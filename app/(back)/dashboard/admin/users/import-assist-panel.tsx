"use client";

import { Loader2, RotateCcw, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ROLES, type Group, type Role } from "@/lib/types";
import { groupLabel } from "@/lib/users/directory";
import { groupResolver, roleResolver } from "@/lib/users/import";
import { ASSIST_LINES, columnLetter, type AssistField, type AssistMapping } from "@/lib/users/import-assist";

const FIELDS: AssistField[] = ["lastname", "firstname", "fullName", "email", "role", "group", "password"];

/** "Read it with AI": offered when a file doesn't follow the template, or some of its values couldn't be read. */
export function AssistOffer({
  hint,
  action,
  model,
  online,
  busy,
  onAssist,
}: Readonly<{ hint: string; action: string; model: string; online: boolean; busy: boolean; onAssist: () => void }>) {
  const t = useTranslations("admin.users.import.ai");
  return (
    <div data-testid="import-ai-offer" className="space-y-3 rounded-2xl border border-primary/30 bg-primary/5 p-3 sm:p-4">
      <p className="flex items-start gap-2 text-sm font-medium">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        {hint}
      </p>
      <p className="text-xs text-muted-foreground">{t("privacy", { lines: ASSIST_LINES, model })}</p>
      <Button type="button" variant="outline" className="w-full rounded-full sm:w-auto" disabled={!online || busy} onClick={onAssist}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
        {busy ? t("working") : action}
      </Button>
      {!online && <p className="text-xs text-muted-foreground">{t("offline")}</p>}
    </div>
  );
}

/** What the AI understood, now applied to the file: shown above the lines so the admin can check it, or undo it. */
export function AssistSummary({
  mapping,
  model,
  groups,
  onUndo,
}: Readonly<{ mapping: AssistMapping; model: string; groups: Group[]; onUndo: () => void }>) {
  const t = useTranslations("admin.users.import.ai");
  const tColumns = useTranslations("admin.users.import.columns");
  const tRoles = useTranslations("common.roles");
  const { columns } = mapping;
  // A value the AI left out may still be read by the usual rules ("4 DS 1" is 4DS1): only the others are listed.
  const readRole = roleResolver(Object.fromEntries(ROLES.map((role) => [role, tRoles(role)])));
  const readGroup = groupResolver(groups);

  const placed = FIELDS.flatMap((field) => {
    const column = columns[field];
    if (column === null) return [];
    if (field === "fullName") return [t("fullNameColumn", { letter: columnLetter(column), order: t(`order.${mapping.nameOrder}`) })];
    return [t("column", { field: tColumns(field), letter: columnLetter(column) })];
  });
  const unknown: string[] = [];
  const roles = mapping.roles.flatMap(({ text, role }) => {
    const read = (role as Role | null) ?? readRole(text);
    if (!read) unknown.push(`“${text}”`);
    return read ? [`“${text}” → ${tRoles(read)}`] : [];
  });
  const matched = mapping.groups.flatMap(({ text, groupId }) => {
    const group = groups.find((candidate) => candidate.id === (groupId ?? readGroup(text)));
    if (!group) unknown.push(`“${text}”`);
    return group ? [`“${text}” → ${groupLabel(group)}`] : [];
  });

  return (
    <section data-testid="import-ai-summary" aria-labelledby="import-ai-title" className="space-y-2 rounded-2xl border border-primary/30 bg-primary/5 p-3 text-sm sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 id="import-ai-title" className="flex items-center gap-2 font-semibold">
          <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          {t("title")}
        </h3>
        <Button type="button" variant="ghost" size="sm" className="shrink-0 rounded-full" onClick={onUndo}>
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          {t("undo")}
        </Button>
      </div>
      <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
        <li>{mapping.headerRow > 0 ? t("titleLine", { line: mapping.headerRow }) : t("noTitle")}</li>
        {placed.length > 0 && <li>{placed.join(" · ")}</li>}
        {roles.length > 0 && <li>{t("roles", { list: roles.join(", ") })}</li>}
        {matched.length > 0 && <li>{t("groups", { list: matched.join(", ") })}</li>}
        {unknown.length > 0 && <li>{t("unknown", { list: unknown.join(", ") })}</li>}
        {columns.fullName !== null && <li>{t("checkNames")}</li>}
      </ul>
      <p className="text-xs text-muted-foreground">{t("model", { model })}</p>
    </section>
  );
}
