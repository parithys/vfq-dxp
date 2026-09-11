import type { ActiveCustomerSummary } from '../../../stores/activeCustomerStore';
import { ProductActionGroups, type ProductActionGroup } from '../ProductActionGroups';

// Fibre Activation (SCR-043) and FWA/5G Home (SCR-077, one shared wizard for
// both per the FWA/5G Home module) are the only real entry points today.
// Relocation/Upgrade/Suspend/Resume/Terminate have no dedicated screen —
// Home Move (SCR-115/116) exists only as unregistered mid-flow steps, not a
// launchable action, so it's listed honestly as not-yet-built rather than
// stretched into a fit.
const GROUPS: ProductActionGroup[] = [
  {
    title: 'Service Management',
    actions: [
      { label: 'Upgrade' },
      { label: 'Relocation' },
      { label: 'Suspend' },
      { label: 'Resume' },
      { label: 'Terminate' },
    ],
  },
  {
    title: 'New Activation',
    actions: [
      { label: 'Fibre Activation', screenId: 'SCR-043' },
      { label: 'FWA', screenId: 'SCR-077' },
      { label: '5G Home', screenId: 'SCR-077' },
      { label: 'IPTV' },
    ],
  },
];

export function FibreHomeSection({ customer }: { customer: ActiveCustomerSummary }) {
  return <ProductActionGroups groups={GROUPS} customer={customer} />;
}
