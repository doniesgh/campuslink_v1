import { STATUSES } from '../../constants/postTypes';
import type { PostStatus } from '../../types/post';

export default function StatusBadge({ status }: { status: PostStatus }) {
  const s = STATUSES[status];
  if (!s) return null;
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${s.badge}`}>{s.label}</span>
  );
}
