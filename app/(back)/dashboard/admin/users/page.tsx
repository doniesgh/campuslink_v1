import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { InlineFeedback } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/dal";
import { getErrorFormatter } from "@/lib/i18n/server";
import { serverSnapshot } from "@/lib/server-api";
import { ROLES, type Group, type Role } from "@/lib/types";
import { DIRECTORY_PATH, GROUPS_PATH, type Directory } from "@/lib/users/directory";
import { UsersManager } from "./users-manager";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.users");
  return { title: t("metaTitle") };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

/**
 * Users (ADMIN). The whole directory is rendered on the server for the first paint, then kept on the device
 * (IndexedDB) by the Client Component: search, filters, paging and CSV export run locally, online or offline,
 * and changes go through the offline outbox. The service worker saves this page for offline reloads.
 */
export default async function AdminUsersPage({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
  const [{ user, error }, t] = await Promise.all([requireRole(["ADMIN"], "/dashboard/admin/users"), getTranslations("admin.users")]);

  if (!user) {
    const errors = await getErrorFormatter();
    return (
      <div className="container space-y-6 py-6 sm:py-10">
        <PageHeader title={t("title")} />
        <InlineFeedback feedback={{ type: "error", message: errors.message(error) }} />
      </div>
    );
  }

  const params = await searchParams;
  const roleParam = first(params.role).toUpperCase();
  const filters = {
    q: first(params.q).trim().slice(0, 100),
    role: ROLES.includes(roleParam as Role) ? (roleParam as Role) : ("" as const),
    page: Math.max(1, Number.parseInt(first(params.page), 10) || 1),
  };

  const [directory, groups] = await Promise.all([
    serverSnapshot<Directory | null>(DIRECTORY_PATH, null),
    serverSnapshot<Group[] | null>(GROUPS_PATH, null),
  ]);

  return (
    <div className="container space-y-6 py-6 sm:py-10">
      <UsersManager initialDirectory={directory} initialGroups={groups} currentUserId={user.id} initialFilters={filters} />
    </div>
  );
}
