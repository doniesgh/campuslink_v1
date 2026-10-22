import CommentForm from './CommentForm';
import CommentItem from './CommentItem';
import type { CommentThread } from '../../types/post';

interface Props {
  comments: CommentThread;
  currentUserId: string;
  onAdd: (content: string, parentId?: string | null) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export default function CommentSection({ comments, currentUserId, onAdd, onDelete }: Props) {
  const { roots, byParent, total } = comments;

  return (
    <section className="grid gap-3">
      <h3 className="text-base font-semibold">Comments ({total})</h3>
      <CommentForm placeholder="Write a comment…" onSubmit={(content) => onAdd(content)} />

      <ul className="grid gap-3.5">
        {roots.map((c) => (
          <CommentItem
            key={c._id}
            comment={c}
            byParent={byParent}
            currentUserId={currentUserId}
            onReply={onAdd}
            onDelete={onDelete}
          />
        ))}
        {roots.length === 0 && (
          <li className="text-sm text-slate-500 dark:text-slate-400">
            No comments yet. Start the conversation.
          </li>
        )}
      </ul>
    </section>
  );
}
