"use client";

import { useEffect, useState } from "react";
import { BffError, bff, errorMessage } from "@/lib/forum/bff";
import { authorIdOf } from "@/lib/forum/ownership";
import { S } from "@/lib/forum/strings";
import type { Post } from "@/lib/forum/types";
import { useForum } from "./forum-provider";
import { PostForm } from "./post-form";

/** Page de modification : charge le post, vérifie que tu en es l'auteur (ou admin), puis affiche le formulaire prérempli. */
export function PostEdit({ id }: { id: string }) {
  const { canManagePost, ready, userId } = useForum();
  const [post, setPost] = useState<Post | null>(null);
  const [error, setError] = useState("");
  const [gone, setGone] = useState(false);

  useEffect(() => {
    bff<Post>(`/posts/${id}?view=0`)
      .then(setPost)
      .catch((e) => (e instanceof BffError && (e.status === 404 || e.status === 400) ? setGone(true) : setError(errorMessage(e))));
  }, [id]);

  if (gone) return <p className="rounded-2xl border border-border bg-card p-10 text-center font-medium">{S.notFound}</p>;
  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>;
  if (!post || !ready) return <div className="mx-auto h-96 max-w-2xl animate-pulse rounded-2xl bg-muted" aria-busy="true" />;
  if (!canManagePost(post))
    return (
      <div role="alert" className="mx-auto max-w-md rounded-2xl border border-destructive/40 bg-destructive/10 p-8 text-center text-destructive">
        <p className="font-medium">{S.notAllowed}</p>
        {/* Diagnostic temporaire : ces deux ids doivent être identiques pour l'auteur du post. */}
        <p className="mt-3 break-all text-xs text-muted-foreground">Your id: {userId ?? "unknown"} · Post author id: {authorIdOf(post) ?? "unknown"}</p>
      </div>
    );
  return <PostForm initial={post} />;
}
