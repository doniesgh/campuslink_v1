import Alert from '../ui/Alert';
import PostCard from './PostCard';
import Pagination from './Pagination';
import type { Post } from '../../types/post';

interface Props {
  posts: Post[];
  loading: boolean;
  error: string;
  likedIds: Set<string>;
  page: number;
  pages: number;
  onPageChange: (page: number) => void;
  onOpen: (id: string) => void;
  onLike: (id: string) => void;
}

// Renders the result area of the feed: error / loading / empty / grid / pagination.
export default function PostFeed({
  posts, loading, error, likedIds,
  page, pages, onPageChange,
  onOpen, onLike,
}: Props) {
  return (
    <section>
      {error && <Alert>{error}</Alert>}
      {loading && <p className="py-4 text-sm text-slate-500 dark:text-slate-400">Loading…</p>}

      {!loading && !error && posts.length === 0 && (
        <div className="py-16 text-center text-slate-500 dark:text-slate-400">
          No posts found. Be the first to publish one.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((p) => (
          <PostCard
            key={p._id}
            post={p}
            liked={likedIds.has(p._id)}
            onOpen={onOpen}
            onLike={onLike}
          />
        ))}
      </div>

      <Pagination page={page} pages={pages} onChange={onPageChange} />
    </section>
  );
}
