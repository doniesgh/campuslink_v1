import { useState } from 'react';
import type { FormEvent } from 'react';
import Button from '@/components/ui/ButtonForm';
import { Textarea } from "@/components/ui/textarea";
interface Props {
  onSubmit: (content: string) => Promise<void>;
  placeholder?: string;
  autoFocus?: boolean;
  onCancel?: () => void;
}

export default function CommentForm({ onSubmit, placeholder, autoFocus, onCancel }: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      await onSubmit(text.trim());
      setText('');
      onCancel?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-2">
      <Textarea
        rows={2}
        maxLength={2000}
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex justify-end gap-2">
        {onCancel && <Button variant="ghost" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" disabled={busy || !text.trim()}>Send</Button>
      </div>
    </form>
  );
}
