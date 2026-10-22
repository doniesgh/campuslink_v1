import type { ReactNode } from 'react';
import { fmtDate } from '../../utils/format';
import type { Post } from '../../types/post';

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-0.5 font-semibold">{children}</dd>
    </div>
  );
}

const Phone = ({ value }: { value: string }) => (
  <a href={`tel:${value}`} className="text-indigo-600 hover:underline dark:text-indigo-400">{value}</a>
);

// Full type-specific details for the detail view.
export default function PostFacts({ post }: { post: Post }) {
  const c = post.covoiturage;
  const o = post.objetPerdu;
  const grid = 'm-0 grid grid-cols-2 gap-2 sm:grid-cols-3';

  if (post.type === 'covoiturage' && c) {
    return (
      <dl className={grid}>
        <Fact label="From">{c.departure}</Fact>
        <Fact label="To">{c.destination}</Fact>
        <Fact label="Departure">{fmtDate(c.departureDate)}</Fact>
        <Fact label="Seats">{c.seats}</Fact>
        <Fact label="Price">{c.price > 0 ? `${c.price} TND` : 'Free'}</Fact>
        {c.contactPhone && <Fact label="Phone"><Phone value={c.contactPhone} /></Fact>}
      </dl>
    );
  }

  if (post.type === 'objet_perdu' && o) {
    return (
      <dl className={grid}>
        <Fact label="Type">{o.kind === 'perdu' ? 'Lost' : 'Found'}</Fact>
        {o.category && <Fact label="Category">{o.category}</Fact>}
        {o.place && <Fact label="Place">{o.place}</Fact>}
        {o.date && <Fact label="Date">{fmtDate(o.date)}</Fact>}
        {o.contactPhone && <Fact label="Phone"><Phone value={o.contactPhone} /></Fact>}
      </dl>
    );
  }

  return null;
}
