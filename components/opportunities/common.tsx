import type { ReactNode } from "react";
import { IconCircle } from "@/components/forum/icons";

export function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
    return (
        <div className="space-y-1.5">
            <label htmlFor={id} className="text-sm font-medium">{label}</label>
            {children}
        </div>
    );
}

/** Pastille de filtre ou d'onglet (même style que les filtres du forum). */
export function Pill({ on, onClick, icon, children, role }: { on: boolean; onClick: () => void; icon?: ReactNode; children: ReactNode; role?: string }) {
    return (
        <button
            role={role}
           // aria-selected={role === "tab" ? on : undefined}
           // aria-pressed={role === "tab" ? undefined : on}
            onClick={onClick}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full border py-1 ${icon ? "pl-1" : "pl-3.5"} pr-3.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                on ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-accent hover:text-accent-foreground"
            }`}
        >
            {icon && (
                <span aria-hidden className={`flex size-6 items-center justify-center rounded-full [&>svg]:size-3.5 ${on ? "bg-primary-foreground/20" : "bg-accent text-accent-foreground"}`}>
          {icon}
        </span>
            )}
            {children}
        </button>
    );
}

export function Empty({ icon, title, hint }: { icon: ReactNode; title: string; hint: string }) {
    return (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-input bg-card px-4 py-12 text-center">
            <IconCircle tone="soft" size="lg">{icon}</IconCircle>
            <p className="mt-3 font-medium">{title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
        </div>
    );
}