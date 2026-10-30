"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ApplicationsTab } from "@/components/announcements/applications-tab";
import { Pill } from "@/components/announcements/common";
import { BriefcaseIcon, InboxIcon } from "@/components/announcements/icons";
import { OfferForm } from "@/components/announcements/offer-form";
import { OffersTab } from "@/components/announcements/offers-tab";
import { IconCircle, PlusIcon, SendIcon } from "@/components/forum/icons";
import { API, APPS_KEY, OFFERS_KEY, flushQueue, getCached, send } from "@/lib/opportunities/api";
import { useOffline } from "@/lib/opportunities/use-offline";
import { emptyForm, type AppStatus, type Application, type Offer, type Tab } from "@/lib/opportunities/types";

export default function Announcements() {
  const [tab, setTab] = useState<Tab>("offers");
  const [offers, setOffers] = useState<Offer[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const { online, pending } = useOffline();

  const loadAll = useCallback(async () => {
    const [o, a]: [Offer[] | null, Application[] | null] = await Promise.all([
      getCached<Offer[]>(API, OFFERS_KEY),
      getCached<Application[]>(`${API}/applications/me`, APPS_KEY),
    ]);
    setOffers(o ?? []);
    setApps(a ?? []);
    setError(o === null && a === null ? "Backend injoignable" : "");
    setLoading(false);
  }, []);

  // Au chargement et à chaque retour de la connexion : envoie les actions en attente, puis recharge
 /* useEffect(() => {
    if (!online) return;
    flushQueue().finally(loadAll);
  }, [online, loadAll]);*/
  useEffect(() => {
    try {
      const o = localStorage.getItem(OFFERS_KEY);
      const a = localStorage.getItem(APPS_KEY);
      if (o) setOffers(JSON.parse(o) as Offer[]);
      if (a) setApps(JSON.parse(a) as Application[]);
    } catch {}
    setLoading(false);
  }, []);

  /** Exécute une action puis recharge les données. */
  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
      setError("");
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  // ----- formulaire
  const openForm = () => {
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const startEdit = (o: Offer) => {
    setEditingId(o._id);
    setForm({ title: o.title, type: o.type, domain: o.domain || "", location: o.location || "", description: o.description || "" });
    openForm();
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      await send(editingId ? `${API}/${editingId}` : API, editingId ? "PUT" : "POST", form);
      closeForm();
    });
  };

  // ----- actions
  const remove = (id: string) =>
      run(async () => {
        await send(`${API}/${id}`, "DELETE");
        setConfirmId(null);
      });

  const apply = (id: string) => {
    const coverLetter = window.prompt("Message de motivation (optionnel)") ?? undefined;
    run(() => send(`${API}/${id}/apply`, "POST", { coverLetter }));
  };

  const setAppStatus = (id: string, status: AppStatus) =>
      run(() => send(`${API}/applications/${id}/status`, "PATCH", { status }));

  const tabs: { id: Tab; label: string; icon: ReactNode; count: number }[] = [
    { id: "offers", label: "Offres d'emploi", icon: <BriefcaseIcon />, count: offers.length },
    { id: "requests", label: "Demandes", icon: <InboxIcon />, count: apps.length },
    { id: "mine", label: "Où j'ai postulé", icon: <SendIcon />, count: apps.length },
  ];

  return (
      <div className="container pb-28 pt-9 sm:pt-10">
        <header className="mx-auto flex max-w-xl flex-col items-center text-center">
          <IconCircle tone="brand" size="lg" className="size-14 ring-4 ring-primary/15 [&>svg]:size-7">
            <BriefcaseIcon />
          </IconCircle>
          <h1 className="mt-3 text-2xl font-semibold">Stages & opportunités</h1>
          <p className="mt-1 text-sm text-muted-foreground">Offres de stage, d'emploi, PFE et alternance, et suivi de vos candidatures.</p>
        </header>

        <section aria-label="Stages & opportunités" className="mx-auto mt-6 max-w-2xl space-y-5">
          <div role="tablist" aria-label="Sections" className="flex flex-wrap justify-center gap-2">
            {tabs.map((t) => (
                <Pill key={t.id} role="tab" on={tab === t.id} onClick={() => setTab(t.id)} icon={t.icon}>
                  {t.label} <span className="opacity-70">({t.count})</span>
                </Pill>
            ))}
          </div>

          {!online && (
              <p role="status" className="rounded-xl border border-input bg-muted px-4 py-2.5 text-sm text-muted-foreground">
                Vous êtes hors ligne : les dernières données enregistrées sont affichées. Vos actions seront envoyées au retour de la connexion.
              </p>
          )}
          {pending > 0 && (
              <p role="status" className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm text-primary">
                {pending} action(s) en attente de synchronisation.
              </p>
          )}

          {error && (
              <p role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
                {error}
                <button onClick={loadAll} className="font-medium underline">Réessayer</button>
              </p>
          )}

          {loading && (
              <div className="space-y-4" aria-busy="true">
                {[0, 1].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-muted" />)}
              </div>
          )}

          {!loading && tab === "offers" && (
              <>
                {showForm && <OfferForm form={form} onChange={setForm} editing={!!editingId} busy={busy} onSubmit={save} onCancel={closeForm} />}
                <OffersTab offers={offers} busy={busy} confirmId={confirmId} setConfirmId={setConfirmId} onEdit={startEdit} onDelete={remove} onApply={apply} />
              </>
          )}

          {!loading && tab === "requests" && <ApplicationsTab apps={apps} manage busy={busy} onStatus={setAppStatus} />}
          {!loading && tab === "mine" && <ApplicationsTab apps={apps} manage={false} busy={busy} onStatus={setAppStatus} />}
        </section>

        {tab === "offers" && !showForm && (
            <button
                onClick={openForm}
                aria-label="Nouvelle offre"
                className="group fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-6 z-30 flex h-14 min-w-14 items-center justify-center rounded-full bg-primary px-4 text-primary-foreground shadow-lg shadow-primary/30 transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
            >
              <PlusIcon className="size-6 shrink-0" />
              <span className="hidden max-w-0 overflow-hidden whitespace-nowrap text-sm font-medium opacity-0 motion-safe:transition-all sm:block group-hover:ml-2 group-hover:max-w-32 group-hover:opacity-100 group-focus-visible:ml-2 group-focus-visible:max-w-32 group-focus-visible:opacity-100">
            Nouvelle offre
          </span>
            </button>
        )}
      </div>
  );
}