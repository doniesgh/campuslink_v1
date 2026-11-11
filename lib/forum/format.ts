import type { Post } from "./types";

export const fmtDate = (d: string, withTime = false) =>
  new Date(d).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });

export function timeAgo(d: string) {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d ago`;
  return fmtDate(d);
}


export const authorName = (p: Post): string => {
  if (!p.author || typeof p.author === "string") {
    return "Unknown";
  }

  const firstname = p.author.firstname?.trim() ?? "";
  const lastname = p.author.lastname?.trim() ?? "";

  return `${firstname} ${lastname}`.trim() ||  "Unknown";
};

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";

/** Id de l'auteur, quelle que soit la forme renvoyée (id seul, objet avec _id / id, champ à plat). */
export const authorId = (p: Post): string | undefined => {
  const raw = p as unknown as Record<string, unknown>;
  const a = raw.author;
  const pick = (v: unknown): string | undefined => {
    if (v == null) return undefined;
    if (typeof v === "string" || typeof v === "number") return String(v);
    if (typeof v === "object") {
      const o = v as Record<string, unknown>;
      return pick(o._id ?? o.id ?? o.userId ?? o.$oid);
    }
    return undefined;
  };
  return pick(a) ?? pick(raw.authorId) ?? pick(raw.author_id) ?? pick(raw.user) ?? pick(raw.createdBy);
};
