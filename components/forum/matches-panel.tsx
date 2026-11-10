"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { bff } from "@/lib/forum/bff";
import { fmtDate } from "@/lib/forum/format";
import { N } from "@/lib/forum/nearby-strings";
import type { PostMatch } from "@/lib/forum/types";
import { btnSm, panel } from "@/lib/forum/ui";
import { IconCircle, SearchIcon } from "./icons";

/** Sur un objet perdu/trouvé : annonces du type opposé qui lui ressemblent (score calculé par le backend). */
export function MatchesPanel({ postId, basePath }: { postId: string; basePath: string }) {
  const [matches, setMatches] = useState<PostMatch[] | null>(null);

  useEffect(() => {
    let off = false;
    bff<{ matches: PostMatch[] }>(`/posts/${postId}/matches`)
      .then((r) => !off && setMatches(r.matches ?? []))
      .catch(() => !off && setMatches([])); // pas de correspondance affichable : on n'encombre pas la page
    return () => {
      off = true;
    };
  }, [postId]);

  if (!matches?.length) return null;

  return (
    <section aria-labelledby="matches-title" className={`${panel} p-6 shadow-sm`}>
      <h3 id="matches-title" className="flex items-center gap-2 text-base font-semibold">
        <IconCircle tone="brand" size="sm"><SearchIcon /></IconCircle>
        {N.matchesTitle}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">{N.matchesSubtitle}</p>
      <ul className="mt-4 space-y-3">
        {matches.map(({ post, score, reasons }) => (
          <li key={post._id} className="rounded-xl border border-border bg-background p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {post.objetPerdu?.kind === "trouve" ? N.foundTag : N.lostTag}
                  {post.objetPerdu?.place ? ` · ${post.objetPerdu.place}` : ""}
                  {post.objetPerdu?.date ? ` · ${fmtDate(post.objetPerdu.date)}` : ""}
                </p>
                <p className="mt-0.5 truncate text-sm font-semibold">{post.title}</p>
              </div>
              <Link href={`${basePath}/${post._id}`} className={btnSm}>{N.viewPost}</Link>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" role="presentation">
                <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, score)}%` }} />
              </div>
              <span className="text-xs font-semibold">{N.matchPercent(Math.min(100, score))}</span>
            </div>
            {reasons.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {reasons.map((r) => (
                  <li key={r} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{r}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
