import type { ReactNode } from "react";

const p = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

type IconProps = { className?: string };
const make = (d: ReactNode) =>
    function Icon({ className }: IconProps) {
        return (
            <svg {...p} className={className}>
                {d}
            </svg>
        );
    };

export const BriefcaseIcon = make(<><rect x="3" y="7" width="18" height="13" rx="2.5" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 13h18" /></>);
export const InboxIcon = make(<path d="M3 13l2.5-7.2A2 2 0 0 1 7.4 4.5h9.2a2 2 0 0 1 1.9 1.3L21 13v4.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V13zM3 13h5l1.5 2.5h5L16 13h5" />);
export const PencilIcon = make(<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3zM14 7l3 3" />);