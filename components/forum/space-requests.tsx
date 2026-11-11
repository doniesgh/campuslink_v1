"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { bff, errorMessage } from "@/lib/forum/bff";
import { fmtDate } from "@/lib/forum/format";
import { R } from "@/lib/forum/reservation-strings";
import { Z } from "@/lib/forum/space-strings";
import type { ReservationWithPost } from "@/lib/forum/types";
import { btnDangerGhost, btnSm, panel } from "@/lib/forum/ui";
import { StatusBadge } from "./status-badge";

const nameOf = (r: ReservationWithPost) => {
  const p = r.passenger;
  return typeof p === "string" ? R.passenger : `${p.firstname ?? ""} ${p.lastname ?? ""}`.trim() || R.passenger;
};

const ErrorBox = ({ text }: { text: string }) => (
  <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{text}</p>
);

/**
 * « sent » : les demandes de places que j'ai envoyées (je peux les annuler).
 * « received » : les demandes reçues sur mes trajets (j'accepte ou je refuse ; accepter retire les places côté serveur).
 */
export function RequestsTab({ mode, basePath }: { mode: "sent" | "received"; basePath: string }) {
  const path = mode === "sent" ? "/posts/reservations/me" : "/posts/reservations/received";
  const [items, setItems] = useState<ReservationWithPost[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await bff<ReservationWithPost[]>(path));
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [path]);

  useEffect(() => {
    void load();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 20000);
    return () => clearInterval(t);
  }, [load]);

  async function act(id: string, action: "accept" | "reject" | "cancel") {
    setBusy(id);
    setError("");
    try {
      await bff(`/posts/reservations/${id}`, { method: "PUT", json: { action } });
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  if (items === null) return error ? <ErrorBox text={error} /> : <p className="text-sm text-muted-foreground" aria-busy="true">{Z.loading}</p>;

  return (
    <div className="space-y-3">
      {error && <ErrorBox text={error} />}
      {items.length === 0 ? (
        <div className={`${panel} p-6 text-center text-sm text-muted-foreground`}>{mode === "sent" ? Z.noSent : Z.noReceived}</div>
      ) : (
        <ul className="space-y-3">
          {items.map((r) => {
            const c = r.post?.covoiturage;
            const left = c?.seats ?? 0;
            return (
              <li key={r._id} className={`${panel} space-y-2 p-4 shadow-sm`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{c?.departure} → {c?.destination}</p>
                    <p className="text-xs text-muted-foreground">
                      {c?.departureDate ? fmtDate(c.departureDate, true) : ""}
                      {mode === "received" ? ` · ${nameOf(r)}` : ""} · {R.seatsCount(r.seats)}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                {r.message && <p className="text-sm text-muted-foreground">“{r.message}”</p>}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {mode === "received" && r.status === "pending" && (
                    <>
                      <button type="button" className={btnSm} disabled={busy === r._id || r.seats > left} onClick={() => act(r._id, "accept")}>{R.accept}</button>
                      <button type="button" className={btnDangerGhost} disabled={busy === r._id} onClick={() => act(r._id, "reject")}>{R.reject}</button>
                      <span className={`text-xs ${r.seats > left ? "text-destructive" : "text-muted-foreground"}`}>{r.seats > left ? R.notEnoughSeats : R.seatsLeft(left)}</span>
                    </>
                  )}
                  {mode === "sent" && (r.status === "pending" || r.status === "accepted") && (
                    <button type="button" className={btnDangerGhost} disabled={busy === r._id} onClick={() => act(r._id, "cancel")}>{R.cancel}</button>
                  )}
                  {r.post && <Link href={`${basePath}/${r.post._id}`} className={btnSm}>{Z.viewRide}</Link>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
