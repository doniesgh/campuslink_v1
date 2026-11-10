// Carte et trajet 100 % gratuits, sans clé d'API :
//  - recherche de lieux : Nominatim (OpenStreetMap)
//  - itinéraire         : OSRM (serveur de démonstration)
//  - fonds de carte     : tuiles OpenStreetMap (voir route-map.tsx)
// Ces services publics sont limités (1 requête/s pour Nominatim, pas de garantie pour OSRM) :
// pour une vraie mise en production, passe par ton backend avec un cache, ou héberge OSRM / Nominatim.
import { cacheGet, cacheSet } from "./offline";

export interface LatLng {
  lat: number;
  lng: number;
}
export interface Place extends LatLng {
  label: string;
}
export interface RouteInfo {
  distanceKm: number;
  durationMin: number;
  /** Tracé [lat, lng][] */
  coords: [number, number][];
  /** true si le service d'itinéraire est injoignable : distance à vol d'oiseau × 1,3 */
  estimated?: boolean;
}

/** Pays de la recherche de lieux ("" pour ne pas restreindre). */
export const GEO_COUNTRY = "tn";

/** Hypothèses du prix proposé (dinars tunisiens). À ajuster selon les prix réels. */
export const TRIP_COST = {
  pricePerKm: 1, // prix conseillé par place, en DT par kilomètre
  fuelPricePerL: 2.5, // prix du litre de carburant
  litresPer100Km: 7, // consommation moyenne
  wearPerKm: 0.1, // usure, pneus, entretien
  co2KgPerKm: 0.16, // émissions d'une voiture moyenne
};

const round1 = (n: number) => Math.round(n * 10) / 10;

export async function searchPlaces(q: string, signal?: AbortSignal): Promise<Place[]> {
  const params = new URLSearchParams({ q, format: "jsonv2", limit: "5", "accept-language": "fr" });
  if (GEO_COUNTRY) params.set("countrycodes", GEO_COUNTRY);
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("place search failed");
  const rows = (await res.json()) as { display_name: string; lat: string; lon: string }[];
  return rows.map((r) => ({ label: r.display_name.split(",").slice(0, 3).join(",").trim(), lat: Number(r.lat), lng: Number(r.lon) }));
}

export function haversineKm(a: LatLng, b: LatLng) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** Estimation hors ligne : ligne droite × 1,3, à 60 km/h. */
export function estimateRoute(a: LatLng, b: LatLng): RouteInfo {
  const km = haversineKm(a, b) * 1.3;
  return { distanceKm: round1(km), durationMin: Math.max(1, Math.round(km)), coords: [[a.lat, a.lng], [b.lat, b.lng]], estimated: true };
}

/** Itinéraire routier. La réponse est gardée dans le cache local pour rester disponible hors ligne. */
export async function fetchRoute(a: LatLng, b: LatLng, signal?: AbortSignal): Promise<RouteInfo> {
  const key = `route:${a.lat.toFixed(4)},${a.lng.toFixed(4)};${b.lat.toFixed(4)},${b.lng.toFixed(4)}`;
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error("route failed");
    const j = (await res.json()) as { code: string; routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[] };
    const r = j.routes?.[0];
    if (j.code !== "Ok" || !r) throw new Error("no route");
    const info: RouteInfo = {
      distanceKm: round1(r.distance / 1000),
      durationMin: Math.max(1, Math.round(r.duration / 60)),
      coords: r.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]),
    };
    void cacheSet(key, info);
    return info;
  } catch (e) {
    if (signal?.aborted) throw e;
    const hit = await cacheGet<RouteInfo>(key);
    if (hit) return hit;
    throw e;
  }
}

/** Ce qu'on peut déduire d'un trajet : prix conseillé, CO₂ évité, heure d'arrivée. */
export function tripInsights(distanceKm: number, durationMin: number, seats: number, departure?: string) {
  const { pricePerKm, fuelPricePerL, litresPer100Km, wearPerKm, co2KgPerKm } = TRIP_COST;
  const fuelCost = ((distanceKm * litresPer100Km) / 100) * fuelPricePerL;
  const totalCost = fuelCost + distanceKm * wearPerKm;
  const people = Math.max(1, seats) + 1; // conducteur + passagers
  const half = (n: number) => Math.max(0.5, Math.round(n * 2) / 2);
  const dep = departure ? new Date(departure) : null;
  return {
    totalCost,
    pricePerSeat: half(distanceKm * pricePerKm),
    fuelOnlyPerSeat: half(fuelCost / people),
    // chaque passager évite de prendre sa propre voiture : valeur maximale, places toutes remplies
    co2SavedKg: round1(distanceKm * co2KgPerKm * Math.max(1, seats)),
    arrival: dep && !Number.isNaN(+dep) ? new Date(+dep + durationMin * 60000).toISOString() : undefined,
  };
}

export function fmtDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`;
}

export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });