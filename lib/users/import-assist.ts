// User management module (admin): the smart import. When a file doesn't follow the template, the AI (backend,
// POST /users/import/assist) tells how it is laid out; this file builds what is sent (the first lines, emails and
// passwords masked, and the distinct values of short columns) and applies the answer to the whole file, which is
// then checked line by line like any other (parseImport). Pure functions, shared by the import dialog and its tests.
import type { Role } from "@/lib/types";
import { cellText, foldKey, TITLE_LINES, type ImportField } from "@/lib/users/import";

/** Lines of the file sent to the AI: where parseImport looks for the titles (the server keeps 12, 15 cells each). */
export const ASSIST_LINES = TITLE_LINES;
const ASSIST_COLUMNS = 15;
/** Characters kept per cell (the server keeps as many; also keeps the masking quick on huge cells). */
const ASSIST_CELL_LENGTH = 80;
/** A column with at most this many different values has them all sent (roles, groups: not names or emails). */
const MAX_DISTINCT = 40;

export type AssistField = ImportField | "fullName";
export type NameOrder = "LAST_FIRST" | "FIRST_LAST";

/** The answer of POST /users/import/assist (checked by the server). */
export type AssistMapping = {
  /** 1-based line of the column titles, 0 when there is none. */
  headerRow: number;
  /** 0-based column of each field, or null. */
  columns: Record<AssistField, number | null>;
  nameOrder: NameOrder;
  roles: { text: string; role: Role | null }[];
  groups: { text: string; groupId: string | null }[];
  /** A sentence or two for the admin, in their language. */
  notes: string;
};

export type AssistRequest = { locale: string; lines: string[][]; values: { column: number; values: string[] }[] };

/** "ines.benali@esprit.tn" → "i…@esprit.tn": enough to see an email column, not whose it is. */
const maskEmail = (value: string) => value.replace(/[^\s@,;<>"']+@([^\s@,;<>"']+)/g, (match, domain: string) => `${match[0]}…@${domain}`);

/** A title that looks like a password's ("Mot de passe", "MDP", "Password", "Code d'accès"...). */
const isPasswordTitle = (value: string) => /^(motdepasse|mdp|password|passwd|pwd|pass|codedacces|codeacces|secret)/.test(foldKey(value));

/** Columns holding passwords → the line of their title (the only cell of the column that isn't masked). */
function passwordColumns(lines: string[][]): Map<number, number> {
  const columns = new Map<number, number>();
  lines.slice(0, ASSIST_LINES).forEach((cells, line) => {
    cells.forEach((cell, column) => {
      if (!columns.has(column) && isPasswordTitle(cell)) columns.set(column, line);
    });
  });
  return columns;
}

/**
 * What the AI gets: the first lines of the file (emails masked, password cells replaced by "•••") and, for each
 * column with few different values (roles, groups...), all of them. Names and emails of the other lines stay here.
 */
export function assistRequest(table: unknown[][], locale: string): AssistRequest {
  const all = table.map((cells) => cells.slice(0, ASSIST_COLUMNS).map((cell) => cellText(cell).slice(0, ASSIST_CELL_LENGTH)));
  const secret = passwordColumns(all);
  // By position, not by look: a password such as "Secret-123" or "Password1" looks like a title.
  const hide = (value: string, column: number, line: number) =>
    secret.has(column) && value && secret.get(column) !== line ? "•••" : maskEmail(value);

  const lines = all.slice(0, ASSIST_LINES).map((cells, line) => cells.map((value, column) => hide(value, column, line)));

  const filled = all.filter((cells) => cells.some((cell) => cell !== ""));
  const limit = Math.min(MAX_DISTINCT, Math.max(5, Math.floor(filled.length / 3)));
  const width = Math.max(0, ...all.map((cells) => cells.length));
  const values: AssistRequest["values"] = [];
  for (let column = 0; column < width; column += 1) {
    if (secret.has(column)) continue;
    const distinct = [...new Set(filled.map((cells) => cells[column] ?? "").filter(Boolean))];
    if (distinct.length === 0 || distinct.length > limit || distinct.some((value) => value.includes("@"))) continue;
    values.push({ column, values: distinct });
  }
  return { locale, lines, values };
}

/** Particles that belong to the family name: "Ben Ali", "El Amri", "De la Fontaine". */
const PARTICLES = new Set(["ben", "bent", "bin", "ibn", "bel", "bou", "abou", "abu", "ould", "el", "al", "de", "du", "des", "la", "le", "van", "von", "der", "da", "di"]);
const isParticle = (word: string) => PARTICLES.has(foldKey(word));
/** A word written in capitals ("BEN", "ALI", "N'DIAYE"): a family name in many lists. */
const isCapitals = (word: string) => /\p{Lu}/u.test(word) && word === word.toLocaleUpperCase("fr") && word.replace(/[^\p{L}]/gu, "").length > 1;

/**
 * Splits a full name. The words in capitals are the family name ("BEN ALI Ines", "Ines BEN ALI"); otherwise the
 * first (LAST_FIRST) or last (FIRST_LAST) word, with the particles before or after it ("Ben Ali Ines", "Ines Ben Ali").
 */
export function splitFullName(fullName: string, order: NameOrder): { lastname: string; firstname: string } {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return { lastname: words[0] ?? "", firstname: "" };

  const capitals = words.map(isCapitals);
  if (capitals.some(Boolean) && !capitals.every(Boolean)) {
    return { lastname: words.filter((_, index) => capitals[index]).join(" "), firstname: words.filter((_, index) => !capitals[index]).join(" ") };
  }
  if (order === "LAST_FIRST") {
    let end = 1;
    while (end < words.length - 1 && isParticle(words[end - 1])) end += 1;
    return { lastname: words.slice(0, end).join(" "), firstname: words.slice(end).join(" ") };
  }
  let start = words.length - 1;
  while (start > 1 && isParticle(words[start - 1])) start -= 1;
  return { lastname: words.slice(start).join(" "), firstname: words.slice(0, start).join(" ") };
}

/** Titles parseImport understands, in its column order. */
const TITLES: [ImportField, string][] = [
  ["lastname", "lastname"],
  ["firstname", "firstname"],
  ["email", "email"],
  ["role", "role"],
  ["group", "group"],
  ["password", "password"],
];

/**
 * The file rewritten as the template: the AI's title line replaced by ours (or ours added on top: lineOffset -1),
 * names split, roles and groups replaced by what they mean (a group by its id). parseImport then checks every line;
 * line numbers stay those of the file.
 */
export function applyAssist(table: unknown[][], mapping: AssistMapping): { table: string[][]; lineOffset: number } {
  const lines = table.map((cells) => cells.map(cellText));
  const { columns } = mapping;
  const get = (cells: string[], column: number | null) => (column === null ? "" : (cells[column] ?? "").trim());
  const roles = new Map(mapping.roles.map((entry) => [entry.text, entry.role]));
  const groups = new Map(mapping.groups.map((entry) => [entry.text, entry.groupId]));

  const rewrite = (cells: string[]): string[] => {
    if (cells.every((cell) => cell === "")) return [];
    let lastname = get(cells, columns.lastname);
    let firstname = get(cells, columns.firstname);
    if (columns.fullName !== null) {
      const split = splitFullName(get(cells, columns.fullName), mapping.nameOrder);
      lastname ||= split.lastname;
      firstname ||= split.firstname;
    }
    const role = get(cells, columns.role);
    const group = get(cells, columns.group);
    return [lastname, firstname, get(cells, columns.email), roles.get(role) ?? role, groups.get(group) ?? group, get(cells, columns.password)];
  };

  const titles = TITLES.map(([, title]) => title);
  if (mapping.headerRow > 0 && mapping.headerRow <= lines.length) {
    const titleIndex = mapping.headerRow - 1;
    return {
      table: lines.map((cells, index) => {
        if (index < titleIndex) return [];
        return index === titleIndex ? titles : rewrite(cells);
      }),
      lineOffset: 0,
    };
  }
  return { table: [titles, ...lines.map(rewrite)], lineOffset: -1 };
}

/** "A", "B", ... "AA": the column as a spreadsheet names it. */
export function columnLetter(index: number): string {
  let letter = "";
  for (let rest = index + 1; rest > 0; rest = Math.floor((rest - 1) / 26)) letter = String.fromCharCode(65 + ((rest - 1) % 26)) + letter;
  return letter;
}
