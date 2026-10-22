"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BffError, bff, errorMessage } from "@/lib/forum/bff";
import { authorName, canManage, fmtDate, initials } from "@/lib/forum/format";
import { S } from "@/lib/forum/strings";
import { STATUSES, type Post, type PostComment, type PostStatus, type Viewer } from "@/lib/forum/types";
import { btnDanger, btnDangerGhost, btnSm, panel } from "@/lib/forum/ui";
import { STATUS_ICONS, StatusBadge, TypeBadge } from "./badges";
import { ArrowLeftIcon, CommentIcon, EyeIcon, HeartIcon, IconCircle, TrashIcon } from "./icons";
import { PostMedia } from "./post-media";

export function PostDetail({ id, viewer }: { id: string; viewer: Viewer | null }) {
  const router = useRouter();
  const listPath = usePathname().replace(/\/[^/]+\/?$/, "");
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [error, setError] = useState("");
  const [gone, setGone] = useState(false);
  const [confirmPost, setConfirmPost] = useState(false);
  const [confirmComment, setConfirmComment] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Le premier chargement compte une vue ; les rechargements (après une action) passent ?view=0.
  const fetchAll = useCallback(
    (countView: boolean) =>
      Promise.all([
        bff<Post>(`/posts/${id}${countView ? "" : "?view=0"}`),
        bff<{ comments: PostComment[] }>(`/posts/${id}/comments?limit=100`),
      ]),
    [id]
  );

  const show = useCallback(([p, c]: [Post, { comments: PostComment[] }]) => {
    setPost(p);
    setComments(c.comments);
    setError("");
  }, []);

  const fail = useCallback((e: unknown) => {
    if (e instanceof BffError && (e.status === 404 || e.status === 400)) setGone(true);
    else setError(errorMessage(e));
  }, []);

  useEffect(() => {
    let off = false;
    fetchAll(true)
      .then((data) => !off && show(data))
      .catch((e) => !off && fail(e));
    return () => {
      off = true;
    };
  }, [fetchAll, show, fail]);

  const load = () => fetchAll(false).then(show, fail);

  async function run(action: () => Promise<unknown>, after?: () => void) {
    setBusy(true);
    try {
      await action();
      if (after) after();
      else await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
      setConfirmPost(false);
      setConfirmComment(null);
    }
  }

  const back = (
    <Link href={listPath} className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
      <IconCircle tone="primary" size="sm"><ArrowLeftIcon /></IconCircle>
      {S.back}
    </Link>
  );

  if (gone)
    return (
      <div className={`${panel} p-10 text-center`}>
        <p className="font-medium">{S.notFound}</p>
        <div className="mt-3 flex justify-center">{back}</div>
      </div>
    );
  if (!post)
    return error ? (
      <p role="alert" className="text-destructive">{error} <button onClick={load} className="underline">{S.retry}</button></p>
    ) : (
      <div className="h-64 animate-pulse rounded-2xl bg-muted" aria-busy="true" />
    );

  const roots = comments.filter((c) => !c.parent);
  const repliesOf = (cid: string) => comments.filter((c) => c.parent === cid);
  const name = authorName(post.author);
  const manageable = canManage(viewer, post.author);

  const commentItem = (c: PostComment, isReply: boolean) => (
    <li key={c._id} className={`flex gap-3 ${isReply ? "ml-6 border-l-2 border-border pl-4" : ""}`}>
      <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
        {initials(authorName(c.author))}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 text-sm">
          <span className="font-medium">{authorName(c.author)}</span>
          <span className="text-xs text-muted-foreground">{fmtDate(c.createdAt, true)}</span>
          {isReply && <span className="text-xs text-muted-foreground">· {S.reply}</span>}
        </div>
        <p className="mt-1 whitespace-pre-line break-words text-sm">{c.content}</p>
        {canManage(viewer, c.author) && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {confirmComment === c._id ? (
              <>
                <button disabled={busy} onClick={() => run(() => bff(`/comments/${c._id}`, { method: "DELETE" }))} className={btnDanger}>{S.confirmDelete}</button>
                <button onClick={() => setConfirmComment(null)} className={btnSm}>{S.cancel}</button>
                {!isReply && <span className="text-xs text-muted-foreground">{S.deleteCommentWarn}</span>}
              </>
            ) : (
              <button onClick={() => setConfirmComment(c._id)} className={btnDangerGhost}>{S.deleteComment}</button>
            )}
          </div>
        )}
      </div>
    </li>
  );

  const stats = [
    { label: S.likes, value: post.likesCount, icon: <HeartIcon />, tone: "heart" as const },
    { label: S.commentsLabel, value: post.commentsCount, icon: <CommentIcon />, tone: "primary" as const },
    { label: S.views, value: post.views, icon: <EyeIcon />, tone: "muted" as const },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-6">
        {back}

        <article className={`${panel} overflow-hidden shadow-sm`}>
          <PostMedia post={post} />
          <div className="p-6">
            <div className="mb-3 flex flex-wrap gap-2">
              <TypeBadge type={post.type} />
              <StatusBadge status={post.status} />
            </div>
            <h2 className="text-xl font-semibold leading-snug">{post.title}</h2>
            <div className="mt-3 flex items-center gap-3">
              <span aria-hidden className="flex size-10 items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-foreground">{initials(name)}</span>
              <p className="text-sm">
                <span className="font-medium">{name}</span>
                <span className="block text-xs text-muted-foreground">{fmtDate(post.createdAt, true)}</span>
              </p>
            </div>
            <p className="mt-4 max-w-prose whitespace-pre-line text-sm leading-relaxed">{post.description}</p>
            {post.tags.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2">
                {post.tags.map((t) => (
                  <li key={t} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">#{t}</li>
                ))}
              </ul>
            )}
          </div>
        </article>

        <section aria-labelledby="mod-comments" className={`${panel} p-6`}>
          <h3 id="mod-comments" className="mb-4 flex items-center gap-2 text-base font-semibold">
            <IconCircle tone="primary" size="sm"><CommentIcon /></IconCircle>
            {S.comments(comments.length)}
          </h3>
          {roots.length === 0 ? (
            <p className="text-sm text-muted-foreground">{S.noComments}</p>
          ) : (
            <ul className="space-y-5">
              {roots.map((c) => (
                <li key={c._id}>
                  <ul className="space-y-4">
                    {commentItem(c, false)}
                    {repliesOf(c._id).map((r) => commentItem(r, true))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start" aria-label={S.moderation}>
        {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        {manageable && (
          <div className={`${panel} p-4`}>
            <h3 className="mb-3 text-sm font-semibold">{S.statusLabel}</h3>
            <div className="grid gap-2" role="group" aria-label={S.statusLabel}>
              {STATUSES.map((s: PostStatus) => {
                const Icon = STATUS_ICONS[s];
                const on = post.status === s;
                return (
                  <button
                    key={s}
                    disabled={busy || on}
                    aria-pressed={on}
                    onClick={() => run(() => bff(`/posts/${id}/status`, { method: "PATCH", json: { status: s } }))}
                    className={`flex h-11 items-center gap-3 rounded-full border py-1 pl-1.5 pr-4 text-left text-sm transition-colors disabled:cursor-default ${
                      on ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-accent"
                    }`}
                  >
                    <span aria-hidden className={`flex size-8 items-center justify-center rounded-full [&>svg]:size-4 ${on ? "bg-primary-foreground/20" : "bg-accent text-accent-foreground"}`}><Icon /></span>
                    {S.status[s]}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <dl className={`${panel} grid grid-cols-3 gap-2 p-4 text-center`}>
          {stats.map((st) => (
            <div key={st.label} className="flex flex-col items-center gap-1">
              <IconCircle tone={st.tone}>{st.icon}</IconCircle>
              <dd className="text-lg font-semibold leading-none">{st.value}</dd>
              <dt className="text-xs text-muted-foreground">{st.label}</dt>
            </div>
          ))}
        </dl>

        {manageable && (
          <div className={`${panel} border-destructive/30 p-4`}>
            <p className="mb-3 flex items-start gap-3 text-sm text-muted-foreground">
              <IconCircle tone="danger"><TrashIcon /></IconCircle>
              {S.deleteWarn}
            </p>
            {confirmPost ? (
              <div className="flex gap-2">
                <button disabled={busy} onClick={() => run(() => bff(`/posts/${id}`, { method: "DELETE" }), () => router.replace(listPath))} className={btnDanger}>{S.confirmDelete}</button>
                <button onClick={() => setConfirmPost(false)} className={btnSm}>{S.cancel}</button>
              </div>
            ) : (
              <button onClick={() => setConfirmPost(true)} className={btnDangerGhost}>{S.deletePost}</button>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
