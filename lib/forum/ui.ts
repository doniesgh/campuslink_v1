// Design « Collegiate Pulse » : marine #1e3a8a (blue-900), bleu campus #2563eb (blue-600),
// surfaces #eff4ff / #e5eeff, bordures slate-200. Uniquement des classes Tailwind.
const base =
  "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all disabled:pointer-events-none disabled:opacity-50 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ring-offset-white";

export const btn = `${base} h-10 border border-slate-200 bg-white px-4 text-slate-700 hover:border-slate-300 hover:bg-slate-50`;
export const btnSm = `${base} h-8 border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:border-slate-300 hover:bg-slate-50`;
export const btnGhost = `${base} h-10 px-4 text-slate-600 hover:bg-slate-100`;
export const btnPrimary = `${base} h-11 bg-blue-900 px-5 text-white shadow-[0_1px_3px_0_rgba(15,23,42,0.08)] hover:scale-[1.01] hover:bg-blue-950 active:scale-[.98]`;
export const btnPrimarySm = `${base} h-8 bg-blue-900 px-3 text-xs text-white hover:bg-blue-950`;
export const btnDanger = `${base} h-8 bg-red-600 px-3 text-xs text-white hover:bg-red-700`;
export const btnDangerGhost = `${base} h-8 border border-slate-200 bg-white px-3 text-xs text-red-600 hover:bg-red-50`;

const control =
  "rounded-lg border border-transparent bg-[#eff4ff] text-sm text-slate-900 shadow-sm transition-all placeholder:text-slate-400 " +
  "focus-visible:border-blue-600 focus-visible:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30 aria-[invalid=true]:border-red-500";
export const field = `${control} h-11 px-3.5`;
export const fieldIcon = `${control} h-11 pl-10 pr-3.5`;
export const textarea = `${control} min-h-32 px-3.5 py-3 leading-relaxed`;
export const fieldLabel = "flex items-center gap-1.5 text-xs font-semibold text-slate-900 [&>svg]:size-4 [&>svg]:text-blue-600";
export const panel = "rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_0_rgba(15,23,42,0.04),0_1px_2px_-1px_rgba(15,23,42,0.04)]";
