"use client";

import { CloudUpload, Pencil, Trash2, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { OutboxRejection } from "@/lib/offline";
import { groupLabel, type UserRow } from "@/lib/users/directory";
import { cn } from "@/lib/utils";

type ListProps = {
  rows: UserRow[];
  currentUserId: string;
  /** Localised reason of a refused change. */
  reason: (rejection: OutboxRejection) => string;
  onEdit: (row: UserRow) => void;
  onDelete: (row: UserRow) => Promise<void>;
  onUndo: (recordId: string) => void;
};

type RowProps = Omit<ListProps, "rows"> & { row: UserRow };

const PENDING_LABELS = { create: "state.pendingCreate", update: "state.pendingUpdate", delete: "state.pendingDelete" } as const;

const isDeleting = (row: UserRow) => row.state.kind === "pending" && row.state.change === "delete";
const nameOf = (row: UserRow) => `${row.firstname} ${row.lastname}`;
const initials = (row: UserRow) => `${row.firstname.charAt(0)}${row.lastname.charAt(0)}`.toUpperCase() || "?";

/** "Waiting to sync" / "Change waiting to sync" / "Will be deleted" / "Not applied". */
function StateBadge({ row }: Readonly<{ row: UserRow }>) {
  const t = useTranslations("admin.users");
  const { state } = row;
  if (state.kind === "synced") return null;
  if (state.kind === "rejected") return <Badge variant="danger">{t("state.rejected")}</Badge>;
  return (
    <Badge variant="warning" className="gap-1">
      <CloudUpload className="h-3 w-3" aria-hidden="true" />
      {t(PENDING_LABELS[state.change])}
    </Badge>
  );
}

/** Edit + Delete, or Edit + Undo while a change waits. `stretch`: full-width touch targets (cards). */
function RowActions({ row, currentUserId, onEdit, onDelete, onUndo, stretch = false }: Readonly<RowProps & { stretch?: boolean }>) {
  const t = useTranslations("admin.users");
  const { state } = row;
  const name = nameOf(row);
  const size = stretch ? "default" : "sm";
  const width = stretch ? "flex-1" : "";

  const edit = !isDeleting(row) && (
    <Button variant="outline" size={size} className={cn("rounded-full", width)} onClick={() => onEdit(row)}>
      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
      {t("edit")}
    </Button>
  );

  if (state.kind === "pending") {
    return (
      <>
        {edit}
        <Button variant="ghost" size={size} className={cn("rounded-full", width)} onClick={() => onUndo(state.recordId)}>
          <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
          {t("undo")}
        </Button>
      </>
    );
  }

  return (
    <>
      {edit}
      {row.id !== currentUserId && (
        <ConfirmDialog
          trigger={
            <Button variant="outline" size={size} className={cn("rounded-full text-destructive hover:text-destructive", width)}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              {t("delete")}
            </Button>
          }
          title={t("confirmDeleteTitle", { name })}
          description={t("confirmDeleteDescription")}
          confirmLabel={t("confirmDelete")}
          onConfirm={() => onDelete(row)}
        />
      )}
    </>
  );
}

/** One account as a card (phones and tablets). */
function UserCard(props: Readonly<RowProps>) {
  const t = useTranslations("admin.users");
  const tRoles = useTranslations("common.roles");
  const { row, currentUserId, reason } = props;
  const deleting = isDeleting(row);
  return (
    <li
      data-user-id={row.id}
      data-state={row.state.kind}
      data-change={row.state.kind === "synced" ? undefined : row.state.change}
      className={cn("flex flex-col gap-3 rounded-3xl border bg-card p-4 text-card-foreground", deleting && "opacity-60")}
    >
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-primary">
          {initials(row)}
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("truncate font-semibold", deleting && "line-through")}>
            {nameOf(row)}
            {row.id === currentUserId && <span className="ml-1.5 text-xs font-normal text-muted-foreground">({t("you")})</span>}
          </p>
          <p className={cn("truncate text-sm text-muted-foreground", deleting && "line-through")}>{row.email}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={row.role === "ADMIN" ? "default" : "secondary"}>{tRoles(row.role)}</Badge>
        {row.group && <Badge variant="outline">{groupLabel(row.group)}</Badge>}
        <StateBadge row={row} />
      </div>
      {row.state.kind === "rejected" && <p className="text-sm text-destructive">{reason(row.state.rejection)}</p>}
      <div className="flex gap-2">
        <RowActions {...props} stretch />
      </div>
    </li>
  );
}

/**
 * The accounts of the current page: cards below 1280 px (one column, two from 768 px), a table above (the
 * sidebar leaves too little room for five columns before that). Both carry `data-user-id`, `data-state` and
 * `data-change`; the hidden one is out of the accessibility tree (display: none).
 */
export function UserList(props: Readonly<ListProps>) {
  const t = useTranslations("admin.users");
  const tRoles = useTranslations("common.roles");
  const { rows, ...rowProps } = props;

  return (
    <>
      <ul aria-label={t("title")} className="grid gap-3 md:grid-cols-2 xl:hidden">
        {rows.map((row) => (
          <UserCard key={row.id} row={row} {...rowProps} />
        ))}
      </ul>

      <Table aria-label={t("title")} wrapperClassName="hidden xl:block">
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
          {rows.map((row) => {
            const deleting = isDeleting(row);
            return (
              <TableRow
                key={row.id}
                data-user-id={row.id}
                data-state={row.state.kind}
                data-change={row.state.kind === "synced" ? undefined : row.state.change}
                className={cn(deleting && "opacity-60")}
              >
                <TableCell className="font-medium">
                  <span className={cn(deleting && "line-through")}>{nameOf(row)}</span>
                  {row.id === props.currentUserId && <span className="ml-2 text-xs text-muted-foreground">({t("you")})</span>}
                  <span className="ml-2 inline-flex align-middle">
                    <StateBadge row={row} />
                  </span>
                </TableCell>
                <TableCell className={cn("text-muted-foreground", deleting && "line-through")}>{row.email}</TableCell>
                <TableCell>
                  <Badge variant={row.role === "ADMIN" ? "default" : "secondary"}>{tRoles(row.role)}</Badge>
                </TableCell>
                <TableCell>{row.group ? groupLabel(row.group) : "—"}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <RowActions row={row} {...rowProps} />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </>
  );
}
