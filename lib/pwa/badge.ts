// Badge of the installed app's icon (Badging API: Chromium desktop, Safari 17+ for web apps). Never throws.

type BadgingNavigator = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

const badging = (): BadgingNavigator | null =>
  typeof navigator !== "undefined" && "setAppBadge" in navigator ? (navigator as BadgingNavigator) : null;

/** A number, or a plain dot without `count`. */
export async function setAppBadge(count?: number): Promise<void> {
  await badging()?.setAppBadge?.(count).catch(() => undefined);
}

export async function clearAppBadge(): Promise<void> {
  await badging()?.clearAppBadge?.().catch(() => undefined);
}
