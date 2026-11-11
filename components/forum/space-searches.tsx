"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { bff, errorMessage } from "@/lib/forum/bff";
import { fmtDate } from "@/lib/forum/format";
import type { LatLng } from "@/lib/forum/geo";
import { M } from "@/lib/forum/match-strings";
import { N } from "@/lib/forum/nearby-strings";
import { Z } from "@/lib/forum/space-strings";
import { S } from "@/lib/forum/strings";
import type { MySearch } from "@/lib/forum/types";
import { btn, btnDangerGhost, btnPrimary, btnSm, field, panel, textarea } from "@/lib/forum/ui";
import { PointPicker } from "./point-picker";

const WINDOWS = [30, 60, 90, 120];
const SEATS = [1, 2, 3, 4];

const chip = (on: boolean) =>
  `inline-flex h-9 items-center justify-center rounded-full border px-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
    on ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-accent"
  }`;

/**
 * « Je cherche un covoiturage » : on décrit le trajet voulu ; les trajets déjà publiés qui correspondent s'affichent,
 * et on est notifié dès qu'un nouveau trajet compatible est publié.
 */
export function SpaceSearches({ basePath }: { basePath: string }) {
  const [items, setItems] = useState<MySearch[] | null>(null);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [departure, setDeparture] = useState("");
  const [destination, setDestination] = useState("");
  const [fromPt, setFromPt] = useState<LatLng | null>(null);
  const [toPt, setToPt] = useState<LatLng | null>(null);
  const [when, setWhen] = useState("");
  const [windowMin, setWindowMin] = useState(60);
  const [seats, setSeats] = useState(1);
  const [maxPrice, setMaxPrice] = useState("");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await bff<MySearch[]>("/posts/searches"));
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 30000);
    return () => clearInterval(t);
  }, [load]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!departure.trim() || !destination.trim() || !when || !fromPt || !toPt) return setFormError(Z.requiredFields);
    if (new Date(when).getTime() + windowMin * 60000 < Date.now()) return setFormError(Z.pastDate);
    setBusy("new");
    try {
      await bff("/posts/searches", {
        method: "POST",
        json: {
          departure: departure.trim(),
          destination: destination.trim(),
          departureCoords: fromPt,
          destinationCoords: toPt,
          when: new Date(when).toISOString(),
          windowMin,
          seats,
          maxPrice: maxPrice === "" ? undefined : Number(maxPrice),
          note: note.trim() || undefined,
        },
      });
      setDeparture("");
      setDestination("");
      setFromPt(null);
      setToPt(null);
      setWhen("");
      setMaxPrice("");
      setNote("");
      setShowForm(false);
      await load();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function cancel(id: string) {
    setBusy(id);
    try {
      await bff(`/posts/searches/${id}`, { method: "PUT", json: { action: "cancel" } });
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {!showForm ? (
        <button type="button" className={btnPrimary} onClick={() => setShowForm(true)}>{Z.newSearch}</button>
      ) : (
        <form onSubmit={submit} noValidate className={`${panel} space-y-4 p-5 shadow-sm`}>
          <div>
            <h3 className="text-base font-semibold">{Z.searchTitle}</h3>
            <p className="text-sm text-muted-foreground">{Z.searchHint}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="s-dep" className="text-sm font-medium">{Z.departure}</label>
              <input id="s-dep" className={`${field} w-full`} value={departure} onChange={(e) => setDeparture(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="s-dest" className="text-sm font-medium">{Z.destination}</label>
              <input id="s-dest" className={`${field} w-full`} value={destination} onChange={(e) => setDestination(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium">{N.pickTitle}</h4>
            <PointPicker from={fromPt} to={toPt} onFrom={setFromPt} onTo={setToPt} />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="s-when" className="text-sm font-medium">{Z.when}</label>
            <input id="s-when" type="datetime-local" className={`${field} w-full`} value={when} onChange={(e) => setWhen(e.target.value)} />
          </div>

          <div className="space-y-2">
            <p id="s-win" className="text-sm font-medium">{Z.flexibility}</p>
            <div role="radiogroup" aria-labelledby="s-win" className="flex flex-wrap gap-2">
              {WINDOWS.map((m) => (
                <button key={m} type="button" role="radio" aria-checked={m === windowMin} onClick={() => setWindowMin(m)} className={chip(m === windowMin)}>{Z.flex(m)}</button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p id="s-seats" className="text-sm font-medium">{Z.seatsNeeded}</p>
            <div role="radiogroup" aria-labelledby="s-seats" className="flex flex-wrap gap-2">
              {SEATS.map((n) => (
                <button key={n} type="button" role="radio" aria-checked={n === seats} onClick={() => setSeats(n)} className={chip(n === seats)}>{n}</button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="s-price" className="text-sm font-medium">{Z.maxPrice}</label>
            <input id="s-price" type="number" min={0} step="0.5" inputMode="decimal" className={`${field} w-full`} value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="s-note" className="text-sm font-medium">{Z.note}</label>
            <textarea id="s-note" maxLength={300} className={`${textarea} w-full`} placeholder={Z.notePh} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          {formError && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={btnPrimary} disabled={busy === "new"}>{busy === "new" ? Z.creating : Z.createSearch}</button>
            <button type="button" className={btn} onClick={() => setShowForm(false)}>{Z.close}</button>
          </div>
        </form>
      )}

      {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      {items === null && !error && <p className="text-sm text-muted-foreground" aria-busy="true">{Z.loading}</p>}
      {items && items.length === 0 && <div className={`${panel} p-6 text-center text-sm text-muted-foreground`}>{Z.noSearches}</div>}

      <ul className="space-y-3">
        {items?.map(({ search: s, matches }) => {
          const expired = new Date(s.when).getTime() + s.windowMin * 60000 < Date.now();
          const live = s.status === "active" && !expired;
          return (
            <li key={s._id} className={`${panel} space-y-3 p-4 shadow-sm`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{s.departure} → {s.destination}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmtDate(s.when, true)} · {Z.flex(s.windowMin)} · {Z.seatsFor(s.seats)}
                    {s.maxPrice !== undefined ? ` · ${Z.maxPriceTag(s.maxPrice)}` : ""}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${live ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>
                  {expired ? Z.expired : Z.searchStatus[s.status]}
                </span>
              </div>
              {s.note && <p className="text-sm text-muted-foreground">“{s.note}”</p>}

              {live && matches.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">{Z.matchesNow(matches.length)}</p>
                  <ul className="space-y-2">
                    {matches.map(({ post: r, score, departureKm, arrivalKm, minutesApart }) => (
                      <li key={r._id} className="rounded-xl border border-border bg-background p-3">
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
                        <p className="mt-2 text-xs text-muted-foreground">
                          {N.matchPercent(Math.min(100, score))} · {minutesApart < 5 ? M.sameTime : M.minutesApart(minutesApart)} · {M.departureApart(departureKm)} · {M.arrivalApart(arrivalKm)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {live && matches.length === 0 && <p className="text-sm text-muted-foreground">{Z.watching}</p>}
              {live && (
                <button type="button" className={btnDangerGhost} disabled={busy === s._id} onClick={() => cancel(s._id)}>{Z.cancelSearch}</button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
