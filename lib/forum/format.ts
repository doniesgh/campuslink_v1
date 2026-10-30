import type { Author, Viewer } from "./types";

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

/** "Firstname Lastname" of a post or comment author; "Unknown" when the account is gone. */
export const authorName = (author: Author | string | null | undefined) => {
  if (!author || typeof author !== "object") return "Unknown";
  return [author.firstname, author.lastname].map((part) => part?.trim()).filter(Boolean).join(" ") || "Unknown";
};

const authorId = (author: Author | string | null | undefined) =>
  typeof author === "string" ? author : (author?._id ?? null);

/** The author of the post or comment, or an admin. */
export const canManage = (viewer: Viewer | null, author: Author | string | null | undefined) =>
  !!viewer && (viewer.role === "ADMIN" || authorId(author) === viewer.id);

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
