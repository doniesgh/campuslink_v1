// User management module (admin): import of accounts from an Excel (.xlsx) or CSV file. The file is read and
// checked on the admin's device (works offline), then sent as POST /users/import batches through the outbox.
// Pure functions, shared by the import dialog and its tests; reading and writing .xlsx is in import-files.ts.
import { ROLES, type Group, type Role } from "@/lib/types";
import { groupLabel, serverProblems } from "@/lib/users/directory";
import { isValidEmail, MIN_PASSWORD_LENGTH } from "@/lib/validation";

/** Accounts per POST /users/import (the server hashes each password: ~0.5 s on a small server; it accepts 50). */
export const IMPORT_BATCH_SIZE = 25;
/** Rows per file (the server checks at most 1000 rows in a dry run). */
export const IMPORT_MAX_ROWS = 1000;
/** Same limit as the user model. */
const NAME_MAX_LENGTH = 100;

export const IMPORT_FIELDS = ["lastname", "firstname", "email", "role", "group", "password"] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];
export const REQUIRED_FIELDS: readonly ImportField[] = ["lastname", "firstname", "email"];

/** Problem codes: the server's (details.errors[].code of 422 IMPORT_INVALID) and the same ones found here. */
export type ImportProblemCode =
  | "REQUIRED"
  | "TOO_LONG"
  | "INVALID_EMAIL"
  | "DUPLICATE_EMAIL"
  | "EMAIL_TAKEN"
  | "INVALID_ROLE"
  | "UNKNOWN_GROUP"
  | "GROUP_NOT_ALLOWED"
  | "PASSWORD_TOO_SHORT"
  | "INVALID"
  | "INVALID_ROW";

export const IMPORT_PROBLEM_CODES: readonly ImportProblemCode[] = [
  "REQUIRED",
  "TOO_LONG",
  "INVALID_EMAIL",
  "DUPLICATE_EMAIL",
  "EMAIL_TAKEN",
  "INVALID_ROLE",
  "UNKNOWN_GROUP",
  "GROUP_NOT_ALLOWED",
  "PASSWORD_TOO_SHORT",
  "INVALID",
  "INVALID_ROW",
];

export const isProblemCode = (code: string): code is ImportProblemCode => (IMPORT_PROBLEM_CODES as readonly string[]).includes(code);

/** `code`: an ImportProblemCode, or a code of a newer server. */
export type ImportProblem = { field: ImportField | null; code: string };

/** A row without problems: it can be imported. */
export const isReady = (row: ImportRow) => row.problems.length === 0;

/** One account of POST /users/import (`row`: its line in the file, used by the server's problems). */
export type ImportUser = {
  row: number;
  firstname: string;
  lastname: string;
  email: string;
  role: Role;
  group: string | null;
  password: string;
};

export type ImportRow = {
  user: ImportUser;
  /** The role and group as written in the file (shown when they could not be understood). */
  roleText: string;
  groupText: string;
  /** No password in the file: one was generated. */
  generated: boolean;
  problems: ImportProblem[];
};

export type ImportParseError =
  | { kind: "empty" }
  | { kind: "missingColumns"; missing: ImportField[] }
  | { kind: "tooMany"; max: number; count: number };

export type ImportParseResult = { ok: true; rows: ImportRow[]; columns: ImportField[] } | { ok: false; error: ImportParseError };

/** `info` of an import batch in the outbox (see UserChangeInfo). */
export type ImportBatchInfo = { source: string; part: number; parts: number; count: number };

/** Body of POST /users/import. */
export type ImportBody = { importId: string; source: string; users: ImportUser[] };

/** "Prénom", "E-mail", "Mot de passe" → "prenom", "email", "motdepasse": accents, case and punctuation ignored. */
export const foldKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/** Column titles understood, in French and English (the template uses the first French or English one). */
const HEADER_ALIASES: Record<ImportField, string[]> = {
  lastname: ["nom", "nomdefamille", "lastname", "surname", "familyname"],
  firstname: ["prenom", "prenoms", "firstname", "givenname"],
  email: ["email", "mail", "courriel", "adresseemail", "adressemail", "adressecourriel", "emailaddress"],
  role: ["role", "profil", "profile", "type", "statut"],
  group: ["groupe", "group", "classe", "class"],
  password: ["motdepasse", "password", "mdp"],
};

/** Role names understood, besides the labels of the app (`roleLabels`). */
const ROLE_ALIASES: Record<Role, string[]> = {
  STUDENT: ["student", "etudiant", "etudiante", "eleve"],
  TEACHER: ["teacher", "enseignant", "enseignante", "professeur", "prof", "formateur", "formatrice"],
  ADMIN: ["admin", "administrateur", "administratrice", "administrator"],
  ALUMNI: ["alumni", "alumnus", "ancien", "ancienne", "ancienetudiant", "ancienneetudiante", "diplome", "diplomee"],
};

function headerField(title: string): ImportField | null {
  const key = foldKey(title);
  if (!key) return null;
  return IMPORT_FIELDS.find((field) => HEADER_ALIASES[field].includes(key)) ?? null;
}

/** Cell of a spreadsheet as text: dates as YYYY-MM-DD, numbers and booleans as written. */
export function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  return typeof value === "object" ? "" : String(value).trim();
}

/**
 * Reads a CSV file: "," ";" or tab separated (the most frequent one in the first line, outside quotes),
 * quoted cells with "" for a quote, CRLF or LF line ends, an optional BOM.
 */
export function parseCsv(text: string): string[][] {
  const source = text.replace(/^﻿/, "");
  const firstLine = source.split(/\r?\n/, 1)[0].replace(/"[^"]*"/g, "");
  const delimiter = [",", "\t"].reduce(
    (best, candidate) => (firstLine.split(candidate).length > firstLine.split(best).length ? candidate : best),
    ";"
  );

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell === "") quoted = true;
    else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/**
 * A random password easy to read out and type: 3 groups of 4 characters without look-alikes (0/O, 1/l/I),
 * e.g. "Xk7m-Pq4r-Ht9w" (about 70 bits). Unbiased: bytes past the last full alphabet cycle are drawn again.
 */
export function generatePassword(random: (bytes: Uint8Array) => Uint8Array = (bytes) => crypto.getRandomValues(bytes)): string {
  const limit = 256 - (256 % PASSWORD_ALPHABET.length);
  const chars: string[] = [];
  while (chars.length < 12) {
    for (const byte of random(new Uint8Array(16))) {
      if (byte < limit && chars.length < 12) chars.push(PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length]);
    }
  }
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8)].map((group) => group.join("")).join("-");
}

/**
 * Group of a cell: its label ("4DS1 · DS"), or its name ("4DS1"). A name used in several academic years is the
 * most recent year's group; two groups of the same year and name can only be told apart by their label.
 */
function groupResolver(groups: Group[]): (text: string) => string | null {
  const byKey = new Map<string, Group[]>();
  const add = (key: string, group: Group) => {
    if (!key) return;
    const list = byKey.get(key) ?? [];
    if (!list.includes(group)) list.push(group);
    byKey.set(key, list);
  };
  for (const group of groups) {
    add(foldKey(groupLabel(group)), group);
    add(foldKey(group.name), group);
  }
  return (text) => {
    const candidates = byKey.get(foldKey(text)) ?? [];
    if (candidates.length === 0) return null;
    const latest = candidates.reduce((best, group) => (group.academicYear > best.academicYear ? group : best), candidates[0]);
    const tied = candidates.filter((group) => group.academicYear === latest.academicYear);
    return tied.length === 1 ? latest.id : null;
  };
}

function roleResolver(roleLabels: Partial<Record<Role, string>>): (text: string) => Role | null {
  const byKey = new Map<string, Role>();
  for (const role of ROLES) {
    for (const alias of [role, ...ROLE_ALIASES[role], roleLabels[role] ?? ""]) if (foldKey(alias)) byKey.set(foldKey(alias), role);
  }
  return (text) => byKey.get(foldKey(text)) ?? null;
}

export type ImportContext = {
  groups: Group[];
  /** Emails of the accounts already in the directory (or waiting to be created), lower case. */
  existingEmails: ReadonlySet<string>;
  /** The app's role labels ("Étudiant", ...), also understood in the role column. */
  roleLabels?: Partial<Record<Role, string>>;
  password?: () => string;
};

/**
 * Reads the rows of a sheet: finds the title line (in the first 10 lines), then checks each account like the server
 * does. Empty lines are skipped; `row` is the line number in the file (1 = first line).
 */
export function parseImport(table: unknown[][], context: ImportContext): ImportParseResult {
  const lines = table.map((cells) => cells.map(cellText));
  if (lines.every((cells) => cells.every((cell) => cell === ""))) return { ok: false, error: { kind: "empty" } };
  // The title line: the one of the first 10 with the most titles understood (the first one on a tie).
  const scores = lines.slice(0, 10).map((cells) => new Set(cells.map(headerField).filter(Boolean)).size);
  const best = Math.max(0, ...scores);
  const headerIndex = best > 0 ? scores.indexOf(best) : -1;

  const header = headerIndex >= 0 ? lines[headerIndex] : [];
  const columns = new Map<ImportField, number>();
  header.forEach((title, index) => {
    const field = headerField(title);
    if (field && !columns.has(field)) columns.set(field, index);
  });
  const missing = REQUIRED_FIELDS.filter((field) => !columns.has(field));
  if (missing.length > 0) return { ok: false, error: { kind: "missingColumns", missing } };

  const body = lines
    .map((cells, index) => ({ cells, line: index + 1 }))
    .slice(headerIndex + 1)
    .filter(({ cells }) => cells.some((cell) => cell !== ""));
  if (body.length === 0) return { ok: false, error: { kind: "empty" } };
  if (body.length > IMPORT_MAX_ROWS) return { ok: false, error: { kind: "tooMany", max: IMPORT_MAX_ROWS, count: body.length } };

  const resolveGroup = groupResolver(context.groups);
  const resolveRole = roleResolver(context.roleLabels ?? {});
  const password = context.password ?? (() => generatePassword());
  const value = (cells: string[], field: ImportField) => {
    const index = columns.get(field);
    return index === undefined ? "" : (cells[index] ?? "").trim();
  };

  const seen = new Set<string>();
  const rows = body.map(({ cells, line }): ImportRow => {
    const problems: ImportProblem[] = [];
    const fail = (field: ImportField, code: ImportProblemCode) => problems.push({ field, code });

    const firstname = value(cells, "firstname");
    const lastname = value(cells, "lastname");
    for (const [field, text] of [["lastname", lastname], ["firstname", firstname]] as const) {
      if (!text) fail(field, "REQUIRED");
      else if (text.length > NAME_MAX_LENGTH) fail(field, "TOO_LONG");
    }

    const email = value(cells, "email").toLowerCase();
    if (!email) fail("email", "REQUIRED");
    else if (!isValidEmail(email)) fail("email", "INVALID_EMAIL");
    else if (seen.has(email)) fail("email", "DUPLICATE_EMAIL");
    else if (context.existingEmails.has(email)) fail("email", "EMAIL_TAKEN");
    if (email) seen.add(email);

    const roleText = value(cells, "role");
    const role = roleText ? resolveRole(roleText) : "STUDENT";
    if (!role) fail("role", "INVALID_ROLE");

    const groupText = value(cells, "group");
    let group: string | null = null;
    if (groupText) {
      group = resolveGroup(groupText);
      if (role && role !== "STUDENT") fail("group", "GROUP_NOT_ALLOWED");
      else if (!group) fail("group", "UNKNOWN_GROUP");
    }

    const given = columns.has("password") ? (cells[columns.get("password")!] ?? "") : "";
    if (given && given.length < MIN_PASSWORD_LENGTH) fail("password", "PASSWORD_TOO_SHORT");

    return {
      user: { row: line, firstname, lastname, email, role: role ?? "STUDENT", group: role === "STUDENT" ? group : null, password: given || password() },
      roleText,
      groupText,
      generated: !given,
      problems,
    };
  });

  return { ok: true, rows, columns: IMPORT_FIELDS.filter((field) => columns.has(field)) };
}

/** Adds the problems the server found (422 IMPORT_INVALID `details`) to the rows. */
export function withServerProblems(rows: ImportRow[], details: unknown): ImportRow[] {
  const byRow = serverProblems(details);
  if (byRow.size === 0) return rows;
  return rows.map((row) => {
    const extra = (byRow.get(row.user.row) ?? []).filter(
      (problem) => !row.problems.some((known) => known.field === problem.field && known.code === problem.code)
    );
    return extra.length > 0 ? { ...row, problems: [...row.problems, ...extra] } : row;
  });
}

/** The rows in batches of `size` (one POST /users/import each). */
export function toBatches<T>(items: T[], size = IMPORT_BATCH_SIZE): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) batches.push(items.slice(index, index + size));
  return batches;
}
