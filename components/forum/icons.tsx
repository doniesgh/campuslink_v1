import type { ReactNode } from "react";

const p = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

type IconProps = { className?: string };
const make = (d: ReactNode, filled = false) =>
  function Icon({ className }: IconProps) {
    return (
      <svg {...p} {...(filled ? { fill: "currentColor", stroke: "none" } : {})} className={className}>
        {d}
      </svg>
    );
  };

export const HeartIcon = make(<path d="M12 21s-7.5-4.6-9.6-9.2C.8 8.2 2.8 4.5 6.4 4.5c2 0 3.7 1.1 4.6 2.7h2c.9-1.6 2.6-2.7 4.6-2.7 3.6 0 5.6 3.7 4 7.3C19.5 16.4 12 21 12 21z" />, true);
export const DotsIcon = make(<><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></>, true);
export const DotIcon = make(<circle cx="12" cy="12" r="5" />, true);
export const CommentIcon = make(<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />);
export const EyeIcon = make(<><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>);
export const SearchIcon = make(<><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></>);
export const PlusIcon = make(<path d="M12 5v14M5 12h14" />);
export const CloseIcon = make(<path d="M6 6l12 12M18 6L6 18" />);
export const CheckIcon = make(<path d="M5 12.5l4.5 4.5L19 7.5" />);
export const CheckCircleIcon = make(<><circle cx="12" cy="12" r="9" /><path d="M8 12.3l2.8 2.8L16 9.6" /></>);
export const LockIcon = make(<><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>);
export const GridIcon = make(<><rect x="4" y="4" width="6.5" height="6.5" rx="1.6" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6" /></>);
export const CarIcon = make(<><path d="M5 12l1.6-4.3A2 2 0 0 1 8.5 6.4h7a2 2 0 0 1 1.9 1.3L19 12" /><rect x="3" y="12" width="18" height="5.5" rx="1.8" /><circle cx="7.5" cy="14.7" r=".9" /><circle cx="16.5" cy="14.7" r=".9" /><path d="M6 17.5V19M18 17.5V19" /></>);
export const BoxIcon = make(<path d="M21 8l-9-5-9 5v8l9 5 9-5V8zM3.3 7.5l8.7 5 8.7-5M12 22v-9.5" />);
export const StarIcon = make(<path d="M12 3.5l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17.3l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8L12 3.5z" />);
export const BulbIcon = make(<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5.9 1.1.9 1.7V16h5.4v-.5c0-.6.3-1.2.9-1.7A6 6 0 0 0 12 3z" />);
/** Siège de voiture vu de côté : dossier + assise. */
export const SeatIcon = make(<><rect x="6" y="3" width="5.5" height="12.5" rx="2.5" transform="rotate(-8 8.75 9.25)" /><rect x="6.5" y="14.5" width="12" height="4" rx="2" /><path d="M9 21h7" /></>);
export const CalendarIcon = make(<><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>);
export const PinIcon = make(<><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z" /><circle cx="12" cy="10" r="2.4" /></>);
export const FlagIcon = make(<path d="M5.5 21V4M5.5 4.5h12l-2.5 4 2.5 4h-12" />);
export const CashIcon = make(<><rect x="2.5" y="6" width="19" height="12" rx="2.5" /><circle cx="12" cy="12" r="2.5" /></>);
export const ArrowRightIcon = make(<path d="M5 12h14M13 6l6 6-6 6" />);
export const ArrowLeftIcon = make(<path d="M19 12H5M11 6l-6 6 6 6" />);
export const TrashIcon = make(<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6" />);
export const SendIcon = make(<path d="M21 3L10.5 13.5M21 3l-6.5 18-4-7.5L3 9.5 21 3z" />);

const tones = {
  brand: "bg-brand text-brand-foreground",
  solid: "bg-primary text-primary-foreground",
  soft: "bg-accent text-accent-foreground",
  primary: "bg-primary/10 text-primary",
  heart: "bg-highlight/10 text-highlight",
  success: "bg-success/10 text-success",
  danger: "bg-destructive/10 text-destructive",
  muted: "bg-muted text-muted-foreground",
  onBrand: "bg-brand-foreground/15 text-brand-foreground",
};
const sizes = {
  sm: "size-7 [&>svg]:size-3.5",
  md: "size-9 [&>svg]:size-[18px]",
  lg: "size-12 [&>svg]:size-6",
};

/** Pastille ronde qui porte une icône : c'est le motif visuel de tout le forum. */
export function IconCircle({ children, tone = "soft", size = "md", className = "" }: { children: ReactNode; tone?: keyof typeof tones; size?: keyof typeof sizes; className?: string }) {
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center rounded-full ${tones[tone]} ${sizes[size]} ${className}`}>
      {children}
    </span>
  );
}
