import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Tooltip } from './Tooltip';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

// Side drawer for everything that isn't a short confirmation message (see
// Modal.tsx, which is reserved for those) - forms, signature capture, and
// multi-step flows read as more seamless sliding in from the edge than
// interrupting the whole screen with a centered dialog. Width is 40% of the
// viewport (with a floor so it doesn't get unusably narrow on small
// screens) rather than a fixed size tier, so every drawer gets the same
// extra breathing room for content.
// Matches the transition-duration below (--motion-base) so unmount is
// deferred exactly as long as the slide-out animation takes to finish.
const EXIT_DURATION_MS = 220;

export function Drawer({ open, onClose, title, children, footer }: DrawerProps) {
  // Mirrors Sidebar.tsx's mobile-drawer technique: mount first, then flip the
  // transform on the next tick so the slide-in transition actually plays
  // instead of the panel just appearing already in place. `mounted` stays
  // true for one extra transition-duration after `open` goes false, so the
  // panel can slide back out before it's removed from the DOM.
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(raf);
    }
    setEntered(false);
    const timeout = setTimeout(() => setMounted(false), EXIT_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!mounted) return null;
  return (
    // Backdrop no longer dismisses the drawer on click - only the explicit
    // close button or Escape do (see the keydown handler above). Prevents
    // losing in-progress form input from an accidental click outside the
    // panel.
    <div className="fixed inset-0 z-50 bg-[var(--black-80)]">
      <div
        className={`fixed right-0 inset-y-0 z-50 w-[40vw] min-w-[320px] max-w-full flex flex-col bg-bg border-l border-border-soft shadow-raised transform transition-transform duration-[var(--motion-base)] ease-[var(--ease-standard)] ${
          entered ? 'translate-x-0' : 'translate-x-full'
        }`}
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
