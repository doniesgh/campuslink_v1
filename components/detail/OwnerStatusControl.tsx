import Chip from '../ui/Chip';
import { STATUS_ENTRIES } from '../../constants/postTypes';
import type { PostStatus } from '../../types/post';

interface Props {
  status: PostStatus;
  onChange: (status: PostStatus) => void;
}

export default function OwnerStatusControl({ status, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-sm text-slate-500 dark:text-slate-400">Status:</span>
      {STATUS_ENTRIES.map(([key, s]) => (
        <Chip key={key} active={status === key} onClick={() => onChange(key)}>
          {s.label}
        </Chip>
      ))}
    </div>
  );
}
