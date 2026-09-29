import type { CustomerRecord, AccountRecord, Customer360Data } from '../../../engines/customer360Engine';
import type { CustomerService } from '../../../engines/customerServicesEngine';
import { ProfileSection } from './ProfileSection';
import { AccountHierarchySection } from './AccountHierarchySection';

/** Customer 360's "Account Information" tab: identity/MOI/linked-services
 * (former Profile tab) plus the account hierarchy tree (former Account
 * Hierarchy tab) - customer360-fields.json's Account Information topic
 * explicitly lists both "Account Hierarchy" and "Contact Hierarchy" as its
 * own fields, so the two belong together. */
export function AccountInformationSection({
  customer,
  accounts,
  services,
  data,
}: {
  customer: CustomerRecord;
  accounts: AccountRecord[];
  services: CustomerService[];
  data: Customer360Data;
}) {
  return (
    <div className="space-y-8">
      <ProfileSection customer={customer} accounts={accounts} services={services} />
      <AccountHierarchySection data={data} />
    </div>
  );
}
