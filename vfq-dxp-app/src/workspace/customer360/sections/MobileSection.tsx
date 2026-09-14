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
      { label: 'Plan Change', description: "Move the customer to a different postpaid or prepaid plan, updating their monthly commitment and bundled allowances." },
      { label: 'Add Add-On', description: "Attach an extra data, voice, or roaming bundle on top of the customer's existing plan." },
      { label: 'Remove Add-On', description: "Cancel an active add-on bundle and stop its recurring charge from the next billing cycle." },
      { label: 'Device Upgrade', description: "Move the customer onto a new device, optionally with an installment plan tied to their line." },
      { label: 'Suspend', description: "Temporarily pause the line's service — no usage, but the plan and number stay reserved." },
      { label: 'Resume', description: "Reactivate a suspended line and restore normal service." },
      { label: 'Terminate', description: "Permanently close the line and end billing for this service." },
    ],
  },
  {
    title: 'Number & SIM Services',
    actions: [
      { label: 'SIM Replacement', description: "Issue a new physical SIM for a lost, damaged, or faulty card while keeping the same number." },
      { label: 'eSIM Management', description: "Provision, transfer, or remove an eSIM profile for the customer's device." },
      { label: 'Ownership Change', description: "Transfer the account/line to a new owner's ID, moving billing and usage history with it." },
      { label: 'MNP/FNP Porting', description: 'Port an existing mobile or fixed number in from another carrier onto a Vodafone plan.', screenId: 'SCR-121' },
    ],
  },
  {
    title: 'New Connection',
    actions: [
      { label: 'New Connection', description: 'Start a brand-new postpaid or prepaid activation for a customer with no line at Vodafone yet.', screenId: 'SCR-037' },
      { label: 'Add Line', description: "Add an additional line to an existing customer's account, e.g. a family or multi-SIM plan." },
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
