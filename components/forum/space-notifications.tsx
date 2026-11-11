"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { bff, errorMessage } from "@/lib/forum/bff";
import { fmtDate } from "@/lib/forum/format";
import { Z } from "@/lib/forum/space-strings";
import type { ForumNotification } from "@/lib/forum/types";
import { btnSm, panel } from "@/lib/forum/ui";

/** Notifications du forum : demandes de places, réponses du conducteur, trajets qui correspondent à une recherche. */
export function SpaceNotifications({ basePath }: { basePath: string }) {
  const [data, setData] = useState<{ notifications: ForumNotification[]; unread: number } | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await bff<{ notifications: ForumNotification[]; unread: number }>("/posts/notifications"));
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

  async function markAll() {
    try {
      await bff("/posts/notifications/read", { method: "PUT", json: {} });
      await load();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  if (!data) return error ? <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : <p className="text-sm text-muted-foreground" aria-busy="true">{Z.loading}</p>;

  return (
    <div className="space-y-3">
      {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      {data.unread > 0 && (
        <div className="flex justify-end">
          <button type="button" className={btnSm} onClick={markAll}>{Z.markAllRead}</button>
        </div>
      )}
      {data.notifications.length === 0 ? (
        <div className={`${panel} p-6 text-center text-sm text-muted-foreground`}>{Z.noNotifications}</div>
      ) : (
        <ul className="space-y-3">
          {data.notifications.map((n) => (
            <li key={n._id} className={`${panel} flex flex-wrap items-start justify-between gap-3 p-4 shadow-sm ${n.read ? "" : "ring-2 ring-primary/30"}`}>
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  {!n.read && <span aria-hidden className="size-2 shrink-0 rounded-full bg-primary" />}
                  {n.title}
                </p>
                {n.body && <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>}
                <p className="mt-1 text-xs text-muted-foreground">{fmtDate(n.createdAt, true)}</p>
              </div>
              {n.data?.postId && <Link href={`${basePath}/${n.data.postId}`} className={btnSm}>{Z.viewRide}</Link>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
