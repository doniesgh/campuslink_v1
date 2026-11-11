"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { bff, errorMessage } from "@/lib/forum/bff";
import { S } from "@/lib/forum/strings";
import { TYPES, type LostKind, type Post, type PostType } from "@/lib/forum/types";
import { btn, btnPrimary, field, fieldIcon, panel, textarea } from "@/lib/forum/ui";
import { estimateRoute, tripInsights, type LatLng } from "@/lib/forum/geo";
import { N } from "@/lib/forum/nearby-strings";
import { TYPE_ICONS } from "./badges";
import { ImagePicker } from "./image-picker";
import { PointPicker } from "./point-picker";
import { TripInsights } from "./trip-insights";
import { ArrowLeftIcon, BoxIcon, CalendarIcon, CarIcon, CashIcon, CheckIcon, CloseIcon, EditIcon, FlagIcon, IconCircle, PinIcon, SearchIcon, SeatIcon, SendIcon } from "./icons";

type ErrorKey = "title" | "description" | "departure" | "destination" | "departureDate" | "price" | "category" | "place";
type Errors = Partial<Record<ErrorKey, string>>;

/** ISO -> valeur d'un <input type="datetime-local"> en heure locale. */
function toLocalInput(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const MAX_SEATS = 8;
const MAX_TAGS = 5;

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      {children}
      {error ? (
        <p id={`${id}-err`} role="alert" className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function WithIcon({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="relative">
      <span aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground [&>svg]:size-[18px]">{icon}</span>
      {children}
    </div>
  );
}

function SectionTitle({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <h2 className="flex items-center gap-3 text-base font-semibold">
      <IconCircle tone="primary">{icon}</IconCircle>
      {children}
    </h2>
  );
}

export function PostForm({ initial }: { initial?: Post }) {
  const router = useRouter();
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
  const [images, setImages] = useState<string[]>(initial?.images ?? []);
  // Covoiturage
  const [departure, setDeparture] = useState(initial?.covoiturage?.departure ?? "");
  const [destination, setDestination] = useState(initial?.covoiturage?.destination ?? "");
  // Points choisis sur la carte (latitude / longitude) + distance estimée sans service externe
  const [fromPt, setFromPt] = useState<LatLng | null>(initial?.covoiturage?.departureCoords ?? null);
  const [toPt, setToPt] = useState<LatLng | null>(initial?.covoiturage?.destinationCoords ?? null);
  const route = useMemo(() => (fromPt && toPt ? estimateRoute(fromPt, toPt) : null), [fromPt, toPt]);
  const [departureDate, setDepartureDate] = useState(toLocalInput(initial?.covoiturage?.departureDate));
  const [seats, setSeats] = useState(initial?.covoiturage?.seats ?? 3);
  const [price, setPrice] = useState(initial?.covoiturage?.price ? String(initial.covoiturage.price) : "");
  const [free, setFree] = useState(initial?.covoiturage?.price === 0);
  // Prix conseillé (1 DT/km) : rempli automatiquement tant que l'utilisateur n'a pas tapé son propre prix
  const [priceEdited, setPriceEdited] = useState(Boolean(initial));
  const suggestedPrice = route ? tripInsights(route.distanceKm, route.durationMin, 1).pricePerSeat : undefined;
  const shownPrice = !priceEdited && suggestedPrice !== undefined ? String(suggestedPrice) : price;
  // Objet perdu / trouvé
  const [kind, setKind] = useState<LostKind>(initial?.objetPerdu?.kind ?? "perdu");
  const [category, setCategory] = useState(initial?.objetPerdu?.category ?? "");
  const [place, setPlace] = useState(initial?.objetPerdu?.place ?? "");
  const [lostDate, setLostDate] = useState(initial?.objetPerdu?.date?.slice(0, 10) ?? "");

  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const inv = (k: ErrorKey) => ({ "aria-invalid": errors[k] ? (true as const) : undefined, "aria-describedby": errors[k] ? `${k}-err` : undefined });

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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const errs: Errors = {};
    if (!title.trim()) errs.title = S.required;
    if (!description.trim()) errs.description = S.required;
    if (type === "covoiturage") {
      if (!departure.trim()) errs.departure = S.required;
      if (!destination.trim()) errs.destination = S.required;
      if (!departureDate) errs.departureDate = S.required;
      if (!free && (shownPrice === "" || Number.isNaN(Number(shownPrice)) || Number(shownPrice) < 0)) errs.price = S.priceInvalid;
    }
    if (type === "objet_perdu") {
      if (!category.trim()) errs.category = S.required;
      if (!place.trim()) errs.place = S.required;
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const payload = {
      type,
      title: title.trim(),
      description: description.trim(),
      tags,
      images,
      location: location.trim() || undefined,
      ...(type === "covoiturage"
        ? { covoiturage: { departure: departure.trim(), destination: destination.trim(), departureDate: new Date(departureDate).toISOString(), seats, price: free ? 0 : Number(shownPrice),
            ...(fromPt && toPt && route
              ? { departureCoords: { lat: fromPt.lat, lng: fromPt.lng }, destinationCoords: { lat: toPt.lat, lng: toPt.lng }, distanceKm: route.distanceKm, durationMin: route.durationMin }
              : {}) } }
        : {}),
      ...(type === "objet_perdu"
        ? { objetPerdu: { kind, category: category.trim(), place: place.trim(), date: lostDate ? new Date(lostDate).toISOString() : undefined } }
        : {}),
    };

    setBusy(true);
    setError("");
    try {
      if (initial) await bff(`/posts/${initial._id}`, { method: "PUT", json: payload });
      else {
        await bff("/posts", { method: "POST", json: payload });
        window.dispatchEvent(new Event("forum:posted")); // met à jour la liste de mes posts (droit de modifier le nouveau post)
      }
      router.push(backHref);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mx-auto max-w-2xl space-y-5">
      <Link href={backHref} className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
        <IconCircle tone="primary" size="sm"><ArrowLeftIcon /></IconCircle>
        {S.back}
      </Link>

      <header className="flex flex-col items-center text-center">
        <IconCircle tone="brand" size="lg" className="size-14 ring-4 ring-primary/15 [&>svg]:size-7">{initial ? <EditIcon /> : <SendIcon />}</IconCircle>
        <h1 className="mt-3 text-2xl font-semibold">{initial ? S.editPostTitle : S.newPostTitle}</h1>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{initial ? S.editPostSubtitle : S.newPostSubtitle}</p>
      </header>

      {/* 1. Type de post */}
      {!initial && (
      <section className={`${panel} space-y-4 p-5 shadow-sm`}>
        <h2 className="text-base font-semibold" id="pick-type">{S.pickType}</h2>
        <div role="radiogroup" aria-labelledby="pick-type" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
                className={`flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  on ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-input bg-background hover:bg-accent"
                }`}
              >
                <IconCircle tone={on ? "brand" : "soft"} size="lg"><Icon /></IconCircle>
                <span className="text-sm font-semibold">{S.type[t]}</span>
                <span className="text-xs leading-snug text-muted-foreground">{S.typeHint[t]}</span>
              </button>
            );
          })}
        </div>
      </section>
      )}

      {/* 2. Détails selon le type */}
      {type === "covoiturage" && (
        <section className={`${panel} space-y-4 p-5 shadow-sm`}>
          <SectionTitle icon={<CarIcon />}>{S.tripDetails}</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="departure" label={S.departure} error={errors.departure}>
              <WithIcon icon={<PinIcon />}>
                <input id="departure" className={`${fieldIcon} w-full`} value={departure} onChange={(e) => setDeparture(e.target.value)} {...inv("departure")} />
              </WithIcon>
            </Field>
            <Field id="destination" label={S.destination} error={errors.destination}>
              <WithIcon icon={<FlagIcon />}>
                <input id="destination" className={`${fieldIcon} w-full`} value={destination} onChange={(e) => setDestination(e.target.value)} {...inv("destination")} />
              </WithIcon>
            </Field>
          </div>

          <Field id="departureDate" label={S.departureDate} error={errors.departureDate}>
            <WithIcon icon={<CalendarIcon />}>
              <input id="departureDate" type="datetime-local" className={`${fieldIcon} w-full`} value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} {...inv("departureDate")} />
            </WithIcon>
          </Field>

          <div className="space-y-2">
            <p id="seats-label" className="text-sm font-medium">{S.seatsLabel}</p>
            <div role="radiogroup" aria-labelledby="seats-label" className="flex flex-wrap gap-2">
              {Array.from({ length: MAX_SEATS }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={n === seats}
                  aria-label={S.seats(n)}
                  onClick={() => setSeats(n)}
                  className={`flex size-11 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    n <= seats ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background text-muted-foreground hover:bg-accent"
                  }`}
                >
                  <SeatIcon className="size-5" />
                </button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground" aria-live="polite">{S.seats(seats)}</p>
          </div>

          <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto]">
            <Field id="price" label={S.price} error={errors.price}>
              <WithIcon icon={<CashIcon />}>
                <input id="price" type="number" min={0} step="0.5" inputMode="decimal" className={`${fieldIcon} w-full disabled:opacity-50`} value={free ? "" : shownPrice} disabled={free} onChange={(e) => { setPrice(e.target.value); setPriceEdited(true); }} {...inv("price")} />
              </WithIcon>
            </Field>
            <button
              type="button"
              aria-pressed={free}
              onClick={() => setFree((v) => !v)}
              className={`inline-flex h-11 items-center gap-2 rounded-full border py-1 pl-1.5 pr-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                free ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-accent"
              }`}
            >
              <span aria-hidden className={`flex size-8 items-center justify-center rounded-full [&>svg]:size-4 ${free ? "bg-primary-foreground/20" : "bg-accent text-accent-foreground"}`}><CheckIcon /></span>
              {S.freeRide}
            </button>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-medium">{N.pickTitle}</h3>
            <PointPicker from={fromPt} to={toPt} onFrom={setFromPt} onTo={setToPt} />
            {route ? (
              <TripInsights
                distanceKm={route.distanceKm}
                durationMin={route.durationMin}
                seats={seats}
                departure={departureDate ? new Date(departureDate).toISOString() : undefined}
                price={free ? 0 : shownPrice === "" ? undefined : Number(shownPrice)}
                estimated
                onUsePrice={() => {
                  setFree(false);
                  setPriceEdited(false); // revient au prix conseillé
                }}
              />
            ) : (
              <p className="text-xs text-muted-foreground">{N.pickMissing}</p>
            )}
          </div>
        </section>
      )}

      {type === "objet_perdu" && (
        <section className={`${panel} space-y-4 p-5 shadow-sm`}>
          <SectionTitle icon={<BoxIcon />}>{S.itemDetails}</SectionTitle>
          <div className="space-y-2">
            <p id="kind-label" className="text-sm font-medium">{S.lostOrFound}</p>
            <div role="radiogroup" aria-labelledby="kind-label" className="grid grid-cols-2 gap-3">
              {([["perdu", S.lost, <SearchIcon key="p" />], ["trouve", S.found, <CheckIcon key="t" />]] as [LostKind, string, ReactNode][]).map(([k, text, icon]) => {
                const on = kind === k;
                return (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setKind(k)}
                    className={`flex h-12 items-center justify-center gap-2 rounded-full border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      on ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-accent"
                    }`}
                  >
                    <span aria-hidden className={`flex size-8 items-center justify-center rounded-full [&>svg]:size-4 ${on ? "bg-primary-foreground/20" : "bg-accent text-accent-foreground"}`}>{icon}</span>
                    {text}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="category" label={S.category} error={errors.category}>
              <WithIcon icon={<BoxIcon />}>
                <input id="category" className={`${fieldIcon} w-full`} placeholder={S.categoryPh} value={category} onChange={(e) => setCategory(e.target.value)} {...inv("category")} />
              </WithIcon>
            </Field>
            <Field id="place" label={S.place} error={errors.place}>
              <WithIcon icon={<PinIcon />}>
                <input id="place" className={`${fieldIcon} w-full`} placeholder={S.placePh} value={place} onChange={(e) => setPlace(e.target.value)} {...inv("place")} />
              </WithIcon>
            </Field>
          </div>
          <Field id="lostDate" label={`${S.lostDate} (${S.optional.toLowerCase()})`}>
            <WithIcon icon={<CalendarIcon />}>
              <input id="lostDate" type="date" className={`${fieldIcon} w-full`} value={lostDate} onChange={(e) => setLostDate(e.target.value)} />
            </WithIcon>
          </Field>
        </section>
      )}

      {/* 3. Contenu */}
      <section className={`${panel} space-y-4 p-5 shadow-sm`}>
        <SectionTitle icon={<TYPE_ICONS.experience />}>{S.content}</SectionTitle>
        <Field id="title" label={S.fieldTitle} error={errors.title}>
          <input id="title" maxLength={120} className={`${field} w-full`} placeholder={S.titlePh} value={title} onChange={(e) => setTitle(e.target.value)} {...inv("title")} />
        </Field>
        <Field id="description" label={S.fieldDescription} error={errors.description}>
          <textarea id="description" maxLength={1500} className={`${textarea} w-full`} placeholder={S.descriptionPh} value={description} onChange={(e) => setDescription(e.target.value)} {...inv("description")} />
          <p className="text-right text-xs text-muted-foreground" aria-hidden>{description.length}/1500</p>
        </Field>
        {type !== "covoiturage" && (
          <Field id="location" label={`${S.fieldLocation} (${S.optional.toLowerCase()})`}>
            <WithIcon icon={<PinIcon />}>
              <input id="location" className={`${fieldIcon} w-full`} value={location} onChange={(e) => setLocation(e.target.value)} />
            </WithIcon>
          </Field>
        )}
        <ImagePicker value={images} onChange={setImages} />

        <Field id="tags" label={`${S.fieldTags} (${S.optional.toLowerCase()})`} hint={S.tagsHint}>
          <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-xl border border-input bg-background px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring">
            {tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-0.5 pl-2.5 pr-1 text-xs font-medium text-primary">
                #{t}
                <button type="button" aria-label={`${S.removeTag} ${t}`} onClick={() => setTags(tags.filter((x) => x !== t))} className="flex size-5 items-center justify-center rounded-full hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <CloseIcon className="size-3" />
                </button>
              </span>
            ))}
            <input
              id="tags"
              className="h-8 min-w-24 flex-1 bg-transparent px-1.5 text-sm placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
              placeholder={S.tagsPh}
              value={tagInput}
              disabled={tags.length >= MAX_TAGS}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={onTagKey}
              onBlur={() => addTag(tagInput)}
            />
          </div>
        </Field>
      </section>

      {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{error}</p>}

      <div className="flex flex-col-reverse gap-3 pb-24 sm:flex-row sm:justify-end">
        <Link href={backHref} className={btn}>{S.cancel}</Link>
        <button type="submit" disabled={busy} className={btnPrimary}>
          <SendIcon className="size-[18px]" />
          {busy ? (initial ? S.saving : S.publishing) : initial ? S.saveChanges : S.publish}
        </button>
      </div>
    </form>
  );
}