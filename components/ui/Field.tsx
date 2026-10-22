import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

export const controlClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

type FieldChildProps = {
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

interface FieldProps {
  id?: string;
  label: string;
  className?: string;
  error?: string;
  children: ReactNode | ((props: FieldChildProps) => ReactNode);
}

export function Field({
  id,
  label,
  className = "",
  error,
  children,
}: FieldProps) {
  const childProps: FieldChildProps = {
    id,
    "aria-invalid": Boolean(error),
    "aria-describedby": error && id ? `${id}-error` : undefined,
  };

  return (
    <div className={`grid gap-1.5 ${className}`}>
      <label
        htmlFor={id}
        className="text-xs font-semibold text-slate-600 dark:text-slate-300"
      >
        {label}
      </label>

      {typeof children === "function" ? children(childProps) : children}

      {error && (
        <p
          id={id ? `${id}-error` : undefined}
          className="text-sm text-red-600"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export const Input = ({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) => (
  <input className={`${controlClass} ${className}`} {...props} />
);

export const Textarea = ({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea className={`${controlClass} ${className}`} {...props} />
);

export const Select = ({
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select className={`${controlClass} ${className}`} {...props} />
);