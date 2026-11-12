export const API = "/bff/opportunities"; // relais Next.js : ajoute le jeton de session
export const OFFERS_KEY = "announcements-offers";
export const APPS_KEY = "announcements-apps";

/** Envoi avec fichier (multipart). Pas d'en-tête Content-Type : le navigateur le fixe. */
export async function sendForm(url: string, body: FormData): Promise<void> {
    const res = await fetch(url, { method: "POST", body });
    if (res.status === 413) throw new Error("CV trop lourd (5 Mo maximum).");
    if (res.status === 415) throw new Error("Format de CV refusé : envoyez un PDF ou un DOCX.");
    if (!res.ok) throw new Error(`Erreur ${res.status}`);
}
/** Lit l'API et garde une copie dans localStorage ; sans réseau, renvoie la dernière copie. */
export async function getCached<T>(url: string, key: string): Promise<T | null> {
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as T;
        localStorage.setItem(key, JSON.stringify(data));
        return data;
    } catch {
        const saved = localStorage.getItem(key);
        return saved ? (JSON.parse(saved) as T) : null;
    }
}

/** POST / PUT / PATCH / DELETE. Lance une erreur si hors ligne ou si le serveur refuse. */
const QUEUE_KEY = "opportunities-outbox";

type Queued = { id: string; url: string; method: string; body?: unknown };

export function readQueue(): Queued[] {
    try {
        return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as Queued[];
    } catch {
        return [];
    }
}

function writeQueue(queue: Queued[]) {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new Event("outbox-changed")); // prévient l'interface
}

function request(url: string, method: string, body?: unknown) {
    const init: RequestInit = { method, headers: { "Content-Type": "application/json" } };
    if (body !== undefined) init.body = JSON.stringify(body);
    return fetch(url, init);
}

/** Envoie la requête. Sans réseau, la met en file d'attente et renvoie "queued". */
export async function send(url: string, method: string, body?: unknown): Promise<"sent" | "queued"> {
    const queue = (): "queued" => {
        writeQueue([...readQueue(), { id: `${Date.now()}-${Math.random()}`, url, method, body }]);
        return "queued";
    };
    if (!navigator.onLine) return queue();

    let res: Response;
    try {
        res = await request(url, method, body);
    } catch {
        return queue(); // serveur injoignable
    }
    if (!res.ok) throw new Error(`Erreur ${res.status}`);
    return "sent";
}

let flushing = false;

/** Envoie les actions en attente, dans l'ordre. Renvoie le nombre d'actions envoyées. */
export async function flushQueue(): Promise<number> {
    if (flushing) return 0;
    flushing = true;
    let sent = 0;
    try {
        for (const item of readQueue()) {
            let res: Response;
            try {
                res = await request(item.url, item.method, item.body);
            } catch {
                break; // toujours hors ligne : on réessaiera plus tard
            }
            if (res.status >= 500) break; // serveur indisponible : on garde l'action
            writeQueue(readQueue().filter((q) => q.id !== item.id)); // envoyée, ou refusée définitivement (4xx)
            if (res.ok) sent += 1;
        }
    } finally {
        flushing = false;
    }
    return sent;
}
export type OfferSummary = { summary: string; keyPoints: string[] };

export async function fetchSummary(id: string): Promise<OfferSummary> {
    if (!navigator.onLine) throw new Error("Le résumé nécessite une connexion.");
    const res = await fetch(`${API}/${id}/summary`, { method: "POST" });
    const body = await res.json().catch(() => null);
    if (res.status === 503) throw new Error("Le résumé IA n'est pas disponible pour le moment.");
    if (res.status === 429) throw new Error("Trop de demandes, réessayez plus tard.");
    if (!res.ok) throw new Error(body?.message ?? `Erreur ${res.status}`);
    return body as OfferSummary;
}