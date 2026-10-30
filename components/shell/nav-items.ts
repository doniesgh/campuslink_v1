import type { Role } from "@/lib/types";

/** Keys of `common.nav.*` messages. */
export type NavLabelKey = "home" | "notifications" | "forum" | "account" | "users" | "audit";

export type NavIconName = NavLabelKey;

export type NavItem = { key: NavLabelKey; href: string; icon: NavIconName };
export type NavGroup = { labelKey: "administration"; items: NavItem[] };

/** Links every signed-in user sees (also the mobile bottom navigation). */
export const MAIN_NAV: NavItem[] = [
  { key: "home", href: "/dashboard", icon: "home" },
  { key: "notifications", href: "/dashboard/notifications", icon: "notifications" },
  { key: "forum", href: "/dashboard/forum", icon: "forum" },
  { key: "account", href: "/dashboard/account", icon: "account" },
];

const item = (key: NavLabelKey, href: string): NavItem => ({ key, href, icon: key });

const ADMIN_NAV: NavItem[] = [item("users", "/dashboard/admin/users"), item("audit", "/dashboard/admin/audit")];

/** Sidebar groups shown under the main links, in order: "Administration" for ADMIN. */
export function navGroups(role: Role | undefined): NavGroup[] {
  return role === "ADMIN" ? [{ labelKey: "administration", items: ADMIN_NAV }] : [];
}

/** "/dashboard" is only active on itself; other links also on their sub-pages. */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}
