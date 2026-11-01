"use client";

import { useEffect, useState } from "react";
import { BffError, errorMessage } from "@/lib/forum/bff";
import { authorId } from "@/lib/forum/format";
import { cachedGet } from "@/lib/forum/offline";
import { S } from "@/lib/forum/strings";
import type { Post } from "@/lib/forum/types";
import { useForum } from "./forum-provider";
import { PostForm } from "./post-form";

export function PostEdit({ id }: { id: string }) {
  const { canManagePost, ready, userId } = useForum();
  const [post, setPost] = useState<Post | null>(null);
  const [error, setError] = useState("");
  const [gone, setGone] = useState(false);

  useEffect(() => {
    cachedGet<Post>(`/posts/${id}?view=0`)
      .then(({ data }) => setPost(data))
      .catch((e) => (e instanceof BffError && (e.status === 404 || e.status === 400) ? setGone(true) : setError(errorMessage(e))));
  }, [id]);

  if (gone) return <p className="rounded-xl border border-slate-200 bg-white p-10 text-center font-medium">{S.notFound}</p>;
  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  if (!post || !ready) return <div className="mx-auto h-96 max-w-2xl animate-pulse rounded-xl bg-slate-100" aria-busy="true" />;
  if (!canManagePost(post))
    return (
      <div role="alert" className="mx-auto max-w-md rounded-xl border border-red-300 bg-red-50 p-8 text-center text-red-600">
        <p className="font-medium">{S.notAllowed}</p>
        {/* Diagnostic temporaire : ces deux ids doivent être identiques pour l'auteur du post. */}
        <p className="mt-3 break-all text-xs text-slate-500">
          Your id: {userId ?? "unknown"} · Post author id: {authorId(post) ?? "unknown"}
          <br />author: {JSON.stringify((post as unknown as { author?: unknown }).author) ?? "undefined"} · keys: {Object.keys(post).join(", ")}
        </p>
      </div>
    );
  return <PostForm initial={post} />;
}
