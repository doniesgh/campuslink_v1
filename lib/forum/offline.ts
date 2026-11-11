
import { bff, BffError } from "./bff";
import type { Post, PostStatus, PostsPage, PostType } from "./types";
import { getDb } from "@/lib/offline/db";
import { getCurrentOwner } from "@/lib/offline/owner";
import { authorId } from "./format";
function cacheKey(path: string, owner: string) {
  return `${owner}::forum:${path}`;
}
export async function cacheSet(key: string, data: unknown) {
  try {
    const db = await getDb();
    const owner = getCurrentOwner();

    if (!db) {
      console.error("[CACHE] Database unavailable");
      return;
    }

    if (!owner) {
      console.error("[CACHE] No current owner");
      return;
    }

    const record = {
      key: cacheKey(key, owner),
      owner,
      data,
      savedAt: Date.now(),
    };

    await db.put("cache", record);

    console.log("[CACHE] Saved:", record.key);
  } catch (error) {
    console.error("[CACHE] Save failed:", key, error);
  }
}

// export async function cacheSet(key: string, data: unknown) {
//   try {
//     const db = await getDb();
//     const owner = getCurrentOwner();
//     if (!db || !owner) return;

//     await db.put("cache", {
//       key: cacheKey(key, owner),
//       owner,
//       data,
//       savedAt: Date.now(),
//     });
//   } catch {
//     // Continue without cache.
//   }
// }

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const db = await getDb();
    const owner = getCurrentOwner();
    if (!db || !owner) return null;

    const record = await db.get("cache", cacheKey(key, owner));
    return record ? (record.data as T) : null;
  } catch {
    return null;
  }
}

// export async function cachePosts(posts: Post[]) {
//   await Promise.all(
//     posts.map((post) =>
//       cacheSet(`/posts/${post._id}?view=0`, post)
//     )
//   );
// }
export async function cachePosts(posts: Post[]) {
  await Promise.all(
    posts.map((post) =>
      cacheSet(`/posts/${post._id}?view=0`, post)
    )
  );
}
export async function cachedGet<T>(
  path: string,
  fallback?: () => Promise<T | null>
): Promise<{ data: T; stale: boolean }> {
  const offline = typeof navigator !== "undefined" && !navigator.onLine;

  try {
    if (offline) throw new TypeError("offline");
    const data = await bff<T>(path);
    await cacheSet(path, data);
    return { data, stale: false };
  } catch (error) {
    // Ne relancer que de vraies erreurs HTTP 4xx (401, 403, 404…), pas un échec réseau/SW
    const status = (error as { status?: number }).status;
    if (error instanceof BffError && !offline && status && status >= 400 && status < 500) {
      throw error;
    }

    const cached = await cacheGet<T>(path);
    if (cached !== null) return { data: cached, stale: true };

    const fallbackData = fallback ? await fallback() : null;
    if (fallbackData !== null) return { data: fallbackData, stale: true };

    throw error;
  }
}
// export async function cachedGet<T>(
//   path: string,
//   fallback?: () => Promise<T | null>
// ): Promise<{ data: T; stale: boolean }> {
//   try {
//     if (typeof navigator !== "undefined" && !navigator.onLine) {
//       throw new TypeError("offline");
//     }

//     const data = await bff<T>(path);

//     // Wait until the response is saved.
//     await cacheSet(path, data);

//     return { data, stale: false };
//   } catch (error) {
//     if (error instanceof BffError) {
//       throw error;
//     }

//     const cached = await cacheGet<T>(path);

//     if (cached !== null) {
//       return { data: cached, stale: true };
//     }

//     const fallbackData = fallback ? await fallback() : null;

//     if (fallbackData !== null) {
//       return { data: fallbackData, stale: true };
//     }

//     throw error;
//   }
// }
// export async function cachedGet<T>(
//   path: string,
//   fallback?: () => Promise<T | null>
// ): Promise<{ data: T; stale: boolean }> {
//   try {
//     if (typeof navigator !== "undefined" && !navigator.onLine) {
//       throw new TypeError("offline");
//     }

//     const data = await bff<T>(path);
//     void cacheSet(path, data);

//     return { data, stale: false };
//   } catch (error) {
//     if (error instanceof BffError) throw error;

//     const hit = await cacheGet<T>(path);
//     const fallbackData = hit ?? (fallback ? await fallback() : null);

//     if (fallbackData !== null) {
//       return { data: fallbackData, stale: true };
//     }

//     throw error;
//   }
// }

// export async function cachedGet<T>(
//   path: string,
//   fallback?: () => Promise<T | null>
// ): Promise<{ data: T; stale: boolean }> {
//   try {
//     if (typeof navigator !== "undefined" && !navigator.onLine) {
//       throw new TypeError("offline");
//     }

//     const data = await bff<T>(path);

//     // Cache the complete paginated response.
//     void cacheSet(path, data);

//     return { data, stale: false };
//   } catch (error) {
//     // A real HTTP response must not be hidden by stale cache.
//     if (error instanceof BffError) {
//       throw error;
//     }

//     const cached = await cacheGet<T>(path);

//     if (cached !== null) {
//       return { data: cached, stale: true };
//     }

//     const fallbackData = fallback ? await fallback() : null;

//     if (fallbackData !== null) {
//       return { data: fallbackData, stale: true };
//     }

//     throw error;
//   }
// }

type Filters = { q: string; type: PostType | ""; status: PostStatus | "" };

/** Le backend renvoie un simple tableau pour /posts/me : on le met au format d'une page. */
export function toPage(data: PostsPage | Post[]): PostsPage {
  return Array.isArray(data) ? { posts: data, page: 1, pages: 1, total: data.length } : data;
}

export function filterPosts(posts: Post[], f: Filters): Post[] {
  const q = f.q.trim().toLowerCase();
  return posts
    .filter((p) => (!f.type || p.type === f.type) && (!f.status || p.status === f.status))
    .filter((p) => !q || [p.title, p.description, p.location ?? "", ...(p.tags ?? [])].join(" ").toLowerCase().includes(q))
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}
export async function searchCachedPosts(
  filters: Filters & { mine?: boolean }
): Promise<PostsPage | null> {
  try {
    const db = await getDb();
    const owner = getCurrentOwner();

    if (!db || !owner) return null;

    const all = await db.getAll("cache");

    const cached = all
      .filter(
        (r) =>
          r.owner === owner &&
          r.key.startsWith(`${owner}::forum:/posts/`) &&
          r.key.endsWith("?view=0")
      )
      .map((r) => r.data as Post);

    // Remove duplicates.
    const unique = Array.from(
      new Map(cached.map((p) => [p._id, p])).values()
    );

    const owned = unique.filter(
      (p) => !filters.mine || authorId(p) === owner
    );

    const posts = filterPosts(owned, filters);

    return {
      posts,
      page: 1,
      pages: 1,
      total: posts.length,
    };
  } catch (error) {
    console.error("[CACHE] Search failed:", error);
    return null;
  }
}
// export async function searchCachedPosts(filters: Filters & { mine?: boolean }): Promise<PostsPage | null> {
//   try {
//     const db = await getDb();
//     const owner = getCurrentOwner();
//     if (!db || !owner) return null;

//     const all = await db.getAll("cache");
//     const cached = all
//       .filter((r) => r.owner === owner && r.key.startsWith(`${owner}::forum:/posts/`) && r.key.endsWith("?view=0"))
//       .map((r) => r.data as Post)
//       .filter((p) => !filters.mine || authorId(p) === owner); // « Mes posts » : seulement les miens

//     const posts = filterPosts(cached, filters);
//     if (!posts.length) return null;
//     return { posts, page: 1, pages: 1, total: posts.length };
//   } catch {
//     return null;
//   }
// }

// export async function searchCachedPosts(filters: {
//   q: string;
//   type: PostType | "";
//   status: PostStatus | "";
// }): Promise<PostsPage | null> {
//   try {
//     const db = await getDb();
//     const owner = getCurrentOwner();
//     if (!db || !owner) return null;

//     const all = await db.getAll("cache");

//     const posts = all
//       .filter(
//         (record) =>
//           record.owner === owner &&
//           record.key.startsWith(`${owner}::forum:/posts/`) &&
//           record.key.endsWith("?view=0")
//       )
//       .map((record) => record.data as Post)
//       .filter(
//         (post) =>
//           (!filters.type || post.type === filters.type) &&
//           (!filters.status || post.status === filters.status)
//       )
//       .filter((post) => {
//         const q = filters.q.trim().toLowerCase();
//         if (!q) return true;

//         return [
//           post.title,
//           post.description,
//           post.location ?? "",
//           ...(post.tags ?? []),
//         ]
//           .join(" ")
//           .toLowerCase()
//           .includes(q);
//       })
//       .sort(
//         (a, b) =>
//           +new Date(b.createdAt) - +new Date(a.createdAt)
//       );

//     if (!posts.length) return null;

//     return {
//       posts,
//       page: 1,
//       pages: 1,
//       total: posts.length,
//     };
//   } catch {
//     return null;
//   }
// }
