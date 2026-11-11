"use client";

import { useCallback, useEffect, useState } from "react";
import { BffError, bff, errorMessage } from "@/lib/forum/bff";
import { fmtDate } from "@/lib/forum/format";
import { R } from "@/lib/forum/reservation-strings";
import type { Post, Reservation, ReservationStatus } from "@/lib/forum/types";
import { btnDangerGhost, btnPrimary, btnSm, panel, textarea } from "@/lib/forum/ui";
import { IconCircle, SeatIcon } from "./icons";

type Data = { role: "driver" | "passenger"; reservations: Reservation[] };
type Action = "accept" | "reject" | "cancel";

const STATUS_STYLE: Record<ReservationStatus, string> = {
  pending: "bg-accent text-accent-foreground",
  accepted: "bg-success/15 text-success",
  rejected: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

const Badge = ({ status }: { status: ReservationStatus }) => (
  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>{R.status[status]}</span>
);

const nameOf = (r: Reservation) => {
  const p = r.passenger;
  return typeof p === "string" ? R.passenger : `${p.firstname ?? ""} ${p.lastname ?? ""}`.trim() || R.passenger;
};

/**
 * Covoiturage : le conducteur voit les demandes de places (accepter / refuser) ;
 * un autre utilisateur envoie sa demande, la suit et peut l'annuler.
 * Les places restantes sont décrémentées côté serveur, de façon atomique.
 */
export function ReservationPanel({ post, onChanged }: { post: Post; onChanged?: () => void }) {
  const id = post._id;
  const [data, setData] = useState<Data | null>(null);
  const [hidden, setHidden] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [seats, setSeats] = useState(1);
  const [message, setMessage] = useState("");

  const left = post.covoiturage?.seats ?? 0;
  const departed = post.covoiturage?.departureDate ? new Date(post.covoiturage.departureDate) < new Date() : false;

  const load = useCallback(async () => {
    try {
      setData(await bff<Data>(`/posts/${id}/reservations`));
      setLoadError("");
    } catch (e) {
      if (e instanceof BffError && e.status === 401) setHidden(true); // pas connecté : pas de réservation
      else setLoadError(e instanceof BffError ? `${errorMessage(e)} (${e.status})` : errorMessage(e));
    }
  }, [id]);

  useEffect(() => {
    void load();
    // Rafraîchit de temps en temps : la décision du conducteur apparaît sans recharger la page
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 20000);
    return () => clearInterval(t);
  }, [load]);

  async function act(key: string, run: () => Promise<unknown>) {
    setBusyKey(key);
    setError("");
    try {
      await run();
      await load();
      onChanged?.(); // recharge le post : le nombre de places a changé
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusyKey(null);
    }
  }

  const send = () =>
    act("new", async () => {
      await bff(`/posts/${id}/reservations`, { method: "POST", json: { seats: Math.min(seats, left), message: message.trim() || undefined } });
      setMessage("");
    });
  const update = (rid: string, action: Action) => act(rid, () => bff(`/posts/reservations/${rid}`, { method: "PUT", json: { action } }));

  if (hidden) return <p className={`${panel} p-4 text-center text-sm text-muted-foreground`}>{R.signIn}</p>;
  if (!data) {
    // Le chargement a échoué : on le dit au lieu de ne rien afficher
    return loadError ? (
      <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{R.unavailable} {loadError}</p>
    ) : (
      <p className={`${panel} animate-pulse p-4 text-center text-sm text-muted-foreground`} aria-busy="true">{R.loading}</p>
    );
  }

  const errorBox = error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>;

  /* ---------------- Conducteur ---------------- */
  if (data.role === "driver") {
    const pending = data.reservations.filter((r) => r.status === "pending").length;
    return (
      <section aria-labelledby="res-title" className={`${panel} space-y-4 p-6 shadow-sm`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="res-title" className="flex items-center gap-2 text-base font-semibold">
            <IconCircle tone="brand" size="sm"><SeatIcon /></IconCircle>
            {R.requestsTitle}
            {pending > 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">{pending}</span>}
          </h3>
          <p className="text-sm text-muted-foreground">{left > 0 ? R.seatsLeft(left) : R.full}</p>
        </div>
        {errorBox}
        {data.reservations.length === 0 ? (
          <p className="text-sm text-muted-foreground">{R.noRequests}</p>
        ) : (
          <ul className="space-y-3">
            {data.reservations.map((r) => (
              <li key={r._id} className="space-y-2 rounded-xl border border-border bg-background p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{nameOf(r)} · {R.seatsCount(r.seats)}</p>
                  <Badge status={r.status} />
                </div>
                {r.message && <p className="text-sm text-muted-foreground">“{r.message}”</p>}
                <p className="text-xs text-muted-foreground">{fmtDate(r.createdAt, true)}</p>
                {r.status === "pending" && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button type="button" className={btnSm} disabled={busyKey === r._id || r.seats > left} onClick={() => update(r._id, "accept")}>{R.accept}</button>
                    <button type="button" className={btnDangerGhost} disabled={busyKey === r._id} onClick={() => update(r._id, "reject")}>{R.reject}</button>
                    {r.seats > left && <span className="self-center text-xs text-destructive">{R.notEnoughSeats}</span>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  /* ---------------- Passager ---------------- */
  const active = data.reservations.find((r) => r.status === "pending" || r.status === "accepted");
  const lastDeclined = !active && data.reservations[0]?.status === "rejected";

  if (active) {
    return (
      <section aria-labelledby="res-title" className={`${panel} space-y-3 p-6 shadow-sm`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="res-title" className="flex items-center gap-2 text-base font-semibold">
            <IconCircle tone="brand" size="sm"><SeatIcon /></IconCircle>
            {R.yourRequest(active.seats)}
          </h3>
          <Badge status={active.status} />
        </div>
        <p className="text-sm text-muted-foreground">{active.status === "accepted" ? R.acceptedHint : R.pendingHint}</p>
        {errorBox}
        <button type="button" className={btnDangerGhost} disabled={busyKey === active._id} onClick={() => update(active._id, "cancel")}>{R.cancel}</button>
      </section>
    );
  }

  if (departed) return <p className={`${panel} p-4 text-center text-sm text-muted-foreground`}>{R.departedNote}</p>;
  if (post.status !== "active") return <p className={`${panel} p-4 text-center text-sm text-muted-foreground`}>{R.closedNote}</p>;

  if (left <= 0) {
    return <p className={`${panel} p-4 text-center text-sm text-muted-foreground`}>{R.full}</p>;
  }

  const options = Array.from({ length: Math.min(left, 4) }, (_, i) => i + 1);
  const chosen = Math.min(seats, left);

  return (
    <section aria-labelledby="res-title" className={`${panel} space-y-4 p-6 shadow-sm`}>
      <h3 id="res-title" className="flex items-center gap-2 text-base font-semibold">
        <IconCircle tone="brand" size="sm"><SeatIcon /></IconCircle>
        {R.requestTitle}
        <span className="ml-auto text-sm font-normal text-muted-foreground">{R.seatsLeft(left)}</span>
      </h3>
      {lastDeclined && <p className="text-sm text-muted-foreground">{R.declinedHint}</p>}

      <div className="space-y-2">
        <p id="res-seats" className="text-sm font-medium">{R.seatsWanted}</p>
        <div role="radiogroup" aria-labelledby="res-seats" className="flex flex-wrap gap-2">
          {options.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={n === chosen}
              onClick={() => setSeats(n)}
              className={`flex size-10 items-center justify-center rounded-full border text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                n === chosen ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-accent"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="res-message" className="text-sm font-medium">{R.messageLabel}</label>
        <textarea id="res-message" maxLength={300} className={`${textarea} w-full`} placeholder={R.messagePh} value={message} onChange={(e) => setMessage(e.target.value)} />
      </div>

      {errorBox}
      <button type="button" className={btnPrimary} disabled={busyKey === "new"} onClick={send}>
        {busyKey === "new" ? R.sending : R.send}
      </button>
    </section>
  );
}