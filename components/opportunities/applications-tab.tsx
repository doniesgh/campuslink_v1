
"use client";

import { Inbox, Send } from "lucide-react";
import type { AppStatus, Application } from "@/lib/opportunities/types";
import { ApplicationCard } from "./application-card";
import { Empty } from "./common";

type Props = {
    apps: Application[];
    manage: boolean; // true : onglet « Demandes », false : « Où j'ai postulé »
    busy: boolean;
    onStatus: (id: string, status: AppStatus) => void;
    onDelete: (id: string)=> void;
};

export function ApplicationsTab({ apps, manage, busy, onStatus, onDelete }: Props) {
    let emptyState;

    if (manage) {
        emptyState = (
            <Empty
                icon={<Inbox />}
                title="Aucune demande"
                hint="Les candidatures reçues pour vos offres apparaîtront ici."
            />
        );
    } else {
        emptyState = (
            <Empty
                icon={<Send />}
                title="Aucune candidature"
                hint="Postulez à une offre pour suivre son état ici."
            />
        );
    }

    return (
        <>
            <p className="text-center text-sm text-muted-foreground">
                {apps.length}{" "}
                {manage
                    ? "demande(s) reçue(s)"
                    : "candidature(s) envoyée(s)"}
            </p>

            {apps.length === 0
                ? emptyState
                : apps.map((a) => (
                    <ApplicationCard
                        key={a._id}
                        app={a}
                        manage={manage}
                        busy={busy}
                        onStatus={onStatus}
                        onDelete={onDelete}
                    />

                ))}
        </>
    );
}
