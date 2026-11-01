"use client";

import { useEffect, useRef } from "react";
import { initials } from "@/lib/forum/format";
import { S } from "@/lib/forum/strings";
import type { Post } from "@/lib/forum/types";
import { TypeBadge } from "./badges";
import { CloseIcon, PinIcon } from "./icons";
import { PostMedia } from "./post-media";

/** Aperçu direct : le post tel qu'il apparaîtra dans le fil. */
export function PostPreview({ post, name, onClose }: { post: Post; name: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={S.previewTitle} className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-xl border border-slate-200 bg-white shadow-[0_10px_15px_-3px_rgba(15,23,42,0.1),0_4px_6px_-4px_rgba(15,23,42,0.08)]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">{S.previewTitle}</h2>
          <button ref={closeRef} onClick={onClose} aria-label={S.closePreview} className="flex size-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
            <CloseIcon className="size-4" />
          </button>
        </div>
        <article>
          <header className="flex items-center gap-3 px-4 py-3">
            <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-900">{initials(name)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
              <p className="flex items-center gap-2 text-xs text-slate-500">
                {S.justNow}
                {post.location && (
                  <span className="inline-flex items-center gap-1">
                    <PinIcon className="size-3.5" />
                    {post.location}
                  </span>
                )}
              </p>
            </div>
            <TypeBadge type={post.type} />
          </header>
          <PostMedia post={post} />
          <div className="space-y-3 p-4">
            <h3 className="text-lg font-semibold leading-snug tracking-tight text-slate-900">{post.title}</h3>
            <p className="whitespace-pre-line break-words text-sm leading-relaxed text-slate-700">{post.description}</p>
            {post.tags.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {post.tags.map((t) => (
                  <li key={t} className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-600">#{t}</li>
                ))}
              </ul>
            )}
          </div>
        </article>
      </div>
    </div>
  );
}
