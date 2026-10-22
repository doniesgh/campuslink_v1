import TypeTabs from './TypeTabs';
import { Input, Select } from '../ui/Field';
import { STATUS_ENTRIES } from '../../constants/postTypes';
import type { PostStatus, PostType } from '../../types/post';

interface Props {
  type: PostType | '';
  onTypeChange: (v: PostType | '') => void;
  search: string;
  onSearchChange: (v: string) => void;
  status: PostStatus | '';
  onStatusChange: (v: PostStatus | '') => void;
}

export default function PostToolbar({
  type, onTypeChange,
  search, onSearchChange,
  status, onStatusChange,
}: Props) {
  return (
    <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <TypeTabs value={type} onChange={onTypeChange} />

      <div className="flex gap-2">
        <Input
          type="search"
          placeholder="Search posts…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="min-w-0 flex-1 md:w-56"
        />
        <Select
          value={status}
          onChange={(e) => onStatusChange(e.target.value as PostStatus | '')}
          className="!w-auto"
        >
          <option value="">Any status</option>
          {STATUS_ENTRIES.map(([k, s]) => (
            <option key={k} value={k}>{s.label}</option>
          ))}
        </Select>
      </div>
    </div>
  );
}
