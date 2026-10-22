import StatusBadge from '../common/StatusBadge';
import { authorName, timeAgo } from '../../utils/format';
import type { Post } from '../../types/post';

export default function PostHeader({ post }: { post: Post }) {
  return (
    <header className="grid gap-1.5">
      <h2 className="text-2xl font-bold leading-tight">{post.title}</h2>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
        <span>{authorName(post.author)}</span>
        <span>·</span>
        <span>{timeAgo(post.createdAt)}</span>
        {post.location && <span>· 📍 {post.location}</span>}
        <StatusBadge status={post.status} />
      </div>
    </header>
  );
}
