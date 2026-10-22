import * as React from "react";

const variants = {
    primary:
        "bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:ring-indigo-500/40",
    ghost:
        "border border-slate-300 text-slate-700 hover:bg-slate-100 focus-visible:ring-slate-400/40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800",
    outline:
        "border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
    highlight:
        "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500",
} as const;

const sizes = {
    default: "h-10 px-4 py-2",
    sm: "h-9 rounded-md px-3",
    lg: "h-11 rounded-full px-8",
    icon: "h-10 w-10 p-0",
} as const;

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: keyof typeof variants;
    size?: keyof typeof sizes;
}

type ButtonVariantOptions = {
    variant?: keyof typeof variants;
    size?: keyof typeof sizes;
};

export function buttonVariants({
    variant = "primary",
    size = "default",
}: ButtonVariantOptions = {}) {
    return [
        "inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-semibold transition-colors",
        "focus-visible:outline-none focus-visible:ring-4",
        "disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
    ].join(" ");
}

export function Button({
    variant = "primary",
    size = "default",
    type = "button",
    className = "",
    ...props
}: ButtonProps) {
    return (
        <button
            type={type}
            className={`${buttonVariants({ variant, size })} ${className}`}
            {...props}
        />
    );
}

export default Button;