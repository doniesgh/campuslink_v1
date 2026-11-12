"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { btnSm } from "@/lib/forum/ui";
import { fetchSummary, type OfferSummary } from "@/lib/opportunities/api";

export function OfferSummaryBox({ offerId }: { offerId: string }) {
    const [data, setData] = useState<OfferSummary | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function generate() {
        setError(null);
        setLoading(true);
        try {
            setData(await fetchSummary(offerId));
        } catch (e) {
            setError(e instanceof Error ? e.message : "Erreur inattendue.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="px-4 pb-4">
            {!data && (
                <button type="button" onClick={generate} disabled={loading} className={btnSm}>
                    <Sparkles className="size-4" />
                    {loading ? "Résumé en cours…" : "Résumer avec l'IA"}
                </button>
            )}
            {error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
            {data && (
                <div className="rounded-xl bg-muted p-3 text-sm">
                    <p className="font-medium">✨ Résumé IA</p>
                    <p className="mt-1">{data.summary}</p>
                    <ul className="mt-2 list-disc space-y-0.5 pl-5">
                        {data.keyPoints.map((k) => <li key={k}>{k}</li>)}
                    </ul>
                    <p className="mt-2 text-xs text-muted-foreground">Généré par IA, vérifiez l'offre complète.</p>
                </div>
            )}
        </div>
    );
}