import { POST_TYPES } from '../../constants/postTypes';
import type { PostType } from '../../types/post';

export default function TypeBadge({ type }: { type: PostType }) {
  const t = POST_TYPES[type];
  if (!t) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${t.badge}`}>
      {t.icon} {t.label}
    </span>
  );
}
