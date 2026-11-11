"use client";

import { useMemo, useState } from "react";
import { CloseIcon, SearchIcon } from "@/components/forum/icons";
import { OFFER_TYPES, TYPE_LABEL, type Offer } from "@/lib/opportunities/types";
import { canApply } from "@/lib/opportunities/roles";
import type { Role } from "@/lib/types";
import { Empty, Pill } from "./common";
import { OfferCard } from "./offer-card";

type Props = {
    userId: string;
    role: Role;
    offers: Offer[];
    busy: boolean;
    confirmId: string | null;
    setConfirmId: (id: string | null) => void;
    onEdit: (o: Offer) => void;
    onDelete: (id: string) => void;
    onApply: (id: string) => void;
};

export function OffersTab({ userId, role, offers, busy, confirmId, setConfirmId, onEdit, onDelete, onApply }: Props) {
    const [q, setQ] = useState("");
    const [typeFilter, setTypeFilter] = useState("");

    const visible = useMemo(() => {
        const needle = q.trim().toLowerCase();
        return offers.filter(
            (o) =>
                (!typeFilter || o.type === typeFilter) &&
                (!needle || [o.title, o.domain, o.location].some((v) => v?.toLowerCase().includes(needle)))
        );
    }, [offers, q, typeFilter]);

    return (
        <>
            <form
                role="search"
                onSubmit={(e) => e.preventDefault()}
                className="mx-auto flex h-11 max-w-sm items-center gap-1 rounded-full border border-input bg-card pl-3.5 pr-1.5 shadow-sm focus-within:ring-2 focus-within:ring-ring"
            >
                <label htmlFor="ann-q" className="sr-only">Rechercher</label>
                <span aria-hidden className="text-muted-foreground"><SearchIcon className="size-[18px]" /></span>
                <input id="ann-q" className="h-full min-w-0 flex-1 bg-transparent px-1 text-sm placeholder:text-muted-foreground focus:outline-none" placeholder="Rechercher une offre..." value={q} onChange={(e) => setQ(e.target.value)} />
                {q && (
                    <button type="button" onClick={() => setQ("")} aria-label="Effacer" className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <CloseIcon className="size-3.5" />
                    </button>
                )}
                <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <SearchIcon className="size-4" />
        </span>
            </form>

            <div role="group" aria-label="Filtrer par type" className="flex flex-wrap justify-center gap-2">
                <Pill on={typeFilter === ""} onClick={() => setTypeFilter("")}>Tous</Pill>
                {OFFER_TYPES.map((t) => (
                    <Pill key={t} on={typeFilter === t} onClick={() => setTypeFilter(t)}>{TYPE_LABEL[t]}</Pill>
                ))}
            </div>

            <p className="text-center text-sm text-muted-foreground">{visible.length} offre(s)</p>

            {visible.length === 0 && <Empty icon={<SearchIcon />} title="Aucune offre" hint="Essayez un autre filtre." />}

            {visible.map((o) => (
                <OfferCard
                    key={o._id}
                    offer={o}
                    canEdit={role === "ADMIN" || (!!o.author && o.author === userId)}
                    canApply={canApply(role)}
                    busy={busy}
                    confirming={confirmId === o._id}
                    onEdit={() => onEdit(o)}
                    onAskDelete={() => setConfirmId(o._id)}
                    onCancelDelete={() => setConfirmId(null)}
                    onDelete={() => onDelete(o._id)}
                    onApply={() => onApply(o._id)}
                />
            ))}
        </>
    );
}