// Module hors ligne : cache IndexedDB (posts, commentaires, profil) + file d'attente des actions.
import { BffError, bff } from "./bff";
import type { Post, PostStatus, PostsPage, PostType } from "./types";

const DB_NAME = "campuslink-forum";

export interface OutboxItem {
  path: string;
  method: string;
  json?: unknown;
  /** Deux actions avec la même clé s'annulent (ex. like puis unlike hors ligne). */
  dedupeKey?: string;
  createdAt: number;
}
type Stored = OutboxItem & { seq: number };

let dbp: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB unavailable"));
  if (!dbp) {
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => {
        r.result.createObjectStore("cache");
        r.result.createObjectStore("outbox", { autoIncrement: true });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  return dbp;
}

async function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise<T>((res, rej) => {
    const req = fn(d.transaction(store, mode).objectStore(store));
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

async function cursor<T>(store: string, each: (key: IDBValidKey, value: unknown) => T | undefined): Promise<T[]> {
  const d = await db();
  return new Promise((res, rej) => {
    const out: T[] = [];
    const req = d.transaction(store).objectStore(store).openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (!c) return res(out);
      const v = each(c.key, c.value);
      if (v !== undefined) out.push(v);
      c.continue();
    };
    req.onerror = () => rej(req.error);
  });
}

const notify = (name: string) => typeof window !== "undefined" && window.dispatchEvent(new Event(name));

/* ----------------------------- Cache de lecture ----------------------------- */

export async function cacheSet(key: string, data: unknown) {
  try {
    await run("cache", "readwrite", (s) => s.put({ data, savedAt: Date.now() }, key));
  } catch {
    /* cache indisponible (navigation privée…) : on continue sans */
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const hit = await run<{ data: T } | undefined>("cache", "readonly", (s) => s.get(key));
    return hit ? hit.data : null;
  } catch {
    return null;
  }
}

/** Mémorise chaque post pour pouvoir l'ouvrir et le rechercher hors ligne. */
export async function cachePosts(posts: Post[]) {
  await Promise.all(posts.map((p) => cacheSet(`/posts/${p._id}?view=0`, p)));
}

/**
 * GET avec cache : réseau d'abord (et on mémorise), cache si le réseau est coupé.
 * `stale` vaut true quand la donnée vient du cache. Les erreurs HTTP (404, 403…) sont relancées telles quelles.
 */
export async function cachedGet<T>(path: string, fallback?: () => Promise<T | null>): Promise<{ data: T; stale: boolean }> {
  try {
    if (typeof navigator !== "undefined" && !navigator.onLine) throw new TypeError("offline");
    const data = await bff<T>(path);
    void cacheSet(path, data);
    return { data, stale: false };
  } catch (e) {
    if (e instanceof BffError) throw e;
    const hit = (await cacheGet<T>(path)) ?? (fallback ? await fallback() : null);
    if (hit) return { data: hit, stale: true };
    throw e;
  }
}
export function filterPosts(
  posts: Post[],
  f: {
    q?: string;
    type?: PostType | "";
    status?: PostStatus | "";
  }
): Post[] {
  const q = (f.q ?? "").trim().toLowerCase();

  return posts
    .filter(
      (p) =>
        (!f.type || p.type === f.type) &&
        (!f.status || p.status === f.status)
    )
    .filter(
      (p) =>
        !q ||
        [
          p.title,
          p.description,
          p.location ?? "",
          ...(p.tags ?? []),
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime()
    );
}
/**
 * Convertit une réponse API en PostsPage.
 * Accepte une liste de posts ou une page paginée.
 */
export function toPage(data: PostsPage | Post[]): PostsPage {
  if (Array.isArray(data)) {
    return {
      posts: data,
      page: 1,
      pages: 1,
      total: data.length,
    };
  }

  return {
    posts: data.posts ?? [],
    page: data.page ?? 1,
    pages: data.pages ?? 1,
    total: data.total ?? data.posts?.length ?? 0,
  };
}

/**
 * Recherche locale dans les posts déjà vus
 * lorsque la recherche serveur est indisponible.
 */
export async function searchCachedPosts(
  f: {
    q: string;
    type: PostType | "";
    status: PostStatus | "";
  }
): Promise<PostsPage | null> {
  try {
    const all = await cursor<Post>("cache", (key, value) => {
      const k = String(key);

      if (!/^\/posts\/[^/?]+\?view=0$/.test(k)) {
        return undefined;
      }

      return (value as { data: Post }).data;
    });

    const posts = filterPosts(all, f);

    return posts.length > 0
      ? {
          posts,
          page: 1,
          pages: 1,
          total: posts.length,
        }
      : null;
  } catch (error) {
    console.error("Offline post search failed:", error);
    return null;
  }
}
/* ------------------------- File d'attente des actions ------------------------ */

async function outboxAll(): Promise<Stored[]> {
  try {
    return await cursor<Stored>("outbox", (key, value) => ({ ...(value as OutboxItem), seq: key as number }));
  } catch {
    return [];
  }
}

export const pendingCount = async () => (await outboxAll()).length;

async function enqueue(path: string, init: { method: string; json?: unknown }, dedupeKey?: string): Promise<{ queued: true }> {
  try {
    if (dedupeKey) {
      const twin = (await outboxAll()).find((i) => i.dedupeKey === dedupeKey);
      if (twin) {
        await run("outbox", "readwrite", (s) => s.delete(twin.seq));
        notify("forum:queue");
        return { queued: true };
      }
    }
    const item: OutboxItem = { path, method: init.method, json: init.json, dedupeKey, createdAt: Date.now() };
    await run("outbox", "readwrite", (s) => s.add(item));
    notify("forum:queue");
  } catch {
    throw new Error("Offline and unable to save this action on the device.");
  }
  return { queued: true };
}

/**
 * Action d'écriture (POST/PUT/PATCH/DELETE). En ligne : envoyée tout de suite.
 * Hors ligne (ou réseau coupé) : mise en file et rejouée au retour du réseau.
 */
export async function mutate<T = unknown>(
  path: string,
  init: { method: string; json?: unknown },
  opts: { dedupeKey?: string } = {}
): Promise<{ queued: boolean; data?: T }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return enqueue(path, init, opts.dedupeKey);
  try {
    return { queued: false, data: await bff<T>(path, init) };
  } catch (e) {
    if (e instanceof BffError) throw e;
    return enqueue(path, init, opts.dedupeKey);
  }
}

let flushing = false;

/** Rejoue la file dans l'ordre. S'arrête au premier échec réseau/serveur ; abandonne les actions refusées (4xx). */
export async function flushOutbox(): Promise<{ sent: number; dropped: number; left: number }> {
  if (flushing) return { sent: 0, dropped: 0, left: await pendingCount() };
  flushing = true;
  let sent = 0;
  let dropped = 0;
  try {
    for (const it of await outboxAll()) {
      try {
        await bff(it.path, { method: it.method, json: it.json });
        await run("outbox", "readwrite", (s) => s.delete(it.seq));
        sent++;
      } catch (e) {
        const refused = e instanceof BffError && e.status >= 400 && e.status < 500 && ![401, 408, 429].includes(e.status);
        if (!refused) break;
        await run("outbox", "readwrite", (s) => s.delete(it.seq));
        dropped++;
      }
    }
  } finally {
    flushing = false;
  }
  return { sent, dropped, left: await pendingCount() };
}
