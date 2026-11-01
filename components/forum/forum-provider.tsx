"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { cacheSet, cachedGet, flushOutbox, pendingCount } from "@/lib/forum/offline";
import { authorId } from "@/lib/forum/format";
import { S } from "@/lib/forum/strings";
import type { Post } from "@/lib/forum/types";
import { CloudOffIcon, IconCircle, RefreshIcon } from "./icons";

/** Rôles qui ont les droits de modération sur tous les posts. À adapter à ton backend. */
const MODERATOR_ROLES = ["admin"]; // comme le backend : req.user.role !== "admin"

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
type Me = ForumUser;

/** Routes essayées dans l'ordre pour connaître l'utilisateur connecté (si le layout ne le fournit pas). */
const ME_PATHS = ["/me", "/auth/me", "/users/me"];

async function loadMe(): Promise<Me | null> {
  for (const path of ME_PATHS) {
    try {
      const { data } = await cachedGet<Me | { user: Me }>(path);
      return "user" in data ? data.user : data;
    } catch {
      /* route inconnue (404) ou réseau coupé : on essaie la suivante */
    }
  }
  return null;
}

interface Ctx {
  userId: string | null;
  userName: string | null;
  isModerator: boolean;
  ready: boolean;
  online: boolean;
  pending: number;
  /** true si l'utilisateur est modérateur ou l'auteur (du post / commentaire) concerné. */
  canManage: (authorId?: string) => boolean;
  /** Même chose pour un post : tient compte de la liste de mes posts quand l'auteur n'est pas dans la réponse. */
  canManagePost: (post: Post) => boolean;
}

const ForumContext = createContext<Ctx | null>(null);

export function useForum() {
  const c = useContext(ForumContext);
  if (!c) throw new Error("useForum doit être utilisé dans <ForumProvider>");
  return c;
}

/**
 * `initialUser` : à fournir depuis le layout serveur (session de l'app) quand c'est possible.
 * Sinon le provider interroge /me, /auth/me puis /users/me.
 */
export function ForumProvider({ children, initialUser }: { children: ReactNode; initialUser?: ForumUser | null }) {
  const [me, setMe] = useState<Me | null>(initialUser ?? null);
  const [myPostIds, setMyPostIds] = useState<Set<string>>(new Set()); // ids de mes posts (GET /posts/me)
  const [myId, setMyId] = useState<string | null>(null); // id déduit de GET /posts/me (celui que le backend utilise)
  const [meDone, setReady] = useState(false);
  const [postsDone, setPostsDone] = useState(false);
  const ready = meDone && postsDone;
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => setPending(await pendingCount()), []);

  const syncNow = useCallback(async () => {
    if (!navigator.onLine) return;
    setSyncing(true);
    try {
      const r = await flushOutbox();
      if (r.sent) window.dispatchEvent(new Event("forum:synced"));
    } finally {
      setSyncing(false);
      await refresh();
    }
  }, [refresh]);

  useEffect(() => {
    setOnline(navigator.onLine);
    const goOnline = () => {
      setOnline(true);
      void syncNow();
    };
    const goOffline = () => setOnline(false);
    const onQueue = () => void refresh();
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    window.addEventListener("forum:queue", onQueue);
    void refresh();
    if (navigator.onLine) void syncNow();
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("forum:queue", onQueue);
    };
  }, [refresh, syncNow]);

  // Profil mis en cache : l'utilisateur reste connu hors ligne.
  useEffect(() => {
    if (initialUser) {
      void cacheSet("/me", initialUser); // pour rester identifié hors ligne
      setReady(true);
      return;
    }
    loadMe()
      .then(setMe)
      .finally(() => setReady(true));
  }, [initialUser]);

  // Identité fiable : l'auteur de mes propres posts (GET /posts/me) est exactement req.user._id côté backend.
  useEffect(() => {
    const load = () =>
      cachedGet<unknown>("/posts/me")
        .then(({ data }) => {
          const list = (Array.isArray(data) ? data : ((data as { posts?: unknown[] } | null)?.posts ?? [])) as { _id?: string; author?: string | { _id?: string } }[];
          const a = list[0]?.author;
          const id = typeof a === "string" ? a : a?._id;
          if (id) setMyId(String(id));
          setMyPostIds(new Set(list.map((p) => String(p._id))));
        })
        .catch(() => {})
        .finally(() => setPostsDone(true));
    void load();
    window.addEventListener("forum:synced", load);
    return () => window.removeEventListener("forum:synced", load);
  }, []);

  const value = useMemo<Ctx>(() => {
    const userId = myId ?? me?._id ?? me?.id ?? me?.userId ?? me?.sub ?? null;
    const isModerator = MODERATOR_ROLES.includes((me?.role ?? "").toLowerCase());
    return {
      userId,
      userName: me?.name ?? ([me?.firstname, me?.lastname].filter(Boolean).join(" ") || null),
      isModerator,
      ready,
      online,
      pending,
      // Si l'utilisateur n'a pas pu être identifié (route /me inconnue), on affiche quand même les actions :
      // c'est le backend qui accepte ou refuse (403). Fournis `initialUser` pour un affichage exact.
      canManage: (authorId) => isModerator || !userId || (!!authorId && String(authorId) === String(userId)),
      canManagePost: (post) => {
        const aid = authorId(post);
        return isModerator || !userId || myPostIds.has(String(post._id)) || (!!aid && String(aid) === String(userId));
      },
    };
  }, [me, myId, myPostIds, ready, online, pending]);

  const showBanner = !online || pending > 0;

  return (
    <ForumContext.Provider value={value}>
      {showBanner && (
        <div className="pointer-events-none fixed inset-x-0 top-3 z-40 flex justify-center px-4">
          <div role="status" className="pointer-events-auto flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-4 text-sm shadow-lg">
            <IconCircle tone={online ? "primary" : "muted"} size="sm">{online ? <RefreshIcon /> : <CloudOffIcon />}</IconCircle>
            <span>
              {!online ? S.offlineBanner : syncing ? S.syncing : S.pendingSync(pending)}
              {!online && pending > 0 ? ` ${S.pendingSync(pending)}` : ""}
            </span>
            {online && !syncing && pending > 0 && (
              <button onClick={() => void syncNow()} className="font-medium text-blue-600 hover:underline">{S.syncNow}</button>
            )}
          </div>
        </div>
      )}
      {children}
    </ForumContext.Provider>
  );
}
