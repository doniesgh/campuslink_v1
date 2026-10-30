"use client";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CloudOff, CloudUpload } from "lucide-react";
import { useTranslations } from "next-intl";
import { SubmitButton } from "@/components/auth/submit-button";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { InlineFeedback, type Feedback } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { PasswordInput } from "@/components/auth/password-input";
import { useErrorFormatter, useValidationMessages } from "@/lib/i18n/client";
import { queueMutation, removeOutboxRecord, useOnlineStatus, useOutbox } from "@/lib/offline";
import { resyncPushSubscription } from "@/lib/offline/push";
import type { ActionState } from "@/lib/server-api";
import type { Role } from "@/lib/types";
import { formText, hasErrors, summarize, validateChangePassword, validateProfile } from "@/lib/validation";
import { changePasswordAction, setTwoFactorAction } from "./actions";
import { DeviceSettings } from "./device-settings";

type Section = "profile" | "language" | "security" | "password" | "device";
type SectionFeedback = (Feedback & { section: Section }) | null;

export type AccountUser = {
  firstname: string;
  lastname: string;
  email: string;
  role: Role;
  twoFactorEnabled: boolean;
  group: string | null;
};

/** Outbox scope and key of the profile change ("last write wins": one waiting profile change at most). */
const ACCOUNT_SCOPE = "account";
const PROFILE_KEY = "PATCH /users/me#profile";

const initialState: ActionState = {};

function NeedsConnection() {
  const t = useTranslations("account.offline");
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <CloudOff className="h-4 w-4" aria-hidden="true" />
      {t("needsConnection")}
    </p>
  );
}

/** Account page: Profile (works offline), Language, Security (2FA + password), This device (push, install, offline). */
export function AccountView({ user, vapidPublicKey }: { user: AccountUser; vapidPublicKey: string | null }) {
  const t = useTranslations("account");
  const tRoles = useTranslations("common.roles");
  const translate = useValidationMessages();
  const errors = useErrorFormatter();
  const router = useRouter();
  const online = useOnlineStatus();

  // One message at a time on the page (status or alert), shown in the section it belongs to.
  const [feedback, setFeedbackState] = useState<SectionFeedback>(null);
  const [languageSaved, setLanguageSaved] = useState(false);
  const show = (section: Section, value: Feedback | null) => {
    setLanguageSaved(false);
    setFeedbackState(value ? { ...value, section, at: Date.now() } : null);
  };
  const feedbackFor = (section: Section) => (feedback?.section === section ? feedback : null);

  // --- Profile: PATCH /users/me through the outbox (queued offline, sent when back online) ---
  const records = useOutbox(ACCOUNT_SCOPE);
  const waiting = records.find((record) => record.id.endsWith(`|${PROFILE_KEY}`));
  const waitingValues = waiting?.body as { firstname?: string; lastname?: string } | undefined;
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [profilePending, setProfilePending] = useState(false);

  // Once the waiting change is gone (sent by this page or by the service worker's Background Sync, or discarded),
  // render the page again with the server's values.
  const waitingId = waiting?.id ?? null;
  const previousWaiting = useRef<string | null>(null);
  useEffect(() => {
    if (previousWaiting.current && !waitingId) router.refresh();
    previousWaiting.current = waitingId;
  }, [waitingId, router]);

  const submitProfile = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const values = { firstname: formText(data, "firstname").trim(), lastname: formText(data, "lastname").trim() };
    const invalid = translate(validateProfile(values));
    if (hasErrors(invalid)) {
      setProfileErrors(invalid);
      show("profile", { type: "error", message: summarize(invalid) });
      return;
    }

    setProfilePending(true);
    const result = await queueMutation({
      method: "PATCH",
      path: "/users/me",
      body: values,
      key: PROFILE_KEY,
      scope: ACCOUNT_SCOPE,
      info: { kind: "profile" },
      keepRejected: true,
    });
    setProfilePending(false);
    if (result.status === "failed") {
      setProfileErrors(errors.fieldErrors(result.error));
      show("profile", { type: "error", message: errors.message(result.error) });
      return;
    }
    setProfileErrors({});
    if (result.status === "sent") {
      show("profile", { type: "success", message: t("profile.saved") });
      router.refresh();
    } else {
      show("profile", { type: "info", message: t("offline.queued") });
    }
  };

  // --- Two-step verification (needs the server: never queued) ---
  const [twoFactor, setTwoFactor] = useState(user.twoFactorEnabled);
  const [twoFactorPending, startTwoFactor] = useTransition();
  const toggleTwoFactor = (enabled: boolean) => {
    const previous = twoFactor;
    setTwoFactor(enabled);
    startTwoFactor(async () => {
      const result = await setTwoFactorAction(enabled);
      if (!result.ok) setTwoFactor(previous);
      else if (result.data) setTwoFactor(result.data.enabled);
      show("security", result.message ? { type: result.ok ? "success" : "error", message: result.message } : null);
    });
  };

  // --- Password (needs the server: never queued, never stored on the device) ---
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [passwordFormKey, setPasswordFormKey] = useState(0);
  const [, passwordAction, passwordPending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await changePasswordAction(prev, formData);
    setPasswordErrors(result.fieldErrors ?? {});
    if (result.ok) {
      setPasswordFormKey((key) => key + 1);
      // The backend dropped this user's push subscriptions with the old sessions: the new session takes this
      // browser's subscription back, so notifications keep arriving and the push toggle stays truthful.
      void resyncPushSubscription();
    }
    show("password", result.message ? { type: result.ok ? "success" : "error", message: result.message } : null);
    return result;
  }, initialState);

  const validatePasswordForm = (event: React.SubmitEvent<HTMLFormElement>) => {
    const data = new FormData(event.currentTarget);
    const invalid = translate(
      validateChangePassword({
        currentPassword: formText(data, "currentPassword"),
        newPassword: formText(data, "newPassword"),
        confirmPassword: formText(data, "confirmPassword"),
      })
    );
    if (hasErrors(invalid)) {
      event.preventDefault();
      setPasswordErrors(invalid);
      show("password", { type: "error", message: summarize(invalid) });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("profile.title")}</CardTitle>
          <CardDescription>
            {user.email} · {tRoles(user.role)}
            {user.role === "STUDENT" && ` · ${t("profile.groupValue", { group: user.group ?? t("profile.noGroup") })}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Re-mounted when a waiting change appears or goes: the fields show the values that will be saved. */}
          <form key={waiting?.createdAt ?? "saved"} onSubmit={submitProfile} className="space-y-5" noValidate>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="profile-firstname" label={t("profile.firstname")} error={profileErrors.firstname}>
                {(props) => <Input {...props} name="firstname" autoComplete="given-name" defaultValue={waitingValues?.firstname ?? user.firstname} required />}
              </Field>
              <Field id="profile-lastname" label={t("profile.lastname")} error={profileErrors.lastname}>
                {(props) => <Input {...props} name="lastname" autoComplete="family-name" defaultValue={waitingValues?.lastname ?? user.lastname} required />}
              </Field>
            </div>
            {waiting && !waiting.rejected && (
              <p data-testid="profile-waiting" className="flex items-center gap-2 text-sm text-muted-foreground">
                <CloudUpload className="h-4 w-4 text-highlight" aria-hidden="true" />
                {t("offline.pending")}
              </p>
            )}
            {waiting?.rejected && (
              <div className="flex flex-wrap items-center gap-2 text-sm text-destructive">
                <span>{t("offline.rejected", { reason: errors.message(waiting.rejected) })}</span>
                <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={() => void removeOutboxRecord(waiting.id)}>
                  {t("offline.discard")}
                </Button>
              </div>
            )}
            <InlineFeedback feedback={feedbackFor("profile")} />
            <SubmitButton pending={profilePending} className="h-10 w-auto rounded-full px-6 shadow-none">
              {t("profile.save")}
            </SubmitButton>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("language.title")}</CardTitle>
          <CardDescription>{t("language.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <LanguageSwitcher
            className="flex-col items-start gap-2"
            selectClassName="h-10 w-56 rounded-xl"
            onChanged={() => {
              show("language", null);
              setLanguageSaved(true);
            }}
          />
          {!online && <NeedsConnection />}
          {/* Computed at render time so it shows in the newly selected language. */}
          <InlineFeedback feedback={languageSaved ? { type: "success", message: t("language.saved") } : null} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("security.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4 rounded-2xl bg-muted p-4">
              <div>
                <label htmlFor="two-factor" className="cursor-pointer font-medium">
                  {t("security.twoFactor")}
                </label>
                <p id="two-factor-description" className="mt-1 text-sm text-muted-foreground">
                  {t("security.twoFactorDescription")}
                </p>
              </div>
              <Switch
                id="two-factor"
                checked={twoFactor}
                onCheckedChange={toggleTwoFactor}
                disabled={twoFactorPending || !online}
                aria-describedby="two-factor-description"
              />
            </div>
            {!online && <NeedsConnection />}
            <InlineFeedback feedback={feedbackFor("security")} />
          </div>

          <form
            key={passwordFormKey}
            action={passwordAction}
            onSubmit={validatePasswordForm}
            className="space-y-5"
            noValidate
          >
            <h3 className="font-semibold">{t("security.passwordTitle")}</h3>
            <Field id="currentPassword" label={t("security.currentPassword")} error={passwordErrors.currentPassword}>
              {(props) => <PasswordInput {...props} name="currentPassword" autoComplete="current-password" required />}
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="newPassword" label={t("security.newPassword")} error={passwordErrors.newPassword}>
                {(props) => <PasswordInput {...props} name="newPassword" autoComplete="new-password" required />}
              </Field>
              <Field id="confirmPassword" label={t("security.confirmPassword")} error={passwordErrors.confirmPassword}>
                {(props) => <PasswordInput {...props} name="confirmPassword" autoComplete="new-password" required />}
              </Field>
            </div>
            <InlineFeedback feedback={feedbackFor("password")} />
            {!online && <NeedsConnection />}
            <SubmitButton pending={passwordPending} disabled={!online} className="h-10 w-auto rounded-full px-6 shadow-none">
              {t("security.changePassword")}
            </SubmitButton>
          </form>
        </CardContent>
      </Card>

      <DeviceSettings vapidPublicKey={vapidPublicKey} onFeedback={(value) => show("device", value)} />
      <InlineFeedback feedback={feedbackFor("device")} />
    </div>
  );
}
