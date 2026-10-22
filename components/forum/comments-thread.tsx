"use client";

import { useCallback, useEffect, useState } from "react";
import { bff, errorMessage } from "@/lib/forum/bff";
import { authorName, canManage, initials, timeAgo } from "@/lib/forum/format";
import { S } from "@/lib/forum/strings";
import type { PostComment, Viewer } from "@/lib/forum/types";

function Avatar({ name }: { name: string }) {
  return (
    <span aria-hidden className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
      {initials(name)}
    </span>
  );
}

export function CommentsThread({ postId, viewer, onChanged }: { postId: string; viewer: Viewer | null; onChanged: () => void }) {
  const [comments, setComments] = useState<PostComment[] | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const fetchComments = useCallback(() => bff<{ comments: PostComment[] }>(`/posts/${postId}/comments?limit=100`), [postId]);

  useEffect(() => {
    let off = false;
    fetchComments()
      .then((data) => {
        if (off) return;
        setComments(data.comments);
        setError("");
      })
      .catch((e) => !off && setError(errorMessage(e)));
    return () => {
      off = true;
    };
  }, [fetchComments]);

  async function remove(id: string) {
    setBusy(true);
    try {
      await bff(`/comments/${id}`, { method: "DELETE" });
      setConfirmId(null);
      setComments((await fetchComments()).comments);
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (!comments) return error ? <p role="alert" className="px-4 pb-4 text-sm text-destructive">{error}</p> : <div className="mx-4 mb-4 h-16 animate-pulse rounded-xl bg-muted" />;

  const roots = comments.filter((c) => !c.parent);
  const repliesOf = (id: string) => comments.filter((c) => c.parent === id);

  const row = (c: PostComment, isReply: boolean) => (
    <li key={c._id} className={`flex gap-2 ${isReply ? "ml-10" : ""}`}>
      <Avatar name={authorName(c.author)} />
      <div className="min-w-0">
        <div className="rounded-2xl bg-muted px-3 py-2">
          <p className="text-sm font-semibold">{authorName(c.author)}</p>
          <p className="whitespace-pre-line break-words text-sm">{c.content}</p>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 px-3 text-xs text-muted-foreground">
          <span>{timeAgo(c.createdAt)}</span>
          {canManage(viewer, c.author) &&
            (confirmId === c._id ? (
              <span className="flex flex-wrap items-center gap-2">
                <span>{S.deleteCommentQ}</span>
                <button disabled={busy} onClick={() => remove(c._id)} className="font-semibold text-destructive hover:underline">{S.confirmDelete}</button>
                <button onClick={() => setConfirmId(null)} className="hover:underline">{S.cancel}</button>
              </span>
            ) : (
              <button onClick={() => setConfirmId(c._id)} className="font-semibold hover:text-destructive hover:underline">{S.deleteComment}</button>
            ))}
        </div>
      </div>
    </li>
  );

  return (
    <div className="border-t border-border px-4 py-4">
      {error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}
      {roots.length === 0 ? (
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
  );
}
