import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Tooltip } from './Tooltip';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

// Was backing 32 Modal-type screens per component-catalogue.md §1 (no
// design-system analog); reserved as of 2026-09-12 for short confirmation
// messages only (e.g. GuidedActivationWizard's "Abandon this order?") -
// every other former Modal usage (forms, signature capture, multi-step
// flows) now renders via Drawer.tsx for a less disruptive, side-anchored
// interaction.
export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  // Escape-to-close: the backdrop's click-to-dismiss below is a mouse-only
  // convenience (a full-screen div is intentionally not made focusable/
  // keyboard-actionable - that would be a false affordance in the other
  // direction). Escape is the real accessible path to close without using
  // the dialog's own controls.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return (
    // cursor-default (not pointer): clicking the backdrop dismisses the
    // modal, but per UI cursor remediation guidance a full-screen dismiss
    // surface should not read as "clickable" the way a button does.
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--black-80)] cursor-default" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-[var(--radius-card)] bg-bg shadow-raised p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[length:var(--fs-h5)] font-medium text-fg">{title}</h2>
          <Tooltip content="Close" placement="left">
            <button onClick={onClose} aria-label="Close" className="text-muted hover:text-fg text-xl leading-none">
              ×
            </button>
          </Tooltip>
        </div>
        <div>{children}</div>
        {footer && <div className="flex justify-end gap-2 mt-6">{footer}</div>}
      </div>
    </div>
  );
}
