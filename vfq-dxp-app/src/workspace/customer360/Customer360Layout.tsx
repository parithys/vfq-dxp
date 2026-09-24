import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getCustomer360, toActiveCustomerSummary, computeBillingSummary, type Customer360Data } from '../../engines/customer360Engine';
import { useActiveCustomerStore } from '../../stores/activeCustomerStore';
import { useCustomerVerificationStore } from '../../stores/customerVerificationStore';
import { usePersonaStore } from '../../stores/personaStore';
import { canEditCustomerRecords } from '../../engines/agentPrivilegeEngine';
import { useVerificationGate } from '../../components/patterns/VerificationGate';
import { Badge } from '../../components/primitives/Badge';
import { Button } from '../../components/primitives/Button';
import { Icon } from '../../components/primitives/Icon';
import { Tooltip } from '../../components/primitives/Tooltip';
import { Tabs, type TabItem } from '../../components/primitives/Tabs';
import { MetricCard } from './MetricCard';
import { downloadCsv } from '../../engines/csvExport';
import { BellNotificationBanner } from './BellNotificationBanner';
import { BulkNotesSection } from './BulkNotesSection';
import { DemographicEditDrawer } from './DemographicEditDrawer';
import { ProfileSection } from './sections/ProfileSection';
import { ContactSection } from './sections/ContactSection';
import { AddressSection } from './sections/AddressSection';
import { AccountHierarchySection } from './sections/AccountHierarchySection';
import { MobileSection } from './sections/MobileSection';
import { FibreHomeSection } from './sections/FibreHomeSection';
import { EnterpriseSection } from './sections/EnterpriseSection';
import { BillingSection } from './sections/BillingSection';
import { OrdersSection } from './sections/OrdersSection';
import { TicketsSection } from './sections/TicketsSection';
import {
  InteractionsSection,
  CommunicationsSection,
  DocumentsSection,
  NotificationsSection,
  ConsentSection,
  ProductsAssetsSection,
  RecentActivitiesSection,
} from './sections/MiscSections';

// The central workspace the whole redesign pivots around: one customer, one
// page, every product/action reachable in at most two more clicks (product
// tab -> action group -> action). Reachable either from Customer Search
// (which already set the active-customer bridge) or a direct URL/bookmark -
// re-sets the bridge here too so a direct link still pre-fills downstream
// wizards correctly.
const CLOSED_TICKET_STATUSES = new Set(['Solved', 'Completed', 'Closed', 'Cancelled']);
const EXPORT_ICON = 'M12 15V3 M7 10l5 5 5-5 M4 21h16';

export function Customer360Layout() {
  const { customerId } = useParams<{ customerId: string }>();
  const setActiveCustomer = useActiveCustomerStore((s) => s.setActiveCustomer);
  const activePersonaId = usePersonaStore((s) => s.activePersonaId);
  const [data, setData] = useState<Customer360Data | undefined | null>(null);
  const [activeTab, setActiveTab] = useState('profile');
  const [demoDrawerOpen, setDemoDrawerOpen] = useState(false);

  useEffect(() => {
    if (!customerId) return;
    setData(null);
    getCustomer360(customerId).then((result) => {
      setData(result ?? undefined);
      if (result) setActiveCustomer(toActiveCustomerSummary(result.customer));
    });
  }, [customerId, setActiveCustomer]);

  const isSessionVerified = useCustomerVerificationStore((s) =>
    customerId ? s.isVerified(customerId) : false
  );
  const { requireVerification, gate: verificationGate } = useVerificationGate(
    customerId ?? '',
    data && data !== null ? data.customer.name : 'this customer'
  );
  const canEdit = canEditCustomerRecords(activePersonaId);

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
  const { outstanding, latestBill } = computeBillingSummary(data);
  const openTicketCount = data.tickets.filter((t) => !CLOSED_TICKET_STATUSES.has(String(t.status))).length;
  const accountStatus = data.customer.blacklisted
    ? 'Blocked'
    : data.accounts.some((a) => a.status === 'Active')
      ? 'Active'
      : (data.accounts[0]?.status ?? '-');

  // BR-04: shared by every ticket-creation path (demographic/contact/address
  // auto-tickets and Tickets tab's own manual "Create Ticket") so the new
  // ticket is immediately reflected here - in the Tickets tab and in the
  // header's Open Tickets count - rather than only after navigating away and
  // back. data.tickets itself stays the single source of truth for both.
  const addTicket = (ticket: Record<string, unknown>) =>
    setData((prev) => (prev ? { ...prev, tickets: [ticket, ...prev.tickets] } : prev));

  const exportProfile = () => {
    downloadCsv(`${data.customer.customerId}-profile.csv`, [
      {
        customerId: data.customer.customerId,
        name: data.customer.name,
        idType: data.customer.idType,
        qid: data.customer.qid,
        dob: data.customer.dob,
        nationality: data.customer.nationality,
        segment: data.customer.segment,
        email: data.customer.email ?? '',
        phone: data.customer.phone ?? '',
        preferredLanguage: data.customer.preferredLanguage ?? '',
        moiValidationStatus: data.customer.moiValidationStatus ?? '',
        blacklisted: data.customer.blacklisted,
      },
    ]);
  };

  const tabs: TabItem[] = [
    { key: 'profile', label: 'Profile', content: <ProfileSection customer={data.customer} accounts={data.accounts} /> },
    { key: 'contacts', label: 'Contacts', content: <ContactSection data={data} onTicketCreated={addTicket} /> },
    { key: 'addresses', label: 'Addresses', content: <AddressSection data={data} onTicketCreated={addTicket} /> },
    { key: 'mobile', label: 'Mobile', content: <MobileSection customer={customer} activePostpaidLines={data.customer.activePostpaidLines ?? 0} /> },
    { key: 'fibre', label: 'Fibre & Home', content: <FibreHomeSection customer={customer} /> },
    { key: 'enterprise', label: 'Enterprise', content: <EnterpriseSection customer={customer} /> },
    { key: 'billing', label: 'Billing', content: <BillingSection data={data} /> },
    { key: 'orders', label: 'Orders', content: <OrdersSection data={data} /> },
    { key: 'tickets', label: 'Tickets', content: <TicketsSection data={data} onTicketCreated={addTicket} /> },
    {
      key: 'interactions',
      label: 'Interactions',
      content: (
        <InteractionsSection
          data={data}
          onLogged={(record) => setData((prev) => (prev ? { ...prev, activities: [record, ...prev.activities] } : prev))}
        />
      ),
    },
    { key: 'communications', label: 'Communications', content: <CommunicationsSection data={data} /> },
    { key: 'documents', label: 'Documents', content: <DocumentsSection data={data} /> },
    { key: 'notifications', label: 'Notifications', content: <NotificationsSection data={data} /> },
    { key: 'bulk-notes', label: 'Bulk Notes', content: <BulkNotesSection accountIds={data.accounts.map((a) => a.accountId)} /> },
    { key: 'consent', label: 'Consent & Preferences', content: <ConsentSection data={data} /> },
    { key: 'assets', label: 'Products & Assets', content: <ProductsAssetsSection data={data} /> },
    { key: 'relationships', label: 'Account Hierarchy', content: <AccountHierarchySection data={data} /> },
    { key: 'activity', label: 'Recent Activities', content: <RecentActivitiesSection data={data} /> },
  ];

  return (
    <div className="p-8">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div className="flex items-center gap-3">
          <h1 className="text-[length:var(--fs-h3)] font-medium text-fg">{data.customer.name}</h1>
          {data.customer.blacklisted && <Badge variant="danger">Blacklisted</Badge>}
          {data.customer.moiValidationStatus === 'Verified' && <Badge variant="success">Verified</Badge>}
          {isSessionVerified && <Badge variant="filled-neutral">Session Verified (BR-01)</Badge>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost-rect" compact onClick={exportProfile}>
            <Icon path={EXPORT_ICON} className="w-4 h-4" />
            Export
          </Button>
          {canEdit ? (
            <Button
              variant="primary-rect"
              compact
              onClick={() => requireVerification(() => setDemoDrawerOpen(true))}
            >
              Edit profile
            </Button>
          ) : (
            <Tooltip content="Not authorised to edit customer records (BR-02)" placement="bottom">
              <Button variant="primary-rect" compact className="opacity-40 cursor-not-allowed" onClick={(e) => e.preventDefault()}>
                Edit profile
              </Button>
            </Tooltip>
          )}
        </div>
      </div>
      <p className="text-fg-2 mb-4">
        {data.customer.customerId} · {data.customer.idType} {data.customer.qid} · {data.customer.segment}
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <MetricCard label="Account status" value={accountStatus} subtext={`${data.accounts.length} account${data.accounts.length === 1 ? '' : 's'}`} />
        <MetricCard
          label="Current bill"
          value={latestBill ? `${String(latestBill.totalAmount ?? '-')} QAR` : '-'}
          subtext={latestBill ? capitalizeStatus(latestBill.status) : 'No bills on file'}
        />
        <MetricCard
          label="Outstanding"
          value={`${outstanding} QAR`}
          subtext={outstanding > 0 ? 'Overdue balance' : 'No overdue balance'}
        />
        <MetricCard
          label="Open tickets"
          value={String(openTicketCount)}
          subtext={openTicketCount > 0 ? 'Needs attention' : 'All resolved'}
        />
      </div>

      <BellNotificationBanner customerId={data.customer.customerId} />
      <Tabs items={tabs} orientation="vertical" activeKey={activeTab} onChange={setActiveTab} />

      {verificationGate}
      <DemographicEditDrawer
        open={demoDrawerOpen}
        onClose={() => setDemoDrawerOpen(false)}
        customer={data.customer}
        onSaved={(patch) => setData((prev) => (prev ? { ...prev, customer: { ...prev.customer, ...patch } } : prev))}
        onTicketCreated={addTicket}
      />
    </div>
  );
}

function capitalizeStatus(value: unknown): string {
  const s = String(value ?? '');
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '-';
}
