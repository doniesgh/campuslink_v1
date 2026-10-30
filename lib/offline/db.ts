// IndexedDB of the offline data layer (browser only). Schema shared with public/sw.js:
// keep DB_NAME / DB_VERSION / store names in sync with the service worker.
import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from "idb";

export const DB_NAME = "campuslink";
export const DB_VERSION = 1;

/** A saved GET answer (stale-while-revalidate). `key` = "<owner>::<query key>". */
export type CacheRecord = { key: string; owner: string; data: unknown; savedAt: number };

/** Why the API refused a queued mutation for good (4xx). */
export type OutboxRejection = { status: number; code: string; message: string; details?: unknown; at: number };

/**
 * A mutation waiting to be sent. `id` = "<owner>|<key>", the key being "<METHOD> <path>" unless the caller
 * chose one (last write wins per key).
 */
export type OutboxRecord = {
  id: string;
  owner: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  createdAt: number;
  /** Module that queued it (e.g. "users"): its pages list and show their own waiting changes. */
  scope?: string;
  /** What the module needs to show it (e.g. the user it is about). */
  info?: Record<string, unknown>;
  /** On a definitive refusal (4xx), keep it with `rejected` (shown to the user) instead of dropping it. */
  keepRejected?: boolean;
  /** Set when the API refused it: no longer replayed until retried or replaced. */
  rejected?: OutboxRejection;
};

export type MetaRecord = { key: string; value: unknown };

interface CampusLinkDB extends DBSchema {
  cache: { key: string; value: CacheRecord };
  outbox: { key: string; value: OutboxRecord; indexes: { createdAt: number } };
  meta: { key: string; value: MetaRecord };
}

export type CampusLinkDatabase = IDBPDatabase<CampusLinkDB>;

let dbPromise: Promise<CampusLinkDatabase> | null = null;

/** Opens (and creates) the database; resolves to null when IndexedDB is unavailable (SSR, private modes). */
export async function getDb(): Promise<CampusLinkDatabase | null> {
  if (typeof indexedDB === "undefined") return null;
  if (!dbPromise) {
    dbPromise = openDB<CampusLinkDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("cache")) db.createObjectStore("cache", { keyPath: "key" });
        if (!db.objectStoreNames.contains("outbox")) {
          db.createObjectStore("outbox", { keyPath: "id" }).createIndex("createdAt", "createdAt");
        }
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
      },
      // Another tab deletes the database (logout) or upgrades it: let it proceed.
      blocking() {
        void closeDb();
      },
      terminated() {
        dbPromise = null;
      },
    });
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  try {
    return await dbPromise;
  } catch {
    return null;
  }
}

export async function closeDb(): Promise<void> {
  const pending = dbPromise;
  dbPromise = null;
  if (!pending) return;
  try {
    (await pending).close();
  } catch {
    // already closed or never opened
  }
}

/** Deletes the whole database (logout). Never throws. */
export async function destroyDb(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  await closeDb();
  try {
    await deleteDB(DB_NAME);
  } catch {
    // ignore
  }
}
