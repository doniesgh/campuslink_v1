"use client";

import type { FormEvent } from "react";
import { Pencil } from "lucide-react";
import { IconCircle, PinIcon, PlusIcon, SendIcon } from "@/components/forum/icons";
import { OFFER_TYPES, TYPE_LABEL, type OfferForm as Form } from "@/lib/opportunities/types";
import { btn, btnPrimary, field, fieldIcon, panel, textarea } from "@/lib/forum/ui";
import { Field } from "./common";

type Props = {
    form: Form;
    onChange: (form: Form) => void;
    editing: boolean;
    busy: boolean;
    onSubmit: (e: FormEvent) => void;
    onCancel: () => void;
};

export function OfferForm({ form, onChange, editing, busy, onSubmit, onCancel }: Props) {
    const set = (patch: Partial<Form>) => onChange({ ...form, ...patch });

    return (
        <form onSubmit={onSubmit} className={`${panel} space-y-4 p-5 shadow-sm`}>
            <h2 className="flex items-center gap-3 text-base font-semibold">
                <IconCircle tone="primary">{editing ? <Pencil /> : <PlusIcon />}</IconCircle>
                {editing ? "Modifier l'offre" : "Nouvelle offre"}
            </h2>

            <Field id="title" label="Titre">
                <input id="title" required maxLength={120} className={`${field} w-full`} placeholder="Ex : Stage développeur web" value={form.title} onChange={(e) => set({ title: e.target.value })} />
            </Field>

            <Field id="type" label="Type">
                <select id="type" className={`${field} w-full`} value={form.type} onChange={(e) => set({ type: e.target.value })}>
                    {OFFER_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                </select>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
                <Field id="domain" label="Domaine">
                    <input id="domain" className={`${field} w-full`} placeholder="Informatique" value={form.domain} onChange={(e) => set({ domain: e.target.value })} />
                </Field>
                <Field id="location" label="Lieu">
                    <div className="relative">
                        <span aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground [&>svg]:size-[18px]"><PinIcon /></span>
                        <input id="location" className={`${fieldIcon} w-full`} placeholder="Tunis" value={form.location} onChange={(e) => set({ location: e.target.value })} />
                    </div>
                </Field>
            </div>

            <Field id="description" label="Description">
                <textarea id="description" maxLength={1500} className={`${textarea} w-full`} placeholder="Détails de l'offre..." value={form.description} onChange={(e) => set({ description: e.target.value })} />
            </Field>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={onCancel} className={btn}>Annuler</button>
                <button type="submit" disabled={busy} className={btnPrimary}>
                    <SendIcon className="size-[18px]" />
                    {editing ? "Enregistrer" : "Publier"}
                </button>
            </div>
        </form>
    );
}