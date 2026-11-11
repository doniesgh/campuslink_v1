"use client";

import { useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { btn, btnPrimary, panel, textarea } from "@/lib/forum/ui";

const MAX = 5 * 1024 * 1024;

type Props = {
    title: string;
    online: boolean;
    busy: boolean;
    onSubmit: (coverLetter: string, cv: File | null) => void;
    onCancel: () => void;
};

export function ApplyForm({ title, online, busy, onSubmit, onCancel }: Props) {
    const [coverLetter, setCoverLetter] = useState("");
    const [cv, setCv] = useState<File | null>(null);
    const [fileError, setFileError] = useState("");

    // Échap ferme le modal ; la page derrière ne défile plus pendant qu'il est ouvert.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && !busy) onCancel();
        };
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", onKey);
        return () => {
            document.body.style.overflow = previous;
            window.removeEventListener("keydown", onKey);
        };
    }, [busy, onCancel]);

    function pick(file: File | null) {
        setFileError("");
        if (file && file.size > MAX) {
            setFileError("Fichier trop lourd (5 Mo maximum).");
            setCv(null);
            return;
        }
        setCv(file);
    }

    function submit(e: FormEvent) {
        e.preventDefault();
        onSubmit(coverLetter.trim(), cv);
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="apply-title"
            onClick={(e) => {
                if (e.target === e.currentTarget && !busy) onCancel();
            }}
        >
            <form
                onSubmit={submit}
                className={`${panel} flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-b-none shadow-2xl sm:max-w-2xl sm:rounded-2xl`}
            >
                {/* En-tête fixe */}
                <header className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
                    <div className="min-w-0">
                        <h2 id="apply-title" className="text-xl font-semibold">Postuler</h2>
                        <p className="mt-1 truncate text-sm text-muted-foreground">{title}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={busy}
                        aria-label="Fermer"
                        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <X className="size-4" />
                    </button>
                </header>

                {/* Contenu : c'est cette zone qui défile */}
                <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
                    <div className="space-y-2">
                        <label htmlFor="cover-letter" className="text-sm font-medium">Lettre de motivation</label>
                        <textarea
                            id="cover-letter"
                            className={`${textarea} w-full resize-y`}
                            rows={8}
                            value={coverLetter}
                            onChange={(e) => setCoverLetter(e.target.value)}
                            placeholder="Présentez-vous et expliquez votre motivation..."
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="cv-file" className="text-sm font-medium">CV (PDF ou DOCX, 5 Mo max)</label>
                        <div className="rounded-xl border border-dashed border-input bg-muted/40 p-4">
                            <input
                                id="cv-file"
                                type="file"
                                accept=".pdf,.docx"
                                disabled={!online}
                                onChange={(e) => pick(e.target.files?.[0] ?? null)}
                                className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground disabled:opacity-50"
                            />
                            {cv && <p className="mt-2 text-xs text-muted-foreground">Fichier sélectionné : {cv.name}</p>}
                            {fileError && <p role="alert" className="mt-2 text-xs text-destructive">{fileError}</p>}
                        </div>
                        {!online && (
                            <p className="text-xs text-muted-foreground">
                                Hors ligne : le CV ne peut pas être joint. Votre lettre sera envoyée au retour de la connexion.
                            </p>
                        )}
                    </div>
                </div>

                {/* Pied fixe : les boutons restent toujours visibles */}
                <footer className="flex flex-col-reverse gap-3 border-t border-border bg-card px-6 py-4 sm:flex-row sm:justify-end">
                    <button type="button" onClick={onCancel} disabled={busy} className={btn}>Annuler</button>
                    <button type="submit" disabled={busy} className={btnPrimary}>
                        {busy ? "Envoi..." : "Envoyer ma candidature"}
                    </button>
                </footer>
            </form>
        </div>
    );
}