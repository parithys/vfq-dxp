import type { ActiveCustomerSummary } from '../../../stores/activeCustomerStore';
import { ProductActionGroups, type ProductActionGroup } from '../ProductActionGroups';

// Fibre Activation (SCR-043) and FWA/5G Home (SCR-077, one shared wizard for
// both per the FWA/5G Home module) are the only real entry points today.
// Relocation/Upgrade/Suspend/Resume/Terminate have no dedicated screen -
// Home Move (SCR-115/116) exists only as unregistered mid-flow steps, not a
// launchable action, so it's listed honestly as not-yet-built rather than
// stretched into a fit.
const GROUPS: ProductActionGroup[] = [
  {
    title: 'Service Management',
    actions: [
      { label: 'Upgrade', description: 'Move the customer to a higher fibre or broadband speed tier.' },
      { label: 'Relocation', description: 'Move an existing fibre or home service to a new installation address.' },
      { label: 'Suspend', description: 'Temporarily pause the home service without cancelling the subscription.' },
      { label: 'Resume', description: 'Reactivate a suspended fibre or home service.' },
      { label: 'Terminate', description: 'Permanently close the fibre or home service and stop billing.' },
    ],
  },
  {
    title: 'New Activation',
    actions: [
      { label: 'Fibre Activation', description: "Install and activate a new fibre broadband connection at the customer's address.", screenId: 'SCR-043' },
      { label: 'FWA', description: 'Activate Fixed Wireless Access - home broadband delivered over the mobile network, no fibre required.', screenId: 'SCR-077' },
      { label: '5G Home', description: 'Activate a 5G-based home broadband plan for addresses within 5G coverage.', screenId: 'SCR-077' },
      { label: 'IPTV', description: "Add IPTV channel packages on top of the customer's home broadband service." },
    ],
  },
];

export function FibreHomeSection({ customer }: { customer: ActiveCustomerSummary }) {
  return <ProductActionGroups groups={GROUPS} customer={customer} />;
}
