import { fmtDate } from '../../utils/format';
import type { Post } from '../../types/post';

// Compact type-specific summary shown inside a card.
export default function PostCardMeta({ post }: { post: Post }) {
  const c = post.covoiturage;
  const o = post.objetPerdu;

  if (post.type === 'covoiturage' && c) {
    return (
      <div className="grid gap-0.5 rounded-lg bg-slate-50 px-2.5 py-2 text-[13px] dark:bg-slate-800/60">
        <div>
          <strong>{c.departure}</strong> → <strong>{c.destination}</strong>
        </div>
        <div className="text-slate-600 dark:text-slate-300">
          {fmtDate(c.departureDate)} · {c.seats} seat(s) · {c.price > 0 ? `${c.price} TND` : 'Free'}
        </div>
      </div>
    );
  }

  if (post.type === 'objet_perdu' && o) {
    return (
      <div className="grid gap-0.5 rounded-lg bg-slate-50 px-2.5 py-2 text-[13px] dark:bg-slate-800/60">
        <div>
          <span
            className={`font-semibold ${
              o.kind === 'perdu'
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {o.kind === 'perdu' ? 'Lost' : 'Found'}
          </span>{' '}
          {o.category} {o.place && `· ${o.place}`}
        </div>
        {o.date && <div className="text-slate-600 dark:text-slate-300">{fmtDate(o.date)}</div>}
      </div>
    );
  }

  return null;
}
