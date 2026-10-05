import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/primitives/Button';
import { Icon } from '../../components/primitives/Icon';
import type { CustomerService } from '../../engines/customerServicesEngine';
import { resolveNavFor } from '../../engines/navigationEngine';
import type { NavItem } from '../../navigation/navManifest';
import { usePersonaStore } from '../../stores/personaStore';
import { appliesToCustomer, appliesToService, launchFor, resolveAction, serviceKind, type LaunchContext } from './customerActions';
import { useStartNewConnection } from './useStartNewConnection';

const CHEVRON_DOWN = 'M6 9l6 6 6-6';
const KEBAB = 'M12 5h.01 M12 12h.01 M12 19h.01';
const PRODUCT_LINES = new Set(['mobile', 'fibre-home']);

/** Closes the menu on an outside click or Escape. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);
  return ref;
}

/** Runs a menu item for a customer / service: the wired journeys directly, everything else by navigation. */
function useActionRunner(customerId: string | undefined, onSupport?: () => void) {
  const navigate = useNavigate();
  const startNewConnection = useStartNewConnection(customerId);
  return (child: NavItem, launch: LaunchContext) => {
    const outcome = resolveAction(child, launch);
    if (outcome.kind === 'start-new-connection') return startNewConnection();
    if (outcome.kind === 'support' && onSupport) return onSupport();
    navigate(outcome.kind === 'navigate' ? outcome.to : child.to, outcome.kind === 'navigate' ? { state: outcome.state } : { state: { launch } });
  };
}

/** The persona's product-line groups, each narrowed to the children that pass `applies`; empty groups are dropped. */
function useGroups(applies: (child: NavItem) => boolean) {
  const personaId = usePersonaStore((s) => s.activePersonaId);
  return resolveNavFor(personaId)
    .filter((i) => PRODUCT_LINES.has(i.key) && i.children?.length)
    .map((line) => ({ line, children: line.children!.filter(applies) }))
    .filter((g) => g.children.length > 0);
}

function MenuPanel({
  groups,
  onPick,
  className = '',
  label,
}: {
  groups: { line: NavItem; children: NavItem[] }[];
  onPick: (child: NavItem) => void;
  className?: string;
  label: string;
}) {
  return (
    <div
      role="menu"
      aria-label={label}
      className={`absolute right-0 top-full mt-1 z-40 w-60 rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg shadow-raised py-1 text-left ${className}`}
    >
      {groups.map(({ line, children }, i) => (
        <div key={line.key} className={i > 0 ? 'border-t border-border-soft mt-1 pt-1' : ''}>
          <p className="px-4 pt-2 pb-1 text-[length:var(--fs-caption-upper)] uppercase tracking-wide text-muted">{line.label}</p>
          {children.map((child) => (
            <button
              key={child.key}
              type="button"
              role="menuitem"
              onClick={() => onPick(child)}
              className="w-full flex items-center gap-2.5 px-4 h-9 text-left text-fg text-[length:var(--fs-body)] hover:bg-surface focus:outline-none focus-visible:bg-surface"
            >
              <Icon path={child.icon} className="w-4 h-4 shrink-0 text-fg-2" />
              <span className="truncate">{child.label}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * "Actions" launcher in the Customer 360 header: the side navigation's Mobile and Fibre & Home menus (New
 * Connections, Existing Service, Number Services, SIM & Device, Relocation, Equipment, Support) for the customer
 * being viewed. The list comes from the same navigation manifest, filtered for the signed-in persona, so a role
 * sees here what it sees in the side navigation. Items that act on a kind of service (mobile line, fibre / home
 * service) appear only when the customer holds one; New Connections and Support always do.
 *
 * Mobile > New Connections starts the Existing Customer journey and Support opens the Tickets & Support tab (when
 * the layout has one); the others open their product-line page for this customer.
 */
export function CustomerActionsMenu({
  customerId,
  customerName,
  services,
  onSupport,
}: {
  customerId: string | undefined;
  customerName?: string;
  /** The customer's services; undefined until they have loaded (nothing is hidden meanwhile). */
  services: CustomerService[] | undefined;
  /** Opens this customer's Tickets & Support tab; undefined when the layout has no such tab. */
  onSupport?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const run = useActionRunner(customerId, onSupport);
  const groups = useGroups((c) => appliesToCustomer(c.key, services));
  if (groups.length === 0 || !customerId) return null;
  const primaryMobile = services?.find((s) => serviceKind(s) === 'mobile');
  const launch = launchFor(customerId, customerName, undefined, primaryMobile?.identifier);
  return (
    <div ref={ref} className="relative">
      <Button variant="secondary-rect" compact onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}>
        Actions
        <Icon path={CHEVRON_DOWN} className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </Button>
      {open && (
        <MenuPanel
          label="Customer actions"
          groups={groups}
          onPick={(child) => {
            setOpen(false);
            run(child, launch);
          }}
        />
      )}
    </div>
  );
}

/** The same actions for ONE service, in its row: each carries that service, so the page it opens knows which line. */
export function ServiceActionsMenu({
  customerId,
  customerName,
  service,
  onSupport,
}: {
  customerId: string | undefined;
  customerName?: string;
  service: CustomerService;
  onSupport?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const run = useActionRunner(customerId, onSupport);
  const groups = useGroups((c) => appliesToService(c.key, service));
  if (groups.length === 0 || !customerId) return null;
  const launch = launchFor(customerId, customerName, service);
  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        aria-label={`Actions for ${service.identifier}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="w-7 h-7 rounded-[var(--radius-pill)] flex items-center justify-center text-fg-2 hover:bg-surface"
      >
        <Icon path={KEBAB} className="w-4 h-4" strokeWidth={3} />
      </button>
      {open && (
        <div onClick={(e) => e.stopPropagation()}>
          <MenuPanel
            label={`Actions for ${service.identifier}`}
            groups={groups}
            onPick={(child) => {
              setOpen(false);
              run(child, launch);
            }}
          />
        </div>
      )}
    </div>
  );
}
