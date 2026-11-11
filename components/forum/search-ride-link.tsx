"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Z } from "@/lib/forum/space-strings";
import { btn } from "@/lib/forum/ui";
import { SearchIcon } from "./icons";

/** Bouton vers /forum/search (« Je cherche un covoiturage »). */
export function SearchRideLink() {
  const base = usePathname().replace(/\/$/, "");
  return (
    <Link href={`${base}/search`} className={btn}>
      <SearchIcon className="size-4" />
      {Z.lookForRide}
    </Link>
  );
}
