"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { bff, errorMessage } from "@/lib/forum/bff";
import { estimateRoute, type LatLng } from "@/lib/forum/geo";
import { N } from "@/lib/forum/nearby-strings";
import { S } from "@/lib/forum/strings";
import { Z } from "@/lib/forum/space-strings";
import { btn, btnPrimary, fieldIcon, panel, textarea } from "@/lib/forum/ui";
import { ArrowLeftIcon, CalendarIcon, CarIcon, CashIcon, CheckIcon, FlagIcon, IconCircle, PinIcon, SearchIcon, SeatIcon } from "./icons";
import { PointPicker } from "./point-picker";
import { TripInsights } from "./trip-insights";

type ErrorKey = "departure" | "destination" | "when" | "price" | "points";
type Errors = Partial<Record<ErrorKey, string>>;

const WINDOWS = [30, 60, 90, 120];
const MAX_SEATS = 4;

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      {children}
      {error && <p id={`${id}-err`} role="alert" className="text-xs text-destructive">{error}</p>}
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

const chip = (on: boolean) =>
  `inline-flex h-9 items-center justify-center rounded-full border px-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
    on ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-accent"
  }`;

/**
 * « Je cherche un covoiturage » : même présentation que la publication d'un covoiturage (départ, destination,
 * date, places, prix, carte), mais le résultat est une recherche surveillée, pas une annonce.
 */
export function SearchRideForm() {
  const router = useRouter();
  const root = usePathname().replace(/\/[^/]+\/?$/, "") || "/"; // /dashboard/forum/search -> /dashboard/forum

  const [departure, setDeparture] = useState("");
  const [destination, setDestination] = useState("");
  const [fromPt, setFromPt] = useState<LatLng | null>(null);
  const [toPt, setToPt] = useState<LatLng | null>(null);
  const [when, setWhen] = useState("");
  const [windowMin, setWindowMin] = useState(60);
  const [seats, setSeats] = useState(1);
  const [maxPrice, setMaxPrice] = useState("");
  const [anyPrice, setAnyPrice] = useState(true);
  const [note, setNote] = useState("");

  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const route = useMemo(() => (fromPt && toPt ? estimateRoute(fromPt, toPt) : null), [fromPt, toPt]);
  const inv = (k: ErrorKey) => ({ "aria-invalid": errors[k] ? (true as const) : undefined, "aria-describedby": errors[k] ? `${k}-err` : undefined });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const errs: Errors = {};
    if (!departure.trim()) errs.departure = S.required;
    if (!destination.trim()) errs.destination = S.required;
    if (!when) errs.when = S.required;
    else if (new Date(when).getTime() + windowMin * 60000 < Date.now()) errs.when = Z.pastDate;
    if (!anyPrice && (maxPrice === "" || Number.isNaN(Number(maxPrice)) || Number(maxPrice) < 0)) errs.price = S.priceInvalid;
    if (!fromPt || !toPt) errs.points = Z.pickBoth;
    setErrors(errs);
    if (Object.keys(errs).length || !fromPt || !toPt) return;

    setBusy(true);
    setError("");
    try {
      await bff("/posts/searches", {
        method: "POST",
        json: {
          departure: departure.trim(),
          destination: destination.trim(),
          departureCoords: fromPt,
          destinationCoords: toPt,
          when: new Date(when).toISOString(),
          windowMin,
          seats,
          maxPrice: anyPrice ? undefined : Number(maxPrice),
          note: note.trim() || undefined,
        },
      });
      router.push(`${root}/my#searches`);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mx-auto max-w-2xl space-y-5">
      <Link href={root} className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
        <IconCircle tone="primary" size="sm"><ArrowLeftIcon /></IconCircle>
        {S.back}
      </Link>

      <header className="flex flex-col items-center text-center">
        <IconCircle tone="brand" size="lg" className="size-14 ring-4 ring-primary/15 [&>svg]:size-7"><SearchIcon /></IconCircle>
        <h1 className="mt-3 text-2xl font-semibold">{Z.searchPageTitle}</h1>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{Z.searchPageSubtitle}</p>
      </header>

      <section className={`${panel} space-y-4 p-5 shadow-sm`}>
        <h2 className="flex items-center gap-3 text-base font-semibold">
          <IconCircle tone="primary"><CarIcon /></IconCircle>
          {Z.searchDetails}
        </h2>

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

        <Field id="when" label={Z.when} error={errors.when}>
          <WithIcon icon={<CalendarIcon />}>
            <input id="when" type="datetime-local" className={`${fieldIcon} w-full`} value={when} onChange={(e) => setWhen(e.target.value)} {...inv("when")} />
          </WithIcon>
        </Field>

        <div className="space-y-2">
          <p id="win-label" className="text-sm font-medium">{Z.flexibility}</p>
          <div role="radiogroup" aria-labelledby="win-label" className="flex flex-wrap gap-2">
            {WINDOWS.map((m) => (
              <button key={m} type="button" role="radio" aria-checked={m === windowMin} onClick={() => setWindowMin(m)} className={chip(m === windowMin)}>{Z.flex(m)}</button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p id="seats-label" className="text-sm font-medium">{Z.seatsNeeded}</p>
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
          <Field id="price" label={Z.maxPriceLabel} error={errors.price}>
            <WithIcon icon={<CashIcon />}>
              <input id="price" type="number" min={0} step="0.5" inputMode="decimal" className={`${fieldIcon} w-full disabled:opacity-50`} value={anyPrice ? "" : maxPrice} disabled={anyPrice} onChange={(e) => setMaxPrice(e.target.value)} {...inv("price")} />
            </WithIcon>
          </Field>
          <button
            type="button"
            aria-pressed={anyPrice}
            onClick={() => setAnyPrice((v) => !v)}
            className={`inline-flex h-11 items-center gap-2 rounded-full border py-1 pl-1.5 pr-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              anyPrice ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-accent"
            }`}
          >
            <span aria-hidden className={`flex size-8 items-center justify-center rounded-full [&>svg]:size-4 ${anyPrice ? "bg-primary-foreground/20" : "bg-accent text-accent-foreground"}`}><CheckIcon /></span>
            {Z.anyPrice}
          </button>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium">{N.pickTitle}</h3>
          <PointPicker from={fromPt} to={toPt} onFrom={setFromPt} onTo={setToPt} />
          {errors.points && <p role="alert" className="text-xs text-destructive">{errors.points}</p>}
          {route && (
            <TripInsights
              distanceKm={route.distanceKm}
              durationMin={route.durationMin}
              seats={seats}
              departure={when ? new Date(when).toISOString() : undefined}
              price={anyPrice || maxPrice === "" ? undefined : Number(maxPrice)}
              estimated
              onUsePrice={(p) => {
                setAnyPrice(false);
                setMaxPrice(String(p));
              }}
            />
          )}
        </div>
      </section>

      <section className={`${panel} space-y-4 p-5 shadow-sm`}>
        <Field id="note" label={Z.note}>
          <textarea id="note" maxLength={300} className={`${textarea} w-full`} placeholder={Z.notePh} value={note} onChange={(e) => setNote(e.target.value)} />
          <p className="text-right text-xs text-muted-foreground" aria-hidden>{note.length}/300</p>
        </Field>
      </section>

      {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{error}</p>}

      <div className="flex flex-col-reverse gap-3 pb-24 sm:flex-row sm:justify-end">
        <Link href={root} className={btn}>{S.cancel}</Link>
        <button type="submit" disabled={busy} className={btnPrimary}>
          <SearchIcon className="size-[18px]" />
          {busy ? Z.submitting : Z.submitSearch}
        </button>
      </div>
    </form>
  );
}
