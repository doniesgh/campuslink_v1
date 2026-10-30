// "Install CampusLink": keeps the browser's install prompt (beforeinstallprompt, Chromium) for the page that
// offers it. Imported by the root layout's service worker registrar, so the event is caught even when it fires
// before any page asks for it. Browser only.
import { useSyncExternalStore } from "react";

type InstallOutcome = "accepted" | "dismissed" | "unavailable";

type BeforeInstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type InstallState = {
  /** The browser offers to install the app now (Chromium: Chrome, Edge, Samsung Internet...). */
  canInstall: boolean;
  /** Running as the installed app (standalone window), or installed in this session. */
  installed: boolean;
  /** iOS/iPadOS Safari: no prompt, the app is added from the Share menu. */
  iosHint: boolean;
};

const SERVER_STATE: InstallState = { canInstall: false, installed: false, iosHint: false };

let deferred: BeforeInstallPromptEvent | null = null;
let installedNow = false;
let state: InstallState = SERVER_STATE;
const listeners = new Set<() => void>();

function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

function update(): void {
  const installed = installedNow || isStandalone();
  const next: InstallState = { canInstall: !installed && deferred !== null, installed, iosHint: !installed && isIos() };
  if (next.canInstall === state.canInstall && next.installed === state.installed && next.iosHint === state.iosHint) return;
  state = next;
  for (const listener of listeners) listener();
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    // Keep it for our own button instead of the browser's mini-infobar.
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    update();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installedNow = true;
    update();
  });
  window.matchMedia?.("(display-mode: standalone)").addEventListener?.("change", update);
  update();
}

/** Shows the browser's install dialog (once per prompt event). */
export async function promptInstall(): Promise<InstallOutcome> {
  const event = deferred;
  if (!event) return "unavailable";
  deferred = null;
  update();
  await event.prompt();
  const { outcome } = await event.userChoice;
  if (outcome === "accepted") installedNow = true;
  update();
  return outcome;
}

export function useInstallState(): InstallState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => SERVER_STATE
  );
}
