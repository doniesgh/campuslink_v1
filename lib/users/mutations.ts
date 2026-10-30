// User management module (admin): create / edit / delete / import through the offline outbox. Sent at once when
// online, kept on the device and replayed (page or Background Sync) when offline. Browser only.
import { BffError, bffFetch } from "@/lib/bff-client";
import {
  listOutbox,
  outboxId,
  queueMutation,
  removeOutboxRecord,
  updateOutboxRecord,
  type MutationResult,
} from "@/lib/offline/outbox";
import type { User } from "@/lib/types";
import { LOCAL_ID_PREFIX, USERS_SCOPE, type UserChangeInfo, type UserInput, type UserRow } from "@/lib/users/directory";
import type { ImportBatchInfo, ImportBody, ImportUser } from "@/lib/users/import";
import type { AssistMapping, AssistRequest } from "@/lib/users/import-assist";

const nameOf = (input: Pick<UserInput, "firstname" | "lastname">) => `${input.firstname} ${input.lastname}`.trim();

/** Only students have a group; empty password = keep the current one. */
function bodyOf(input: UserInput): UserInput {
  const body: UserInput = { firstname: input.firstname, lastname: input.lastname, email: input.email, role: input.role };
  if (input.role === "STUDENT") body.group = input.group || null;
  if (input.password) body.password = input.password;
  return body;
}

const createKey = (localId: string) => `POST /users#${localId}`;
export const IMPORT_PATH = "/users/import";
const importKey = (importId: string) => `POST ${IMPORT_PATH}#${importId}`;

function randomId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const newLocalId = () => `${LOCAL_ID_PREFIX}${randomId()}`;

/** The body of a waiting mutation of the users module, by outbox id. */
async function waitingBody<T>(id: string | null): Promise<T | undefined> {
  if (!id) return undefined;
  return (await listOutbox(USERS_SCOPE)).find((record) => record.id === id)?.body as T | undefined;
}

/** The account of a waiting import part shown as `row`. */
async function importedUser(row: UserRow): Promise<ImportUser | undefined> {
  if (row.state.kind === "synced" || row.importRow === undefined) return undefined;
  return (await waitingBody<ImportBody>(row.state.recordId))?.users?.find((user) => user.row === row.importRow);
}

/** Takes one account out of its waiting import part (the part goes when it was the last one). */
async function removeFromImport(row: UserRow): Promise<void> {
  if (row.state.kind === "synced" || row.importRow === undefined) return;
  await updateOutboxRecord(row.state.recordId, (record) => {
    const body = record.body as ImportBody;
    const users = (body?.users ?? []).filter((user) => user.row !== row.importRow);
    if (users.length === 0) return null;
    return { ...record, body: { ...body, users }, info: { ...record.info, count: users.length } };
  });
}

/**
 * "Save" of the user dialog: POST /users (new account, or one created offline that is still waiting) or
 * PATCH /users/:id with the whole form. An account of a waiting import leaves its part and is created alone.
 */
export async function saveUser(input: UserInput, editing: UserRow | null): Promise<MutationResult<User>> {
  const name = nameOf(input);

  if (!editing || editing.local) {
    const imported = editing?.importRow !== undefined;
    const localId = !editing || imported ? newLocalId() : editing.id;
    // An account created offline and edited before it synced: one creation with the latest values (and the
    // password it was given, when the form leaves it empty).
    let previous: { password?: string } | undefined;
    if (imported) previous = await importedUser(editing);
    else if (editing) previous = await waitingBody<UserInput>(outboxId({ method: "POST", path: "/users", key: createKey(localId) }));
    const body = bodyOf({ ...input, password: input.password || previous?.password });
    const info: UserChangeInfo = { kind: "create", userId: localId, name };
    const result = await queueMutation<User>({ method: "POST", path: "/users", body, key: createKey(localId), scope: USERS_SCOPE, info, keepRejected: true });
    if (imported && result.status !== "failed") await removeFromImport(editing);
    return result;
  }

  const info: UserChangeInfo = { kind: "update", userId: editing.id, name };
  return queueMutation<User>({
    method: "PATCH",
    path: `/users/${encodeURIComponent(editing.id)}`,
    body: bodyOf(input),
    scope: USERS_SCOPE,
    info,
    keepRejected: true,
  });
}

/** "Undo" of a waiting change: drops it (an account of an import only leaves its part). */
export async function undoChange(row: UserRow): Promise<void> {
  if (row.state.kind === "synced") return;
  if (row.importRow !== undefined) await removeFromImport(row);
  else await removeOutboxRecord(row.state.recordId);
}

/** "Delete": DELETE /users/:id. An account created offline that never synced is simply dropped. */
export async function deleteUser(row: UserRow): Promise<MutationResult<unknown> | { status: "dropped" }> {
  if (row.local) {
    await undoChange(row);
    return { status: "dropped" };
  }
  const path = `/users/${encodeURIComponent(row.id)}`;
  // A waiting edit of this account is pointless once it is deleted.
  const waitingEdit = outboxId({ method: "PATCH", path });
  if (waitingEdit) await removeOutboxRecord(waitingEdit);
  const info: UserChangeInfo = { kind: "delete", userId: row.id, name: `${row.firstname} ${row.lastname}` };
  return queueMutation({ method: "DELETE", path, scope: USERS_SCOPE, info, keepRejected: true });
}

export type ImportCheck =
  | { status: "ok" }
  | { status: "invalid"; details: unknown }
  | { status: "offline" }
  | { status: "failed"; error: BffError };

/** Dry run of POST /users/import: the server checks the accounts (emails already used, groups) without creating any. */
export async function checkImport(users: ImportUser[]): Promise<ImportCheck> {
  try {
    await bffFetch(IMPORT_PATH, { method: "POST", body: { dryRun: true, users } });
    return { status: "ok" };
  } catch (e) {
    const error = e instanceof BffError ? e : new BffError(0, "NETWORK_ERROR", "Can't reach the server.");
    if (error.isNetworkError) return { status: "offline" };
    if (error.code === "IMPORT_INVALID") return { status: "invalid", details: error.details };
    return { status: "failed", error };
  }
}

export type ImportResult = { importId: string; created: number; items: User[]; replayed?: boolean };

/**
 * One part of an import: POST /users/import, all or nothing. Kept on the device when offline; a part the server
 * refuses (now or when it syncs) stays listed with the module's refused changes, its accounts in the list.
 */
export function importBatch(users: ImportUser[], meta: ImportBatchInfo): Promise<MutationResult<ImportResult>> {
  const importId = randomId();
  const body: ImportBody = { importId, source: meta.source, users };
  const info: UserChangeInfo = { kind: "import", userId: `${LOCAL_ID_PREFIX}${importId}`, name: meta.source, part: meta.part, parts: meta.parts, count: users.length };
  return queueMutation<ImportResult>({
    method: "POST",
    path: IMPORT_PATH,
    body,
    key: importKey(importId),
    scope: USERS_SCOPE,
    info,
    keepRejected: true,
    keepRefused: true,
  });
}

// ---------------------------------------------------------------- smart import (AI, online only)

const ASSIST_PATH = `${IMPORT_PATH}/assist`;

/** Whether the server can analyse files with AI (OPENROUTER_API_KEY set), and with which model. */
export type AssistStatus = { enabled: boolean; model: string | null };

export function getAssistStatus(): Promise<AssistStatus> {
  return bffFetch<AssistStatus>(ASSIST_PATH);
}

/** Asks the AI how a file is laid out (see lib/users/import-assist.ts). Throws BffError (AI_* codes, NETWORK_ERROR). */
export function assistImport(request: AssistRequest): Promise<{ mapping: AssistMapping; model: string }> {
  return bffFetch(ASSIST_PATH, { method: "POST", body: request });
}
