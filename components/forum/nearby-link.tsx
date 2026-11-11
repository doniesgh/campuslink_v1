
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { N } from "@/lib/forum/nearby-strings";
import { PinIcon } from "./icons";

export function NearbyLink() {
  const pathname = usePathname();
  const base = pathname.replace(/\/$/, "");

  return (
    <Link
      href={`${base}/nearby`}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-input bg-background px-4 text-sm font-medium text-foreground transition-colors"
    >
      <PinIcon className="size-4" />
      {N.nearbyLink}
    </Link>
  );
}
