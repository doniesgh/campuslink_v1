import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Props to spread on the control so its label, hint and error are announced with it. */
export type FieldChildProps = {
  id: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

type FieldProps = {
  id: string;
  label: React.ReactNode;
  /** Help text under the control. */
  hint?: React.ReactNode;
  /** Inline error, shown under the hint. */
  error?: string | null;
  className?: string;
  children: (props: FieldChildProps) => React.ReactNode;
};

/**
 * Label + control + hint + error, wired together (htmlFor, aria-describedby, aria-invalid).
 *
 *   <Field id="email" label="Email" hint="..." error={errors.email}>
 *     {(props) => <Input {...props} type="email" name="email" />}
 *   </Field>
 */
export function Field({ id, label, hint, error, className, children }: Readonly<FieldProps>) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
