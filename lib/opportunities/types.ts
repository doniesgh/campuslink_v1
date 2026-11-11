export type Offer = {
    _id: string;
    title: string;
    type: string;
    domain?: string;
    location?: string;
    description?: string;
    applicationsCount?: number;
    createdAt?: string;
};

export type AppStatus = "envoyee" | "en_cours" | "acceptee" | "refusee";

export type Application = {
    _id: string;
    opportunity: Offer | null; // null si l'offre a été supprimée
    status: AppStatus;
    createdAt: string;
    cvUrl?: string;
    coverLetter?: string;
};

export type Tab = "offers" | "requests" | "mine";

export const OFFER_TYPES = ["stage", "emploi", "pfe", "alternance", "projet"] as const;

export const TYPE_LABEL: Record<string, string> = {
    stage: "Stage",
    emploi: "Emploi",
    pfe: "PFE",
    alternance: "Alternance",
    projet: "Projet",
};

export const STATUS: Record<AppStatus, { label: string; cls: string }> = {
    envoyee: { label: "Envoyée", cls: "bg-primary/10 text-primary" },
    en_cours: { label: "En cours", cls: "bg-muted text-muted-foreground" },
    acceptee: { label: "Acceptée", cls: "bg-success/10 text-success" },
    refusee: { label: "Refusée", cls: "bg-destructive/10 text-destructive" },
};

export const emptyForm = { title: "", type: "stage", domain: "", location: "", description: "" };
export type OfferForm = typeof emptyForm;