"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SubmitButton } from "@/components/auth/submit-button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InlineFeedback } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useErrorFormatter, useValidationMessages } from "@/lib/i18n/client";
import { ROLES, type Group, type Role, type User } from "@/lib/types";
import { groupLabel, type UserInput, type UserRow } from "@/lib/users/directory";
import { saveUser } from "@/lib/users/mutations";
import { formText, hasErrors, isValidEmail, MIN_PASSWORD_LENGTH, summarize, type ValidationErrors } from "@/lib/validation";

export type SaveOutcome = { status: "sent"; user: User } | { status: "queued" };

/**
 * "Add user" / "Edit" dialog. Checked in the browser, then saved through the outbox: sent now when online,
 * kept on the device when offline. `draft` pre-fills the form with a change the server refused.
 */
export function UserDialog({
  open,
  onOpenChange,
  editing,
  draft,
  groups,
  onSaved,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: UserRow | null;
  draft: UserInput | null;
  groups: Group[];
  onSaved: (outcome: SaveOutcome, input: UserInput, editing: UserRow | null) => void;
}>) {
  const t = useTranslations("admin.users");
  const tRoles = useTranslations("common.roles");
  const translate = useValidationMessages();
  const errors = useErrorFormatter();
  const initial = {
    firstname: draft?.firstname ?? editing?.firstname ?? "",
    lastname: draft?.lastname ?? editing?.lastname ?? "",
    email: draft?.email ?? editing?.email ?? "",
    role: draft?.role ?? editing?.role ?? "STUDENT",
    group: (draft ? draft.group : editing?.group?.id) ?? "",
  };
  const [role, setRole] = useState<Role>(initial.role);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ text: string; at: number } | null>(null);
  const [pending, setPending] = useState(false);
  const name = editing ? `${editing.firstname} ${editing.lastname}` : "";
  // A password is required to create an account, unless it was already given to the creation waiting offline.
  const passwordRequired = !editing;

  const fail = (fields: Record<string, string>, text: string) => {
    setFieldErrors(fields);
    setMessage({ text, at: Date.now() });
  };

  const submit = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const input: UserInput = {
      firstname: formText(data, "firstname").trim(),
      lastname: formText(data, "lastname").trim(),
      email: formText(data, "email").trim(),
      role,
      group: role === "STUDENT" ? formText(data, "group") || null : null,
      password: formText(data, "password"),
    };

    const keys: ValidationErrors = {};
    if (!input.firstname) keys.firstname = "firstnameRequired";
    if (!input.lastname) keys.lastname = "lastnameRequired";
    if (!input.email) keys.email = "emailRequired";
    else if (!isValidEmail(input.email)) keys.email = "emailInvalid";
    if (!ROLES.includes(input.role)) keys.role = "invalidValue";
    if ((passwordRequired || input.password) && (input.password ?? "").length < MIN_PASSWORD_LENGTH) keys.password = "passwordTooShort";
    const local = translate(keys);
    if (hasErrors(local)) {
      fail(local, summarize(local));
      return;
    }

    setPending(true);
    const result = await saveUser(input, editing);
    setPending(false);
    if (result.status === "failed") {
      const fields = errors.fieldErrors(result.error);
      if (result.error.code === "EMAIL_TAKEN") fields.email = errors.message(result.error);
      fail(fields, errors.message(result.error));
      return;
    }
    onSaved(result.status === "sent" ? { status: "sent", user: result.data } : { status: "queued" }, input, editing);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? t("editTitle", { name }) : t("addTitle")}</DialogTitle>
          <DialogDescription>{t("subtitle")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="user-firstname" label={t("form.firstname")} error={fieldErrors.firstname}>
              {(props) => <Input {...props} name="firstname" defaultValue={initial.firstname} required />}
            </Field>
            <Field id="user-lastname" label={t("form.lastname")} error={fieldErrors.lastname}>
              {(props) => <Input {...props} name="lastname" defaultValue={initial.lastname} required />}
            </Field>
          </div>
          <Field id="user-email" label={t("form.email")} error={fieldErrors.email}>
            {(props) => <Input {...props} type="email" name="email" autoComplete="off" defaultValue={initial.email} required />}
          </Field>
          <Field
            id="user-password"
            label={t("form.password")}
            hint={passwordRequired ? t("form.passwordHint", { min: MIN_PASSWORD_LENGTH }) : t("form.passwordEditHint")}
            error={fieldErrors.password}
          >
            {(props) => <Input {...props} type="password" name="password" autoComplete="new-password" required={passwordRequired} />}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="user-role" label={t("form.role")} error={fieldErrors.role}>
              {(props) => (
                <Select {...props} name="role" value={role} onChange={(event) => setRole(event.target.value as Role)}>
                  {ROLES.map((value) => (
                    <option key={value} value={value}>
                      {tRoles(value)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field id="user-group" label={t("form.group")} hint={role === "STUDENT" ? undefined : t("form.groupHint")} error={fieldErrors.group}>
              {(props) => (
                <Select {...props} name="group" defaultValue={initial.group} disabled={role !== "STUDENT"}>
                  <option value="">{t("form.noGroup")}</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {groupLabel(group)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <InlineFeedback feedback={message ? { type: "error", message: message.text, at: message.at } : null} />
          <div className="flex justify-end">
            <SubmitButton pending={pending} className="h-10 w-auto rounded-full px-6 shadow-none">
              {t("form.save")}
            </SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
