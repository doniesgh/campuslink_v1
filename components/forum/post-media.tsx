import type { ReactNode } from "react";
import { fmtDate } from "@/lib/forum/format";
import { S } from "@/lib/forum/strings";
import type { Post } from "@/lib/forum/types";
import { fmtDuration } from "@/lib/forum/geo";
import { PREFS } from "./prefs";
import { BoxIcon, CalendarIcon, CarIcon, CashIcon, FlagIcon, IconCircle, PinIcon, RouteIcon, SeatIcon } from "./icons";

function Chip({ icon, onBrand = false, children }: { icon: ReactNode; onBrand?: boolean; children: ReactNode }) {
  return (
    <li className={`inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm ${onBrand ? "bg-white/10" : "bg-white/70 text-slate-800"}`}>
      <IconCircle tone={onBrand ? "onBrand" : "amber"} size="sm">{icon}</IconCircle>
      {children}
    </li>
  );
}

function Stop({ icon, city, end = false }: { icon: ReactNode; city: string; end?: boolean }) {
  return (
    <div className={`flex min-w-0 max-w-[40%] items-center gap-2 ${end ? "flex-row-reverse text-right" : ""}`}>
      <IconCircle tone="onBrand">{icon}</IconCircle>
      <span className="line-clamp-2 break-words font-heading text-base font-semibold leading-tight sm:text-lg">{city}</span>
    </div>
  );
}

export function PostMedia({ post }: { post: Post }) {
  const img = post.images?.[0];
  if (img) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={img} alt="" className="aspect-[4/3] w-full bg-slate-100 object-cover" />;
  }

  if (post.type === "covoiturage" && post.covoiturage?.departure) {
    const c = post.covoiturage;
    return (
      <div className="bg-blue-900 px-5 py-5 text-white">
        <div className="flex items-center gap-3">
          <Stop icon={<PinIcon />} city={c.departure ?? ""} />
          <div aria-hidden className="flex min-w-6 flex-1 items-center gap-2 text-white/60">
            <span className="h-px flex-1 border-t border-dashed border-current" />
            <CarIcon className="size-5 shrink-0" />
            <span className="h-px flex-1 border-t border-dashed border-current" />
          </div>
          <Stop icon={<FlagIcon />} city={c.destination ?? ""} end />
        </div>
        <ul className="mt-4 flex flex-wrap gap-2">
          {c.departureDate && <Chip onBrand icon={<CalendarIcon />}>{fmtDate(c.departureDate, true)}</Chip>}
          {c.seats ? <Chip onBrand icon={<SeatIcon />}>{S.seats(c.seats)}</Chip> : null}
          {c.distanceKm ? <Chip onBrand icon={<RouteIcon />}>{c.distanceKm} km{c.durationMin ? ` · ${fmtDuration(c.durationMin)}` : ""}</Chip> : null}
          {c.price !== undefined && c.price !== null && <Chip onBrand icon={<CashIcon />}>{c.price === 0 ? S.free : `${c.price} DT`}</Chip>}
          {c.flexibleStops && <Chip onBrand icon={<RouteIcon />}>{S.flexibleStops}</Chip>}
          {PREFS.filter((p) => c.preferences?.includes(p.id)).map(({ id, icon: Icon }) => (
            <Chip key={id} onBrand icon={<Icon />}>{S.prefs[id]}</Chip>
          ))}
        </ul>
      </div>
    );
  }

  if (post.type === "objet_perdu" && post.objetPerdu?.kind) {
    const o = post.objetPerdu;
    return (
      <div className="flex items-start gap-3 border-b border-amber-200 bg-amber-50 px-5 py-5 text-amber-900">
        <IconCircle tone="amber" size="lg"><BoxIcon /></IconCircle>
        <div className="min-w-0">
          <p className="font-heading text-xl font-semibold leading-tight">
            {o.kind === "trouve" ? S.found : S.lost}
            {o.category ? `: ${o.category}` : ""}
          </p>
          {(o.place || o.date) && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {o.place && <Chip icon={<PinIcon />}>{o.place}</Chip>}
              {o.date && <Chip icon={<CalendarIcon />}>{fmtDate(o.date)}</Chip>}
            </ul>
          )}
        </div>
      </div>
    );
  }
  return null;
}
