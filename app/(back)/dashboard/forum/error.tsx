"use client";

import { S } from "@/lib/forum/strings";
import { btn } from "@/lib/forum/ui";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-8 text-center">
      <p className="font-medium text-destructive">{S.loadError}</p>
      <button onClick={reset} className={`${btn} mt-4`}>{S.retry}</button>
    </div>
  );
}
