"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { S } from "@/lib/forum/strings";
import { Z } from "@/lib/forum/space-strings";
import { ArrowLeftIcon, IconCircle, SeatIcon } from "./icons";
import { SpaceNotifications } from "./space-notifications";
import { RequestsTab } from "./space-requests";
import { SpaceSearches } from "./space-searches";

type Tab = "sent" | "received" | "searches" | "notifications";
const TABS: Tab[] = ["sent", "received", "searches", "notifications"];

/** Mon espace : demandes envoyées, demandes reçues, recherches de covoiturage et notifications. */
export function MySpace() {
  const basePath = usePathname().replace(/\/[^/]+\/?$/, ""); // /dashboard/forum/my -> /dashboard/forum
  const [tab, setTab] = useState<Tab>("sent");

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href={basePath} className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
        <IconCircle tone="primary" size="sm"><ArrowLeftIcon /></IconCircle>
        {S.back}
      </Link>

      <header className="flex flex-col items-center text-center">
        <IconCircle tone="brand" size="lg" className="size-14 ring-4 ring-primary/15 [&>svg]:size-7"><SeatIcon /></IconCircle>
        <h1 className="mt-3 text-2xl font-semibold">{Z.title}</h1>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{Z.subtitle}</p>
      </header>

      <div role="tablist" aria-label={Z.title} className="flex flex-wrap justify-center gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={`tab-${t}`}
            aria-selected={tab === t}
            aria-controls={`panel-${t}`}
            onClick={() => setTab(t)}
            className={`inline-flex h-10 items-center rounded-full border px-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              tab === t ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-accent"
            }`}
          >
            {Z.tabs[t]}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "sent" && <RequestsTab mode="sent" basePath={basePath} />}
        {tab === "received" && <RequestsTab mode="received" basePath={basePath} />}
        {tab === "searches" && <SpaceSearches basePath={basePath} />}
        {tab === "notifications" && <SpaceNotifications basePath={basePath} />}
      </div>
    </div>
  );
}
