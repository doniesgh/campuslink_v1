"use client";

import { useEffect } from "react";
import { usePendingCount } from "@/lib/offline/status";
import { clearAppBadge, setAppBadge } from "@/lib/pwa/badge";

/**
 * Badge of the installed app's icon: the unread notifications count, or a dot when only changes are waiting
 * to sync. The service worker also sets it from pushes while no page is open (public/sw.js).
 */
export function AppBadge({ unread }: Readonly<{ unread: number }>) {
  const pending = usePendingCount();

  useEffect(() => {
    if (unread > 0) void setAppBadge(unread);
    else if (pending > 0) void setAppBadge();
    else void clearAppBadge();
  }, [unread, pending]);

  return null;
}
