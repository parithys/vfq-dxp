import type { ActiveCustomerSummary } from '../../../stores/activeCustomerStore';
import { ProductActionGroups, type ProductActionGroup } from '../ProductActionGroups';

// Account Setup (SCR-007) is the one real enterprise screen in the catalogue
// today — it manages the account structure the other five product lines
// would eventually sit on top of. They're listed as requested by the
// taxonomy but honestly marked not-yet-built.
const GROUPS: ProductActionGroup[] = [
  {
    title: 'Enterprise Services',
    actions: [
      { label: 'Mobile Enterprise' },
      { label: 'IoT' },
      { label: 'Connectivity' },
      { label: 'Business Fibre' },
      { label: 'Managed Services' },
      { label: 'Account Setup', screenId: 'SCR-007' },
    ],
  },
];

export function EnterpriseSection({ customer }: { customer: ActiveCustomerSummary }) {
  return <ProductActionGroups groups={GROUPS} customer={customer} />;
}
