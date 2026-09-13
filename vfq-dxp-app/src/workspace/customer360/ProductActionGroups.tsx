import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllRoutes } from '../../engines/configEngine';
import { useActiveCustomerStore, type ActiveCustomerSummary } from '../../stores/activeCustomerStore';
import { Icon } from '../../components/primitives/Icon';
import { Tooltip } from '../../components/primitives/Tooltip';

const CHEVRON_DOWN = 'M6 9l6 6 6-6';
const CHEVRON_RIGHT = 'M9 18l6-6-6-6';
// Clock face — a clearer, at-a-glance "not available yet" signal than the
// dashed-border/muted-text treatment alone, which was too subtle to notice
// without hovering for the tooltip.
const CLOCK_ICON = 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3.2 2';

export interface ProductAction {
  label: string;
  /** Existing screen this action launches, if one exists yet. Omit to show
   * an honest "not yet built" state instead of a fabricated screen. */
  screenId?: string;
}

export interface ProductActionGroup {
  title: string;
  actions: ProductAction[];
}

// The progressive-disclosure layer for Customer 360's product tabs: groups
// collapse by default (Existing Customer Services / Number & SIM Services /
// New Connection, etc.) so an agent sees intent-shaped groups, not a flat
// wall of every action. Launching an action sets the active-customer bridge
// then navigates to the EXISTING screen registered for it — no wizard is
// rewritten to support this, per GuidedContactStep's pre-fill patch.
export function ProductActionGroups({ groups, customer }: { groups: ProductActionGroup[]; customer: ActiveCustomerSummary }) {
  const navigate = useNavigate();
  const setActiveCustomer = useActiveCustomerStore((s) => s.setActiveCustomer);
  const [openTitle, setOpenTitle] = useState<string | undefined>(groups[0]?.title);

  const launch = (action: ProductAction) => {
    const route = action.screenId ? getAllRoutes().find((r) => r.screenId === action.screenId) : undefined;
    if (!route) return;
    setActiveCustomer(customer);
    navigate(route.path);
  };

  return (
    <div className="space-y-2.5">
      {groups.map((group) => {
        const isOpen = openTitle === group.title;
        return (
          <div key={group.title} className="rounded-[var(--radius-card)] border border-border-soft bg-bg overflow-hidden">
            <button
              onClick={() => setOpenTitle(isOpen ? undefined : group.title)}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface"
            >
              <span className="font-medium text-fg text-[length:var(--fs-body)]">{group.title}</span>
              <Icon path={isOpen ? CHEVRON_DOWN : CHEVRON_RIGHT} className="w-4 h-4 text-muted shrink-0" />
            </button>
            {isOpen && (
              <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 border-t border-border-soft pt-3">
                {group.actions.map((action) => {
                  const available = Boolean(action.screenId && getAllRoutes().find((r) => r.screenId === action.screenId));
                  if (!available) {
                    return (
                      <Tooltip key={action.label} content="Not yet built for this action" placement="top">
                        <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-dashed border-border bg-light-neutral p-4 text-muted cursor-not-allowed">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[length:var(--fs-btn-compact)] font-medium">{action.label}</span>
                            <Icon path={CLOCK_ICON} className="w-3.5 h-3.5 shrink-0" />
                          </div>
                          <span className="text-[length:var(--fs-micro)] uppercase tracking-wide">Coming soon</span>
                        </div>
                      </Tooltip>
                    );
                  }
                  return (
                    <button
                      key={action.label}
                      onClick={() => launch(action)}
                      className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-border bg-bg p-4 text-left text-fg hover:bg-surface hover:border-accent transition-colors"
                    >
                      <span className="text-[length:var(--fs-btn-compact)] font-medium">{action.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
