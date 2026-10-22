import TypeBadge from '../common/TypeBadge';
import StatusBadge from '../common/StatusBadge';
import TagList from '../common/TagList';
import PostCardMeta from './PostCardMeta';
import PostCardFooter from './PostCardFooter';
import type { Post } from '../../types/post';

interface Props {
  post: Post;
  liked: boolean;
  onOpen: (id: string) => void;
  onLike: (id: string) => void;
}

export default function PostCard({ post, liked, onOpen, onLike }: Props) {
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(post._id)}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(post._id)}
      className="flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/30 dark:border-slate-800 dark:bg-slate-900"
    >
      {post.images?.[0] && (
        <img src={post.images[0]} alt="" loading="lazy" className="h-40 w-full object-cover" />
      )}

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="flex items-center justify-between">
          <TypeBadge type={post.type} />
          {post.status !== 'active' && <StatusBadge status={post.status} />}
        </div>

        <h3 className="text-[17px] font-semibold leading-snug">{post.title}</h3>
        <p className="line-clamp-3 text-sm text-slate-500 dark:text-slate-400">{post.description}</p>

        <PostCardMeta post={post} />
        <TagList tags={post.tags} />
        <PostCardFooter post={post} liked={liked} onLike={onLike} />
      </div>
    </article>
  );
}
