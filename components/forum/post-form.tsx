"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { errorMessage } from "@/lib/forum/bff";
import { initials } from "@/lib/forum/format";
import { estimateRoute, fetchRoute, type Place, type RouteInfo } from "@/lib/forum/geo";
import { mutate } from "@/lib/forum/offline";
import { S } from "@/lib/forum/strings";
import { TYPES, type LostKind, type Post, type PostType } from "@/lib/forum/types";
import { btn, btnGhost, btnPrimary, field, fieldIcon, fieldLabel, panel, textarea } from "@/lib/forum/ui";
import { TYPE_ICONS } from "./badges";
import { useForum } from "./forum-provider";
import { ArrowLeftIcon, BoxIcon, CalendarIcon, CarIcon, CashIcon, CheckCircleIcon, CheckIcon, ClockIcon, CloseIcon, EditIcon, EyeIcon, FlagIcon, HashIcon, LockIcon, PinIcon, SearchIcon, SeatIcon, SendIcon } from "./icons";
import { PlaceInput } from "./place-input";
import { PostPreview } from "./post-preview";
import { PREFS } from "./prefs";
import { RouteMap } from "./route-map";
import { TripInsights } from "./trip-insights";

type ErrorKey = "title" | "description" | "departure" | "destination" | "departureDate" | "price" | "category" | "place";
type Errors = Partial<Record<ErrorKey, string>>;

const MAX_SEATS = 6;
const MAX_TAGS = 5;
const DRAFT_KEY = "campuslink:forum:draft";

interface Draft {
  type: PostType;
  title: string;
  description: string;
  location: string;
  tags: string[];
  departure: string;
  destination: string;
  depPlace: Place | null;
  destPlace: Place | null;
  departureDate: string;
  seats: number;
  price: string;
  free: boolean;
  kind: LostKind;
  category: string;
  place: string;
  lostDate: string;
  prefs: string[];
  flexibleStops: boolean;
}

/** ISO -> valeur d'un <input type="datetime-local"> en heure locale. */
function toLocalInput(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function Field({ id, label, icon, hint, error, children }: { id: string; label: string; icon?: ReactNode; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className={fieldLabel}>{icon}{label}</label>
        {hint && <span className="text-[11px] font-medium text-slate-500">{hint}</span>}
      </div>
      {children}
      {error && <p id={`${id}-err`} role="alert" className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function WithIcon({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="relative">
      <span aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 [&>svg]:size-[18px]">{icon}</span>
      {children}
    </div>
  );
}

function SectionHeader({ icon, title, subtitle, aside }: { icon: ReactNode; title: string; subtitle: string; aside?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#dce9ff] text-blue-900 [&>svg]:size-5">{icon}</span>
        <div>
          <h2 className="text-lg font-semibold leading-6 tracking-tight text-slate-900">{title}</h2>
          <p className="text-[13px] leading-[18px] text-slate-500">{subtitle}</p>
        </div>
      </div>
      {aside}
    </div>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${checked ? "bg-blue-600" : "bg-slate-300"}`}
    >
      <span className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : ""}`} />
    </button>
  );
}
interface PostFormProps {
  initial?: Post;
  defaultType?: PostType;
}

export function PostForm({
  initial,
  defaultType,
}: PostFormProps) {
  const router = useRouter();
  const { userId, userName } = useForum();
  // /forum/new -> /forum ; /forum/ID/edit -> /forum (retour vers /forum/ID après modification)
  const parts = usePathname().replace(/\/$/, "").split("/");
  const root = parts.slice(0, initial ? -2 : -1).join("/") || "/";
  const backHref = initial ? `${root}/${initial._id}` : root;

  const [type, setType] = useState<PostType>(initial?.type ?? "covoiturage");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  // Covoiturage
  const [departure, setDeparture] = useState(initial?.covoiturage?.departure ?? "");
  const [destination, setDestination] = useState(initial?.covoiturage?.destination ?? "");
  const [departureDate, setDepartureDate] = useState(toLocalInput(initial?.covoiturage?.departureDate));
  const [seats, setSeats] = useState(Math.min(MAX_SEATS, initial?.covoiturage?.seats ?? 3));
  const startPlace = (label: string | undefined, c?: { lat: number; lng: number }): Place | null => (c ? { label: label ?? "", lat: c.lat, lng: c.lng } : null);
  const [depPlace, setDepPlace] = useState<Place | null>(startPlace(initial?.covoiturage?.departure, initial?.covoiturage?.departureCoords));
  const [destPlace, setDestPlace] = useState<Place | null>(startPlace(initial?.covoiturage?.destination, initial?.covoiturage?.destinationCoords));
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [price, setPrice] = useState(initial?.covoiturage?.price ? String(initial.covoiturage.price) : "");
  const [free, setFree] = useState(initial?.covoiturage?.price === 0);
  const [prefs, setPrefs] = useState<string[]>(initial?.covoiturage?.preferences ?? []);
  const [flexibleStops, setFlexibleStops] = useState(!!initial?.covoiturage?.flexibleStops);
  // Objet perdu / trouvé
  const [kind, setKind] = useState<LostKind>(initial?.objetPerdu?.kind ?? "perdu");
  const [category, setCategory] = useState(initial?.objetPerdu?.category ?? "");
  const [place, setPlace] = useState(initial?.objetPerdu?.place ?? "");
  const [lostDate, setLostDate] = useState(initial?.objetPerdu?.date?.slice(0, 10) ?? "");

  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const done = useRef(false);
  const closePreview = useCallback(() => setPreview(false), []);

  const inv = (k: ErrorKey) => ({ "aria-invalid": errors[k] ? (true as const) : undefined, "aria-describedby": errors[k] ? `${k}-err` : undefined });

  /* ---------- Brouillon automatique (création uniquement) ---------- */
  useEffect(() => {
    if (initial) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as Partial<Draft>;
      if (d.type && TYPES.includes(d.type)) setType(d.type);
      setTitle(d.title ?? "");
      setDescription(d.description ?? "");
      setLocation(d.location ?? "");
      setTags(d.tags ?? []);
      setDeparture(d.departure ?? "");
      setDestination(d.destination ?? "");
      setDepPlace(d.depPlace ?? null);
      setDestPlace(d.destPlace ?? null);
      setDepartureDate(d.departureDate ?? "");
      setSeats(Math.min(MAX_SEATS, Math.max(1, d.seats ?? 3)));
      setPrice(d.price ?? "");
      setFree(!!d.free);
      setKind(d.kind === "trouve" ? "trouve" : "perdu");
      setCategory(d.category ?? "");
      setPlace(d.place ?? "");
      setLostDate(d.lostDate ?? "");
      setPrefs(d.prefs ?? []);
      setFlexibleStops(!!d.flexibleStops);
    } catch {
      /* brouillon illisible : on repart de zéro */
    }
  }, [initial]);

  useEffect(() => {
    if (initial) return;
    const t = setTimeout(() => {
      if (done.current) return;
      try {
        if (!(title || description || departure || destination || category || place || tags.length)) {
          localStorage.removeItem(DRAFT_KEY);
          setSavedAt(null);
          return;
        }
        const draft: Draft = { type, title, description, location, tags, departure, destination, depPlace, destPlace, departureDate, seats, price, free, kind, category, place, lostDate, prefs, flexibleStops };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      } catch {
        /* stockage indisponible */
      }
    }, 800);
    return () => clearTimeout(t);
  }, [initial, type, title, description, location, tags, departure, destination, depPlace, destPlace, departureDate, seats, price, free, kind, category, place, lostDate, prefs, flexibleStops]);

  /* ---------- Itinéraire dès que les deux lieux sont choisis ---------- */
  useEffect(() => {
    if (type !== "covoiturage" || !depPlace || !destPlace) {
      setRoute(null);
      return;
    }
    const ctrl = new AbortController();
    setRouteLoading(true);
    fetchRoute(depPlace, destPlace, ctrl.signal)
      .catch(() => estimateRoute(depPlace, destPlace))
      .then((r) => {
        if (!ctrl.signal.aborted) setRoute(r);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setRouteLoading(false);
      });
    return () => ctrl.abort();
  }, [type, depPlace, destPlace]);

  function addTag(raw: string) {
    const t = raw.trim().replace(/^#/, "").toLowerCase();
    if (t && !tags.includes(t) && tags.length < MAX_TAGS) setTags([...tags, t]);
    setTagInput("");
  }

  function onTagKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === "Backspace" && !tagInput) {
      setTags(tags.slice(0, -1));
    }
  }

  const togglePref = (id: string) => setPrefs((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  /** Tags proposés à partir de ce que l'utilisateur a déjà saisi. */
  function suggestTags(): string[] {
    const first = (s: string) => slug(s.split(",")[0] ?? "");
    const out: string[] = [];
    if (type === "covoiturage") {
      if (destination) out.push(first(destination));
      const h = departureDate ? new Date(departureDate).getHours() : NaN;
      if (!Number.isNaN(h)) out.push(h < 12 ? "morning" : h < 18 ? "afternoon" : "evening");
      out.push("carpool");
    } else if (type === "objet_perdu") {
      if (category) out.push(slug(category));
      if (place) out.push(first(place));
      out.push(kind === "perdu" ? "lost" : "found");
    } else {
      out.push("campus");
    }
    return out.filter((t, i, a) => t && a.indexOf(t) === i && !tags.includes(t)).slice(0, 4);
  }

  function buildPreview(): Post {
    return {
      _id: "preview",
      author: { _id: userId ?? "me", firstname: userName ?? S.you, lastname: "" } as unknown as Post["author"],
      type,
      title: title.trim() || S.titlePh,
      description: description.trim() || S.descriptionPh,
      tags,
      location: location.trim() || undefined,
      ...(type === "covoiturage"
        ? {
          covoiturage: {
            departure: departure.trim(),
            destination: destination.trim(),
            departureDate: departureDate ? new Date(departureDate).toISOString() : undefined,
            seats,
            price: free ? 0 : price === "" ? undefined : Number(price),
            distanceKm: route && !route.estimated ? route.distanceKm : undefined,
            durationMin: route && !route.estimated ? route.durationMin : undefined,
            preferences: prefs,
            flexibleStops,
          },
        }
        : {}),
      ...(type === "objet_perdu" ? { objetPerdu: { kind, category: category.trim(), place: place.trim(), date: lostDate || undefined } } : {}),
      status: "active",
      likesCount: 0,
      commentsCount: 0,
      views: 0,
      createdAt: new Date().toISOString(),
    };
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const errs: Errors = {};
    if (!title.trim()) errs.title = S.required;
    if (!description.trim()) errs.description = S.required;
    if (type === "covoiturage") {
      if (!departure.trim()) errs.departure = S.required;
      if (!destination.trim()) errs.destination = S.required;
      if (!departureDate) errs.departureDate = S.required;
      if (!free && (price === "" || Number.isNaN(Number(price)) || Number(price) < 0)) errs.price = S.priceInvalid;
    }
    if (type === "objet_perdu") {
      if (!category.trim()) errs.category = S.required;
      if (!place.trim()) errs.place = S.required;
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;

    // Coordonnées et trajet enregistrés avec le post (le trajet estimé n'est pas gardé).
    const tripExtras = {
      ...(depPlace && destPlace ? { departureCoords: { lat: depPlace.lat, lng: depPlace.lng }, destinationCoords: { lat: destPlace.lat, lng: destPlace.lng } } : {}),
      ...(route && !route.estimated ? { distanceKm: route.distanceKm, durationMin: route.durationMin } : {}),
    };
    const payload = {
      type,
      title: title.trim(),
      description: description.trim(),
      tags,
      location: location.trim() || undefined,
      ...(type === "covoiturage"
        ? { covoiturage: { departure: departure.trim(), destination: destination.trim(), departureDate: new Date(departureDate).toISOString(), seats, price: free ? 0 : Number(price), preferences: prefs, flexibleStops, ...tripExtras } }
        : {}),
      ...(type === "objet_perdu"
        ? { objetPerdu: { kind, category: category.trim(), place: place.trim(), date: lostDate ? new Date(lostDate).toISOString() : undefined } }
        : {}),
    };

    setBusy(true);
    setError("");
    try {
      if (initial) await mutate(`/posts/${initial._id}`, { method: "PUT", json: payload });
      else {
        await mutate("/posts", { method: "POST", json: payload });
        window.dispatchEvent(new Event("forum:synced")); // recharge la liste de mes posts (droit de modifier le nouveau post)
      }
      done.current = true;
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignoré */
      }
      router.push(backHref);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  const suggestions = suggestTags();

  return (
    <form onSubmit={onSubmit} noValidate className="mx-auto flex max-w-3xl flex-col gap-6 pb-6">
      {/* Barre du haut + titre */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <Link href={backHref} className="group inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900">
            <ArrowLeftIcon className="size-[18px] transition-transform group-hover:-translate-x-1" />
            {S.back}
          </Link>
          <span className="inline-flex items-center gap-2 rounded-full bg-[#eff4ff] px-3 py-1 text-[11px] font-semibold text-slate-600">
            <span className="size-2 animate-pulse rounded-full bg-blue-600" />
            {S.communityMode}
          </span>
        </div>
        <header className="flex flex-col items-center text-center">
          <span aria-hidden className="mb-2 flex size-14 items-center justify-center rounded-2xl bg-blue-900 text-white shadow-md shadow-blue-900/20 [&>svg]:size-7">
            {initial ? <EditIcon /> : <SendIcon />}
          </span>
          <h1 className="text-[30px] font-bold leading-[38px] tracking-tight text-slate-900">{initial ? S.editPostTitle : S.newPostTitle}</h1>
          <p className="mt-1 max-w-lg text-sm text-slate-500">{initial ? S.editPostSubtitle : S.newPostSubtitle}</p>
        </header>
      </div>

      {/* Étape 1 : catégorie */}
      {!initial && (
        <section className={`${panel} p-5 sm:p-6`}>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">{S.stepLabel}</span>
              <h2 id="pick-type" className="text-base font-semibold text-slate-900">{S.pickType}</h2>
            </div>
            <span className="rounded-lg bg-[#e5eeff] px-2 py-1 text-[11px] font-semibold text-slate-600">{S.selectionRequired}</span>
          </div>
          <div role="radiogroup" aria-labelledby="pick-type" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {TYPES.map((t) => {
              const Icon = TYPE_ICONS[t];
              const on = type === t;
              return (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setType(t)}
                  className={`group relative flex h-40 flex-col justify-between overflow-hidden rounded-xl border p-4 text-left shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${on ? "border-blue-900 bg-[#eff4ff]" : "border-slate-200 bg-white hover:border-blue-300 hover:bg-[#eff4ff]"
                    }`}
                >
                  <div className="flex w-full items-start justify-between">
                    <span aria-hidden className={`flex size-11 items-center justify-center rounded-xl shadow-sm transition-colors [&>svg]:size-[22px] ${on ? "bg-blue-900 text-white" : "bg-[#e5eeff] text-slate-600 group-hover:bg-[#dce1ff] group-hover:text-blue-900"}`}>
                      <Icon />
                    </span>
                    {on && <CheckCircleIcon className="size-5 text-blue-600" />}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold leading-6 tracking-tight text-slate-900">{S.type[t]}</h3>
                    <p className="mt-0.5 text-[13px] leading-[18px] text-slate-500">{S.typeHint[t]}</p>
                  </div>
                  <span aria-hidden className={`absolute inset-x-0 bottom-0 h-1 ${on ? "bg-blue-600" : "bg-transparent"}`} />
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Détails du trajet */}
      {type === "covoiturage" && (
        <section className={`${panel} flex flex-col gap-5 p-5 sm:p-6`}>
          <SectionHeader
            icon={<CarIcon />}
            title={S.tripDetails}
            subtitle={S.tripSubtitle}
            aside={<span className="hidden rounded-full bg-[#dce1ff] px-2.5 py-1 text-[11px] font-semibold text-blue-900 sm:inline-flex">{S.campusRoute}</span>}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <Field id="departure" label={S.departure} icon={<PinIcon />} error={errors.departure}>
              <PlaceInput id="departure" icon={<PinIcon />} value={departure} place={depPlace} onText={setDeparture} onPlace={setDepPlace} {...inv("departure")} />
            </Field>
            <Field id="destination" label={S.destination} icon={<FlagIcon />} error={errors.destination}>
              <PlaceInput id="destination" icon={<FlagIcon />} value={destination} place={destPlace} onText={setDestination} onPlace={setDestPlace} {...inv("destination")} />
            </Field>
          </div>

          {routeLoading && !route && <div className="h-64 animate-pulse rounded-xl bg-[#e5eeff]" aria-busy="true" />}
          {depPlace && destPlace && route && (
            <div className="space-y-3">
              <RouteMap from={depPlace} to={destPlace} line={route.coords} estimated={route.estimated} />
              <TripInsights
                distanceKm={route.distanceKm}
                durationMin={route.durationMin}
                seats={seats}
                departure={departureDate || undefined}
                price={free ? 0 : price === "" ? undefined : Number(price)}
                estimated={route.estimated}
                onUsePrice={(n) => {
                  setFree(false);
                  setPrice(String(n));
                }}
              />
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <Field id="departureDate" label={S.departureDate} icon={<CalendarIcon />} error={errors.departureDate}>
              <WithIcon icon={<ClockIcon />}>
                <input id="departureDate" type="datetime-local" className={`${fieldIcon} w-full`} value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} {...inv("departureDate")} />
              </WithIcon>
            </Field>
            <div className="flex h-11 items-center justify-between gap-4 rounded-lg bg-[#eff4ff] px-3.5 shadow-sm md:min-w-64">
              <div>
                <p className="text-xs font-semibold leading-4 text-slate-900">{S.flexibleStops}</p>
                <p className="text-[11px] leading-[14px] text-slate-500">{S.flexibleStopsHint}</p>
              </div>
              <Switch checked={flexibleStops} onChange={setFlexibleStops} label={S.flexibleStops} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <p id="seats-label" className={fieldLabel}><SeatIcon />{S.seatsLabel}</p>
                <span aria-live="polite" className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-semibold text-blue-600">{S.seatsSelected(seats)}</span>
              </div>
              <div role="radiogroup" aria-labelledby="seats-label" className="flex items-center gap-2 rounded-xl bg-[#eff4ff] p-2.5">
                {Array.from({ length: MAX_SEATS }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={n === seats}
                    aria-label={S.seats(n)}
                    onClick={() => setSeats(n)}
                    className={`flex size-9 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${n <= seats ? "bg-blue-900 text-white shadow-sm" : "border-[1.5px] border-slate-300 bg-white text-slate-500 hover:border-blue-300"
                      }`}
                  >
                    <SeatIcon className="size-[18px]" />
                  </button>
                ))}
                <span className="ml-auto hidden pr-1 text-[11px] text-slate-500 sm:inline">{S.maxCapacity(MAX_SEATS)}</span>
              </div>
            </div>

            <Field id="price" label={S.price} icon={<CashIcon />} error={errors.price}>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <div className="relative">
                  <input id="price" type="number" min={0} step="0.5" inputMode="decimal" className={`${field} w-full pr-14 disabled:opacity-50`} value={free ? "" : price} disabled={free} onChange={(e) => setPrice(e.target.value)} {...inv("price")} />
                  <span aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500">{S.currency}</span>
                </div>
                <button
                  type="button"
                  aria-pressed={free}
                  onClick={() => setFree((v) => !v)}
                  className={`inline-flex h-11 items-center gap-2 rounded-lg border px-3.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${free ? "border-blue-900 bg-blue-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                >
                  <CheckIcon className="size-4" />
                  {S.freeRide}
                </button>
              </div>
            </Field>
          </div>
        </section>
      )}

      {type === "objet_perdu" && (
        <section className={`${panel} flex flex-col gap-5 p-5 sm:p-6`}>
          <SectionHeader
            icon={<BoxIcon />}
            title={S.itemDetails}
            subtitle={S.itemSubtitle}
            aside={<span className="hidden rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-600 sm:inline-flex">{S.lostAndFound}</span>}
          />
          <div className="flex flex-col gap-1.5">
            <p id="kind-label" className={fieldLabel}>{S.lostOrFound}</p>
            <div role="radiogroup" aria-labelledby="kind-label" className="grid grid-cols-2 gap-3">
              {([["perdu", S.lost, <SearchIcon key="p" className="size-4" />], ["trouve", S.found, <CheckIcon key="t" className="size-4" />]] as [LostKind, string, ReactNode][]).map(([k, text, icon]) => {
                const on = kind === k;
                return (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setKind(k)}
                    className={`flex h-11 items-center justify-center gap-2 rounded-lg border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${on ? "border-blue-900 bg-blue-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                  >
                    {icon}
                    {text}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field id="category" label={S.category} icon={<BoxIcon />} error={errors.category}>
              <WithIcon icon={<BoxIcon />}>
                <input id="category" className={`${fieldIcon} w-full`} placeholder={S.categoryPh} value={category} onChange={(e) => setCategory(e.target.value)} {...inv("category")} />
              </WithIcon>
            </Field>
            <Field id="place" label={S.place} icon={<PinIcon />} error={errors.place}>
              <WithIcon icon={<PinIcon />}>
                <input id="place" className={`${fieldIcon} w-full`} placeholder={S.placePh} value={place} onChange={(e) => setPlace(e.target.value)} {...inv("place")} />
              </WithIcon>
            </Field>
          </div>
          <Field id="lostDate" label={S.lostDate} icon={<CalendarIcon />} hint={S.optional}>
            <WithIcon icon={<CalendarIcon />}>
              <input id="lostDate" type="date" className={`${fieldIcon} w-full`} value={lostDate} onChange={(e) => setLostDate(e.target.value)} />
            </WithIcon>
          </Field>
        </section>
      )}

      {/* Votre publication */}
      <section className={`${panel} flex flex-col gap-5 p-5 sm:p-6`}>
        <SectionHeader
          icon={<EditIcon />}
          title={S.content}
          subtitle={S.yourPostSubtitle}
          aside={
            <span className="hidden items-center gap-1.5 text-xs text-slate-500 sm:inline-flex">
              <EyeIcon className="size-4" />
              {S.visibleToAll}
            </span>
          }
        />

        <Field id="title" label={S.fieldTitle} hint={S.shortExplicit} error={errors.title}>
          <input id="title" maxLength={120} className={`${field} w-full`} placeholder={S.titlePh} value={title} onChange={(e) => setTitle(e.target.value)} {...inv("title")} />
        </Field>

        <Field id="description" label={S.fieldDescription} hint={S.freeFormat} error={errors.description}>
          <textarea id="description" maxLength={1500} className={`${textarea} w-full`} placeholder={S.descriptionPh} value={description} onChange={(e) => setDescription(e.target.value)} {...inv("description")} />
          <div className="flex items-center justify-between text-[11px] text-slate-500" aria-hidden>
            <span>{S.descriptionHint}</span>
            <span>{description.length} / 1500</span>
          </div>
        </Field>

        {type === "covoiturage" && (
          <div className="flex flex-col gap-2">
            <p id="prefs-label" className={fieldLabel}>{S.prefsTitle}</p>
            <div role="group" aria-labelledby="prefs-label" className="flex flex-wrap gap-2">
              {PREFS.map(({ id, icon: Icon }) => {
                const on = prefs.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => togglePref(id)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${on ? "bg-blue-900 text-white" : "bg-[#eff4ff] text-slate-700 hover:bg-[#dce9ff]"
                      }`}
                  >
                    <Icon className="size-3.5" />
                    {S.prefs[id]}
                    {on && <CheckIcon className="size-3.5" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {type !== "covoiturage" && (
          <Field id="location" label={S.fieldLocation} icon={<PinIcon />} hint={S.optional}>
            <WithIcon icon={<PinIcon />}>
              <input id="location" className={`${fieldIcon} w-full`} value={location} onChange={(e) => setLocation(e.target.value)} />
            </WithIcon>
          </Field>
        )}

        <Field id="tags" label={S.fieldTags} hint={S.optional}>
          <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-lg bg-[#eff4ff] px-3 py-1.5 shadow-sm transition-all focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-600/30">
            <HashIcon className="size-[18px] shrink-0 text-slate-500" />
            {tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full bg-blue-100 py-0.5 pl-2.5 pr-1 text-xs font-medium text-blue-900">
                #{t}
                <button type="button" aria-label={`${S.removeTag} ${t}`} onClick={() => setTags(tags.filter((x) => x !== t))} className="flex size-5 items-center justify-center rounded-full hover:bg-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
                  <CloseIcon className="size-3" />
                </button>
              </span>
            ))}
            <input
              id="tags"
              className="h-8 min-w-24 flex-1 bg-transparent px-1 text-sm placeholder:text-slate-400 focus:outline-none disabled:opacity-50"
              placeholder={S.tagsPh}
              value={tagInput}
              disabled={tags.length >= MAX_TAGS}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={onTagKey}
              onBlur={() => addTag(tagInput)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <span>{S.tagsHint}</span>
            {suggestions.length > 0 && tags.length < MAX_TAGS && (
              <>
                <span className="font-medium">{S.suggestions}</span>
                {suggestions.map((t) => (
                  <button key={t} type="button" onClick={() => addTag(t)} className="rounded bg-[#e5eeff] px-2 py-0.5 font-medium text-slate-700 hover:bg-[#dce9ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
                    #{t}
                  </button>
                ))}
              </>
            )}
          </div>
        </Field>
      </section>

      {/* Auteur */}
      {userName && (
        <section className={`${panel} flex flex-wrap items-center gap-3 p-4`}>
          <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-900">{initials(userName)}</span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              {userName}
              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-semibold text-blue-600">{S.authorBadge}</span>
            </p>
            <p className="text-xs text-slate-500">{S.verifiedInfo}</p>
          </div>
          <p className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <LockIcon className="size-4" />
            {S.privateContact}
          </p>
        </section>
      )}

      {error && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>}

      {/* Barre d'actions collée en bas */}
      <div className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-[0_10px_15px_-3px_rgba(15,23,42,0.1),0_4px_6px_-4px_rgba(15,23,42,0.08)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="inline-flex items-center gap-2 px-1 text-xs text-slate-500" aria-live="polite">
          {!initial && (
            <>
              <span className="size-2 rounded-full bg-teal-400" />
              {savedAt ? S.draftSaved(savedAt) : S.draftAuto}
            </>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <button type="button" onClick={() => setPreview(true)} className={btn}>
            <EyeIcon className="size-[18px]" />
            {S.preview}
          </button>
          <Link href={backHref} className={btnGhost}>{S.cancel}</Link>
          <button type="submit" disabled={busy} className={btnPrimary}>
            <SendIcon className="size-[18px]" />
            {busy ? (initial ? S.saving : S.publishing) : initial ? S.saveChanges : S.publish}
          </button>
        </div>
      </div>

      {preview && <PostPreview post={buildPreview()} name={userName ?? S.you} onClose={closePreview} />}
    </form>
  );
}
