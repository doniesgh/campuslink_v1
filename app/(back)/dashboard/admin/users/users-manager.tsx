"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { CircleAlert, Clock, CloudOff, Download, FileUp, HardDrive, Pencil, RefreshCw, RotateCcw, Search, Share2, UserPlus, Users } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineFeedback, useFeedback } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { SkeletonList } from "@/components/ui/skeleton";
import { todayKey } from "@/lib/datetime";
import { useErrorFormatter } from "@/lib/i18n/client";
import {
  OUTBOX_REPLAYED_EVENT,
  removeOutboxRecord,
  retryOutboxRecord,
  useOfflineQuery,
  useOnlineStatus,
  useOutbox,
  type OutboxRejection,
} from "@/lib/offline";
import { enablePeriodicSync, type PeriodicSyncState } from "@/lib/pwa/periodic-sync";
import { ROLES, type Group, type Role, type User } from "@/lib/types";
import {
  applyChanges,
  countByRole,
  DIRECTORY_KEY,
  DIRECTORY_PATH,
  DIRECTORY_SYNC_INTERVAL_MS,
  DIRECTORY_SYNC_TAG,
  filterRows,
  GROUPS_KEY,
  GROUPS_PATH,
  IMPORT_ROW_HELD,
  IMPORT_ROW_INVALID,
  serverProblems,
  toCsv,
  USERS_SCOPE,
  userChanges,
  type Directory,
  type UserChange,
  type UserInput,
  type UserRow,
} from "@/lib/users/directory";
import type { ImportProblem } from "@/lib/users/import";
import { downloadBlob } from "@/lib/users/import-files";
import { deleteUser, undoChange } from "@/lib/users/mutations";
import { cn } from "@/lib/utils";
import { ImportDialog, useImportProblemText, type ImportSummary } from "./import-dialog";
import { UserDialog, type SaveOutcome } from "./user-dialog";
import { UserList } from "./user-list";

const PAGE_SIZE = 20;
/** Problems of a refused import part listed in "couldn't be applied" (the others are counted). */
const SHOWN_PROBLEMS = 3;

type Filters = { q: string; role: Role | ""; page: number };
type Snapshot<T> = { data: T; savedAt: number };
type DialogState = { open: boolean; editing: UserRow | null; draft: UserInput | null; key: number };

/** The directory with `user` added or replaced (after a change the server confirmed). */
function withUser(directory: Directory | undefined, user: User): Directory | undefined {
  if (!directory) return directory;
  const exists = directory.items.some((item) => item.id === user.id);
  const items = exists ? directory.items.map((item) => (item.id === user.id ? user : item)) : [...directory.items, user];
  return { ...directory, items, total: directory.total + (exists ? 0 : 1) };
}

function withoutUser(directory: Directory | undefined, id: string): Directory | undefined {
  if (!directory) return directory;
  const items = directory.items.filter((item) => item.id !== id);
  return { ...directory, items, total: Math.max(0, directory.total - (directory.items.length - items.length)) };
}

/** Role filter chip (36 px high on phones: an easy touch target). */
const chipClass = (pressed: boolean) =>
  cn(
    "rounded-full border px-3.5 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:py-1",
    pressed ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent"
  );

const subscribeNothing = () => () => undefined;

/** Web Share API with files (phones, some desktops): offer "Share" for the CSV. */
function useCanShareFiles(): boolean {
  return useSyncExternalStore(
    subscribeNothing,
    () => {
      try {
        return typeof navigator.canShare === "function" && navigator.canShare({ files: [new File([""], "users.csv", { type: "text/csv" })] });
      } catch {
        return false;
      }
    },
    () => false
  );
}

export function UsersManager({
  initialDirectory,
  initialGroups,
  currentUserId,
  initialFilters,
}: Readonly<{
  initialDirectory: Snapshot<Directory | null>;
  initialGroups: Snapshot<Group[] | null>;
  currentUserId: string;
  initialFilters: Filters;
}>) {
  const t = useTranslations("admin.users");
  const tRoles = useTranslations("common.roles");
  const tPagination = useTranslations("common.pagination");
  const format = useFormatter();
  const errors = useErrorFormatter();
  const online = useOnlineStatus();
  const canShare = useCanShareFiles();
  const [feedback, setFeedback] = useFeedback();
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [dialog, setDialog] = useState<DialogState>({ open: false, editing: null, draft: null, key: 0 });
  const [importDialog, setImportDialog] = useState({ open: false, key: 0 });
  const problemText = useImportProblemText();
  const [background, setBackground] = useState<PeriodicSyncState | null>(null);

  // The directory and the groups, saved on this device (stale-while-revalidate, readable offline).
  const directory = useOfflineQuery<Directory>(DIRECTORY_KEY, DIRECTORY_PATH, {
    fallbackData: initialDirectory.data ?? undefined,
    fallbackSavedAt: initialDirectory.savedAt,
    revalidateOnMount: !initialDirectory.data,
  });
  const groupsQuery = useOfflineQuery<Group[]>(GROUPS_KEY, GROUPS_PATH, {
    fallbackData: initialGroups.data ?? undefined,
    fallbackSavedAt: initialGroups.savedAt,
    revalidateOnMount: !initialGroups.data,
    reportLastUpdated: false,
  });
  const groups = useMemo(() => groupsQuery.data ?? [], [groupsQuery.data]);
  // Changes made on this device that the server has not confirmed yet (or refused).
  const records = useOutbox(USERS_SCOPE);

  const { rows } = useMemo(() => applyChanges(directory.data?.items ?? [], records, groups), [directory.data, records, groups]);
  const issues = useMemo(() => userChanges(records).filter((change) => change.record.rejected), [records]);
  const visible = useMemo(() => filterRows(rows, filters), [rows, filters]);
  const counts = useMemo(() => countByRole(rows), [rows]);
  const existingEmails = useMemo(() => new Set(rows.map((row) => row.email.toLowerCase())), [rows]);
  const total = ROLES.reduce((sum, role) => sum + counts[role], 0);
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const page = Math.min(filters.page, pages);
  const pageRows = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // The filters live in the URL (shareable, kept on reload) without a server round trip.
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.q.trim()) params.set("q", filters.q.trim());
    if (filters.role) params.set("role", filters.role);
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    const url = `${window.location.pathname}${query ? `?${query}` : ""}`;
    if (url !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(window.history.state, "", url);
  }, [filters, page]);

  // Periodic Background Sync keeps the saved directory fresh while the app is closed (installed app only).
  useEffect(() => {
    let cancelled = false;
    void enablePeriodicSync(DIRECTORY_SYNC_TAG, DIRECTORY_SYNC_INTERVAL_MS).then((state) => {
      if (!cancelled) setBackground(state);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Changes sent when the connection came back.
  useEffect(() => {
    const onReplayed = (event: Event) => {
      const sent = (event as CustomEvent<{ sent: number }>).detail?.sent ?? 0;
      if (sent > 0) setFeedback({ type: "success", message: t("synced", { count: sent }) });
    };
    window.addEventListener(OUTBOX_REPLAYED_EVENT, onReplayed);
    return () => window.removeEventListener(OUTBOX_REPLAYED_EVENT, onReplayed);
  }, [setFeedback, t]);

  const setFilter = (patch: Partial<Filters>) => setFilters((current) => ({ ...current, page: 1, ...patch }));
  // Back to the top of the list: on a phone the "Next" button is far below it.
  const goToPage = (next: number) => {
    setFilters((current) => ({ ...current, page: next }));
    document.getElementById("users-results")?.scrollIntoView({ block: "start" });
  };
  const openDialog = (editing: UserRow | null, draft: UserInput | null = null) =>
    setDialog((current) => ({ open: true, editing, draft, key: current.key + 1 }));

  /** Why a change was refused. An import part: its first problems; one of its accounts: its own (or held back). */
  const reason = (rejection: OutboxRejection) => {
    if (rejection.code === IMPORT_ROW_INVALID) {
      const problems = (rejection.details as { problems?: ImportProblem[] } | undefined)?.problems ?? [];
      return problems.map(problemText).join(" · ") || errors.message(rejection);
    }
    if (rejection.code === IMPORT_ROW_HELD) return t("import.held");
    if (rejection.code === "IMPORT_INVALID") {
      const problems = [...serverProblems(rejection.details)].flatMap(([line, list]) => list.map((problem) => ({ line, problem })));
      if (problems.length === 0) return errors.message(rejection);
      const listed = problems.slice(0, SHOWN_PROBLEMS).map(({ line, problem }) => t("import.problemAt", { line, problem: problemText(problem) }));
      const more = problems.length > SHOWN_PROBLEMS ? [t("import.moreProblems", { count: problems.length - SHOWN_PROBLEMS })] : [];
      return [...listed, ...more].join(" ");
    }
    return errors.message(rejection);
  };

  const onSaved = (outcome: SaveOutcome, input: UserInput, editing: UserRow | null) => {
    const name = `${input.firstname} ${input.lastname}`;
    const isEdit = !!editing && !editing.local;
    if (outcome.status === "sent") {
      directory.mutate((current) => withUser(current, outcome.user));
      void directory.refresh();
      setFeedback({ type: "success", message: isEdit ? t("updated", { name }) : t("created", { name }) });
    } else {
      setFeedback({ type: "info", message: isEdit ? t("queued.update", { name }) : t("queued.create", { name }) });
    }
  };

  const remove = async (row: UserRow) => {
    const name = `${row.firstname} ${row.lastname}`;
    const result = await deleteUser(row);
    if (result.status === "dropped") setFeedback({ type: "info", message: t("dropped", { name }) });
    else if (result.status === "queued") setFeedback({ type: "info", message: t("queued.delete", { name }) });
    else if (result.status === "failed") setFeedback({ type: "error", message: errors.message(result.error) });
    else {
      directory.mutate((current) => withoutUser(current, row.id));
      void directory.refresh();
      setFeedback({ type: "success", message: t("deleted", { name }) });
    }
  };

  const undo = async (row: UserRow) => {
    await undoChange(row);
    setFeedback({ type: "info", message: t("undone") });
  };
  const discard = async (recordId: string) => {
    await removeOutboxRecord(recordId);
    setFeedback({ type: "info", message: t("discarded") });
  };

  /** Edit a refused change: the form opens with the values that were refused. */
  const editChange = (change: UserChange) => {
    const row = rows.find((candidate) => candidate.id === change.info.userId) ?? null;
    openDialog(row, (change.record.body as UserInput | undefined) ?? null);
  };

  const onImported = (summary: ImportSummary) => {
    if (summary.items.length > 0) {
      directory.mutate((current) => summary.items.reduce<Directory | undefined>((list, user) => withUser(list, user), current));
      void directory.refresh();
    }
    const parts = [
      summary.sent > 0 ? t("import.sent", { count: summary.sent }) : "",
      summary.queued > 0 ? t("import.queued", { count: summary.queued }) : "",
      summary.refused > 0 ? t("import.refused", { count: summary.refused }) : "",
    ].filter(Boolean);
    if (parts.length === 0) return;
    let type: "success" | "info" | "error" = summary.sent > 0 ? "success" : "info";
    if (summary.refused > 0 || summary.failed > 0) type = "error";
    setFeedback({ type, message: t("import.feedback", { name: summary.source, result: parts.join(" ") }) });
  };

  const csvLabels = {
    headers: { lastname: t("csv.lastname"), firstname: t("csv.firstname"), email: t("csv.email"), role: t("csv.role"), group: t("csv.group"), createdAt: t("csv.createdAt") },
    role: (role: Role) => tRoles(role),
  };
  const csvFile = () => {
    const content = toCsv(visible, csvLabels);
    return { content, name: `campuslink-users-${todayKey()}.csv` };
  };

  // Built from the data on this device: works offline.
  const exportCsv = () => {
    const { content, name } = csvFile();
    downloadBlob(new Blob([content], { type: "text/csv;charset=utf-8" }), name);
    setFeedback({ type: "success", message: t("exported", { count: visible.length }) });
  };
  const shareCsv = async () => {
    const { content, name } = csvFile();
    try {
      await navigator.share({ title: t("title"), files: [new File([content], name, { type: "text/csv" })] });
    } catch {
      // Cancelled by the user.
    }
  };

  const savedAt = directory.savedAt;
  const saved = directory.data;
  const changeLabel = ({ info }: UserChange) => {
    if (info.kind !== "import") return t(`issues.${info.kind}`, { name: info.name });
    const count = info.count ?? 0;
    return info.parts && info.parts > 1
      ? t("issues.importPart", { name: info.name, count, part: info.part ?? 1, parts: info.parts })
      : t("issues.import", { name: info.name, count });
  };

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <>
            <Button
              variant="outline"
              className="flex-1 rounded-full sm:flex-none"
              disabled={!saved}
              onClick={() => setImportDialog((current) => ({ open: true, key: current.key + 1 }))}
            >
              <FileUp className="h-4 w-4" aria-hidden="true" />
              {t("import.button")}
            </Button>
            <Button className="flex-1 rounded-full sm:flex-none" onClick={() => openDialog(null)}>
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              {t("add")}
            </Button>
          </>
        }
      />

      {/* Where the list comes from: always this device's copy, refreshed when online. One item per line on phones. */}
      <div data-testid="users-offline-status" className="space-y-2 text-sm">
        {!online && (
          <p className="flex items-start gap-2 rounded-2xl border border-highlight/40 bg-highlight/10 px-3 py-2.5 font-medium text-foreground">
            <CloudOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {t("offline.offline")}
          </p>
        )}
        <ul className="flex flex-col gap-1 text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-5">
          {saved && (
            <li className="flex items-center gap-1.5">
              <HardDrive className="h-4 w-4 shrink-0" aria-hidden="true" />
              {t("offline.saved", { count: saved.items.length })}
            </li>
          )}
          {saved && savedAt && (
            <li className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
              {t("offline.updated", { time: format.dateTime(new Date(savedAt), "dayMonthTime") })}
            </li>
          )}
          {background && (
            <li className="flex items-center gap-1.5">
              <RefreshCw className="h-4 w-4 shrink-0" aria-hidden="true" />
              {background === "on" ? t("offline.backgroundOn") : t("offline.backgroundOff")}
            </li>
          )}
        </ul>
        {saved?.truncated && <p className="text-muted-foreground">{t("offline.truncated", { count: saved.items.length })}</p>}
      </div>

      <form role="search" className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(event) => event.preventDefault()}>
        <div className="flex-1 space-y-2">
          <label htmlFor="users-search" className="block text-sm font-medium">
            {t("search")}
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="users-search"
              type="search"
              name="q"
              value={filters.q}
              placeholder={t("searchPlaceholder")}
              className="pl-10"
              onChange={(event) => setFilter({ q: event.target.value })}
            />
          </div>
        </div>
        {/* Phones filter with the role chips below (same filter, bigger targets). */}
        <div className="hidden space-y-2 sm:block sm:w-56">
          <label htmlFor="users-role" className="block text-sm font-medium">
            {t("role")}
          </label>
          <Select id="users-role" name="role" value={filters.role} onChange={(event) => setFilter({ role: event.target.value as Role | "" })}>
            <option value="">{t("allRoles")}</option>
            {ROLES.map((value) => (
              <option key={value} value={value}>
                {tRoles(value)}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1 rounded-full sm:flex-none" onClick={exportCsv} disabled={visible.length === 0}>
            <Download className="h-4 w-4" aria-hidden="true" />
            {t("export")}
          </Button>
          {canShare && (
            <Button type="button" variant="outline" className="flex-1 rounded-full sm:flex-none" onClick={() => void shareCsv()} disabled={visible.length === 0}>
              <Share2 className="h-4 w-4" aria-hidden="true" />
              {t("share")}
            </Button>
          )}
        </div>
      </form>

      {saved && (
        <ul aria-label={t("stats")} className="flex flex-wrap gap-2">
          {/* "All" is only needed where the role select is hidden. */}
          <li className="sm:hidden">
            <button type="button" aria-pressed={filters.role === ""} onClick={() => setFilter({ role: "" })} className={chipClass(filters.role === "")}>
              {t("allRoles")} · <span className="font-semibold">{total}</span>
            </button>
          </li>
          {ROLES.map((value) => (
            <li key={value}>
              <button
                type="button"
                aria-pressed={filters.role === value}
                onClick={() => setFilter({ role: filters.role === value ? "" : value })}
                className={chipClass(filters.role === value)}
              >
                {tRoles(value)} · <span className="font-semibold">{counts[value]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <InlineFeedback feedback={feedback} />

      {issues.length > 0 && (
        <section aria-labelledby="sync-issues" className="space-y-3 rounded-3xl border border-destructive/30 bg-destructive/5 p-4 sm:p-5">
          <div className="flex items-start gap-2">
            <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
            <div>
              <h2 id="sync-issues" className="font-semibold">
                {t("issues.title", { count: issues.length })}
              </h2>
              <p className="text-sm text-muted-foreground">{t("issues.description")}</p>
            </div>
          </div>
          <ul className="space-y-2">
            {issues.map((change) => (
              <li
                key={change.record.id}
                data-change-id={change.record.id}
                className="flex flex-col gap-2 rounded-2xl bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 text-sm">
                  <p className="font-medium">{changeLabel(change)}</p>
                  {change.record.rejected && <p className="text-destructive">{reason(change.record.rejected)}</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                  {change.info.kind !== "delete" && change.info.kind !== "import" && (
                    <Button variant="outline" size="sm" className="flex-1 rounded-full sm:flex-none" onClick={() => editChange(change)}>
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      {t("edit")}
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="flex-1 rounded-full sm:flex-none" onClick={() => void retryOutboxRecord(change.record.id)}>
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("retry")}
                  </Button>
                  <Button variant="ghost" size="sm" className="flex-1 rounded-full text-destructive sm:flex-none" onClick={() => void discard(change.record.id)}>
                    {t("discard")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!saved ? (
        directory.isLoading ? (
          <SkeletonList rows={4} label={t("title")} />
        ) : (
          <EmptyState icon={CloudOff} title={t("offline.notSaved")} />
        )
      ) : visible.length === 0 ? (
        <EmptyState icon={Users} title={t("empty")} />
      ) : (
        <>
          <p id="users-results" className="scroll-mt-20 text-sm text-muted-foreground">
            {tPagination("total", { count: visible.length })}
          </p>
          <UserList
            rows={pageRows}
            currentUserId={currentUserId}
            reason={reason}
            onEdit={(row) => openDialog(row)}
            onDelete={remove}
            onUndo={(row) => void undo(row)}
          />
          {pages > 1 && (
            <nav aria-label={tPagination("label")} className="flex items-center justify-between gap-3">
              <Button variant="outline" className="rounded-full sm:h-9 sm:px-3" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
                {t("previous")}
              </Button>
              <span className="text-sm text-muted-foreground">{tPagination("pageOf", { page, pages })}</span>
              <Button variant="outline" className="rounded-full sm:h-9 sm:px-3" disabled={page >= pages} onClick={() => goToPage(page + 1)}>
                {t("next")}
              </Button>
            </nav>
          )}
        </>
      )}

      <UserDialog
        key={dialog.key}
        open={dialog.open}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
        editing={dialog.editing}
        draft={dialog.draft}
        groups={groups}
        onSaved={onSaved}
      />
      <ImportDialog
        key={`import-${importDialog.key}`}
        open={importDialog.open}
        onOpenChange={(open) => setImportDialog((current) => ({ ...current, open }))}
        groups={groups}
        existingEmails={existingEmails}
        onImported={onImported}
      />
    </>
  );
}
