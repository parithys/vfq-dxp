import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Tooltip } from './Tooltip';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** 'md' (28rem) fits signature capture and 1-2 field action forms; 'lg' (36rem) is for the two
      content-heaviest forms (TicketCreationModal, ForgotPasswordFlow). Defaults to 'md'. */
  size?: 'md' | 'lg';
}

const SIZE_CLASSES: Record<NonNullable<DrawerProps['size']>, string> = {
  md: 'max-w-md',
  lg: 'max-w-xl',
};

// Side drawer for everything that isn't a short confirmation message (see
// Modal.tsx, which is reserved for those) — forms, signature capture, and
// multi-step flows read as more seamless sliding in from the edge than
// interrupting the whole screen with a centered dialog.
export function Drawer({ open, onClose, title, children, footer, size = 'md' }: DrawerProps) {
  // Mirrors Sidebar.tsx's mobile-drawer technique: mount first, then flip the
  // transform on the next tick so the slide-in transition actually plays
  // instead of the panel just appearing already in place.
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [open]);

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
    // drawer, but per UI cursor remediation guidance a full-screen dismiss
    // surface should not read as "clickable" the way a button does.
    <div className="fixed inset-0 z-50 bg-[var(--black-80)] cursor-default" onClick={onClose}>
      <div
        className={`fixed right-0 inset-y-0 z-50 w-full ${SIZE_CLASSES[size]} flex flex-col bg-bg border-l border-border-soft shadow-raised transform transition-transform duration-[var(--motion-base)] ease-[var(--ease-standard)] ${
          entered ? 'translate-x-0' : 'translate-x-full'
        }`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-soft shrink-0">
          <h2 className="text-[length:var(--fs-h5)] font-medium text-fg">{title}</h2>
          <Tooltip content="Close" placement="left">
            <button onClick={onClose} aria-label="Close" className="text-muted hover:text-fg text-xl leading-none">
              ×
            </button>
          </Tooltip>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
        {footer && <div className="flex justify-end gap-2 px-6 py-4 border-t border-border-soft shrink-0">{footer}</div>}
      </div>
    </div>
  );
}
