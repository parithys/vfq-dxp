import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/primitives/Button';
import { Icon } from '../../components/primitives/Icon';
import { resolveNavFor } from '../../engines/navigationEngine';
import type { NavItem } from '../../navigation/navManifest';
import { useStartNewConnection } from './useStartNewConnection';

const CHEVRON_DOWN = 'M6 9l6 6 6-6';
const PRODUCT_LINES = new Set(['mobile', 'fibre-home']);

/**
 * "Actions" launcher in the Customer 360 header: the side navigation's Mobile and Fibre & Home menus
 * (New Connections, Existing Service, Number Services, SIM & Device, Relocation, Equipment, Support), offered
 * for the customer being viewed. The list comes from the same navigation manifest, filtered for the signed-in
 * persona, so a role sees here exactly what it sees in the side navigation and a new menu item appears in both.
 *
 * Wired for this customer: Mobile > New Connections (the Existing Customer journey, identity pre-resolved) and
 * Support (opens the Tickets & Support tab when the layout has one). The rest open their product-line page; the
 * customer is already the active customer in the shared context when they get there.
 */
export function CustomerActionsMenu({
  customerId,
  personaId,
  onSupport,
}: {
  customerId: string | undefined;
  personaId: string | undefined;
  /** Opens this customer's Tickets & Support tab; undefined when the layout has no such tab. */
  onSupport?: () => void;
}) {
  const navigate = useNavigate();
  const startNewConnection = useStartNewConnection(customerId);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const lines = resolveNavFor(personaId).filter((i) => PRODUCT_LINES.has(i.key) && i.children?.length);
  if (lines.length === 0) return null;

  const run = (child: NavItem) => {
    setOpen(false);
    if (child.key === 'mobile.new-connections') return startNewConnection();
    if (child.key.endsWith('.support') && onSupport) return onSupport();
    navigate(child.to);
  };

  return (
    <div ref={ref} className="relative">
      <Button variant="secondary-rect" compact onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}>
        Actions
        <Icon path={CHEVRON_DOWN} className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </Button>
      {open && (
        <div
          role="menu"
          aria-label="Customer actions"
          className="absolute right-0 top-full mt-1 z-40 w-60 rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg shadow-raised py-1"
        >
          {lines.map((line, i) => (
            <div key={line.key} className={i > 0 ? 'border-t border-border-soft mt-1 pt-1' : ''}>
              <p className="px-4 pt-2 pb-1 text-[length:var(--fs-caption-upper)] uppercase tracking-wide text-muted">{line.label}</p>
              {line.children!.map((child) => (
                <button
                  key={child.key}
                  type="button"
                  role="menuitem"
                  onClick={() => run(child)}
                  className="w-full flex items-center gap-2.5 px-4 h-9 text-left text-fg text-[length:var(--fs-body)] hover:bg-surface focus:outline-none focus-visible:bg-surface"
                >
                  <Icon path={child.icon} className="w-4 h-4 shrink-0 text-fg-2" />
                  <span className="truncate">{child.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
