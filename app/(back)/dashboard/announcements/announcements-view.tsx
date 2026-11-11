"use client";
import { ApplyForm } from "@/components/opportunities/apply-form";
import { API, APPS_KEY, OFFERS_KEY, flushQueue, getCached, send, sendForm } from "@/lib/opportunities/api";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ApplicationsTab } from "@/components/opportunities/applications-tab";
import { Pill } from "@/components/opportunities/common";
import { BriefcaseIcon, InboxIcon } from "@/components/opportunities/icons";
import { OfferForm } from "@/components/opportunities/offer-form";
import { OffersTab } from "@/components/opportunities/offers-tab";
import { IconCircle, PlusIcon, SendIcon } from "@/components/forum/icons";
import { useOffline } from "@/lib/opportunities/use-offline";
import { canApply, canManage } from "@/lib/opportunities/roles";
import type { Role } from "@/lib/types";
import { emptyForm, type AppStatus, type Application, type Offer, type Tab } from "@/lib/opportunities/types";

export function AnnouncementsView({ userId, role }: { userId: string; role: Role }) {
  const mayApply = canApply(role); // étudiant : « Où j'ai postulé »
  const mayManage = canManage(role); // entreprise (et admin) : « Demandes » + gestion des offres
  // Liste des candidatures propre au rôle ; la copie locale est séparée par compte.
  const appsUrl = mayManage ? `${API}/applications/received` : mayApply ? `${API}/applications/me` : null;
  const appsKey = `${APPS_KEY}:${userId}`;
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
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const applyingOffer = offers.find((o) => o._id === applyingId);
  const loadAll = useCallback(async () => {
    const [o, a]: [Offer[] | null, Application[] | null] = await Promise.all([
      getCached<Offer[]>(API, OFFERS_KEY),
      appsUrl ? getCached<Application[]>(appsUrl, appsKey) : Promise.resolve(null),
    ]);
    setOffers(o ?? []);
    setApps(a ?? []);
    setError(o === null && a === null ? "Backend injoignable" : "");
    setLoading(false);
  }, [appsUrl, appsKey]);

  // Au chargement et à chaque retour de la connexion : envoie les actions en attente, puis recharge
 /* useEffect(() => {
    if (!online) return;
    flushQueue().finally(loadAll);
  }, [online, loadAll]);*/
  // 1) Affichage immédiat depuis le cache local (marche hors ligne)
  useEffect(() => {
    try {
      const o = localStorage.getItem(OFFERS_KEY);
      const a = appsUrl ? localStorage.getItem(appsKey) : null;
      if (o) setOffers(JSON.parse(o) as Offer[]);
      if (a) setApps(JSON.parse(a) as Application[]);
    } catch {}
    setLoading(false);
  }, [appsUrl, appsKey]);

  // 2) Rafraîchissement : en ligne on envoie la file d'attente puis on recharge ;
  //    hors ligne, loadAll relit le cache
  useEffect(() => {
    if (online) flushQueue().finally(loadAll);
    else loadAll();
  }, [online, loadAll]);

  /** Exécute une action puis recharge les données. */
    async function run(action: () => Promise<unknown>) {
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
  const handleDelete = (id: string) =>
      run(async () => {
        await send(`${API}/applications/${id}`, "DELETE");
      });

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

 /* const apply = (id: string) => {
    const coverLetter = window.prompt("Message de motivation (optionnel)") ?? undefined;
    run(() => send(`${API}/${id}/apply`, "POST", { coverLetter }));
  };*/
  const apply = (id: string) => setApplyingId(id);

  const submitApply = (coverLetter: string, cv: File | null) =>
      run(async () => {
        if (!applyingId) return;
        if (cv) {
          const fd = new FormData();
          fd.append("coverLetter", coverLetter);
          fd.append("cv", cv);
          await sendForm(`${API}/${applyingId}/apply`, fd);
        } else {
          await send(`${API}/${applyingId}/apply`, "POST", { coverLetter });
        }
        setApplyingId(null);
      });

  const setAppStatus = (id: string, status: AppStatus) =>
      run(() => send(`${API}/applications/${id}/status`, "PATCH", { status }));

  const tabs: { id: Tab; label: string; icon: ReactNode; count: number }[] = [
    { id: "offers", label: "Offres d'emploi", icon: <BriefcaseIcon />, count: offers.length },
    ...(mayManage ? [{ id: "requests" as Tab, label: "Demandes", icon: <InboxIcon />, count: apps.length }] : []),
    ...(mayApply ? [{ id: "mine" as Tab, label: "Où j'ai postulé", icon: <SendIcon />, count: apps.length }] : []),
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
                {mayManage && showForm && <OfferForm form={form} onChange={setForm} editing={!!editingId} busy={busy} onSubmit={save} onCancel={closeForm} />}
                <OffersTab offers={offers} busy={busy} userId={userId} role={role} confirmId={confirmId} setConfirmId={setConfirmId} onEdit={startEdit} onDelete={remove} onApply={apply} />
              </>
          )}

          {!loading && mayManage && tab === "requests" && <ApplicationsTab apps={apps} manage busy={busy} onStatus={setAppStatus} onDelete={handleDelete} />}
          {!loading && mayApply && tab === "mine" && <ApplicationsTab apps={apps} manage={false} busy={busy} onStatus={setAppStatus} onDelete={handleDelete} />}
        </section>

        {mayManage && tab === "offers" && !showForm && (
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
        {mayApply && applyingOffer && (
            <ApplyForm
                title={applyingOffer.title}
                online={online}
                busy={busy}
                onSubmit={submitApply}
                onCancel={() => setApplyingId(null)}
            />
        )}
      </div>
  );
}