// User management module (admin): the user directory saved on the admin's device and the changes waiting in
// the outbox. Pure functions, shared by the users page and its tests.
import type { OutboxRecord, OutboxRejection } from "@/lib/offline/db";
import type { Group, Role, User, UserGroup } from "@/lib/types";

/** Outbox scope of the module's mutations. */
export const USERS_SCOPE = "users";
/** Saved directory: useOfflineQuery key and API path (GET /api/users/directory, admin). */
export const DIRECTORY_KEY = ["users", "directory"] as const;
export const DIRECTORY_PATH = "/users/directory";
export const GROUPS_KEY = ["academic", "groups"] as const;
export const GROUPS_PATH = "/academic/groups";
/** Periodic Background Sync tag (public/sw.js refreshes the saved directory). */
export const DIRECTORY_SYNC_TAG = "campuslink-users-directory";
export const DIRECTORY_SYNC_INTERVAL_MS = 12 * 60 * 60 * 1000;
/** Id of an account created offline, until the server gives it a real one. */
export const LOCAL_ID_PREFIX = "local-";

export type Directory = { items: User[]; total: number; truncated: boolean };

/** Body of POST /users and PATCH /users/:id: the whole form, so a later edit replaces a waiting one. */
export type UserInput = {
  firstname: string;
  lastname: string;
  email: string;
  role: Role;
  /** Students only: a group id or null. */
  group?: string | null;
  password?: string;
};

export type ChangeKind = "create" | "update" | "delete";

/** `info` of a users mutation in the outbox. */
export type UserChangeInfo = { kind: ChangeKind; userId: string; name: string };

export type RowState =
  | { kind: "synced" }
  | { kind: "pending"; change: ChangeKind; recordId: string }
  | { kind: "rejected"; change: ChangeKind; recordId: string; rejection: OutboxRejection };

/** A user as the page shows it: server data with the waiting change applied on top. */
export type UserRow = User & { state: RowState; local: boolean };

/** A users mutation of the outbox, with what it is about. */
export type UserChange = { record: OutboxRecord; info: UserChangeInfo };

export const isLocalId = (id: string) => id.startsWith(LOCAL_ID_PREFIX);

export function userChanges(records: OutboxRecord[]): UserChange[] {
  return records.flatMap((record) => {
    const info = record.info as Partial<UserChangeInfo> | undefined;
    if (!info || !info.kind || typeof info.userId !== "string") return [];
    return [{ record, info: { kind: info.kind, userId: info.userId, name: String(info.name ?? "") } }];
  });
}

function groupRef(id: string | null | undefined, groups: Group[], current?: UserGroup | null): UserGroup | null {
  if (!id) return null;
  if (current?.id === id) return current;
  const group = groups.find((candidate) => candidate.id === id);
  if (!group) return current?.id === id ? current : null;
  return { id: group.id, name: group.name, level: group.level, academicYear: group.academicYear, program: group.program };
}

const collator = new Intl.Collator("fr", { sensitivity: "base", numeric: true });

export function sortRows(rows: UserRow[]): UserRow[] {
  return [...rows].sort(
    (a, b) => collator.compare(a.lastname, b.lastname) || collator.compare(a.firstname, b.firstname) || a.id.localeCompare(b.id)
  );
}

/**
 * The directory as the admin should see it: each waiting change applied on top of the saved server data
 * (oldest first), and the changes whose user is gone from the directory (`orphans`, e.g. deleted elsewhere).
 */
export function applyChanges(users: User[], records: OutboxRecord[], groups: Group[]): { rows: UserRow[]; orphans: UserChange[] } {
  const rows = new Map<string, UserRow>(users.map((user) => [user.id, { ...user, state: { kind: "synced" }, local: false }]));
  const orphans: UserChange[] = [];

  for (const change of userChanges(records)) {
    const { record, info } = change;
    const body = record.body as UserInput | undefined;
    const state: RowState = record.rejected
      ? { kind: "rejected", change: info.kind, recordId: record.id, rejection: record.rejected }
      : { kind: "pending", change: info.kind, recordId: record.id };

    if (info.kind === "create") {
      if (!body) continue;
      const at = new Date(record.createdAt).toISOString();
      rows.set(info.userId, {
        id: info.userId,
        firstname: body.firstname,
        lastname: body.lastname,
        email: body.email,
        role: body.role,
        twoFactorEnabled: false,
        group: body.role === "STUDENT" ? groupRef(body.group, groups) : null,
        createdAt: at,
        updatedAt: at,
        state,
        local: true,
      });
      continue;
    }

    const row = rows.get(info.userId);
    if (!row) {
      orphans.push(change);
      continue;
    }
    if (info.kind === "update" && body && !record.rejected) {
      rows.set(info.userId, {
        ...row,
        firstname: body.firstname,
        lastname: body.lastname,
        email: body.email,
        role: body.role,
        group: body.role === "STUDENT" ? groupRef(body.group, groups, row.group) : null,
        state,
      });
    } else {
      // A refused edit keeps the server values; a delete keeps the row (struck through, with "Undo").
      rows.set(info.userId, { ...row, state });
    }
  }

  return { rows: sortRows([...rows.values()]), orphans };
}

/** "école" → "ecole": accent- and case-insensitive search. */
const fold = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function filterRows(rows: UserRow[], { q, role }: { q: string; role: Role | "" }): UserRow[] {
  const words = fold(q.trim()).split(/\s+/).filter(Boolean);
  return rows.filter((row) => {
    if (role && row.role !== role) return false;
    if (words.length === 0) return true;
    const haystack = fold(`${row.firstname} ${row.lastname} ${row.email} ${row.group?.name ?? ""}`);
    return words.every((word) => haystack.includes(word));
  });
}

export function countByRole(rows: UserRow[]): Record<Role, number> {
  const counts: Record<Role, number> = { STUDENT: 0, TEACHER: 0, ADMIN: 0, ALUMNI: 0 };
  for (const row of rows) if (!(row.state.kind === "pending" && row.state.change === "delete")) counts[row.role] += 1;
  return counts;
}

export function groupLabel(group: { name: string; program?: { code: string } | null }): string {
  return [group.name, group.program?.code].filter(Boolean).join(" · ");
}

/** One CSV cell: quoted when needed, and never read as a formula by spreadsheets (CSV injection). */
function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",;\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export type CsvLabels = {
  headers: { lastname: string; firstname: string; email: string; role: string; group: string; createdAt: string };
  role: (role: Role) => string;
};

/** The rows as CSV (UTF-8 with BOM so spreadsheet apps read accents; CRLF line ends). */
export function toCsv(rows: UserRow[], labels: CsvLabels): string {
  const { headers } = labels;
  const lines = [
    [headers.lastname, headers.firstname, headers.email, headers.role, headers.group, headers.createdAt],
    ...rows.map((row) => [
      row.lastname,
      row.firstname,
      row.email,
      labels.role(row.role),
      row.group ? groupLabel(row.group) : "",
      row.createdAt.slice(0, 10),
    ]),
  ].map((cells) => cells.map((cell) => csvCell(String(cell ?? ""))).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}
