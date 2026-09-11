import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getCustomer360, toActiveCustomerSummary, type Customer360Data } from '../../engines/customer360Engine';
import { useActiveCustomerStore } from '../../stores/activeCustomerStore';
import { Badge } from '../../components/primitives/Badge';
import { Tabs, type TabItem } from '../../components/primitives/Tabs';
import { ProfileSection } from './sections/ProfileSection';
import { MobileSection } from './sections/MobileSection';
import { FibreHomeSection } from './sections/FibreHomeSection';
import { EnterpriseSection } from './sections/EnterpriseSection';
import { BillingSection } from './sections/BillingSection';
import { OrdersSection } from './sections/OrdersSection';
import { TicketsSection } from './sections/TicketsSection';
import {
  InteractionsSection,
  DocumentsSection,
  NotificationsSection,
  ConsentSection,
  ProductsAssetsSection,
  RelationshipHierarchySection,
  RecentActivitiesSection,
} from './sections/MiscSections';

// The central workspace the whole redesign pivots around: one customer, one
// page, every product/action reachable in at most two more clicks (product
// tab -> action group -> action). Reachable either from Customer Search
// (which already set the active-customer bridge) or a direct URL/bookmark —
// re-sets the bridge here too so a direct link still pre-fills downstream
// wizards correctly.
export function Customer360Layout() {
  const { customerId } = useParams<{ customerId: string }>();
  const setActiveCustomer = useActiveCustomerStore((s) => s.setActiveCustomer);
  const [data, setData] = useState<Customer360Data | undefined | null>(null);

  useEffect(() => {
    if (!customerId) return;
    setData(null);
    getCustomer360(customerId).then((result) => {
      setData(result ?? undefined);
      if (result) setActiveCustomer(toActiveCustomerSummary(result.customer));
    });
  }, [customerId, setActiveCustomer]);

  if (data === null) {
    return <div className="p-8 text-fg-2">Loading customer…</div>;
  }
  if (data === undefined) {
    return (
      <div className="p-8">
        <p className="text-fg font-medium">No customer found for “{customerId}”.</p>
        <p className="text-fg-2 text-[length:var(--fs-caption)] mt-1">Try Customer Search instead.</p>
      </div>
    );
  }

  const customer = toActiveCustomerSummary(data.customer);

  const tabs: TabItem[] = [
    { key: 'profile', label: 'Profile', content: <ProfileSection customer={data.customer} accounts={data.accounts} /> },
    { key: 'mobile', label: 'Mobile', content: <MobileSection customer={customer} activePostpaidLines={data.customer.activePostpaidLines ?? 0} /> },
    { key: 'fibre', label: 'Fibre & Home', content: <FibreHomeSection customer={customer} /> },
    { key: 'enterprise', label: 'Enterprise', content: <EnterpriseSection customer={customer} /> },
    { key: 'billing', label: 'Billing', content: <BillingSection data={data} /> },
    { key: 'orders', label: 'Orders', content: <OrdersSection data={data} /> },
    { key: 'tickets', label: 'Tickets', content: <TicketsSection data={data} /> },
    { key: 'interactions', label: 'Interactions', content: <InteractionsSection data={data} /> },
    { key: 'documents', label: 'Documents', content: <DocumentsSection data={data} /> },
    { key: 'notifications', label: 'Notifications', content: <NotificationsSection data={data} /> },
    { key: 'consent', label: 'Consent & Preferences', content: <ConsentSection data={data} /> },
    { key: 'assets', label: 'Products & Assets', content: <ProductsAssetsSection data={data} /> },
    { key: 'relationships', label: 'Relationship Hierarchy', content: <RelationshipHierarchySection data={data} /> },
    { key: 'activity', label: 'Recent Activities', content: <RecentActivitiesSection data={data} /> },
  ];

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-[length:var(--fs-h3)] font-medium text-fg">{data.customer.name}</h1>
        {data.customer.blacklisted && <Badge variant="danger">Blacklisted</Badge>}
        {data.customer.moiValidationStatus === 'Verified' && <Badge variant="success">Verified</Badge>}
      </div>
      <p className="text-fg-2 mb-6">
        {data.customer.customerId} · {data.customer.idType} {data.customer.qid} · {data.customer.segment}
      </p>
      <Tabs items={tabs} />
    </div>
  );
}
