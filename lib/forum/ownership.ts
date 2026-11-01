import type { Post } from "./types";

/** Id de l'auteur d'un post, quelle que soit la forme renvoyée par l'API (id seul ou objet avec _id / id). */
export function authorIdOf(p: Post): string | undefined {
  const raw = p as unknown as Record<string, unknown>;
  const pick = (v: unknown): string | undefined => {
    if (v == null) return undefined;
    if (typeof v === "string" || typeof v === "number") return String(v);
    if (typeof v === "object") {
      const o = v as Record<string, unknown>;
      return pick(o._id ?? o.id ?? o.userId ?? o.$oid);
    }
    return undefined;
  };
  return pick(raw.author) ?? pick(raw.authorId) ?? pick(raw.author_id);
}
