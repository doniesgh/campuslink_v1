"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { bff } from "@/lib/forum/bff";
import { authorIdOf } from "@/lib/forum/ownership";
import type { Post } from "@/lib/forum/types";

/** Rôles qui peuvent modifier / supprimer tous les posts. Comme le backend : req.user.role === "admin". */
const MODERATOR_ROLES = ["admin"];
/** Routes essayées dans l'ordre pour connaître l'utilisateur connecté (sans effet si le layout fournit initialUser). */
const ME_PATHS = ["/me", "/auth/me", "/users/me"];

export interface ForumUser {
  _id?: string;
  id?: string;
  userId?: string;
  sub?: string;
  name?: string;
  firstname?: string;
  lastname?: string;
  role?: string;
}

interface Ctx {
  userId: string | null;
  userName: string | null;
  isModerator: boolean;
  /** L'identité est connue (ou impossible à connaître) : on peut décider quoi afficher. */
  ready: boolean;
  /** Auteur du post (ou modérateur) ? */
  canManagePost: (post: Post) => boolean;
  /** Auteur du commentaire (ou modérateur) ? */
  canManage: (authorId?: string) => boolean;
}

const ForumContext = createContext<Ctx | null>(null);

export function useForum() {
  const c = useContext(ForumContext);
  if (!c) throw new Error("useForum doit être utilisé dans <ForumProvider>");
  return c;
}

async function loadMe(): Promise<ForumUser | null> {
  for (const path of ME_PATHS) {
    try {
      const data = await bff<ForumUser | { user: ForumUser }>(path);
      return "user" in data ? data.user : data;
    } catch {
      /* route inconnue (404) : on essaie la suivante */
    }
  }
  return null;
}

export function ForumProvider({ children, initialUser }: { children: ReactNode; initialUser?: ForumUser | null }) {
  const [me, setMe] = useState<ForumUser | null>(initialUser ?? null);
  const [myId, setMyId] = useState<string | null>(null); // déduit de GET /posts/me = req.user._id côté backend
  const [myPostIds, setMyPostIds] = useState<Set<string>>(new Set());
  const [meDone, setMeDone] = useState(!!initialUser);
  const [postsDone, setPostsDone] = useState(false);

  useEffect(() => {
    if (initialUser) return;
    loadMe().then(setMe).finally(() => setMeDone(true));
  }, [initialUser]);

  useEffect(() => {
    const load = () =>
      bff<{ _id?: string; author?: unknown }[] | { posts?: { _id?: string; author?: unknown }[] }>("/posts/me")
        .then((data) => {
          const list = Array.isArray(data) ? data : (data.posts ?? []);
          const id = list[0] ? authorIdOf(list[0] as unknown as Post) : undefined;
          if (id) setMyId(id);
          setMyPostIds(new Set(list.map((p) => String(p._id))));
        })
        .catch(() => {})
        .finally(() => setPostsDone(true));
    void load();
    window.addEventListener("forum:posted", load); // après la création d'un post
    return () => window.removeEventListener("forum:posted", load);
  }, []);

  const value = useMemo<Ctx>(() => {
    const userId = myId ?? me?._id ?? me?.id ?? me?.userId ?? me?.sub ?? null;
    const isModerator = MODERATOR_ROLES.includes((me?.role ?? "").toLowerCase());
    return {
      userId,
      userName: me?.name ?? ([me?.firstname, me?.lastname].filter(Boolean).join(" ") || null),
      isModerator,
      ready: meDone && postsDone,
      // Identité inconnue : on affiche les actions et c'est le backend qui accepte ou refuse (403).
      // Règle : on ne cache les actions que si on SAIT que le contenu appartient à quelqu'un d'autre.
      // Auteur inconnu dans la réponse de l'API = on les affiche, et le backend accepte ou refuse (403).
      canManage: (authorId) => isModerator || !userId || !authorId || String(authorId) === String(userId),
      canManagePost: (post) => {
        if (isModerator || !userId) return true;
        if (myPostIds.has(String(post._id))) return true;
        const aid = authorIdOf(post);
        if (!aid) return true; // auteur absent de la réponse : le backend décide
        return String(aid) === String(userId);
      },
    };
  }, [me, myId, myPostIds, meDone, postsDone]);

  return <ForumContext.Provider value={value}>{children}</ForumContext.Provider>;
}
