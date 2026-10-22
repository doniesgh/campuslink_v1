"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BffError, bff, errorMessage } from "@/lib/forum/bff";
import { S } from "@/lib/forum/strings";
import type { Post } from "@/lib/forum/types";
import { ArrowLeftIcon, IconCircle } from "./icons";
import { PostCard } from "./post-card";

export function PostView({ id }: { id: string }) {
  const router = useRouter();
  const listPath = usePathname().replace(/\/[^/]+\/?$/, "");
  const [post, setPost] = useState<Post | null>(null);
  const [error, setError] = useState("");
  const [gone, setGone] = useState(false);

  const load = useCallback(async () => {
    try {
      setPost(await bff<Post>(`/posts/${id}?view=0`));
      setError("");
    } catch (e) {
      if (e instanceof BffError && (e.status === 404 || e.status === 400)) setGone(true);
      else setError(errorMessage(e));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href={listPath} className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
        <IconCircle tone="primary" size="sm"><ArrowLeftIcon /></IconCircle>
        {S.back}
      </Link>
      {gone && <p className="rounded-2xl border border-border bg-card p-10 text-center font-medium">{S.notFound}</p>}
      {error && (
        <p role="alert" className="text-sm text-destructive">{error} <button onClick={load} className="underline">{S.retry}</button></p>
      )}
      {!post && !gone && !error && <div className="h-80 animate-pulse rounded-2xl bg-muted" aria-busy="true" />}
      {post && <PostCard post={post} detail onChange={setPost} onDeleted={() => router.replace(listPath)} />}
    </div>
  );
}
