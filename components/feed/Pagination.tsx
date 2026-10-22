import Button from '../ui/ButtonForm';

interface Props {
  page: number;
  pages: number;
  onChange: (page: number) => void;
}

export default function Pagination({ page, pages, onChange }: Props) {
  if (pages <= 1) return null;
  return (
    <div className="mt-6 flex items-center justify-center gap-4 text-sm">
      <Button variant="ghost" disabled={page <= 1} onClick={() => onChange(page - 1)}>← Prev</Button>
      <span className="text-slate-500 dark:text-slate-400">{page} / {pages}</span>
      <Button variant="ghost" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next →</Button>
    </div>
  );
}
