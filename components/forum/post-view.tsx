"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BffError, errorMessage } from "@/lib/forum/bff";
import { cachedGet } from "@/lib/forum/offline";
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
      const { data } = await cachedGet<Post>(`/posts/${id}?view=0`);
      setPost(data);
      setError("");
    } catch (e) {
      if (e instanceof BffError && (e.status === 404 || e.status === 400)) setGone(true);
      else setError(errorMessage(e));
    }
  }, [id]);

  useEffect(() => {
    load();
    window.addEventListener("forum:synced", load);
    return () => window.removeEventListener("forum:synced", load);
  }, [load]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href={listPath} className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline">
        <IconCircle tone="primary" size="sm"><ArrowLeftIcon /></IconCircle>
        {S.back}
      </Link>
      {gone && <p className="rounded-xl border border-slate-200 bg-white p-10 text-center font-medium">{S.notFound}</p>}
      {error && (
        <p role="alert" className="text-sm text-red-600">{error} <button onClick={load} className="underline">{S.retry}</button></p>
      )}
      {!post && !gone && !error && <div className="h-80 animate-pulse rounded-xl bg-slate-100" aria-busy="true" />}
      {post && <PostCard post={post} detail onChange={setPost} onDeleted={() => router.replace(listPath)} />}
    </div>
  );
}
