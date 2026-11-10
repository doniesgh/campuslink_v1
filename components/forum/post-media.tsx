"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { fmtDate } from "@/lib/forum/format";
import { S } from "@/lib/forum/strings";
import type { Post } from "@/lib/forum/types";
import { BoxIcon, CalendarIcon, CarIcon, CashIcon, FlagIcon, IconCircle, PinIcon, SeatIcon } from "./icons";

function Chip({ icon, onBrand = false, children }: { icon: ReactNode; onBrand?: boolean; children: ReactNode }) {
  return (
    <li className={`inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm ${onBrand ? "bg-brand-foreground/10" : "bg-card/70 text-foreground"}`}>
      <IconCircle tone={onBrand ? "onBrand" : "primary"} size="sm">{icon}</IconCircle>
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

function PostBlock({ post }: { post: Post }) {

  if (post.type === "covoiturage" && post.covoiturage?.departure) {
    const c = post.covoiturage;
    return (
      <div className="bg-brand px-5 py-5 text-brand-foreground">
        <div className="flex items-center gap-3">
          <Stop icon={<PinIcon />} city={c.departure ?? ""} />
          <div aria-hidden className="flex min-w-6 flex-1 items-center gap-2 text-brand-foreground/60">
            <span className="h-px flex-1 border-t border-dashed border-current" />
            <CarIcon className="size-5 shrink-0" />
            <span className="h-px flex-1 border-t border-dashed border-current" />
          </div>
          <Stop icon={<FlagIcon />} city={c.destination ?? ""} end />
        </div>
        <ul className="mt-4 flex flex-wrap gap-2">
          {c.departureDate && <Chip onBrand icon={<CalendarIcon />}>{fmtDate(c.departureDate, true)}</Chip>}
          {c.seats ? <Chip onBrand icon={<SeatIcon />}>{S.seats(c.seats)}</Chip> : null}
          {c.price !== undefined && c.price !== null && <Chip onBrand icon={<CashIcon />}>{c.price === 0 ? S.free : `${c.price} DT`}</Chip>}
        </ul>
      </div>
    );
  }

  if (post.type === "objet_perdu" && post.objetPerdu?.kind) {
    const o = post.objetPerdu;
    return (
      <div className="flex items-start gap-3 bg-accent px-5 py-5 text-accent-foreground">
        <IconCircle tone="brand" size="lg"><BoxIcon /></IconCircle>
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

/** Photos du post : 1 grande image, ou une grille de 2 à 3 ; un clic ouvre l'image en grand. */
function Gallery({ images }: { images: string[] }) {
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <ul className={`grid gap-0.5 ${images.length === 1 ? "grid-cols-1" : images.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
        {images.map((src, i) => (
          <li key={i}>
            <button type="button" onClick={() => setOpen(src)} className="block w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className={`w-full bg-muted object-cover ${images.length === 1 ? "aspect-[16/10]" : "aspect-square"}`} />
            </button>
          </li>
        ))}
      </ul>
      {open && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setOpen(null)}>
          <button type="button" autoFocus aria-label={S.closePhoto} onClick={() => setOpen(null)} className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full bg-background/90 text-foreground">✕</button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={open} alt="" className="max-h-[90vh] max-w-full rounded-lg object-contain" />
        </div>
      )}
    </>
  );
}

export function PostMedia({ post }: { post: Post }) {
  const images = post.images ?? [];
  return (
    <>
      <PostBlock post={post} />
      {images.length > 0 && <Gallery images={images} />}
    </>
  );
}
