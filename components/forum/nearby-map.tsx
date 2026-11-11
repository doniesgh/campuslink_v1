"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import type { LatLng } from "@/lib/forum/geo";
import { N } from "@/lib/forum/nearby-strings";

type Leaflet = typeof import("leaflet");

export interface MapRide {
  id: string;
  lat: number;
  lng: number;
  label: string;
}

const PIN = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z"/><circle cx="12" cy="10" r="2.4"/></svg>`;
const pin = (on: boolean) =>
  `<span class="flex size-9 items-center justify-center rounded-full ${on ? "bg-brand text-brand-foreground scale-110" : "bg-primary text-primary-foreground"} shadow-lg ring-2 ring-background">${PIN}</span>`;
const ME = `<span class="block size-4 rounded-full bg-foreground ring-4 ring-foreground/25"></span>`;

interface Props {
  center: LatLng;
  radiusKm: number;
  rides: MapRide[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** Carte de la recherche : zone de recherche, position de départ et un marqueur par covoiturage. */
export function NearbyMap({ center, radiusKm, rides, selectedId, onSelect }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const lib = useRef<Leaflet | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const fitKey = useRef("");
  const [ready, setReady] = useState(false);

  // 1. Création de la carte (une seule fois ; Leaflet a besoin de window, donc import dynamique)
  useEffect(() => {
    let off = false;
    (async () => {
      const mod = await import("leaflet");
      const L = ((mod as unknown as { default?: Leaflet }).default ?? mod) as Leaflet;
      if (off || !el.current) return;
      const map = L.map(el.current, { scrollWheelZoom: false }).setView([center.lat, center.lng], 11);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap contributors" }).addTo(map);
      layer.current = L.layerGroup().addTo(map);
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
      fitKey.current = "";
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Mise à jour des marqueurs (le zoom ne bouge que si la recherche change, pas quand on sélectionne un trajet)
  useEffect(() => {
    const L = lib.current;
    const map = mapRef.current;
    const group = layer.current;
    if (!ready || !L || !map || !group) return;

    group.clearLayers();
    const c = L.latLng(center.lat, center.lng);
    L.circle(c, { radius: radiusKm * 1000, weight: 1.5, opacity: 0.6, fillOpacity: 0.06, interactive: false }).addTo(group);
    L.marker(c, { icon: L.divIcon({ className: "", html: ME, iconSize: [16, 16], iconAnchor: [8, 8] }), keyboard: false, interactive: false, zIndexOffset: -500 }).addTo(group);

    rides.forEach((r) => {
      const on = r.id === selectedId;
      L.marker([r.lat, r.lng], {
        icon: L.divIcon({ className: "", html: pin(on), iconSize: [36, 36], iconAnchor: [18, 34] }),
        title: r.label,
        keyboard: false,
        zIndexOffset: on ? 1000 : 0,
      })
        .on("click", () => onSelect(r.id))
        .addTo(group);
    });

    const key = `${center.lat},${center.lng},${radiusKm},${rides.length}`;
    if (fitKey.current !== key) {
      fitKey.current = key;
      map.fitBounds(c.toBounds(radiusKm * 2000), { padding: [20, 20] });
    }
  }, [ready, center.lat, center.lng, radiusKm, rides, selectedId, onSelect]);

  return <div ref={el} role="region" aria-label={N.mapLabel} className="isolate h-72 w-full overflow-hidden rounded-2xl border border-border bg-muted sm:h-96" />;
}
