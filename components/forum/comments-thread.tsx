
"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";

import { errorMessage } from "@/lib/forum/bff";
import { initials, timeAgo } from "@/lib/forum/format";
import { cachedGet, mutate } from "@/lib/forum/offline";
import { S } from "@/lib/forum/strings";
import type { Author, PostComment } from "@/lib/forum/types";
import { btnPrimarySm, btnSm, textarea } from "@/lib/forum/ui";

import { useForum } from "./forum-provider";
import { CloseIcon, CloudOffIcon, SendIcon } from "./icons";

function getAuthorName(author: Author | string | null | undefined): string {
  if (!author) return "Unknown";

  if (typeof author === "string") {
    return "Unknown";
  }

  const firstname = author.firstname?.trim() ?? "";
  const lastname = author.lastname?.trim() ?? "";

  return `${firstname} ${lastname}`.trim() || "Unknown";
}

function getAuthorId(author: Author | string | null | undefined): string {
  if (!author) return "";
  return typeof author === "string" ? author : author._id;
}

function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-900"
    >
      {initials(name)}
    </span>
  );
}

export function CommentsThread({
  postId,
  onChanged,
}: {
  postId: string;
  onChanged: () => void;
}) {
  const { userId, userName, canManage } = useForum();

  const [comments, setComments] = useState<PostComment[] | null>(null);
  const [pending, setPending] = useState<PostComment[]>([]);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<PostComment | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const { data } = await cachedGet<{ comments: PostComment[] }>(
        `/posts/${postId}/comments?limit=100`
      );

      console.log("COMMENTS API:", data.comments);
      console.log("FIRST AUTHOR:", data.comments[0]?.author);

      setComments(data.comments);
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [postId]);

  useEffect(() => {
    void load();

    const onSynced = () => {
      setPending([]);
      void load();
    };

    window.addEventListener("forum:synced", onSynced);

    return () => {
      window.removeEventListener("forum:synced", onSynced);
    };
  }, [load]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const content = text.trim();
    if (!content || busy) return;

    const parent = replyTo
      ? replyTo.parent ?? replyTo._id
      : null;

    setBusy(true);

    try {
      const result = await mutate(`/posts/${postId}/comments`, {
        method: "POST",
        json: { content, parent },
      });

      if (result.queued) {
        const name = (userName ?? S.you).trim() || S.you;
        const parts = name.split(/\s+/);
        const firstname = parts.shift() ?? "";
        const lastname = parts.join(" ");

        const optimisticComment: PostComment = {
          _id: `tmp-${Date.now()}`,
          post: postId,
          author: {
            _id: userId ?? "",
            firstname,
            lastname,
          },
          content,
          parent,
          createdAt: new Date().toISOString(),
        };

        setPending((previous) => [
          ...previous,
          optimisticComment,
        ]);
      } else {
        await load();
        onChanged();
      }

      setText("");
      setReplyTo(null);
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(id: string) {
    const content = editText.trim();

    if (!content || busy) return;

    setBusy(true);

    try {
      const result = await mutate(`/comments/${id}`, {
        method: "PUT",
        json: { content },
      });

      setComments((previous) =>
        previous?.map((comment) =>
          comment._id === id
            ? {
              ...comment,
              content,
              updatedAt: new Date().toISOString(),
            }
            : comment
        ) ?? previous
      );

      setEditId(null);
      setEditText("");

      if (!result.queued) {
        await load();
        onChanged();
      }

      setError("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (busy) return;

    setBusy(true);

    try {
      const result = await mutate(`/comments/${id}`, {
        method: "DELETE",
      });

      setComments((previous) =>
        previous?.filter(
          (comment) => comment._id !== id && comment.parent !== id
        ) ?? previous
      );

      setPending((previous) =>
        previous.filter(
          (comment) => comment._id !== id && comment.parent !== id
        )
      );

      setConfirmId(null);

      if (!result.queued) {
        await load();
        onChanged();
      }

      setError("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!comments) {
    return error ? (
      <p
        role="alert"
        className="px-4 pb-4 text-sm text-red-600"
      >
        {error}
        <button
          type="button"
          onClick={() => void load()}
          className="ml-2 underline"
        >
          {S.retry}
        </button>
      </p>
    ) : (
      <div
        className="mx-4 mb-4 h-16 animate-pulse rounded-xl bg-slate-100"
        aria-busy="true"
      />
    );
  }

  const all = [...comments, ...pending];
  const roots = all.filter((comment) => !comment.parent);

  const repliesOf = (id: string) =>
    all.filter((comment) => comment.parent === id);

  const row = (comment: PostComment, isReply: boolean) => {
    const waiting = comment._id.startsWith("tmp-");
    const authorId = getAuthorId(comment.author);
    const name = getAuthorName(comment.author);
    const mine = !userId || authorId === userId; // identité inconnue : le backend tranche

    const edited =
      !!comment.updatedAt &&
      comment.updatedAt !== comment.createdAt;

    const link =
      "font-semibold hover:text-blue-600 hover:underline";

    return (
      <li
        key={comment._id}
        className={`flex gap-2 ${isReply ? "ml-6 sm:ml-10" : ""}`}
      >
        <Avatar name={name} />

        <div className="min-w-0 flex-1">
          {editId === comment._id ? (
            <div className="space-y-2">
              <textarea
                aria-label={S.editComment}
                className={`${textarea} min-h-20 w-full`}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                maxLength={1000}
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy || !editText.trim()}
                  onClick={() => void saveEdit(comment._id)}
                  className={`${btnPrimarySm}`}
                >
                  {S.saveComment}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditId(null);
                    setEditText("");
                  }}
                  className={btnSm}
                >
                  {S.cancel}
                </button>
              </div>
            </div>
          ) : (
            <div
              className={`rounded-xl px-3 py-2 ${waiting ? "bg-slate-100/60" : "bg-slate-100"
                }`}
            >
              <p className="text-sm font-semibold">{name}</p>

              <p className="whitespace-pre-line break-words text-sm">
                {comment.content}
              </p>
            </div>
          )}

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 px-3 text-xs text-slate-500">
            <span>
              {timeAgo(comment.createdAt)}
              {edited ? ` · ${S.edited}` : ""}
            </span>

            {waiting ? (
              <span className="inline-flex items-center gap-1">
                <CloudOffIcon className="size-3.5" />
                {S.pendingTag}
              </span>
            ) : confirmId === comment._id ? (
              <span className="flex flex-wrap items-center gap-2">
                <span>{S.deleteCommentQ}</span>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void remove(comment._id)}
                  className="font-semibold text-red-600 hover:underline"
                >
                  {S.confirmDelete}
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmId(null)}
                  className="hover:underline"
                >
                  {S.cancel}
                </button>
              </span>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setReplyTo(comment)}
                  className={link}
                >
                  {S.reply}
                </button>

                {mine && editId !== comment._id && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditId(comment._id);
                      setEditText(comment.content);
                    }}
                    className={link}
                  >
                    {S.editComment}
                  </button>
                )}

                {canManage(authorId) && (
                  <button
                    type="button"
                    onClick={() => setConfirmId(comment._id)}
                    className="font-semibold hover:text-red-600 hover:underline"
                  >
                    {S.deleteComment}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </li>
    );
  };

  return (
    <div className="border-t border-slate-200">
      {error && (
        <p
          role="alert"
          className="mx-4 mt-3 text-sm text-red-600"
        >
          {error}
        </p>
      )}

      <div className="px-4 py-4">
        {roots.length === 0 ? (
          <p className="text-sm text-slate-500">
            {S.noComments}
          </p>
        ) : (
          <ul className="space-y-4">
            {roots.map((comment) => (
              <li key={comment._id}>
                <ul className="space-y-2">
                  {row(comment, false)}

                  {repliesOf(comment._id).map((reply) =>
                    row(reply, true)
                  )}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form
        onSubmit={submit}
        className="space-y-2 border-t border-slate-200 px-4 py-3"
      >
        {replyTo && (
          <p className="flex items-center gap-2 text-xs text-slate-500">
            {S.replyingTo(getAuthorName(replyTo.author))}

            <button
              type="button"
              onClick={() => setReplyTo(null)}
              aria-label={S.cancelReply}
              className="flex size-5 items-center justify-center rounded-full bg-slate-100 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <CloseIcon className="size-3" />
            </button>
          </p>
        )}

        <div className="flex items-end gap-2">
          <label
            htmlFor={`c-${postId}`}
            className="sr-only"
          >
            {S.commentPlaceholder}
          </label>

          <textarea
            id={`c-${postId}`}
            rows={1}
            maxLength={1000}
            className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            placeholder={S.commentPlaceholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          <button
            type="submit"
            disabled={busy || !text.trim()}
            aria-label={S.sendComment}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-blue-900 text-white transition-colors hover:bg-blue-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ring-offset-white disabled:opacity-50"
          >
            <SendIcon className="size-5" />
          </button>
        </div>
      </form>
    </div>
  );
}
