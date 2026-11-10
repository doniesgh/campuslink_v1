"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { bff, errorMessage } from "@/lib/forum/bff";
import { initials, timeAgo } from "@/lib/forum/format";
import { S } from "@/lib/forum/strings";
import type { PostComment } from "@/lib/forum/types";
import { btnSm, textarea } from "@/lib/forum/ui";
import { useForum } from "./forum-provider";
import { CloseIcon, SendIcon } from "./icons";

type CommentWithMeta = PostComment & { updatedAt?: string };

const authorOf = (c: PostComment) => c.author as unknown as string | { _id?: string; name?: string; firstname?: string; lastname?: string } | undefined;
const nameOf = (c: PostComment) => {
  const a = authorOf(c);
  if (!a || typeof a === "string") return "?";
  return a.name ?? ([a.firstname, a.lastname].filter(Boolean).join(" ") || "?");
};
const idOf = (c: PostComment) => {
  const a = authorOf(c);
  return typeof a === "string" ? a : a?._id;
};

export function CommentsThread({ postId, onChanged }: { postId: string; onChanged: () => void }) {
  const { userId, canManage } = useForum();
  const [comments, setComments] = useState<CommentWithMeta[] | null>(null);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<PostComment | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const d = await bff<unknown>(`/posts/${postId}/comments?limit=100`);
      const list = Array.isArray(d) ? d : ((d as { comments?: unknown }).comments ?? []);
      setComments(list as CommentWithMeta[]);
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

  /** Ajouter un commentaire ou répondre (les réponses sont rattachées au commentaire racine). */
  async function submit(e: FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content) return;
    setBusy(true);
    try {
      await bff(`/posts/${postId}/comments`, { method: "POST", json: { content, parent: replyTo ? replyTo.parent ?? replyTo._id : null } });
      setText("");
      setReplyTo(null);
      await load();
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  /** Modifier son commentaire : PUT /comments/:id { content } */
  async function saveEdit(id: string) {
    const content = editText.trim();
    if (!content) return;
    setBusy(true);
    try {
      await bff(`/comments/${id}`, { method: "PUT", json: { content } });
      setEditId(null);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  /** Supprimer : DELETE /comments/:id (les réponses sont supprimées avec le commentaire) */
  async function remove(id: string) {
    setBusy(true);
    try {
      await bff(`/comments/${id}`, { method: "DELETE" });
      setConfirmId(null);
      await load();
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  // Le formulaire d'écriture s'affiche toujours, même si la liste n'a pas pu être chargée.
  const all = comments ?? [];
  const roots = all.filter((c) => !c.parent);
  const repliesOf = (id: string) => all.filter((c) => c.parent === id);

  const row = (c: CommentWithMeta, isReply: boolean) => {
    const mine = !userId || !idOf(c) || idOf(c) === userId; // identité inconnue : le backend tranche
    const edited = !!c.updatedAt && c.updatedAt !== c.createdAt;
    const link = "font-semibold hover:text-primary hover:underline";
    return (
      <li key={c._id} className={`flex gap-2 ${isReply ? "ml-10" : ""}`}>
        <span aria-hidden className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
          {initials(nameOf(c))}
        </span>
        <div className="min-w-0 flex-1">
          {editId === c._id ? (
            <div className="space-y-2">
              <textarea aria-label={S.editComment} className={`${textarea} min-h-20 w-full`} value={editText} onChange={(e) => setEditText(e.target.value)} maxLength={1000} />
              <div className="flex gap-2">
                <button disabled={busy || !editText.trim()} onClick={() => saveEdit(c._id)} className="inline-flex h-8 items-center rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{S.saveComment}</button>
                <button onClick={() => setEditId(null)} className={btnSm}>{S.cancel}</button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-muted px-3 py-2">
              <p className="text-sm font-semibold">{nameOf(c)}</p>
              <p className="whitespace-pre-line break-words text-sm">{c.content}</p>
            </div>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 px-3 text-xs text-muted-foreground">
            <span>{timeAgo(c.createdAt)}{edited ? ` · ${S.edited}` : ""}</span>
            {confirmId === c._id ? (
              <span className="flex flex-wrap items-center gap-2">
                <span>{S.deleteCommentQ}</span>
                <button disabled={busy} onClick={() => remove(c._id)} className="font-semibold text-destructive hover:underline">{S.confirmDelete}</button>
                <button onClick={() => setConfirmId(null)} className="hover:underline">{S.cancel}</button>
              </span>
            ) : (
              <>
                <button onClick={() => setReplyTo(c)} className={link}>{S.reply}</button>
                {mine && editId !== c._id && <button onClick={() => { setEditId(c._id); setEditText(c.content); }} className={link}>{S.editComment}</button>}
                {canManage(idOf(c)) && <button onClick={() => setConfirmId(c._id)} className="font-semibold hover:text-destructive hover:underline">{S.deleteComment}</button>}
              </>
            )}
          </div>
        </div>
      </li>
    );
  };

  return (
    <div className="border-t border-border">
      {error && <p role="alert" className="mx-4 mt-3 text-sm text-destructive">{error}</p>}
      <div className="px-4 py-4">
        {comments === null ? (
          error ? null : <div className="h-12 animate-pulse rounded-xl bg-muted" />
        ) : roots.length === 0 ? (
          <p className="text-sm text-muted-foreground">{S.noComments}</p>
        ) : (
          <ul className="space-y-4">
            {roots.map((c) => (
              <li key={c._id}>
                <ul className="space-y-2">
                  {row(c, false)}
                  {repliesOf(c._id).map((r) => row(r, true))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={submit} className="space-y-2 border-t border-border px-4 py-3">
        {replyTo && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            {S.replyingTo(nameOf(replyTo))}
            <button type="button" onClick={() => setReplyTo(null)} aria-label={S.cancelReply} className="flex size-5 items-center justify-center rounded-full bg-muted hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <CloseIcon className="size-3" />
            </button>
          </p>
        )}
        <div className="flex items-end gap-2">
          <label htmlFor={`c-${postId}`} className="sr-only">{S.commentPlaceholder}</label>
          <textarea
            id={`c-${postId}`}
            rows={1}
            maxLength={1000}
            className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-input bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder={S.commentPlaceholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button disabled={busy || !text.trim()} aria-label={S.sendComment} className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background disabled:opacity-50">
            <SendIcon className="size-5" />
          </button>
        </div>
      </form>
    </div>
  );
}
