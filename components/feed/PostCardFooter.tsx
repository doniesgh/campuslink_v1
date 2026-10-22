import { authorName, timeAgo } from '../../utils/format';
import type { Post } from '../../types/post';

interface Props {
  post: Post;
  liked: boolean;
  onLike: (id: string) => void;
}

export default function PostCardFooter({ post, liked, onLike }: Props) {
  return (
    <div
      className="mt-auto flex items-center gap-4 border-t border-slate-200 pt-2.5 text-[13px] text-slate-500 dark:border-slate-800 dark:text-slate-400"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => onLike(post._id)}
        aria-label="Like"
        className={`transition ${liked ? 'text-rose-500' : 'hover:text-rose-500'}`}
      >
        {liked ? '♥' : '♡'} {post.likesCount}
      </button>
      <span>💬 {post.commentsCount}</span>
      <span>👁 {post.views}</span>
      <span className="ml-auto truncate">
        {authorName(post.author)} · {timeAgo(post.createdAt)}
      </span>
    </div>
  );
}
