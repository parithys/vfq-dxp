import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllRoutes } from '../../engines/configEngine';
import { useActiveCustomerStore, type ActiveCustomerSummary } from '../../stores/activeCustomerStore';
import { Icon } from '../../components/primitives/Icon';
import { Tooltip } from '../../components/primitives/Tooltip';

const CHEVRON_DOWN = 'M6 9l6 6 6-6';
const CHEVRON_RIGHT = 'M9 18l6-6-6-6';

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
              <div className="px-4 pb-4 flex flex-wrap gap-2 border-t border-border-soft pt-3">
                {group.actions.map((action) => {
                  const available = Boolean(action.screenId && getAllRoutes().find((r) => r.screenId === action.screenId));
                  if (!available) {
                    return (
                      <Tooltip key={action.label} content="Not yet built for this action" placement="top">
                        <span className="inline-flex items-center rounded-[var(--radius-button)] border border-dashed border-border px-3.5 py-2 text-[length:var(--fs-btn-compact)] text-muted cursor-not-allowed">
                          {action.label}
                        </span>
                      </Tooltip>
                    );
                  }
                  return (
                    <button
                      key={action.label}
                      onClick={() => launch(action)}
                      className="inline-flex items-center rounded-[var(--radius-button)] border border-border px-3.5 py-2 text-[length:var(--fs-btn-compact)] text-fg hover:bg-surface hover:border-accent transition-colors"
                    >
                      {action.label}
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
