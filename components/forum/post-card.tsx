
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { bff, errorMessage, BffError } from "@/lib/forum/bff";
import { authorName, fmtDate, initials, timeAgo } from "@/lib/forum/format";
import { R } from "@/lib/forum/reservation-strings";
import { S } from "@/lib/forum/strings";
import type { Post, PostStatus } from "@/lib/forum/types";
import { btnDanger, btnSm } from "@/lib/forum/ui";
import { StatusBadge, TypeBadge } from "./badges";
import { CommentsThread } from "./comments-thread";
import { useForum } from "./forum-provider";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  CommentIcon,
  DotIcon,
  DotsIcon,
  EditIcon,
  EyeIcon,
  HeartIcon,
  HeartOutlineIcon,
  IconCircle,
  LockIcon,
  PinIcon,
  SeatIcon,
  TrashIcon
} from "./icons";
import { PostMedia } from "./post-media";

interface Props {
  post: Post;
  detail?: boolean;
  onChange: (post: Post) => void;
  onDeleted: (id: string) => void;
}

type Icon = ComponentType<{ className?: string }>;

const menuItem =
  "flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground";

export function PostCard({
  post,
  detail = false,
  onChange,
  onDeleted
}: Props) {
  const pathname = usePathname();

  const base = detail
    ? pathname.replace(/\/[^/]+\/?$/, "")
    : pathname;

  const { canManagePost, userId } = useForum();
  const manage = canManagePost(post);

  const isLiked =
    post.likedByMe ??
    (!!userId &&
      !!post.likes?.some(
        (id) => String(id) === String(userId)
      ));

  const [liking, setLiking] = useState(false);
  const [menu, setMenu] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showComments, setShowComments] = useState(detail);
  const [expanded, setExpanded] = useState(detail);
  const [busy, setBusy] = useState(false);
  const [reserving, setReserving] = useState(false);
  const [error, setError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;

    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) {
        setMenu(false);
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(false);
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  // ---------------------------------
  // RESERVATION
  // ---------------------------------

  async function handleReservation() {
    if (reserving) return;

    setReserving(true);
    setError("");

    try {
      const result = await bff(
        `/posts/${post._id}/reservations`,
        {
          method: "POST",
          json: { seats: 1 }
        }
      );

      console.log("Reservation:", result);

      setShowSuccess(true);
    } catch (e) {
      if (e instanceof BffError && e.status === 409) {
        setError(e.message);
      } else {
        setError(errorMessage(e));
      }
    } finally {
      setReserving(false);
    }
  }
  // ---------------------------------
  // POST STATUS
  // ---------------------------------

  async function setStatus(next: PostStatus) {
    setMenu(false);
    setBusy(true);

    try {
      await bff(`/posts/${post._id}/status`, {
        method: "PATCH",
        json: { status: next }
      });

      onChange({ ...post, status: next });
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  // ---------------------------------
  // DELETE POST
  // ---------------------------------

  async function remove() {
    setBusy(true);

    try {
      await bff(`/posts/${post._id}`, {
        method: "DELETE"
      });

      onDeleted(post._id);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  // ---------------------------------
  // REFRESH COUNTS
  // ---------------------------------

  async function refreshCounts() {
    try {
      const fresh = await bff<Post>(
        `/posts/${post._id}?view=0`
      );

      onChange({
        ...post,
        commentsCount: fresh.commentsCount,
        likesCount: fresh.likesCount
      });
    } catch {
      // Refresh on next load
    }
  }

  // ---------------------------------
  // LIKE / UNLIKE
  // ---------------------------------

  async function toggleLike() {
    if (liking) return;

    const prev = post;
    const liked = !isLiked;

    setLiking(true);

    onChange({
      ...post,
      likedByMe: liked,
      likesCount: Math.max(
        0,
        post.likesCount + (liked ? 1 : -1)
      )
    });

    try {
      const r = await bff<{
        liked: boolean;
        likesCount: number;
      }>(`/posts/${post._id}/like`, {
        method: "POST"
      });

      onChange({
        ...post,
        likedByMe: r.liked,
        likesCount: r.likesCount
      });

      setError("");
    } catch (e) {
      onChange(prev);
      setError(errorMessage(e));
    } finally {
      setLiking(false);
    }
  }

  const name = authorName(post);
  const long = post.description.length > 180;

  const item = (
    Ic: Icon,
    text: string,
    tone: "soft" | "danger" = "soft"
  ) => (
    <>
      <IconCircle tone={tone} size="sm">
        <Ic />
      </IconCircle>
      {text}
    </>
  );

  return (
    <article className="rounded-2xl border border-border bg-card text-card-foreground shadow-sm">

      {/* HEADER */}
      <header className="flex items-center gap-3 px-4 py-3">
        <span
          aria-hidden
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-foreground ring-2 ring-primary/20"
        >
          {initials(name)}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {name}
          </p>

          <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <time
              dateTime={post.createdAt}
              title={fmtDate(post.createdAt, true)}
            >
              {timeAgo(post.createdAt)}
            </time>

            {post.location && (
              <span className="inline-flex items-center gap-1">
                <PinIcon className="size-3.5" />
                {post.location}
              </span>
            )}
          </p>
        </div>

        <TypeBadge type={post.type} />

        {post.status !== "active" && (
          <StatusBadge status={post.status} />
        )}

        {(manage || !detail) && (
          <div ref={menuRef} className="relative">
            <button
              aria-label={S.menu}
              aria-haspopup="menu"
              aria-expanded={menu}
              disabled={busy}
              onClick={() => setMenu(v => !v)}
              className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-accent"
            >
              <DotsIcon />
            </button>

            {menu && (
              <div
                role="menu"
                className="absolute right-0 top-11 z-10 w-60 overflow-hidden rounded-xl border border-border bg-popover py-1 shadow-lg"
              >
                {!detail && (
                  <Link
                    role="menuitem"
                    href={`${base}/${post._id}`}
                    className={menuItem}
                  >
                    {item(ArrowRightIcon, S.openPost)}
                  </Link>
                )}

                {manage && (
                  <>
                    <Link
                      role="menuitem"
                      href={`${base}/${post._id}/edit`}
                      className={menuItem}
                    >
                      {item(EditIcon, S.editPost)}
                    </Link>

                    {post.status === "active" ? (
                      <button
                        role="menuitem"
                        onClick={() => setStatus("closed")}
                        className={menuItem}
                      >
                        {item(LockIcon, S.close)}
                      </button>
                    ) : (
                      <button
                        role="menuitem"
                        onClick={() => setStatus("active")}
                        className={menuItem}
                      >
                        {item(DotIcon, S.reopen)}
                      </button>
                    )}

                    {post.status !== "resolved" && (
                      <button
                        role="menuitem"
                        onClick={() => setStatus("resolved")}
                        className={menuItem}
                      >
                        {item(CheckCircleIcon, S.markResolved)}
                      </button>
                    )}

                    <button
                      role="menuitem"
                      onClick={() => {
                        setMenu(false);
                        setConfirming(true);
                      }}
                      className={`${menuItem} text-destructive`}
                    >
                      {item(TrashIcon, S.delete, "danger")}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </header>

      {/* DELETE CONFIRMATION */}
      {confirming && (
        <div
          role="alertdialog"
          aria-label={S.deleteQ}
          className="mx-4 mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2.5"
        >
          <IconCircle tone="danger">
            <TrashIcon />
          </IconCircle>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-destructive">
              {S.deleteQ}
            </p>
            <p className="text-xs text-muted-foreground">
              {S.deleteWarn}
            </p>
          </div>

          <button
            disabled={busy}
            onClick={remove}
            className={btnDanger}
          >
            {S.confirmDelete}
          </button>

          <button
            onClick={() => setConfirming(false)}
            className={btnSm}
          >
            {S.cancel}
          </button>
        </div>
      )}

      {/* ERROR */}
      {error && (
        <p
          role="alert"
          className="mx-4 mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {/* MEDIA */}
      <PostMedia post={post} />

      {/* CONTENT */}
      <div className="px-4 pt-4">
        <h2 className="text-base font-semibold leading-snug">
          {detail ? (
            post.title
          ) : (
            <Link
              href={`${base}/${post._id}`}
              className="hover:underline"
            >
              {post.title}
            </Link>
          )}
        </h2>

        <p
          className={`mt-1.5 whitespace-pre-line break-words text-sm leading-relaxed ${expanded ? "" : "line-clamp-3"
            }`}
        >
          {post.description}
        </p>

        {long && !detail && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="mt-1 text-sm font-medium text-primary hover:underline"
          >
            {expanded ? S.seeLess : S.seeMore}
          </button>
        )}

        {post.tags.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {post.tags.map(t => (
              <li
                key={t}
                className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
              >
                #{t}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ACTIVITY BAR */}
      <div className="mt-4 flex items-center gap-1 border-t border-border px-3 py-2 text-sm text-muted-foreground">

        {/* LIKE */}
        <button
          onClick={toggleLike}
          disabled={liking}
          aria-pressed={isLiked}
          aria-label={isLiked ? S.unlike : S.like}
          className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 hover:bg-accent"
        >
          <IconCircle
            tone={isLiked ? "heartOn" : "heart"}
            size="sm"
          >
            {isLiked ? <HeartIcon /> : <HeartOutlineIcon />}
          </IconCircle>
          {post.likesCount}
        </button>

        {/* COMMENTS */}
        <button
          onClick={() => setShowComments(v => !v)}
          aria-expanded={showComments}
          className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 hover:bg-accent"
        >
          <IconCircle tone="primary" size="sm">
            <CommentIcon />
          </IconCircle>
          {showComments
            ? S.hideComments
            : S.comments(post.commentsCount)}
        </button>

        {/* RESERVATION BUTTON */}
        {!detail &&
          !manage &&
          post.type === "covoiturage" &&
          post.status === "active" &&
          (post.covoiturage?.seats ?? 0) > 0 && (
            <button
              type="button"
              onClick={handleReservation}
              disabled={reserving}
              className="flex items-center gap-2 rounded-full bg-primary py-1 pl-1 pr-3 text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <IconCircle tone="soft" size="sm">
                <SeatIcon />
              </IconCircle>

              {reserving
                ? "Sending..."
                : R.requestTitle}
            </button>
          )}

        {/* EDIT */}
        {manage && (
          <Link
            href={`${base}/${post._id}/edit`}
            className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 hover:bg-accent"
          >
            <IconCircle tone="soft" size="sm">
              <EditIcon />
            </IconCircle>
            {S.editPost}
          </Link>
        )}

        {/* VIEWS */}
        <span
          className="ml-auto flex items-center gap-2 rounded-full py-1 pl-1 pr-3"
          title={S.views}
        >
          <IconCircle tone="muted" size="sm">
            <EyeIcon />
          </IconCircle>

          <span className="sr-only">{S.views}</span>
          {post.views}
        </span>
      </div>

      {/* COMMENTS */}
      {showComments && (
        <CommentsThread
          postId={post._id}
          onChanged={refreshCounts}
        />
      )}
      {/* SUCCESS POPUP */}
      {showSuccess && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">

          <div className="w-full max-w-sm animate-in zoom-in-95 fade-in duration-300 rounded-2xl border border-border bg-card p-6 text-center shadow-2xl">

            {/* SUCCESS ICON */}
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircleIcon className="size-9 text-green-600 dark:text-green-400" />
            </div>

            {/* TITLE */}
            <h2 className="text-xl font-bold text-foreground">
              Demande envoyée !
            </h2>

            {/* MESSAGE */}
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Votre demande de réservation a été envoyée avec succès.
              Vous serez informé lorsque l'organisateur répondra.
            </p>

            {/* BUTTON */}
            <button
              onClick={() => setShowSuccess(false)}
              className="mt-6 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              Parfait !
            </button>

          </div>
        </div>
      )}
    </article>

  );
}
