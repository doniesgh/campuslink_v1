"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { S } from "@/lib/forum/strings";
import { PlusIcon } from "./icons";

/** Bouton rond flottant en bas de l'écran : s'élargit pour afficher son libellé au survol ou au focus. */
export function AddPostButton() {
  const base = usePathname().replace(/\/$/, "");
  return (
    <Link
      href={`${base}/new`}
      aria-label={S.newPost}
      className="group fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-6 z-30 flex h-14 min-w-14 items-center justify-center rounded-full bg-primary px-4 text-primary-foreground shadow-lg shadow-primary/30 transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
    >
      <PlusIcon className="size-6 shrink-0" />
      <span className="hidden max-w-0 overflow-hidden whitespace-nowrap text-sm font-medium opacity-0 motion-safe:transition-all sm:block group-hover:ml-2 group-hover:max-w-32 group-hover:opacity-100 group-focus-visible:ml-2 group-focus-visible:max-w-32 group-focus-visible:opacity-100">
        {S.newPost}
      </span>
    </Link>
  );
}
