import Chip from '../ui/Chip';
import { POST_TYPE_ENTRIES } from '../../constants/postTypes';
import type { PostType } from '../../types/post';

interface Props {
  value: PostType | '';
  onChange: (value: PostType | '') => void;
}

export default function TypeTabs({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Chip active={!value} onClick={() => onChange('')}>All</Chip>
      {POST_TYPE_ENTRIES.map(([key, t]) => (
        <Chip key={key} active={value === key} onClick={() => onChange(key)}>
          {t.icon} {t.label}
        </Chip>
      ))}
    </div>
  );
}
