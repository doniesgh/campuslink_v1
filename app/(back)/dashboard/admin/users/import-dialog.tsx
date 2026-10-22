"use client";

import { useCallback, useRef, useState } from "react";
import { CheckCircle2, CircleAlert, CloudOff, Download, FileSpreadsheet, KeyRound, Loader2, RotateCcw, ShieldCheck, Smartphone, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InlineFeedback } from "@/components/ui/feedback";
import { todayKey } from "@/lib/datetime";
import { useErrorFormatter } from "@/lib/i18n/client";
import { useOnlineStatus } from "@/lib/offline";
import type { Group, Role, User } from "@/lib/types";
import { groupLabel } from "@/lib/users/directory";
import {
  IMPORT_FIELDS,
  IMPORT_MAX_ROWS,
  isProblemCode,
  isReady,
  parseImport,
  REQUIRED_FIELDS,
  toBatches,
  withServerProblems,
  type ImportField,
  type ImportParseError,
  type ImportProblem,
  type ImportRow,
  type ImportUser,
} from "@/lib/users/import";
import { credentialsFile, downloadBlob, IMPORT_MAX_FILE_MB, ImportFileProblem, readImportFile, templateFile, XLSX_TYPE } from "@/lib/users/import-files";
import { checkImport, importBatch } from "@/lib/users/mutations";
import { cn } from "@/lib/utils";
import { MIN_PASSWORD_LENGTH } from "@/lib/validation";

/** Lines listed in the preview (the others are counted). */
const SHOWN_ROWS = 200;
const ACCEPT = `.xlsx,.csv,${XLSX_TYPE},text/csv`;

type Check = "checking" | "server" | "device";
type Review = { source: string; rows: ImportRow[]; check: Check };
type Outcome = { sent: number; queued: number; refused: number; failed: number; reason: string | null };
type Step =
  | { kind: "pick"; reading: boolean; error: { message: string; at: number } | null }
  | ({ kind: "review" } & Review)
  | ({ kind: "importing"; done: number; total: number } & Review)
  | ({ kind: "done"; imported: ImportUser[]; generated: number; outcome: Outcome } & Review);

export type ImportSummary = Omit<Outcome, "reason"> & { source: string; items: User[] };

/** Localised text of an import problem ("Email: an account already uses it"), for the dialog and the users list. */
export function useImportProblemText(): (problem: ImportProblem) => string {
  const t = useTranslations("admin.users.import");
  return useCallback(
    (problem: ImportProblem) => {
      const field = problem.field && IMPORT_FIELDS.includes(problem.field) ? t(`columns.${problem.field}`) : "";
      const code = isProblemCode(problem.code) ? problem.code : "INVALID";
      return t(`problems.${code}`, { field, min: MIN_PASSWORD_LENGTH });
    },
    [t]
  );
}

function ImportRowItem({ row, groups, problemText }: Readonly<{ row: ImportRow; groups: Group[]; problemText: (problem: ImportProblem) => string }>) {
  const t = useTranslations("admin.users.import");
  const tRoles = useTranslations("common.roles");
  const { user } = row;
  const ready = isReady(row);
  const group = user.group ? groups.find((candidate) => candidate.id === user.group) : undefined;
  const role = row.problems.some((problem) => problem.code === "INVALID_ROLE") ? row.roleText : tRoles(user.role);
  const name = `${user.firstname} ${user.lastname}`.trim();
  return (
    <li data-import-row={user.row} data-ready={ready} className="space-y-1 px-3 py-2.5 text-sm sm:px-4">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate font-medium">
          <span className="font-normal text-muted-foreground">{t("line", { line: user.row })} · </span>
          {name || "—"}
        </p>
        <Badge variant={ready ? "success" : "danger"} className="shrink-0">
          {ready ? t("ready") : t("toFix")}
        </Badge>
      </div>
      <p className="truncate text-muted-foreground">{[user.email || "—", role, group ? groupLabel(group) : row.groupText].filter(Boolean).join(" · ")}</p>
      {row.problems.map((problem) => (
        <p key={`${problem.field}-${problem.code}`} className="text-destructive">
          {problemText(problem)}
        </p>
      ))}
    </li>
  );
}

/**
 * "Import" dialog: an Excel or CSV file read and checked on this device (offline too), checked again by the server
 * when online (dry run), then sent in parts through the outbox. Ends with the sign-in details to download.
 */
export function ImportDialog({
  open,
  onOpenChange,
  groups,
  existingEmails,
  onImported,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: Group[];
  /** Emails already used in the directory (lower case). */
  existingEmails: ReadonlySet<string>;
  onImported: (summary: ImportSummary) => void;
}>) {
  const t = useTranslations("admin.users.import");
  const tRoles = useTranslations("common.roles");
  const errors = useErrorFormatter();
  const online = useOnlineStatus();
  const problemText = useImportProblemText();
  const [step, setStep] = useState<Step>({ kind: "pick", reading: false, error: null });
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [skip, setSkip] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [closeWarning, setCloseWarning] = useState(false);
  // The file being read: a later choice wins over a slower earlier one.
  const readToken = useRef(0);

  const columns = Object.fromEntries(IMPORT_FIELDS.map((field) => [field, t(`columns.${field}`)])) as Record<ImportField, string>;
  const roleLabels = Object.fromEntries((["STUDENT", "TEACHER", "ADMIN", "ALUMNI"] as Role[]).map((role) => [role, tRoles(role)]));

  const parseErrorText = (error: ImportParseError) => {
    if (error.kind === "missingColumns") return t("errors.missingColumns", { columns: error.missing.map((field) => columns[field]).join(", ") });
    if (error.kind === "tooMany") return t("errors.tooMany", { count: error.count, max: error.max });
    return t("errors.empty");
  };
  const pickError = (message: string): Step => ({ kind: "pick", reading: false, error: { message, at: Date.now() } });

  const readFile = async (file: File) => {
    const token = ++readToken.current;
    setStep({ kind: "pick", reading: true, error: null });
    let table: unknown[][];
    try {
      table = await readImportFile(file);
    } catch (error) {
      const kind = error instanceof ImportFileProblem ? error.kind : "unreadable";
      if (token === readToken.current) setStep(pickError(t(`errors.${kind}`, { max: IMPORT_MAX_FILE_MB })));
      return;
    }
    if (token !== readToken.current) return;

    const result = parseImport(table, { groups, existingEmails, roleLabels });
    if (!result.ok) {
      setStep(pickError(parseErrorText(result.error)));
      return;
    }
    setOnlyProblems(false);
    setSkip(false);
    const ready = result.rows.filter(isReady);
    const check: Check = online && ready.length > 0 ? "checking" : "device";
    setStep({ kind: "review", source: file.name, rows: result.rows, check });
    if (check !== "checking") return;

    // The server knows the accounts and groups this device may not have yet.
    const outcome = await checkImport(ready.map((row) => row.user));
    if (token !== readToken.current) return;
    setStep((current) =>
      current.kind === "review"
        ? {
            ...current,
            rows: outcome.status === "invalid" ? withServerProblems(current.rows, outcome.details) : current.rows,
            check: outcome.status === "ok" || outcome.status === "invalid" ? "server" : "device",
          }
        : current
    );
  };

  const runImport = async (review: Review) => {
    const ready = review.rows.filter(isReady);
    const batches = toBatches(ready.map((row) => row.user));
    const outcome: Outcome = { sent: 0, queued: 0, refused: 0, failed: 0, reason: null };
    const items: User[] = [];
    const imported: ImportUser[] = [];
    let done = 0;
    setStep({ ...review, kind: "importing", done, total: ready.length });

    for (const [index, users] of batches.entries()) {
      // One part after the other: the server hashes the password of every account of a part.
      const result = await importBatch(users, { source: review.source, part: index + 1, parts: batches.length, count: users.length });
      if (result.status === "sent") {
        outcome.sent += result.data.created;
        items.push(...result.data.items);
      } else if (result.status === "queued") outcome.queued += users.length;
      else if (result.id) outcome.refused += users.length;
      else {
        outcome.failed += users.length;
        outcome.reason ??= errors.message(result.error);
      }
      if (result.status !== "failed" || result.id) imported.push(...users);
      done += users.length;
      setStep((current) => (current.kind === "importing" ? { ...current, done } : current));
    }

    const generated = new Set(ready.filter((row) => row.generated).map((row) => row.user.row));
    setDownloaded(false);
    setStep({ ...review, kind: "done", imported, generated: imported.filter((user) => generated.has(user.row)).length, outcome });
    onImported({ source: review.source, sent: outcome.sent, queued: outcome.queued, refused: outcome.refused, failed: outcome.failed, items });
  };

  const downloadTemplate = async () => {
    const help: [string, string][] = [
      [t("help.names"), t("help.namesHint")],
      [t("help.role"), t("help.roleHint")],
      [t("help.group"), t("help.groupHint")],
      [t("help.password"), t("help.passwordHint")],
    ];
    const blob = await templateFile({ sheet: t("sheet"), helpSheet: t("helpSheet"), columns, help, groupsTitle: t("groupsTitle"), yearTitle: t("yearTitle") }, groups);
    downloadBlob(blob, "campuslink-import.xlsx");
  };

  const downloadCredentials = async (users: ImportUser[]) => {
    const blob = await credentialsFile(users, groups, { sheet: t("sheet"), columns, role: (role) => tRoles(role) });
    downloadBlob(blob, `campuslink-accounts-${todayKey()}.xlsx`);
    setDownloaded(true);
    setCloseWarning(false);
  };

  // Never closed mid-import; once done, not before the generated passwords were downloaded (or on a second request).
  const requestClose = (next: boolean) => {
    if (next || step.kind === "importing") return;
    if (step.kind === "done" && step.generated > 0 && !downloaded && !closeWarning) {
      setCloseWarning(true);
      return;
    }
    onOpenChange(false);
  };

  const dropFile = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file && step.kind === "pick" && !step.reading) void readFile(file);
  };

  return (
    <Dialog open={open} onOpenChange={requestClose}>
      <DialogContent className="max-w-2xl" hideClose={step.kind === "importing"}>
        <DialogHeader>
          <DialogTitle>{step.kind === "done" ? t("doneTitle") : t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {/* Each step is min-w-0: the dialog is a grid, and long emails must be cut, not widen it on phones. */}
        {step.kind === "pick" && (
          <div className="min-w-0 space-y-4">
            {!online && (
              <p className="flex items-start gap-2 rounded-2xl border border-highlight/40 bg-highlight/10 px-3 py-2.5 text-sm font-medium">
                <CloudOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {t("offline")}
              </p>
            )}
            <label
              htmlFor="users-import-file"
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={dropFile}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-2 rounded-3xl border-2 border-dashed px-4 py-8 text-center transition-colors",
                "hover:bg-accent/60 focus-within:ring-2 focus-within:ring-ring",
                dragging && "border-primary bg-accent/60",
                step.reading && "cursor-wait"
              )}
            >
              {step.reading ? (
                <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
              ) : (
                <FileSpreadsheet className="h-8 w-8 text-primary" aria-hidden="true" />
              )}
              <span className="font-medium">{step.reading ? t("reading") : t("choose")}</span>
              <span className="text-sm text-muted-foreground">{t("formats", { max: IMPORT_MAX_ROWS })}</span>
              <input
                id="users-import-file"
                type="file"
                accept={ACCEPT}
                className="sr-only"
                disabled={step.reading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void readFile(file);
                }}
              />
            </label>
            <InlineFeedback feedback={step.error ? { type: "error", message: step.error.message, at: step.error.at } : null} />
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>{t("required", { columns: REQUIRED_FIELDS.map((field) => columns[field]).join(", ") })}</p>
              <p>{t("optional", { columns: IMPORT_FIELDS.filter((field) => !REQUIRED_FIELDS.includes(field)).map((field) => columns[field]).join(", ") })}</p>
              <p>{t("rules", { min: MIN_PASSWORD_LENGTH })}</p>
            </div>
            <Button type="button" variant="outline" className="w-full rounded-full sm:w-auto" onClick={() => void downloadTemplate()}>
              <Download className="h-4 w-4" aria-hidden="true" />
              {t("template")}
            </Button>
          </div>
        )}

        {step.kind === "review" && reviewContent(step)}

        {step.kind === "importing" && (
          <div className="min-w-0 space-y-3" aria-live="polite">
            <p className="flex items-center gap-2 font-medium">
              <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
              {t("importing", { done: step.done, total: step.total })}
            </p>
            <div
              role="progressbar"
              aria-label={t("progress")}
              aria-valuemin={0}
              aria-valuemax={step.total}
              aria-valuenow={step.done}
              className="h-2 overflow-hidden rounded-full bg-muted"
            >
              <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${step.total ? (step.done / step.total) * 100 : 0}%` }} />
            </div>
          </div>
        )}

        {step.kind === "done" && (
          <div data-testid="import-done" className="min-w-0 space-y-4">
            <ul className="space-y-2 text-sm" aria-live="polite">
              {step.outcome.sent > 0 && (
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                  {t("sent", { count: step.outcome.sent })}
                </li>
              )}
              {step.outcome.queued > 0 && (
                <li className="flex items-start gap-2">
                  <CloudOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {t("queued", { count: step.outcome.queued })}
                </li>
              )}
              {step.outcome.refused > 0 && (
                <li className="flex items-start gap-2 text-destructive">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {t("refused", { count: step.outcome.refused })}
                </li>
              )}
              {step.outcome.failed > 0 && (
                <li className="flex items-start gap-2 text-destructive">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {t("failed", { count: step.outcome.failed, reason: step.outcome.reason ?? "" })}
                </li>
              )}
            </ul>
            {step.imported.length > 0 && (
              <div className="space-y-3 rounded-2xl border bg-card p-4">
                <p className="text-sm text-muted-foreground">{t("credentialsHint")}</p>
                <Button type="button" className="w-full rounded-full sm:w-auto" onClick={() => void downloadCredentials(step.imported)}>
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                  {t("credentials")}
                </Button>
                {downloaded && (
                  <p className="flex items-center gap-1.5 text-sm text-success">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    {t("downloaded")}
                  </p>
                )}
              </div>
            )}
            {closeWarning && (
              <div role="alert" className="flex flex-col gap-2 rounded-2xl border border-highlight/50 bg-highlight/15 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <p className="font-medium">{t("closeWarning")}</p>
                <Button type="button" variant="ghost" size="sm" className="shrink-0 rounded-full" onClick={() => onOpenChange(false)}>
                  {t("closeAnyway")}
                </Button>
              </div>
            )}
            <div className="flex justify-end">
              <Button type="button" variant="outline" className="w-full rounded-full sm:w-auto" onClick={() => requestClose(false)}>
                {t("close")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );

  function reviewContent(review: Review) {
    const ready = review.rows.filter(isReady);
    const invalid = review.rows.length - ready.length;
    const generated = ready.filter((row) => row.generated).length;
    const shown = onlyProblems ? review.rows.filter((row) => !isReady(row)) : review.rows;
    const CheckIcon = review.check === "server" ? ShieldCheck : Smartphone;

    return (
      <div className="min-w-0 space-y-4">
        <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <FileSpreadsheet className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="truncate">{review.source}</span>
        </p>
        <ul className="flex flex-wrap gap-2" data-testid="import-summary">
          <li>
            <Badge variant="neutral">{t("summary.rows", { count: review.rows.length })}</Badge>
          </li>
          <li>
            <Badge variant="success">{t("summary.ready", { count: ready.length })}</Badge>
          </li>
          {invalid > 0 && (
            <li>
              <Badge variant="danger">{t("summary.problems", { count: invalid })}</Badge>
            </li>
          )}
          {generated > 0 && (
            <li>
              <Badge variant="secondary" className="gap-1">
                <KeyRound className="h-3 w-3" aria-hidden="true" />
                {t("summary.generated", { count: generated })}
              </Badge>
            </li>
          )}
        </ul>
        <p data-testid="import-check" data-check={review.check} className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
          {review.check === "checking" ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
          ) : (
            <CheckIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          {t(`check.${review.check}`)}
        </p>
        {invalid > 0 && (
          <CheckboxField id="users-import-only-problems" label={t("onlyProblems")} checked={onlyProblems} onChange={(event) => setOnlyProblems(event.target.checked)} />
        )}
        <ul aria-label={review.source} className="max-h-[40vh] divide-y overflow-y-auto rounded-2xl border bg-card">
          {shown.slice(0, SHOWN_ROWS).map((row) => (
            <ImportRowItem key={row.user.row} row={row} groups={groups} problemText={problemText} />
          ))}
        </ul>
        {shown.length > SHOWN_ROWS && <p className="text-sm text-muted-foreground">{t("more", { count: shown.length - SHOWN_ROWS })}</p>}
        {invalid > 0 && (
          <div className="space-y-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-sm">{t("fixHint")}</p>
            {ready.length > 0 && (
              <CheckboxField id="users-import-skip" label={t("skip", { ready: ready.length, count: invalid })} checked={skip} onChange={(event) => setSkip(event.target.checked)} />
            )}
          </div>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            className="rounded-full"
            onClick={() => {
              readToken.current += 1;
              setStep({ kind: "pick", reading: false, error: null });
            }}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {t("another")}
          </Button>
          <Button
            type="button"
            className="rounded-full"
            disabled={ready.length === 0 || (invalid > 0 && !skip) || review.check === "checking"}
            onClick={() => void runImport(review)}
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            {t("submit", { count: ready.length })}
          </Button>
        </div>
      </div>
    );
  }
}
