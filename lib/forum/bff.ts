import { S } from "./strings";

export class BffError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : S.generic);

/** Appelle le BFF de l'app (/bff/*). La session passe par les cookies, pas de token à gérer ici. */
export async function bff<T = unknown>(path: string, init: Omit<RequestInit, "body"> & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(`/bff${path}`, {
    credentials: "same-origin",
    ...rest,
    headers: {
      Accept: "application/json",
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  // API errors are { error, code, details? }.
  if (!res.ok) throw new BffError(data.error ?? S.generic, res.status);
  return data as T;
}
