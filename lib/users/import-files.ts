// User management module (admin): the files of the import, read and written on the admin's device (offline too).
// The libraries are part of the users page's bundle, which the service worker keeps for offline use.
import { InvalidInputError, readSheet } from "read-excel-file/browser";
import writeXlsxFile, { type Cell, type SheetData } from "write-excel-file/browser";
import type { Group, Role } from "@/lib/types";
import { groupLabel } from "@/lib/users/directory";
import { IMPORT_FIELDS, parseCsv, type ImportField, type ImportUser } from "@/lib/users/import";

/** Largest file read (an import holds at most 1000 accounts: far less than this). */
export const IMPORT_MAX_FILE_MB = 5;

export type ImportFileError = "unreadable" | "xls" | "tooBig";

export class ImportFileProblem extends Error {
  constructor(readonly kind: ImportFileError) {
    super(kind);
  }
}

/** Text of a CSV file: UTF-8, else Windows-1252 (what Excel writes for "CSV (semicolon delimited)" in French). */
function decodeCsv(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}

/** The cells of the file's first sheet (.xlsx) or of the CSV file. Throws ImportFileProblem. */
export async function readImportFile(file: File): Promise<unknown[][]> {
  if (file.size > IMPORT_MAX_FILE_MB * 1024 * 1024) throw new ImportFileProblem("tooBig");
  const name = file.name.toLowerCase();
  if (name.endsWith(".xls")) throw new ImportFileProblem("xls");
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength));
  // .xlsx files are zip archives ("PK"); anything else is read as CSV text.
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (!isZip) {
    if (name.endsWith(".xlsx")) throw new ImportFileProblem("unreadable");
    return parseCsv(decodeCsv(buffer));
  }
  try {
    return await readSheet(buffer);
  } catch (error) {
    if (error instanceof InvalidInputError && error.code === "XLS_FILE_NOT_SUPPORTED") throw new ImportFileProblem("xls");
    throw new ImportFileProblem("unreadable");
  }
}

/** Saves `blob` as `name` (the browser's download). */
export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const COLUMN_WIDTHS: Record<ImportField, number> = { lastname: 22, firstname: 22, email: 34, role: 16, group: 18, password: 20 };
const title = (value: string): Cell => ({ value, fontWeight: "bold", backgroundColor: "#E8EEF9" });
const text = (value: string): Cell => ({ value, type: String });

export type TemplateLabels = {
  sheet: string;
  helpSheet: string;
  columns: Record<ImportField, string>;
  /** Lines of the help sheet: [title, explanation]. */
  help: [string, string][];
  groupsTitle: string;
  yearTitle: string;
};

/** The template: the column titles (sheet 1) and how to fill them with the groups of CampusLink (sheet 2). */
export function templateFile(labels: TemplateLabels, groups: Group[]): Promise<Blob> {
  const accounts: SheetData = [IMPORT_FIELDS.map((field) => title(labels.columns[field]))];
  const help: SheetData = [
    ...labels.help.map(([name, explanation]) => [title(name), text(explanation)]),
    [],
    [title(labels.groupsTitle), title(labels.yearTitle)],
    ...groups.map((group) => [text(groupLabel(group)), text(group.academicYear)]),
  ];
  return writeXlsxFile([
    { sheet: labels.sheet, data: accounts, columns: IMPORT_FIELDS.map((field) => ({ width: COLUMN_WIDTHS[field] })), stickyRowsCount: 1 },
    { sheet: labels.helpSheet, data: help, columns: [{ width: 24 }, { width: 90 }] },
  ]).toBlob();
}

export type CredentialsLabels = { sheet: string; columns: Record<ImportField, string>; role: (role: Role) => string };

/** The sign-in details of the imported accounts (their passwords are not shown anywhere else). */
export function credentialsFile(users: ImportUser[], groups: Group[], labels: CredentialsLabels): Promise<Blob> {
  const groupName = (id: string | null) => {
    const group = id ? groups.find((candidate) => candidate.id === id) : undefined;
    return group ? groupLabel(group) : "";
  };
  const values: Record<ImportField, (user: ImportUser) => string> = {
    lastname: (user) => user.lastname,
    firstname: (user) => user.firstname,
    email: (user) => user.email,
    role: (user) => labels.role(user.role),
    group: (user) => groupName(user.group),
    password: (user) => user.password,
  };
  const data: SheetData = [
    IMPORT_FIELDS.map((field) => title(labels.columns[field])),
    ...users.map((user) => IMPORT_FIELDS.map((field) => text(values[field](user)))),
  ];
  return writeXlsxFile(data, { sheet: labels.sheet, columns: IMPORT_FIELDS.map((field) => ({ width: COLUMN_WIDTHS[field] })), stickyRowsCount: 1 }).toBlob();
}
