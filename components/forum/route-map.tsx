"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { LatLng } from "@/lib/forum/geo";
import { S } from "@/lib/forum/strings";

const svg = (d: string) =>
  `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const PIN = svg('<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z"/><circle cx="12" cy="10" r="2.4"/>');
const FLAG = svg('<path d="M5.5 21V4M5.5 4.5h12l-2.5 4 2.5 4h-12"/>');
const marker = (icon: string, cls: string) => `<span class="flex size-9 items-center justify-center rounded-full ${cls} shadow-lg ring-2 ring-white">${icon}</span>`;

interface Props {
  from: LatLng;
  to: LatLng;
  /** Tracé [lat, lng][] ; sans tracé (ou estimé) on dessine une ligne en pointillés. */
  line?: [number, number][];
  estimated?: boolean;
  label?: string;
}

export function RouteMap({ from, to, line, estimated = false, label }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let off = false;
    let map: import("leaflet").Map | undefined;
    (async () => {
      const mod = await import("leaflet"); // chargé à la demande : Leaflet a besoin de window
      const L = (mod as unknown as { default?: typeof mod }).default ?? mod;
      if (off || !ref.current) return;
      map = L.map(ref.current, { scrollWheelZoom: false });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap contributors" }).addTo(map);

      const real = !!line && line.length > 1 && !estimated;
      const pts: [number, number][] = line && line.length > 1 ? line : [[from.lat, from.lng], [to.lat, to.lng]];
      L.polyline(pts, { className: "stroke-blue-600 fill-none", weight: 5, opacity: 0.85, dashArray: real ? undefined : "8 8" }).addTo(map);

      const icon = (html: string) => L.divIcon({ className: "", html, iconSize: [36, 36], iconAnchor: [18, 18] });
      L.marker([from.lat, from.lng], { icon: icon(marker(PIN, "bg-blue-900 text-white")), keyboard: false }).addTo(map);
      L.marker([to.lat, to.lng], { icon: icon(marker(FLAG, "bg-blue-900 text-white")), keyboard: false }).addTo(map);
      map.fitBounds(L.latLngBounds(pts), { padding: [40, 40] });
    })();
    return () => {
      off = true;
      map?.remove();
    };
  }, [from.lat, from.lng, to.lat, to.lng, line, estimated]);

  return <div ref={ref} role="img" aria-label={label ?? S.tripTitle} className="isolate h-64 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100" />;
}
