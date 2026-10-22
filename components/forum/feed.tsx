"use client";

import { useCallback, useEffect, useState, type ComponentType, type FormEvent } from "react";
import { bff, errorMessage } from "@/lib/forum/bff";
import { S } from "@/lib/forum/strings";
import { STATUSES, TYPES, type Post, type PostsPage, type PostStatus, type PostType } from "@/lib/forum/types";
import { btn } from "@/lib/forum/ui";
import { STATUS_ICONS, TYPE_ICONS } from "./badges";
import { CloseIcon, GridIcon, IconCircle, SearchIcon } from "./icons";
import { PostCard } from "./post-card";

type Icon = ComponentType<{ className?: string }>;

function Chips<T extends string>({ label, value, options, onChange }: { label: string; value: T | ""; options: [T | "", string, Icon][]; onChange: (v: T | "") => void }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap justify-center gap-2">
      {options.map(([v, text, Icon]) => {
        const on = value === v;
        return (
          <button
            key={v || "all"}
            aria-pressed={on}
            onClick={() => onChange(v)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full border py-1 pl-1 pr-3.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              on ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            <span aria-hidden className={`flex size-6 items-center justify-center rounded-full [&>svg]:size-3.5 ${on ? "bg-primary-foreground/20" : "bg-accent text-accent-foreground"}`}>
              <Icon />
            </span>
            {text}
          </button>
        );
      })}
    </div>
  );
}

export function Feed() {
  const [type, setType] = useState<PostType | "">("");
  const [status, setStatus] = useState<PostStatus | "">("");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const fetchPage = useCallback(
    (p: number) => {
      const params = new URLSearchParams({ page: String(p), limit: "8", status: status || "all" });
      if (type) params.set("type", type);
      if (search) params.set("q", search);
      return bff<PostsPage>(`/posts?${params}`);
    },
    [type, status, search]
  );

  const reload = useCallback(() => {
    let off = false;
    setLoading(true);
    fetchPage(1)
      .then((d) => {
        if (off) return;
        setPosts(d.posts);
        setPage(d.page);
        setPages(d.pages);
        setTotal(d.total);
        setError("");
      })
      .catch((e) => !off && setError(errorMessage(e)))
      .finally(() => !off && setLoading(false));
    return () => {
      off = true;
    };
  }, [fetchPage]);

  useEffect(() => reload(), [reload]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const d = await fetchPage(page + 1);
      setPosts((prev) => [...prev, ...d.posts.filter((n) => !prev.some((p) => p._id === n._id))]);
      setPage(d.page);
      setPages(d.pages);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoadingMore(false);
    }
  }

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    setSearch(q.trim());
  };

  const clear = () => {
    setQ("");
    setSearch("");
  };

  return (
    <section aria-label={S.title} className="mx-auto mt-6 max-w-2xl space-y-5">
      {/* Recherche : petite, centrée, en pilule */}
      <form
        onSubmit={onSearch}
        role="search"
        className="mx-auto flex h-11 max-w-sm items-center gap-1 rounded-full border border-input bg-card pl-3.5 pr-1.5 shadow-sm focus-within:ring-2 focus-within:ring-ring"
      >
        <label htmlFor="mod-q" className="sr-only">{S.search}</label>
        <span aria-hidden className="text-muted-foreground"><SearchIcon className="size-[18px]" /></span>
        <input
          id="mod-q"
          className="h-full min-w-0 flex-1 bg-transparent px-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          placeholder={S.search}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {q && (
          <button type="button" onClick={clear} aria-label={S.clearSearch} className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <CloseIcon className="size-3.5" />
          </button>
        )}
        <button aria-label={S.searchButton} className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <SearchIcon className="size-4" />
        </button>
      </form>

      <div className="space-y-2.5">
        <Chips<PostType> label={S.filterType} value={type} onChange={setType} options={[["", S.all, GridIcon], ...TYPES.map((t): [PostType, string, Icon] => [t, S.type[t], TYPE_ICONS[t]])]} />
        <Chips<PostStatus> label={S.filterStatus} value={status} onChange={setStatus} options={[["", S.all, GridIcon], ...STATUSES.map((s): [PostStatus, string, Icon] => [s, S.status[s], STATUS_ICONS[s]])]} />
      </div>

      {!loading && !error && <p className="text-center text-sm text-muted-foreground">{S.total(total)}</p>}

      {error && (
        <p role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          {error}
          <button onClick={reload} className="font-medium underline">{S.retry}</button>
        </p>
      )}

      {loading && (
        <div className="space-y-4" aria-busy="true">
          {[0, 1].map((i) => <div key={i} className="h-72 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      )}

      {!loading && !error && posts.length === 0 && (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-input bg-card px-4 py-12 text-center">
          <IconCircle tone="soft" size="lg"><SearchIcon /></IconCircle>
          <p className="mt-3 font-medium">{S.empty}</p>
          <p className="mt-1 text-sm text-muted-foreground">{S.emptyHint}</p>
        </div>
      )}

      {!loading &&
        posts.map((p) => (
          <PostCard
            key={p._id}
            post={p}
            onChange={(next) => setPosts((prev) => prev.map((x) => (x._id === next._id ? next : x)))}
            onDeleted={(id) => {
              setPosts((prev) => prev.filter((x) => x._id !== id));
              setTotal((t) => Math.max(0, t - 1));
            }}
          />
        ))}

      {!loading && page < pages && (
        <div className="flex justify-center pt-2">
          <button onClick={loadMore} disabled={loadingMore} className={btn}>{loadingMore ? S.loading : S.loadMore}</button>
        </div>
      )}
    </section>
  );
}
