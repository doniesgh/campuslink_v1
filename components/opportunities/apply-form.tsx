"use client";

import { useState, type FormEvent } from "react";
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
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
            <form onSubmit={submit} className={`${panel} w-full max-w-lg space-y-4 p-5`}>
                <div>
                    <h2 className="text-lg font-semibold">Postuler</h2>
                    <p className="text-sm text-muted-foreground">{title}</p>
                </div>

                <label className="block space-y-1.5">
                    <span className="text-sm font-medium">Lettre de motivation</span>
                    <textarea
                        className={textarea}
                        rows={6}
                        value={coverLetter}
                        onChange={(e) => setCoverLetter(e.target.value)}
                        placeholder="Présentez-vous et expliquez votre motivation..."
                    />
                </label>

                <label className="block space-y-1.5">
                    <span className="text-sm font-medium">CV (PDF, DOC, DOCX, 5 Mo max)</span>
                    <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        disabled={!online}
                        onChange={(e) => pick(e.target.files?.[0] ?? null)}
                        className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground disabled:opacity-50"
                    />
                    {!online && (
                        <p className="text-xs text-muted-foreground">
                            Hors ligne : le CV ne peut pas être joint. Votre lettre sera envoyée au retour de la connexion.
                        </p>
                    )}
                    {cv && <p className="text-xs text-muted-foreground">Fichier : {cv.name}</p>}
                    {fileError && <p className="text-xs text-destructive">{fileError}</p>}
                </label>

                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onCancel} className={btn}>Annuler</button>
                    <button type="submit" disabled={busy} className={btnPrimary}>
                        {busy ? "Envoi..." : "Envoyer ma candidature"}
                    </button>
                </div>
            </form>
        </div>
    );
}