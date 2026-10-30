"use client";

import { Briefcase } from "lucide-react";
import { IconCircle } from "@/components/forum/icons";
import type { AppStatus, Application } from "@/lib/opportunities/types";
import { timeAgo } from "@/lib/forum/format";
import { btnSm } from "@/lib/forum/ui";
import { StatusBadge, TypeBadge } from "./badges";

type Props = {
    app: Application;
    manage: boolean; // true : boutons Accepter / Refuser (onglet Demandes)
    busy: boolean;
    onStatus: (id: string, status: AppStatus) => void;
};

export function ApplicationCard({ app: a, manage, busy, onStatus }: Props) {
    return (
        <article className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
            <header className="flex items-center gap-3 px-4 py-3">
                <IconCircle tone="brand" size="lg"><Briefcase /></IconCircle>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{a.opportunity?.title ?? "Offre supprimée"}</p>
                    <p className="text-xs text-muted-foreground">
                        <time dateTime={a.createdAt}>{timeAgo(a.createdAt)}</time>
                    </p>
                </div>
                {a.opportunity && <TypeBadge type={a.opportunity.type} />}
                <StatusBadge status={a.status} />
            </header>

            {a.coverLetter && <p className="whitespace-pre-line break-words px-4 pb-4 text-sm leading-relaxed">{a.coverLetter}</p>}

            {manage && (
                <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
                    <button disabled={busy || a.status === "acceptee"} onClick={() => onStatus(a._id, "acceptee")} className={btnSm}>Accepter</button>
                    <button disabled={busy || a.status === "refusee"} onClick={() => onStatus(a._id, "refusee")} className={btnSm}>Refuser</button>
                    <button disabled={busy || a.status === "en_cours"} onClick={() => onStatus(a._id, "en_cours")} className={btnSm}>Mettre en cours</button>
                </div>
            )}
        </article>
    );
}