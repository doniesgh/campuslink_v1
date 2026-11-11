"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { bff } from "@/lib/forum/bff";
import { fmtDate } from "@/lib/forum/format";
import { M } from "@/lib/forum/match-strings";
import { N } from "@/lib/forum/nearby-strings";
import { S } from "@/lib/forum/strings";
import type { CompatibleRide, Post } from "@/lib/forum/types";
import { btnSm, panel } from "@/lib/forum/ui";
import { CarIcon, IconCircle } from "./icons";

/** Covoiturage : autres trajets actifs au départ, à l'arrivée et à l'heure proches (utile si celui-ci est complet). */
export function CompatibleRidesPanel({ post, basePath }: { post: Post; basePath: string }) {
  const [rides, setRides] = useState<CompatibleRide[] | null>(null);
  const hasCoords = Boolean(post.covoiturage?.departureCoords && post.covoiturage?.destinationCoords);

  useEffect(() => {
    if (!hasCoords || post.status !== "active") return;
    let off = false;
    bff<{ rides: CompatibleRide[] }>(`/posts/${post._id}/compatible`)
      .then((r) => !off && setRides(r.rides ?? []))
      .catch(() => !off && setRides([]));
    return () => {
      off = true;
    };
  }, [post._id, post.status, hasCoords]);

  if (!rides?.length) return null;

  return (
    <section aria-labelledby="compat-title" className={`${panel} p-6 shadow-sm`}>
      <h3 id="compat-title" className="flex items-center gap-2 text-base font-semibold">
        <IconCircle tone="brand" size="sm"><CarIcon /></IconCircle>
        {M.compatTitle}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">{M.compatSubtitle}</p>
      <ul className="mt-4 space-y-3">
        {rides.map(({ post: r, score, departureKm, arrivalKm, minutesApart }) => (
          <li key={r._id} className="rounded-xl border border-border bg-background p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{r.covoiturage?.departure} → {r.covoiturage?.destination}</p>
                <p className="text-xs text-muted-foreground">
                  {r.covoiturage?.departureDate ? fmtDate(r.covoiturage.departureDate, true) : ""} · {M.seatsLeft(r.covoiturage?.seats ?? 0)} ·{" "}
                  {r.covoiturage?.price ? `${r.covoiturage.price} DT` : S.free}
                </p>
              </div>
              <Link href={`${basePath}/${r._id}`} className={btnSm}>{M.viewRide}</Link>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" role="presentation">
                <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, score)}%` }} />
              </div>
              <span className="text-xs font-semibold">{N.matchPercent(Math.min(100, score))}</span>
            </div>
            <ul className="mt-3 flex flex-wrap gap-2">
              {[minutesApart < 5 ? M.sameTime : M.minutesApart(minutesApart), M.departureApart(departureKm), M.arrivalApart(arrivalKm)].map((t) => (
                <li key={t} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{t}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
