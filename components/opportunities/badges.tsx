import { Briefcase } from "lucide-react";
import { STATUS, TYPE_LABEL, type AppStatus } from "@/lib/announcements/types";

export function TypeBadge({ type }: { type: string }) {
    return (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-accent py-0.5 pl-0.5 pr-2.5 text-xs font-medium text-accent-foreground">
      <span aria-hidden className="flex size-5 items-center justify-center rounded-full bg-brand text-brand-foreground [&>svg]:size-3">
        <Briefcase />
      </span>
            {TYPE_LABEL[type] ?? type}
    </span>
    );
}

export function StatusBadge({ status }: { status: AppStatus }) {
    const s = STATUS[status] ?? STATUS.envoyee;
    return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}