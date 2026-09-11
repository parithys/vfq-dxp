import type { ActiveCustomerSummary } from '../../../stores/activeCustomerStore';
import { ProductActionGroups, type ProductActionGroup } from '../ProductActionGroups';

// Product taxonomy per the redesign brief. Only MNP/FNP Porting and New
// Connection map to screens that actually exist in the 213-screen catalogue
// today (SCR-121, SCR-037) — the rest render an honest "not yet built" state
// via ProductActionGroups rather than a fabricated screen. This is the
// documented gap, not an oversight.
// Note: SCR-120 ("Choose process") is cataloged but unregistered — SCR-121
// (the wizard's own Contact step) is the real, built entry point.
const GROUPS: ProductActionGroup[] = [
  {
    title: 'Existing Customer Services',
    actions: [
      { label: 'Plan Change' },
      { label: 'Add Add-On' },
      { label: 'Remove Add-On' },
      { label: 'Device Upgrade' },
      { label: 'Suspend' },
      { label: 'Resume' },
      { label: 'Terminate' },
    ],
  },
  {
    title: 'Number & SIM Services',
    actions: [
      { label: 'SIM Replacement' },
      { label: 'eSIM Management' },
      { label: 'Ownership Change' },
      { label: 'MNP/FNP Porting', screenId: 'SCR-121' },
    ],
  },
  {
    title: 'New Connection',
    actions: [
      { label: 'New Connection', screenId: 'SCR-037' },
      { label: 'Add Line' },
    ],
  },
];

export function MobileSection({ customer, activePostpaidLines }: { customer: ActiveCustomerSummary; activePostpaidLines: number }) {
  return (
    <div>
      <p className="text-fg-2 text-[length:var(--fs-body)] mb-4">
        {activePostpaidLines} active postpaid {activePostpaidLines === 1 ? 'line' : 'lines'} on file.
      </p>
      <ProductActionGroups groups={GROUPS} customer={customer} />
    </div>
  );
}
