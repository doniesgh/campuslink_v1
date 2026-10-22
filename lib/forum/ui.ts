// Classes partagées (uniquement les tokens de globals.css : le thème bleu ne change pas).
const base =
  "inline-flex items-center justify-center gap-2 rounded-full text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background";

export const btn = `${base} h-10 border border-input bg-background px-4 text-foreground hover:bg-accent hover:text-accent-foreground`;
export const btnSm = `${base} h-8 border border-input bg-background px-3 text-xs text-foreground hover:bg-accent hover:text-accent-foreground`;
export const btnPrimary = `${base} h-11 bg-primary px-5 text-primary-foreground shadow-sm hover:bg-primary/90`;
export const btnDanger = `${base} h-8 bg-destructive px-3 text-xs text-destructive-foreground hover:bg-destructive/90`;
export const btnDangerGhost = `${base} h-8 border border-input bg-background px-3 text-xs text-destructive hover:bg-destructive/10`;

const control =
  "rounded-xl border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive";
export const field = `${control} h-11 px-3.5`;
export const fieldIcon = `${control} h-11 pl-10 pr-3.5`;
export const textarea = `${control} min-h-32 px-3.5 py-3 leading-relaxed`;
export const panel = "rounded-2xl border border-border bg-card text-card-foreground";
