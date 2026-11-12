
"use client";

import { Briefcase, Trash2 } from "lucide-react";
import { IconCircle } from "@/components/forum/icons";
import type { AppStatus, Application } from "@/lib/opportunities/types";
import { timeAgo } from "@/lib/forum/format";
import { btnSm } from "@/lib/forum/ui";
import { StatusBadge, TypeBadge } from "./badges";
import { API } from "@/lib/opportunities/api";

type Props = {
    app: Application;
    manage: boolean;
    busy: boolean;
    onStatus: (id: string, status: AppStatus) => void;
    onDelete: (id: string) => void;
};

export function ApplicationCard({
                                    app: a,
                                    manage,
                                    busy,
                                    onStatus,
                                    onDelete
                                }: Props) {

    const handleDelete = () => {
        const confirmed = window.confirm(
            "Voulez-vous vraiment annuler votre candidature ?"
        );

        if (confirmed) {
            onDelete(a._id);
        }
    };
    return (
        <article className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">

            {/* En-tête */}
            <header className="flex items-center gap-3 px-4 py-3">
                <IconCircle tone="brand" size="lg">
                    <Briefcase />
                </IconCircle>

                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                        {a.opportunity?.title ?? "Offre supprimée"}
                    </p>

                    <p className="text-xs text-muted-foreground">
                        <time dateTime={a.createdAt}>
                            {timeAgo(a.createdAt)}
                        </time>
                    </p>
                </div>

                {a.opportunity && (
                    <TypeBadge type={a.opportunity.type} />
                )}

                <StatusBadge status={a.status} />
            </header>

            {a.coverLetter && (
                <p className="px-4 pb-3 whitespace-pre-line break-words text-sm leading-relaxed text-muted-foreground">
                    {a.coverLetter}
                </p>
            )}

            {/* CV */}
            {a.cv && (
                <div className="px-4 pb-4">
                    <a
                        href={`${API}/applications/${a._id}/cv`}
                        download={a.cv.filename}
                        className="inline-block text-sm font-medium text-primary underline"
                    >
                        Télécharger le CV ({a.cv.filename})
                    </a>
                </div>
            )}

            {/* Actions étudiant */}
            {!manage && (
                <div className="border-t border-border px-4 py-3">
                    <button
                        type="button"
                        disabled={busy}
                        onClick={handleDelete}
                        className={`${btnSm} !border-destructive !text-destructive hover:!bg-destructive/10`}
                    >
                        <Trash2 size={16} />
                        Annuler ma candidature
                    </button>
                </div>
            )}

            {/* Actions recruteur */}
            {manage && (
                <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">

                    <button
                        type="button"
                        disabled={busy || a.status === "acceptee"}
                        onClick={() => onStatus(a._id, "acceptee")}
                        className={btnSm}
                    >
                        Accepter
                    </button>

                    <button
                        type="button"
                        disabled={busy || a.status === "refusee"}
                        onClick={() => onStatus(a._id, "refusee")}
                        className={btnSm}
                    >
                        Refuser
                    </button>

                    <button
                        type="button"
                        disabled={busy || a.status === "en_cours"}
                        onClick={() => onStatus(a._id, "en_cours")}
                        className={btnSm}
                    >
                        Mettre en cours
                    </button>

                </div>
            )}

        </article>
    );
}