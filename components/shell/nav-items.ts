import type { Role } from "@/lib/types";
import { Megaphone } from "lucide-react";
/** Keys of `common.nav.*` messages. */
export type NavLabelKey =
    | "home"
    | "notifications"
    | "forum"
    | "account"
    | "users"
    | "audit"
    | "announcements";

export type NavIconName = NavLabelKey;

export type NavItem = {
  key: NavLabelKey;
  href: string;
  icon: NavIconName;
};

export type NavGroup = {
  labelKey: "administration";
  items: NavItem[];
};

/** Links every signed-in user sees. */
export const MAIN_NAV: NavItem[] = [
  { key: "home", href: "/dashboard", icon: "home" },
  { key: "notifications", href: "/dashboard/notifications", icon: "notifications" },
  { key: "forum", href: "/dashboard/forum", icon: "forum" },
  { key: "account", href: "/dashboard/account", icon: "account" },
  { key: "announcements", href: "/dashboard/announcements", icon: "announcements" },
];

const item = (key: NavLabelKey, href: string): NavItem => ({
  key,
  href,
  icon: key,
});

const ADMIN_NAV: NavItem[] = [
  item("users", "/dashboard/admin/users"),
  item("audit", "/dashboard/admin/audit"),
];

export function navGroups(role: Role | undefined): NavGroup[] {
  return role === "ADMIN"
      ? [{ labelKey: "administration", items: ADMIN_NAV }]
      : [];
}

export function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}