"use client";

import { useEffect, useState } from "react";
import { BellRing, Download, HardDrive, MonitorSmartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Feedback } from "@/components/ui/feedback";
import { Switch } from "@/components/ui/switch";
import { useOnlineStatus } from "@/lib/offline/status";
import { disablePush, enablePush, getPushState, PushSetupError, type PushState } from "@/lib/offline/push";
import { promptInstall, useInstallState } from "@/lib/pwa/install";

const PUSH_ERRORS = {
  unsupported: "push.unsupported",
  "no-service-worker": "push.noServiceWorker",
  denied: "push.denied",
  failed: "push.failed",
} as const;

/** Why push can't be turned on here, or null. */
function pushProblem(vapidPublicKey: string | null, state: PushState | null) {
  if (!vapidPublicKey) return "push.unavailable" as const;
  if (state === "unsupported" || state === "no-service-worker" || state === "denied") return PUSH_ERRORS[state];
  return null;
}

/**
 * "This device": push notifications of this browser (Web Push), installing the app (beforeinstallprompt) and
 * what stays available offline. Outcomes are reported through the page's single feedback (`onFeedback`).
 */
export function DeviceSettings({
  vapidPublicKey,
  onFeedback,
}: Readonly<{ vapidPublicKey: string | null; onFeedback: (feedback: Feedback | null) => void }>) {
  const t = useTranslations("account");
  const online = useOnlineStatus();
  const install = useInstallState();
  const [push, setPush] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getPushState().then((state) => {
      if (!cancelled) setPush(state);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const subscribed = push === "subscribed";
  const problem = pushProblem(vapidPublicKey, push);

  const togglePush = async (enabled: boolean) => {
    setBusy(true);
    try {
      if (enabled && vapidPublicKey) {
        await enablePush(vapidPublicKey);
        setPush("subscribed");
        onFeedback({ type: "success", message: t("push.enabled") });
      } else {
        await disablePush();
        setPush("unsubscribed");
        onFeedback({ type: "success", message: t("push.disabled") });
      }
    } catch (error) {
      const reason = error instanceof PushSetupError ? error.reason : "failed";
      if (reason === "denied" || reason === "unsupported" || reason === "no-service-worker") setPush(reason);
      onFeedback({ type: "error", message: t(PUSH_ERRORS[reason]) });
    } finally {
      setBusy(false);
    }
  };

  const installApp = async () => {
    const outcome = await promptInstall();
    if (outcome === "accepted") onFeedback({ type: "success", message: t("device.installed") });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("device.title")}</CardTitle>
        <CardDescription>{t("device.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-4 rounded-2xl bg-muted p-4">
          <div className="flex gap-3">
            <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <label htmlFor="push-notifications" className="cursor-pointer font-medium">
                {t("push.title")}
              </label>
              <p id="push-description" className="mt-1 text-sm text-muted-foreground">
                {problem ? t(problem) : online ? t("push.description") : `${t("push.description")} ${t("offline.needsConnection")}`}
              </p>
            </div>
          </div>
          <Switch
            id="push-notifications"
            checked={subscribed}
            onCheckedChange={(checked) => void togglePush(checked)}
            disabled={busy || push === null || !online || (!subscribed && !!problem)}
            aria-describedby="push-description"
          />
        </div>

        <div className="flex items-start gap-3 rounded-2xl bg-muted p-4">
          <MonitorSmartphone className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="space-y-2" data-testid="install-app">
            {install.installed ? (
              <p className="font-medium">{t("device.installed")}</p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">{t("device.installDescription")}</p>
                {install.canInstall && (
                  <Button className="rounded-full" onClick={() => void installApp()}>
                    <Download className="h-4 w-4" aria-hidden="true" />
                    {t("device.install")}
                  </Button>
                )}
                {!install.canInstall && <p className="text-sm text-muted-foreground">{install.iosHint ? t("device.installIos") : t("device.installMenu")}</p>}
              </>
            )}
          </div>
        </div>

        <p className="flex items-start gap-3 px-1 text-sm text-muted-foreground">
          <HardDrive className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {t("device.offline")}
        </p>
      </CardContent>
    </Card>
  );
}
