// User management module (admin): create / edit / delete through the offline outbox. Sent at once when online,
// kept on the device and replayed (page or Background Sync) when offline. Browser only.
import { listOutbox, outboxId, queueMutation, removeOutboxRecord, type MutationResult } from "@/lib/offline/outbox";
import type { User } from "@/lib/types";
import { LOCAL_ID_PREFIX, USERS_SCOPE, type UserChangeInfo, type UserInput, type UserRow } from "@/lib/users/directory";

const nameOf = (input: Pick<UserInput, "firstname" | "lastname">) => `${input.firstname} ${input.lastname}`.trim();

/** Only students have a group; empty password = keep the current one. */
function bodyOf(input: UserInput): UserInput {
  const body: UserInput = { firstname: input.firstname, lastname: input.lastname, email: input.email, role: input.role };
  if (input.role === "STUDENT") body.group = input.group || null;
  if (input.password) body.password = input.password;
  return body;
}

const createKey = (localId: string) => `POST /users#${localId}`;

function newLocalId(): string {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  return `${LOCAL_ID_PREFIX}${random}`;
}

/** The body of the waiting creation of an account made offline (to keep its password on a later edit). */
async function waitingCreateBody(localId: string): Promise<UserInput | undefined> {
  const id = outboxId({ method: "POST", path: "/users", key: createKey(localId) });
  return (await listOutbox(USERS_SCOPE)).find((record) => record.id === id)?.body as UserInput | undefined;
}

/**
 * "Save" of the user dialog: POST /users (new account, or one created offline that is still waiting) or
 * PATCH /users/:id with the whole form.
 */
export async function saveUser(input: UserInput, editing: UserRow | null): Promise<MutationResult<User>> {
  const name = nameOf(input);

  if (!editing || editing.local) {
    const localId = editing?.id ?? newLocalId();
    // An account created offline and edited before it synced: one creation with the latest values.
    const previous = editing ? await waitingCreateBody(editing.id) : undefined;
    const body = bodyOf({ ...input, password: input.password || previous?.password });
    const info: UserChangeInfo = { kind: "create", userId: localId, name };
    return queueMutation<User>({ method: "POST", path: "/users", body, key: createKey(localId), scope: USERS_SCOPE, info, keepRejected: true });
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

/** "Delete": DELETE /users/:id. An account created offline that never synced is simply dropped. */
export async function deleteUser(row: UserRow): Promise<MutationResult<unknown> | { status: "dropped" }> {
  if (row.local) {
    if (row.state.kind !== "synced") await removeOutboxRecord(row.state.recordId);
    return { status: "dropped" };
  }
  const path = `/users/${encodeURIComponent(row.id)}`;
  // A waiting edit of this account is pointless once it is deleted.
  const waitingEdit = outboxId({ method: "PATCH", path });
  if (waitingEdit) await removeOutboxRecord(waitingEdit);
  const info: UserChangeInfo = { kind: "delete", userId: row.id, name: `${row.firstname} ${row.lastname}` };
  return queueMutation({ method: "DELETE", path, scope: USERS_SCOPE, info, keepRejected: true });
}
