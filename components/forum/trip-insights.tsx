import type { ReactNode } from "react";
import { TRIP_COST, fmtDuration, fmtTime, tripInsights } from "@/lib/forum/geo";
import { S } from "@/lib/forum/strings";
import { btnSm, panel } from "@/lib/forum/ui";
import { CalendarIcon, CashIcon, ClockIcon, IconCircle, LeafIcon, RouteIcon } from "./icons";

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <li className="flex items-center gap-2.5">
      <IconCircle tone="primary">{icon}</IconCircle>
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-tight">{value}</p>
        <p className="text-xs leading-tight text-slate-500">{label}</p>
      </div>
    </li>
  );
}

interface Props {
  distanceKm: number;
  durationMin: number;
  seats: number;
  departure?: string;
  /** Prix demandé par place (DT), s'il est déjà saisi. */
  price?: number;
  estimated?: boolean;
  /** Fourni dans le formulaire : affiche le bouton « utiliser ce prix ». Absent sur la page d'un post. */
  onUsePrice?: (price: number) => void;
}

/** Ce que le trajet permet de calculer : durée, arrivée, CO₂ évité et prix conseillé par place. */
export function TripInsights({ distanceKm, durationMin, seats, departure, price, estimated, onUsePrice }: Props) {
  const t = tripInsights(distanceKm, durationMin, seats, departure);
  const verdict = price === undefined ? null : price === 0 ? S.free : price <= t.pricePerSeat * 1.25 ? S.fairPrice : S.aboveShare;

  return (
    <div className={`${panel} space-y-4 p-4`}>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={<RouteIcon />} label={S.distance} value={`${distanceKm} km`} />
        <Stat icon={<ClockIcon />} label={S.duration} value={fmtDuration(durationMin)} />
        {t.arrival && <Stat icon={<CalendarIcon />} label={S.arrival} value={fmtTime(t.arrival)} />}
        <Stat icon={<LeafIcon />} label={S.co2Saved} value={`${t.co2SavedKg} kg`} />
      </ul>

      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[#eff4ff] p-3 text-blue-900">
        <IconCircle tone="brand"><CashIcon /></IconCircle>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{S.suggestedPrice(t.pricePerSeat)}</p>
          <p className="text-xs text-slate-500">{S.priceBasis(t.fuelOnlyPerSeat, TRIP_COST.fuelPricePerL, TRIP_COST.litresPer100Km)}</p>
        </div>
        {onUsePrice ? (
          <button type="button" disabled={price === t.pricePerSeat} onClick={() => onUsePrice(t.pricePerSeat)} className={btnSm}>
            {S.usePrice(t.pricePerSeat)}
          </button>
        ) : (
          verdict && <span className="rounded-full bg-white px-3 py-1 text-xs font-medium">{verdict}</span>
        )}
      </div>

      {estimated && <p className="text-xs text-slate-500">{S.estimatedRoute}</p>}
    </div>
  );
}
