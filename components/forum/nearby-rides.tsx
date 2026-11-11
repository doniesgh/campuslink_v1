"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { bff, errorMessage } from "@/lib/forum/bff";
import { authorName, fmtDate } from "@/lib/forum/format";
import type { Place } from "@/lib/forum/geo";
import { N } from "@/lib/forum/nearby-strings";
import { S } from "@/lib/forum/strings";
import type { NearbyRide } from "@/lib/forum/types";
import { btn, btnSm, panel } from "@/lib/forum/ui";
import { ArrowLeftIcon, CalendarIcon, CarIcon, CashIcon, IconCircle, PinIcon, SeatIcon } from "./icons";
import { NearbyMap, type MapRide } from "./nearby-map";
import { PlaceInput } from "./place-input";

const TUNIS: Place = { label: "Tunis", lat: 36.8065, lng: 10.1815 }; // point de départ par défaut
const RADII = [5, 10, 20, 50, 100];
const SEATS = [1, 2, 3, 4];

const chip = (on: boolean) =>
  `inline-flex h-9 items-center justify-center rounded-full border px-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
    on ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-accent"
  }`;

/** Page « Rides near me » : on choisit un point + un rayon, le backend (MongoDB $geoNear) renvoie les trajets triés par distance. */
export function NearbyRides() {
  const listPath = usePathname().replace(/\/[^/]+\/?$/, "");
  const [center, setCenter] = useState<Place>(TUNIS);
  const [text, setText] = useState(TUNIS.label);
  const [picked, setPicked] = useState<Place | null>(TUNIS);
  const [radius, setRadius] = useState(20);
  const [seats, setSeats] = useState(1);
  const [rides, setRides] = useState<NearbyRide[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState("");
  const req = useRef(0);

  useEffect(() => {
    const id = ++req.current;
    setState("loading");
    const t = setTimeout(async () => {
      try {
        const qs = new URLSearchParams({ lat: String(center.lat), lng: String(center.lng), radiusKm: String(radius), seats: String(seats) });
        const r = await bff<NearbyRide[] | { posts: NearbyRide[] }>(`/posts/nearby?${qs}`);
        if (id !== req.current) return; // réponse d'une recherche déjà remplacée
        setRides(Array.isArray(r) ? r : (r.posts ?? []));
        setSelected(null);
        setError("");
        setState("ready");
      } catch (e) {
        if (id !== req.current) return;
        setError(errorMessage(e));
        setState("error");
      }
    }, 350);
    return () => clearTimeout(t);
  }, [center.lat, center.lng, radius, seats]);

  function locate() {
    if (!navigator.geolocation) {
      setGeoError(N.geoUnsupported);
      return;
    }
    setLocating(true);
    setGeoError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p: Place = { label: N.myLocation, lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCenter(p);
        setPicked(p);
        setText(p.label);
        setLocating(false);
      },
      () => {
        setGeoError(N.geoDenied);
        setLocating(false);
      },
      { timeout: 10000 },
    );
  }

  const mapRides: MapRide[] = rides.flatMap((r) => {
    const c = r.covoiturage?.departureCoords;
    return c ? [{ id: r._id, lat: c.lat, lng: c.lng, label: `${r.covoiturage?.departure ?? ""} → ${r.covoiturage?.destination ?? ""}` }] : [];
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href={listPath} className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
        <IconCircle tone="primary" size="sm"><ArrowLeftIcon /></IconCircle>
        {S.back}
      </Link>

      <header className="flex flex-col items-center text-center">
        <IconCircle tone="brand" size="lg" className="size-14 ring-4 ring-primary/15 [&>svg]:size-7"><CarIcon /></IconCircle>
        <h1 className="mt-3 text-2xl font-semibold">{N.nearbyTitle}</h1>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{N.nearbySubtitle}</p>
      </header>

      <section className={`${panel} space-y-4 p-5 shadow-sm`}>
        <div className="space-y-1.5">
          <label htmlFor="nearby-place" className="text-sm font-medium">{N.startingPoint}</label>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <PlaceInput
              id="nearby-place"
              value={text}
              place={picked}
              icon={<PinIcon />}
              onText={setText}
              onPlace={(p) => {
                setPicked(p);
                if (p) setCenter(p);
              }}
            />
            <button type="button" onClick={locate} disabled={locating} className={`${btn} h-11`}>
              <PinIcon className="size-4" />
              {locating ? N.locating : N.useMyLocation}
            </button>
          </div>
          {geoError && <p role="alert" className="text-xs text-destructive">{geoError}</p>}
        </div>

        <div className="space-y-2">
          <p id="radius-label" className="text-sm font-medium">{N.radius}</p>
          <div role="radiogroup" aria-labelledby="radius-label" className="flex flex-wrap gap-2">
            {RADII.map((km) => (
              <button key={km} type="button" role="radio" aria-checked={km === radius} onClick={() => setRadius(km)} className={chip(km === radius)}>{N.km(km)}</button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p id="seats-need-label" className="text-sm font-medium">{N.minSeats}</p>
          <div role="radiogroup" aria-labelledby="seats-need-label" className="flex flex-wrap gap-2">
            {SEATS.map((n) => (
              <button key={n} type="button" role="radio" aria-checked={n === seats} onClick={() => setSeats(n)} className={chip(n === seats)}>{n}+</button>
            ))}
          </div>
        </div>
      </section>

      <NearbyMap center={center} radiusKm={radius} rides={mapRides} selectedId={selected} onSelect={setSelected} />

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {state === "loading" ? N.searching : state === "ready" ? N.found(rides.length) : ""}
      </p>

      {state === "error" && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      {state === "ready" && rides.length === 0 && <div className={`${panel} p-6 text-center text-sm text-muted-foreground`}>{N.noRides(radius)}</div>}

      <ul className="space-y-3">
        {rides.map((r) => {
          const c = r.covoiturage;
          const on = r._id === selected;
          return (
            <li key={r._id}>
              <div className={`${panel} space-y-3 p-4 shadow-sm transition-shadow ${on ? "ring-2 ring-primary" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <button type="button" onClick={() => setSelected(r._id)} className="min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <p className="truncate text-sm font-semibold">{c?.departure} → {c?.destination}</p>
                    <p className="truncate text-xs text-muted-foreground">{r.title} · {authorName(r)}</p>
                  </button>
                  <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">{N.away(r.awayKm)}</span>
                </div>
                <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {c?.departureDate && <li className="flex items-center gap-1.5"><CalendarIcon className="size-4" />{fmtDate(c.departureDate, true)}</li>}
                  {c?.seats !== undefined && <li className="flex items-center gap-1.5"><SeatIcon className="size-4" />{S.seats(c.seats)}</li>}
                  <li className="flex items-center gap-1.5"><CashIcon className="size-4" />{c?.price ? `${c.price} DT` : S.free}</li>
                </ul>
                <Link href={`${listPath}/${r._id}`} className={btnSm}>{N.viewRide}</Link>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
