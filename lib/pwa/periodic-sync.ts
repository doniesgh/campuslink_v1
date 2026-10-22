// Periodic Background Sync (Chromium, installed app with enough engagement): the service worker refreshes saved
// data while no page is open (public/sw.js, "periodicsync"). Browser only; never throws.

export type PeriodicSyncState = "on" | "unsupported" | "denied";

type PeriodicSyncManager = {
  register(tag: string, options: { minInterval: number }): Promise<void>;
  unregister(tag: string): Promise<void>;
  getTags(): Promise<string[]>;
};

async function manager(): Promise<PeriodicSyncManager | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    return (registration as (ServiceWorkerRegistration & { periodicSync?: PeriodicSyncManager }) | undefined)?.periodicSync ?? null;
  } catch {
    return null;
  }
}

/** Registers `tag` (at most every `minIntervalMs`): "on", or why it can't ("unsupported", "denied"). */
export async function enablePeriodicSync(tag: string, minIntervalMs: number): Promise<PeriodicSyncState> {
  const periodicSync = await manager();
  if (!periodicSync) return "unsupported";
  try {
    const permission = await navigator.permissions.query({ name: "periodic-background-sync" as PermissionName });
    if (permission.state !== "granted") return "denied";
    await periodicSync.register(tag, { minInterval: minIntervalMs });
    return "on";
  } catch {
    return "denied";
  }
}

export async function disablePeriodicSync(tag: string): Promise<void> {
  const periodicSync = await manager();
  await periodicSync?.unregister(tag).catch(() => undefined);
}

/** Unregisters every CampusLink periodic sync (logout: nothing refreshes data for an ended session). */
export async function disableAllPeriodicSyncs(): Promise<void> {
  const periodicSync = await manager();
  if (!periodicSync) return;
  try {
    const tags = await periodicSync.getTags();
    await Promise.all(tags.filter((tag) => tag.startsWith("campuslink-")).map((tag) => periodicSync.unregister(tag)));
  } catch {
    // best effort
  }
}
