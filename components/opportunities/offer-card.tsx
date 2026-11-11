"use client";

import { Briefcase, Inbox, Pencil, Trash2 } from "lucide-react";
import { CheckIcon, IconCircle, PinIcon } from "@/components/forum/icons";
import type { Offer } from "@/lib/opportunities/types";
import { timeAgo } from "@/lib/forum/format";
import { btnDanger, btnPrimary, btnSm } from "@/lib/forum/ui";
import { TypeBadge } from "./badges";
import { useState } from "react";
import { OfferSummaryBox } from "./offer-summary";
type Props = {
    offer: Offer;
    canEdit: boolean; // recruteur propriétaire de l'offre, ou admin
    canApply: boolean; // étudiant
    busy: boolean;
    confirming: boolean;
    onEdit: () => void;
    onAskDelete: () => void;
    onCancelDelete: () => void;
    onDelete: () => void;
    onApply: () => void;
};

export function OfferCard({ offer: o, canEdit, canApply, busy, confirming, onEdit, onAskDelete, onCancelDelete, onDelete, onApply }: Props) {
    const [expanded, setExpanded] = useState(false);
    const text: string = o.description ?? "";
    const lineCount: number = text.split(/\r?\n/).length;
    const isLong: boolean = text.length > 180 || lineCount > 3;
    return (
        <article className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
            <header className="flex items-center gap-3 px-4 py-3">
                <IconCircle tone="brand" size="lg"><Briefcase /></IconCircle>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{o.title}</p>
                    <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        {o.createdAt && <time dateTime={o.createdAt}>{timeAgo(o.createdAt)}</time>}
                        {o.domain && <span>{o.domain}</span>}
                        {o.location && (
                            <span className="inline-flex items-center gap-1">
                <PinIcon className="size-3.5" />
                                {o.location}
              </span>
                        )}
                    </p>
                </div>
                <TypeBadge type={o.type} />
                {canEdit && (<>
                <button onClick={onEdit} aria-label="Modifier" title="Modifier" className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&>svg]:size-4">
                    <Pencil />
                </button>
                <button onClick={onAskDelete} aria-label="Supprimer" title="Supprimer" className="flex size-9 items-center justify-center rounded-full bg-destructive/10 text-destructive transition-colors hover:bg-destructive/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&>svg]:size-4">
                    <Trash2 />
                </button>
                </>)}
            </header>

            {canEdit && confirming && (
                <div role="alertdialog" aria-label="Supprimer cette offre ?" className="mx-4 mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2.5">
                    <IconCircle tone="danger"><Trash2 /></IconCircle>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-destructive">Supprimer cette offre ?</p>
                        <p className="text-xs text-muted-foreground">Cette action est définitive.</p>
                    </div>
                    <button disabled={busy} onClick={onDelete} className={btnDanger}>Supprimer</button>
                    <button onClick={onCancelDelete} className={btnSm}>Annuler</button>
                </div>
            )}
            {o.description && (
                <div className="px-4 pb-4">
                    <p
                        className={`whitespace-pre-line break-words text-sm leading-relaxed ${
                            expanded ? "max-h-96 overflow-y-auto pr-1" : "line-clamp-3"
                        }`}
                    >
                        {o.description}
                    </p>
                    {isLong && (
                        <button
                            type="button"
                            onClick={() => setExpanded((v) => !v)}
                            aria-expanded={expanded}
                            className="mt-1 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            {expanded ? "Voir moins" : "Voir plus"}
                        </button>
                    )}
                </div>
            )}
            {o.description && <OfferSummaryBox offerId={o._id} />}
            <div className="flex items-center gap-2 border-t border-border px-3 py-2 text-sm text-muted-foreground">
        <span className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3" title="Candidatures">
          <IconCircle tone="primary" size="sm"><Inbox /></IconCircle>
            {o.applicationsCount ?? 0} candidature(s)
        </span>
                {canApply && (
                    <button disabled={busy} onClick={onApply} className={`${btnPrimary} ml-auto`}>
                        <CheckIcon className="size-[18px]" />
                        Postuler
                    </button>
                )}
            </div>
        </article>
    );
}