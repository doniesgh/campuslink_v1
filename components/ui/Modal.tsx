"use client";
import { useEffect } from 'react';
import type { ReactNode } from 'react';

const sizes = { md: 'max-w-xl', lg: 'max-w-3xl' } as const;

interface ModalProps {
  onClose: () => void;
  size?: keyof typeof sizes;
  children: ReactNode;
}

// Overlay + panel. Closes on backdrop click and Escape, locks page scroll while open.
export default function Modal({ onClose, size = 'md', children }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 px-3 py-8"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`w-full ${sizes[size]} rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900 dark:text-slate-100`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

interface ModalHeaderProps {
  onClose: () => void;
  children?: ReactNode;
}

export function ModalHeader({ onClose, children }: ModalHeaderProps) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="min-w-0">{children}</div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="rounded-md p-1 text-lg leading-none text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
      >
        ✕
      </button>
    </div>
  );
}
