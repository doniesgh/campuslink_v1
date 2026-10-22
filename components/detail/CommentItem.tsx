import { useState } from 'react';
import Avatar from '../ui/Avatar';
import CommentForm from './CommentForm';
import { authorName, idOf, timeAgo } from '../../utils/format';
import type { CommentsByParent, PostComment } from '../../types/post';

const actionBtn =
  'text-[13px] text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400';

interface Props {
  comment: PostComment;
  byParent: CommentsByParent;
  currentUserId: string;
  onReply: (content: string, parentId: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

// Recursive: renders its own replies as nested CommentItems.
export default function CommentItem({ comment, byParent, currentUserId, onReply, onDelete }: Props) {
  const [replying, setReplying] = useState(false);
  const replies = byParent[comment._id] ?? [];
  const name = authorName(comment.author);
  const isMine = idOf(comment.author) === String(currentUserId);

  return (
    <li className="flex gap-2.5">
      <Avatar name={name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 text-sm">
          <strong>{name}</strong>
          <span className="text-xs text-slate-500 dark:text-slate-400">{timeAgo(comment.createdAt)}</span>
        </div>

        <p className="my-1 whitespace-pre-wrap break-words text-sm">{comment.content}</p>

        <div className="flex gap-3">
          <button type="button" className={actionBtn} onClick={() => setReplying(!replying)}>Reply</button>
          {isMine && (
            <button type="button" className={actionBtn} onClick={() => onDelete(comment._id)}>Delete</button>
          )}
        </div>

        {replying && (
          <div className="mt-2">
            <CommentForm
              autoFocus
              placeholder={`Reply to ${name}…`}
              onSubmit={(content) => onReply(content, comment._id)}
              onCancel={() => setReplying(false)}
            />
          </div>
        )}

        {replies.length > 0 && (
          <ul className="mt-3 grid gap-3.5 border-l-2 border-slate-200 pl-3.5 dark:border-slate-700">
            {replies.map((r) => (
              <CommentItem
                key={r._id}
                comment={r}
                byParent={byParent}
                currentUserId={currentUserId}
                onReply={onReply}
                onDelete={onDelete}
              />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}
