// import { NextIntlClientProvider } from "next-intl";
// import { getMessages } from "next-intl/server";
// import type { Namespace } from "@/i18n/config";

// /** Used by Client Components on every page: shell, language switcher, error texts (common), connectivity banner (offline). */
// const BASE_NAMESPACES: readonly Namespace[] = ["common", "offline"];

// /** Client namespaces of the /dashboard pages (admin pages add "admin", see dashboard/admin/layout.tsx). */
// export const DASHBOARD_NAMESPACES: readonly Namespace[] = ["dashboard", "account","forum","timetable"];


// export async function ClientMessages({
//   namespaces = [],
//   children,
// }: Readonly<{ namespaces?: readonly Namespace[]; children: React.ReactNode }>) {
//   const messages = await getMessages();
//   const picked = Object.fromEntries([...new Set([...BASE_NAMESPACES, ...namespaces])].map((namespace) => [namespace, messages[namespace]]));
//   return <NextIntlClientProvider messages={picked}>{children}</NextIntlClientProvider>;
// }
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import type { Namespace } from "@/i18n/config";

const BASE_NAMESPACES: readonly Namespace[] = ["common", "offline"];
export const DASHBOARD_NAMESPACES: readonly Namespace[] = ["dashboard", "account", "notifications", "timetable", "announcements"];
export async function ClientMessages({
  namespaces = [],
  children,
}: Readonly<{ namespaces?: readonly Namespace[]; children: React.ReactNode }>) {
  const messages = await getMessages();
  const picked = Object.fromEntries([...new Set([...BASE_NAMESPACES, ...namespaces])].map((namespace) => [namespace, messages[namespace]]));
  return <NextIntlClientProvider messages={picked}>{children}</NextIntlClientProvider>;
}
