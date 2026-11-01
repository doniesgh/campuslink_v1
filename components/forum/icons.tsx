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

export const EditIcon = make(<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3zM14.5 7.5l3 3" />);
export const HeartOutlineIcon = make(<path d="M12 20.5s-7.2-4.4-9.2-8.8C1.4 8.5 3.2 5 6.5 5c2 0 3.5 1 4.5 2.6h2C14 6 15.5 5 17.5 5c3.3 0 5.1 3.5 3.7 6.7-2 4.4-9.2 8.8-9.2 8.800z" />);
export const CloudOffIcon = make(<path d="M3 3l18 18M7.5 7.600A5.5 5.5 0 0 0 7 18h10.500a4 4 0 0 0 1.8-.5M17.2 10.400A5.5 5.5 0 0 0 9.5 5.2" />);
export const RefreshIcon = make(<path d="M20 11a8 8 0 0 0-14.3-4.600L4 8.500M4 4v4.500h4.500M4 13a8 8 0 0 0 14.3 4.600L20 15.500M20 20v-4.500h-4.5" />);

export const RouteIcon = make(<><circle cx="6" cy="19" r="2" /><circle cx="18" cy="5" r="2" /><path d="M8 19h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7" /></>);
export const ClockIcon = make(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);
export const LeafIcon = make(<><path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14" /><path d="M5 19c3-5 6-8 10-10" /></>);
export const HashIcon = make(<path d="M9 4L7.5 20M16.5 4L15 20M4.5 9h16M3.5 15h16" />);
export const LuggageIcon = make(<><rect x="3" y="7" width="18" height="13" rx="2.5" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 13h18" /></>);
export const MusicIcon = make(<><path d="M9 18V6l10-2v12" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="16.5" cy="16" r="2.5" /></>);
export const SnowflakeIcon = make(<path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5" />);
export const UsersIcon = make(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.5a6.5 6.5 0 0 1 3.5 5.5" /></>);
export const NoSmokeIcon = make(<path d="M3 3l18 18M3 15h12v3H3zM18 15v3M21 12a2.5 2.5 0 0 0-2.5-2.5M18 6a3 3 0 0 1 3 3" />);
export const UserIcon = make(<><circle cx="12" cy="8" r="4" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></>);

const tones = {
  heartOn: "bg-rose-500 text-white",
  amber: "bg-amber-100 text-amber-600",
  brand: "bg-blue-900 text-white",
  solid: "bg-blue-900 text-white",
  soft: "bg-[#eff4ff] text-blue-900",
  primary: "bg-blue-50 text-blue-600",
  heart: "bg-rose-50 text-rose-500",
  success: "bg-emerald-50 text-emerald-600",
  danger: "bg-red-50 text-red-600",
  muted: "bg-slate-100 text-slate-500",
  onBrand: "bg-white/15 text-white",
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
