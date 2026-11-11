"use client";

import { useEffect, useState } from "react";
import { fetchRoute } from "@/lib/forum/geo";
import type { CarpoolInfo } from "@/lib/forum/types";
import { RouteMap } from "./route-map";
import { TripInsights } from "./trip-insights";

/** Carte du trajet + chiffres clés, affichés sur la page d'un post de covoiturage. */
export function TripPanel({ trip }: { trip?: CarpoolInfo }) {
  const from = trip?.departureCoords;
  const to = trip?.destinationCoords;
  const [line, setLine] = useState<[number, number][] | undefined>();

  useEffect(() => {
    if (!from || !to) return;
    const ctrl = new AbortController();
    fetchRoute(from, to, ctrl.signal)
      .then((r) => setLine(r.coords))
      .catch(() => {}); // sans tracé, la carte dessine une ligne droite en pointillés
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from?.lat, from?.lng, to?.lat, to?.lng]);

  if (!trip || !from || !to) return null;
  return (
    <div className="space-y-3 px-4 pt-4">
      <RouteMap from={from} to={to} line={line} />
      {trip.distanceKm && trip.durationMin ? (
        <TripInsights distanceKm={trip.distanceKm} durationMin={trip.durationMin} seats={trip.seats ?? 1} departure={trip.departureDate} price={trip.price} />
      ) : null}
    </div>
  );
}
