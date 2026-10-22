"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { bff, errorMessage } from "@/lib/forum/bff";
import { authorName, canManage, fmtDate, initials, timeAgo } from "@/lib/forum/format";
import { S } from "@/lib/forum/strings";
import type { Post, PostStatus, Viewer } from "@/lib/forum/types";
import { btnDanger, btnSm } from "@/lib/forum/ui";
import { StatusBadge, TypeBadge } from "./badges";
import { CommentsThread } from "./comments-thread";
import { ArrowRightIcon, CheckCircleIcon, CommentIcon, DotIcon, DotsIcon, EyeIcon, HeartIcon, IconCircle, LockIcon, PinIcon, TrashIcon } from "./icons";
import { PostMedia } from "./post-media";

interface Props {
  post: Post;
  viewer: Viewer | null;
  detail?: boolean;
  onChange: (post: Post) => void;
  onDeleted: (id: string) => void;
}

type Icon = ComponentType<{ className?: string }>;
const menuItem = "flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground";

export function PostCard({ post, viewer, detail = false, onChange, onDeleted }: Props) {
  const base = usePathname();
  const [menu, setMenu] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showComments, setShowComments] = useState(detail);
  const [expanded, setExpanded] = useState(detail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  async function setStatus(next: PostStatus) {
    setMenu(false);
    setBusy(true);
    try {
      await bff(`/posts/${post._id}/status`, { method: "PATCH", json: { status: next } });
      onChange({ ...post, status: next });
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await bff(`/posts/${post._id}`, { method: "DELETE" });
      onDeleted(post._id);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  async function refreshCounts() {
    try {
      const fresh = await bff<Post>(`/posts/${post._id}?view=0`);
      onChange({ ...post, commentsCount: fresh.commentsCount, likesCount: fresh.likesCount });
    } catch {
      /* les compteurs se mettront à jour au prochain chargement */
    }
  }

  const name = authorName(post.author);
  const manageable = canManage(viewer, post.author);
  const long = post.description.length > 180;
  const item = (Ic: Icon, text: string, tone: "soft" | "danger" = "soft") => (
    <>
      <IconCircle tone={tone} size="sm"><Ic /></IconCircle>
      {text}
    </>
  );

  return (
    // Pas d'overflow-hidden : il couperait le menu d'actions.
    <article className="rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
      {/* En-tête : auteur, date, type, menu de modération */}
      <header className="flex items-center gap-3 px-4 py-3">
        <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-foreground ring-2 ring-primary/20">
          {initials(name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <time dateTime={post.createdAt} title={fmtDate(post.createdAt, true)}>{timeAgo(post.createdAt)}</time>
            {post.location && (
              <span className="inline-flex items-center gap-1">
                <PinIcon className="size-3.5" />
                {post.location}
              </span>
            )}
          </p>
        </div>
        <TypeBadge type={post.type} />
        {post.status !== "active" && <StatusBadge status={post.status} />}

        {/* Actions : auteur du post ou admin uniquement (l'API le vérifie aussi). */}
        {manageable && (
          <div ref={menuRef} className="relative">
            <button
              aria-label={S.menu}
              aria-haspopup="menu"
              aria-expanded={menu}
              disabled={busy}
              onClick={() => setMenu((v) => !v)}
              className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              <DotsIcon />
            </button>
            {menu && (
              <div role="menu" className="absolute right-0 top-11 z-10 w-60 overflow-hidden rounded-xl border border-border bg-popover py-1 text-popover-foreground shadow-lg">
                {!detail && (
                  <Link role="menuitem" href={`${base}/${post._id}`} className={menuItem}>{item(ArrowRightIcon, S.openPost)}</Link>
                )}
                {post.status === "active" ? (
                  <button role="menuitem" onClick={() => setStatus("closed")} className={menuItem}>{item(LockIcon, S.close)}</button>
                ) : (
                  <button role="menuitem" onClick={() => setStatus("active")} className={menuItem}>{item(DotIcon, S.reopen)}</button>
                )}
                {post.status !== "resolved" && (
                  <button role="menuitem" onClick={() => setStatus("resolved")} className={menuItem}>{item(CheckCircleIcon, S.markResolved)}</button>
                )}
                <button role="menuitem" onClick={() => { setMenu(false); setConfirming(true); }} className={`${menuItem} text-destructive`}>{item(TrashIcon, S.delete, "danger")}</button>
              </div>
            )}
          </div>
        )}
      </header>

      {confirming && (
        <div role="alertdialog" aria-label={S.deleteQ} className="mx-4 mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2.5">
          <IconCircle tone="danger"><TrashIcon /></IconCircle>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-destructive">{S.deleteQ}</p>
            <p className="text-xs text-muted-foreground">{S.deleteWarn}</p>
          </div>
          <button disabled={busy} onClick={remove} className={btnDanger}>{S.confirmDelete}</button>
          <button onClick={() => setConfirming(false)} className={btnSm}>{S.cancel}</button>
        </div>
      )}

      {error && <p role="alert" className="mx-4 mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      <PostMedia post={post} />

      {/* Texte */}
      <div className="px-4 pt-4">
        <h2 className="text-base font-semibold leading-snug">
          {detail ? post.title : <Link href={`${base}/${post._id}`} className="hover:underline">{post.title}</Link>}
        </h2>
        <p className={`mt-1.5 whitespace-pre-line break-words text-sm leading-relaxed ${expanded ? "" : "line-clamp-3"}`}>{post.description}</p>
        {long && !detail && (
          <button onClick={() => setExpanded((v) => !v)} className="mt-1 text-sm font-medium text-primary hover:underline">
            {expanded ? S.seeLess : S.seeMore}
          </button>
        )}
        {post.tags.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {post.tags.map((t) => (
              <li key={t} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">#{t}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Barre d'activité : chaque compteur a son icône ronde */}
      <div className="mt-4 flex items-center gap-1 border-t border-border px-3 py-2 text-sm text-muted-foreground">
        <span className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3" title={S.likes}>
          <IconCircle tone="heart" size="sm"><HeartIcon /></IconCircle>
          <span className="sr-only">{S.likes}</span>
          {post.likesCount}
        </span>
        <button
          onClick={() => setShowComments((v) => !v)}
          aria-expanded={showComments}
          className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <IconCircle tone="primary" size="sm"><CommentIcon /></IconCircle>
          {showComments ? S.hideComments : S.comments(post.commentsCount)}
        </button>
        <span className="ml-auto flex items-center gap-2 rounded-full py-1 pl-1 pr-3" title={S.views}>
          <IconCircle tone="muted" size="sm"><EyeIcon /></IconCircle>
          <span className="sr-only">{S.views}</span>
          {post.views}
        </span>
      </div>

      {showComments && <CommentsThread postId={post._id} viewer={viewer} onChanged={refreshCounts} />}
    </article>
  );
}
