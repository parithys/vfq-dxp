import type { ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

// Backs 32 Modal-type screens per component-catalogue.md §1 — Assumed shape
// (no design-system analog), styled with real tokens.
export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--black-80)]" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-[var(--radius-card)] bg-bg shadow-raised p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[length:var(--fs-h5)] font-medium text-fg">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-muted hover:text-fg text-xl leading-none">
            ×
          </button>
        </div>
        <div>{children}</div>
        {footer && <div className="flex justify-end gap-2 mt-6">{footer}</div>}
      </div>
    </div>
  );
}
