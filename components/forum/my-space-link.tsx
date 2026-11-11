"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { bff } from "@/lib/forum/bff";
import { Z } from "@/lib/forum/space-strings";
import { btn } from "@/lib/forum/ui";
import { SeatIcon } from "./icons";

/** Bouton « My space » avec le nombre de notifications non lues. */
export function MySpaceLink() {
  const base = usePathname().replace(/\/$/, "");
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let off = false;
    const load = () =>
      bff<{ unread: number }>("/posts/notifications")
        .then((r) => !off && setUnread(r.unread ?? 0))
        .catch(() => undefined); // pas connecté ou hors ligne : pas de pastille
    load();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 30000);
    return () => {
      off = true;
      clearInterval(t);
    };
  }, []);

  return (
    <Link href={`${base}/my`} className={btn}>
      <SeatIcon className="size-4" />
      {Z.title}
      {unread > 0 && <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">{unread}</span>}
    </Link>
  );
}
