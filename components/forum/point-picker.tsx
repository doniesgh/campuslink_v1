"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import type { LatLng } from "@/lib/forum/geo";
import { N } from "@/lib/forum/nearby-strings";
import { btnSm } from "@/lib/forum/ui";

type Leaflet = typeof import("leaflet");

const svg = (d: string) =>
  `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const PIN = svg('<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z"/><circle cx="12" cy="10" r="2.4"/>');
const FLAG = svg('<path d="M5.5 21V4M5.5 4.5h12l-2.5 4 2.5 4h-12"/>');
const dot = (icon: string, cls: string) => `<span class="flex size-9 items-center justify-center rounded-full ${cls} shadow-lg ring-2 ring-background">${icon}</span>`;

interface Props {
  from: LatLng | null;
  to: LatLng | null;
  onFrom: (p: LatLng | null) => void;
  onTo: (p: LatLng | null) => void;
}

/** Carte où l'on clique pour placer le départ, puis l'arrivée. Les repères se déplacent en les faisant glisser. */
export function PointPicker({ from, to, onFrom, onTo }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const lib = useRef<Leaflet | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const fitted = useRef(false);
  const [ready, setReady] = useState(false);

  // Dernières valeurs, lues par le clic sur la carte (évite un gestionnaire périmé)
  const live = useRef({ from, to, onFrom, onTo });
  live.current = { from, to, onFrom, onTo };

  useEffect(() => {
    let off = false;
    (async () => {
      const mod = await import("leaflet"); // Leaflet a besoin de window
      const L = ((mod as unknown as { default?: Leaflet }).default ?? mod) as Leaflet;
      if (off || !el.current) return;
      const start = live.current.from;
      const map = L.map(el.current, { scrollWheelZoom: false }).setView(start ? [start.lat, start.lng] : [36.8065, 10.1815], start ? 12 : 10);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap contributors" }).addTo(map);
      layer.current = L.layerGroup().addTo(map);
      map.on("click", (e) => {
        const p = { lat: e.latlng.lat, lng: e.latlng.lng };
        const c = live.current;
        if (!c.from) c.onFrom(p);
        else if (!c.to) c.onTo(p);
      });
      mapRef.current = map;
      lib.current = L;
      setReady(true);
    })();
    return () => {
      off = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layer.current = null;
      lib.current = null;
      fitted.current = false;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const L = lib.current;
    const map = mapRef.current;
    const group = layer.current;
    if (!ready || !L || !map || !group) return;
    group.clearLayers();

    const mk = (p: LatLng, icon: string, cls: string, set: (p: LatLng) => void) =>
      L.marker([p.lat, p.lng], { icon: L.divIcon({ className: "", html: dot(icon, cls), iconSize: [36, 36], iconAnchor: [18, 18] }), draggable: true, keyboard: false })
        .on("dragend", (e) => {
          const ll = (e.target as import("leaflet").Marker).getLatLng();
          set({ lat: ll.lat, lng: ll.lng });
        })
        .addTo(group);

    if (from) mk(from, PIN, "bg-primary text-primary-foreground", onFrom);
    if (to) mk(to, FLAG, "bg-brand text-brand-foreground", onTo);
    if (from && to) {
      L.polyline([[from.lat, from.lng], [to.lat, to.lng]], { weight: 4, opacity: 0.8, dashArray: "8 8", interactive: false }).addTo(group);
      if (!fitted.current) {
        fitted.current = true;
        map.fitBounds(L.latLngBounds([[from.lat, from.lng], [to.lat, to.lng]]), { padding: [50, 50] });
      }
    } else {
      fitted.current = false;
    }
  }, [ready, from, to, onFrom, onTo]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground" aria-live="polite">{!from ? N.pickA : !to ? N.pickB : N.pickDone}</p>
        {(from || to) && (
          <button type="button" className={btnSm} onClick={() => { onFrom(null); onTo(null); }}>{N.pickReset}</button>
        )}
      </div>
      <div ref={el} role="region" aria-label={N.pickTitle} className="isolate h-72 w-full overflow-hidden rounded-2xl border border-border bg-muted" />
    </div>
  );
}
