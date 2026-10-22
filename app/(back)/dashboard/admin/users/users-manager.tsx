"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { CircleAlert, CloudOff, CloudUpload, Download, HardDrive, Pencil, RefreshCw, RotateCcw, Search, Share2, Trash2, Undo2, UserPlus, Users } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineFeedback, useFeedback } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { SkeletonList } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  groupLabel,
  toCsv,
  USERS_SCOPE,
  userChanges,
  type ChangeKind,
  type Directory,
  type UserChange,
  type UserInput,
  type UserRow,
} from "@/lib/users/directory";
import { deleteUser } from "@/lib/users/mutations";
import { cn } from "@/lib/utils";
import { UserDialog, type SaveOutcome } from "./user-dialog";

const PAGE_SIZE = 20;

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
  const openDialog = (editing: UserRow | null, draft: UserInput | null = null) =>
    setDialog((current) => ({ open: true, editing, draft, key: current.key + 1 }));

  const reason = (rejection: OutboxRejection) => errors.message(rejection);

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

  const undo = async (recordId: string) => {
    await removeOutboxRecord(recordId);
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
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
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
  const changeLabel = (kind: ChangeKind, name: string) => t(`issues.${kind}`, { name });

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button className="rounded-full" onClick={() => openDialog(null)}>
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            {t("add")}
          </Button>
        }
      />

      {/* Where the list comes from: always this device's copy, refreshed when online. */}
      <p data-testid="users-offline-status" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        {online ? <HardDrive className="h-4 w-4" aria-hidden="true" /> : <CloudOff className="h-4 w-4 text-highlight" aria-hidden="true" />}
        {!online && <span className="font-medium text-foreground">{t("offline.offline")}</span>}
        {saved && <span>{t("offline.saved", { count: saved.items.length })}</span>}
        {saved && savedAt && <span>· {t("offline.updated", { time: format.dateTime(new Date(savedAt), "dayMonthTime") })}</span>}
        {background && (
          <span className="inline-flex items-center gap-1">
            · <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            {background === "on" ? t("offline.backgroundOn") : t("offline.backgroundOff")}
          </span>
        )}
      </p>
      {saved?.truncated && <p className="text-sm text-muted-foreground">{t("offline.truncated", { count: saved.items.length })}</p>}

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
        <div className="space-y-2 sm:w-56">
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
          <Button type="button" variant="outline" className="rounded-full" onClick={exportCsv} disabled={visible.length === 0}>
            <Download className="h-4 w-4" aria-hidden="true" />
            {t("export")}
          </Button>
          {canShare && (
            <Button type="button" variant="outline" className="rounded-full" onClick={() => void shareCsv()} disabled={visible.length === 0}>
              <Share2 className="h-4 w-4" aria-hidden="true" />
              {t("share")}
            </Button>
          )}
        </div>
      </form>

      {saved && (
        <ul aria-label={t("stats")} className="flex flex-wrap gap-2">
          {ROLES.map((value) => (
            <li key={value}>
              <button
                type="button"
                aria-pressed={filters.role === value}
                onClick={() => setFilter({ role: filters.role === value ? "" : value })}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  filters.role === value ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent"
                )}
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
                  <p className="font-medium">{changeLabel(change.info.kind, change.info.name)}</p>
                  {change.record.rejected && <p className="text-destructive">{reason(change.record.rejected)}</p>}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {change.info.kind !== "delete" && (
                    <Button variant="outline" size="sm" className="rounded-full" onClick={() => editChange(change)}>
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      {t("edit")}
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="rounded-full" onClick={() => void retryOutboxRecord(change.record.id)}>
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("retry")}
                  </Button>
                  <Button variant="ghost" size="sm" className="rounded-full text-destructive" onClick={() => void discard(change.record.id)}>
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
          <p className="text-sm text-muted-foreground">{tPagination("total", { count: visible.length })}</p>
          <Table aria-label={t("title")}>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.name")}</TableHead>
                <TableHead>{t("columns.email")}</TableHead>
                <TableHead>{t("columns.role")}</TableHead>
                <TableHead>{t("columns.group")}</TableHead>
                <TableHead className="text-right">{t("columns.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((row) => {
                const name = `${row.firstname} ${row.lastname}`;
                const isSelf = row.id === currentUserId;
                const state = row.state;
                const deleting = state.kind === "pending" && state.change === "delete";
                return (
                  <TableRow
                    key={row.id}
                    data-user-id={row.id}
                    data-state={state.kind}
                    data-change={state.kind === "synced" ? undefined : state.change}
                    className={cn(deleting && "opacity-60")}
                  >
                    <TableCell className="font-medium">
                      <span className={cn(deleting && "line-through")}>{name}</span>
                      {isSelf && <span className="ml-2 text-xs text-muted-foreground">({t("you")})</span>}
                      {state.kind === "pending" && (
                        <Badge variant="warning" className="ml-2 gap-1 align-middle">
                          <CloudUpload className="h-3 w-3" aria-hidden="true" />
                          {state.change === "create" ? t("state.pendingCreate") : state.change === "update" ? t("state.pendingUpdate") : t("state.pendingDelete")}
                        </Badge>
                      )}
                      {state.kind === "rejected" && (
                        <Badge variant="danger" className="ml-2 align-middle" title={reason(state.rejection)}>
                          {t("state.rejected")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className={cn("text-muted-foreground", deleting && "line-through")}>{row.email}</TableCell>
                    <TableCell>
                      <Badge variant={row.role === "ADMIN" ? "default" : "secondary"}>{tRoles(row.role)}</Badge>
                    </TableCell>
                    <TableCell>{row.group ? groupLabel(row.group) : "—"}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        {state.kind === "pending" ? (
                          <>
                            {!deleting && (
                              <Button variant="outline" size="sm" className="rounded-full" onClick={() => openDialog(row)}>
                                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                                {t("edit")}
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" className="rounded-full" onClick={() => void undo(state.recordId)}>
                              <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                              {t("undo")}
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button variant="outline" size="sm" className="rounded-full" onClick={() => openDialog(row)}>
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                              {t("edit")}
                            </Button>
                            {!isSelf && (
                              <ConfirmDialog
                                trigger={
                                  <Button variant="outline" size="sm" className="rounded-full text-destructive hover:text-destructive">
                                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                    {t("delete")}
                                  </Button>
                                }
                                title={t("confirmDeleteTitle", { name })}
                                description={t("confirmDeleteDescription")}
                                confirmLabel={t("confirmDelete")}
                                onConfirm={() => remove(row)}
                              />
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {pages > 1 && (
            <nav aria-label={tPagination("label")} className="flex items-center justify-between gap-3">
              <Button variant="outline" size="sm" className="rounded-full" disabled={page <= 1} onClick={() => setFilters((current) => ({ ...current, page: page - 1 }))}>
                {t("previous")}
              </Button>
              <span className="text-sm text-muted-foreground">{tPagination("pageOf", { page, pages })}</span>
              <Button variant="outline" size="sm" className="rounded-full" disabled={page >= pages} onClick={() => setFilters((current) => ({ ...current, page: page + 1 }))}>
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
    </>
  );
}
