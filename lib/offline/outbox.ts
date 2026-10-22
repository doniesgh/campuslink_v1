// queueMutation: writes that survive being offline (IndexedDB store "outbox").
// Last write wins per key ("<METHOD> <path>" by default). Mutations that are not idempotent (e.g. creating
// a record) pass their own `key`; modules that must report refusals pass `keepRejected` and a `scope`.
import { useEffect, useState } from "react";
import { BffError, bffFetch, type BffMethod } from "@/lib/bff-client";
import { getDb, type OutboxRecord, type OutboxRejection } from "@/lib/offline/db";
import { getCurrentOwner, useDataOwner } from "@/lib/offline/owner";
import { invalidateQueries } from "@/lib/offline/query";
import { isOnline, reportNetworkFailure, setPendingCount } from "@/lib/offline/status";

export type { OutboxRecord, OutboxRejection } from "@/lib/offline/db";

export const SYNC_TAG = "campuslink-outbox";
const LOCK_NAME = "campuslink-outbox";

/** Fired on window after queued mutations were sent: `detail = { sent: number }`. */
export const OUTBOX_REPLAYED_EVENT = "campuslink:outbox-replayed";

export type MutationRequest = {
  method: Exclude<BffMethod, "GET">;
  /** API path relative to /bff, e.g. "/notifications/123/read". */
  path: string;
  /** JSON body (no FormData: it can't be stored). */
  body?: unknown;
  /** Dedupe key (default "<METHOD> <path>"): a new mutation replaces a waiting one with the same key. */
  key?: string;
  /** Module that queues it (see useOutbox). */
  scope?: string;
  /** Data the module needs to show the waiting change. */
  info?: Record<string, unknown>;
  /** Keep it (with `rejected`) when the API refuses it for good, instead of dropping it. */
  keepRejected?: boolean;
  /** Also keep it (with `rejected`) when the API refuses it as soon as it is sent online (`failed` then has its `id`). */
  keepRefused?: boolean;
};

export type MutationResult<T = unknown> =
  | { status: "sent"; data: T }
  | { status: "queued"; id: string }
  | { status: "failed"; error: BffError; id?: string };

type NavigatorWithLocks = Navigator & {
  locks?: { request<R>(name: string, callback: () => Promise<R>): Promise<R> };
};

async function withLock<R>(callback: () => Promise<R>): Promise<R> {
  const locks = typeof navigator !== "undefined" ? (navigator as NavigatorWithLocks).locks : undefined;
  return locks ? locks.request(LOCK_NAME, callback) : callback();
}

// ---------------------------------------------------------------- change notifications

const changeListeners = new Set<() => void>();

/** Calls `listener` whenever the outbox changes (queued, sent, rejected, removed; also from the service worker). */
export function subscribeOutbox(listener: () => void): () => void {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

/** Tells the subscribers that the outbox changed (also called when the service worker replayed it). */
export function notifyOutboxChanged(): void {
  for (const listener of changeListeners) listener();
}

// ---------------------------------------------------------------- reading

/** The current user's waiting (and refused) mutations of `scope`, oldest first. */
export async function listOutbox(scope?: string): Promise<OutboxRecord[]> {
  const owner = getCurrentOwner();
  if (!owner) return [];
  try {
    const db = await getDb();
    if (!db) return [];
    return (await db.getAllFromIndex("outbox", "createdAt")).filter(
      (record) => record.owner === owner && (scope === undefined || record.scope === scope)
    );
  } catch {
    return [];
  }
}

/** Waiting and refused mutations of `scope`, kept up to date (Client Components). */
export function useOutbox(scope: string): OutboxRecord[] {
  const owner = useDataOwner();
  const [records, setRecords] = useState<OutboxRecord[]>([]);
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void listOutbox(scope).then((list) => {
        if (!cancelled) setRecords(list);
      });
    };
    load();
    const off = subscribeOutbox(load);
    return () => {
      cancelled = true;
      off();
    };
  }, [scope, owner]);
  return records;
}

/** Recounts the current user's waiting mutations (feeds the "<n> changes waiting to sync" banner). Refused ones don't count. */
export async function refreshPendingCount(): Promise<number> {
  const owner = getCurrentOwner();
  try {
    const db = await getDb();
    if (!db || !owner) {
      setPendingCount(0);
      return 0;
    }
    const all = await db.getAll("outbox");
    const count = all.filter((record) => record.owner === owner && !record.rejected).length;
    setPendingCount(count);
    return count;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------- writing

/** Asks the service worker to replay the outbox when the connection comes back (Background Sync). */
async function requestBackgroundSync(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    const sync = (registration as (ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } }) | undefined)
      ?.sync;
    await sync?.register(SYNC_TAG);
  } catch {
    // Not supported (Firefox, Safari): the page replays on the "online" event instead.
  }
}

/** The outbox id of a mutation of the current user (see OutboxRecord). */
export function outboxId(request: Pick<MutationRequest, "method" | "path" | "key">): string | null {
  const owner = getCurrentOwner();
  return owner ? `${owner}|${request.key ?? `${request.method} ${request.path}`}` : null;
}

async function enqueue(request: MutationRequest, rejected?: OutboxRejection): Promise<string | null> {
  const owner = getCurrentOwner();
  const id = outboxId(request);
  const db = await getDb();
  if (!db || !owner || !id) return null;
  const record: OutboxRecord = {
    id,
    owner,
    method: request.method,
    path: request.path,
    body: request.body,
    createdAt: Date.now(),
    ...(request.scope ? { scope: request.scope } : {}),
    ...(request.info ? { info: request.info } : {}),
    ...(request.keepRejected || rejected ? { keepRejected: true } : {}),
    ...(rejected ? { rejected } : {}),
  };
  try {
    await db.put("outbox", record);
  } catch {
    return null;
  }
  await refreshPendingCount();
  notifyOutboxChanged();
  if (!rejected) void requestBackgroundSync();
  return id;
}

/**
 * Runs the mutation now when online; when offline (or when the request can't reach the server)
 * stores it in the outbox and replays it on reconnection / through Background Sync.
 *
 *   const result = await queueMutation({ method: "POST", path: `/notifications/${id}/read` });
 *   if (result.status === "failed") show(result.error) // a real API error (4xx/5xx), not queued
 */
export async function queueMutation<T = unknown>(request: MutationRequest): Promise<MutationResult<T>> {
  if (isOnline()) {
    try {
      const data = await bffFetch<T>(request.path, { method: request.method, body: request.body });
      // A waiting copy of the same change (e.g. refused earlier) is now obsolete.
      const id = outboxId(request);
      if (id) await removeOutboxRecord(id);
      return { status: "sent", data };
    } catch (e) {
      const error = e instanceof BffError ? e : new BffError(0, "NETWORK_ERROR", "Can't reach the server.");
      if (!error.isNetworkError) {
        // Refused at once: kept with the module's other refused changes when asked (not for 401/429: not final).
        const final = error.status !== 401 && error.status !== 429;
        const id = request.keepRefused && final ? await enqueue(request, rejectionOf(error)) : null;
        return id ? { status: "failed", error, id } : { status: "failed", error };
      }
      // Unreachable: fall through and keep it for later.
    }
  }
  const id = await enqueue(request);
  if (id) return { status: "queued", id };
  return { status: "failed", error: new BffError(0, "OFFLINE", "You're offline.") };
}

/** Drops a waiting or refused mutation of the current user (e.g. "Undo", "Discard"). */
export async function removeOutboxRecord(id: string): Promise<void> {
  const owner = getCurrentOwner();
  try {
    const db = await getDb();
    const record = await db?.get("outbox", id);
    if (!db || !record || record.owner !== owner) return;
    await db.delete("outbox", id);
  } catch {
    return;
  }
  await refreshPendingCount();
  notifyOutboxChanged();
}

/**
 * Rewrites a waiting or refused mutation of the current user in place, without sending it: `update` returns the
 * new record (same id and owner), or null to drop it. Runs under the replay's lock, so never mid-send.
 */
export async function updateOutboxRecord(id: string, update: (record: OutboxRecord) => OutboxRecord | null): Promise<void> {
  const owner = getCurrentOwner();
  try {
    await withLock(async () => {
      const db = await getDb();
      const record = await db?.get("outbox", id);
      if (!db || !record || record.owner !== owner) return;
      const next = update(record);
      if (next) await db.put("outbox", { ...next, id: record.id, owner: record.owner });
      else await db.delete("outbox", id);
    });
  } catch {
    return;
  }
  await refreshPendingCount();
  notifyOutboxChanged();
}

/** Sends a refused mutation again (clears `rejected`, then replays when online). */
export async function retryOutboxRecord(id: string): Promise<void> {
  const owner = getCurrentOwner();
  try {
    const db = await getDb();
    const record = await db?.get("outbox", id);
    if (!db || !record || record.owner !== owner) return;
    const next: OutboxRecord = { ...record, createdAt: Date.now() };
    delete next.rejected;
    await db.put("outbox", next);
  } catch {
    return;
  }
  await refreshPendingCount();
  notifyOutboxChanged();
  if (isOnline()) await replayOutbox();
  else void requestBackgroundSync();
}

// ---------------------------------------------------------------- replay

function rejectionOf(error: BffError): OutboxRejection {
  return { status: error.status, code: error.code, message: error.message, details: error.details, at: Date.now() };
}

/**
 * Sends the current user's waiting mutations, oldest first. Stops at the first network failure, 429 or 401
 * (the session is over: items stay for the next login of the same user). A mutation the API refuses for good
 * (4xx) is dropped, or kept with `rejected` when it asked for it (`keepRejected`); refused ones are not
 * replayed again. Safe to call often: runs under a Web Lock shared with the service worker.
 */
export async function replayOutbox(): Promise<{ sent: number; rejected: number; remaining: number }> {
  const owner = getCurrentOwner();
  if (!owner) return { sent: 0, rejected: 0, remaining: 0 };

  const result = await withLock(async () => {
    const db = await getDb();
    if (!db) return { sent: 0, rejected: 0 };
    const records = (await db.getAllFromIndex("outbox", "createdAt")).filter(
      (record) => record.owner === owner && !record.rejected
    );
    let sent = 0;
    let rejected = 0;
    for (const record of records) {
      try {
        await bffFetch(record.path, { method: record.method, body: record.body, redirectOnUnauthorized: false });
        await db.delete("outbox", record.id);
        sent += 1;
      } catch (e) {
        const error = e instanceof BffError ? e : new BffError(0, "NETWORK_ERROR", "Can't reach the server.");
        if (error.isNetworkError) {
          if (error.status === 0) reportNetworkFailure();
          break;
        }
        if (error.status === 401 || error.status === 429) break;
        if (record.keepRejected) await db.put("outbox", { ...record, rejected: rejectionOf(error) });
        else await db.delete("outbox", record.id);
        rejected += 1;
      }
    }
    return { sent, rejected };
  });

  const remaining = await refreshPendingCount();
  if (result.sent > 0 || result.rejected > 0) notifyOutboxChanged();
  if (result.sent > 0) {
    invalidateQueries();
    window.dispatchEvent(new CustomEvent(OUTBOX_REPLAYED_EVENT, { detail: { sent: result.sent } }));
  }
  return { ...result, remaining };
}
