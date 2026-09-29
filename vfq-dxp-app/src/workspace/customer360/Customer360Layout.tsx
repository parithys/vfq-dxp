import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { accountHolderStatus, getCustomer360, toActiveCustomerSummary, computeBillingSummary, type AccountRecord, type Customer360Data } from '../../engines/customer360Engine';
import { listCustomerServices, type ServiceSources } from '../../engines/customerServicesEngine';
import * as mockDataEngine from '../../engines/mockDataEngine';
import { useActiveCustomerStore } from '../../stores/activeCustomerStore';
import { useCustomerVerificationStore } from '../../stores/customerVerificationStore';
import { usePersonaStore } from '../../stores/personaStore';
import { canEditCustomerRecords } from '../../engines/agentPrivilegeEngine';
import { isTopicVisible } from '../../engines/customer360VisibilityEngine';
import { useVerificationGate } from '../../components/patterns/VerificationGate';
import { Badge } from '../../components/primitives/Badge';
import { Button } from '../../components/primitives/Button';
import { Icon } from '../../components/primitives/Icon';
import { Tooltip } from '../../components/primitives/Tooltip';
import { Tabs, type TabItem } from '../../components/primitives/Tabs';
import { MetricCard } from './MetricCard';
import { downloadCsv } from '../../engines/csvExport';
import { BellNotificationBanner } from './BellNotificationBanner';
import { DemographicEditDrawer } from './DemographicEditDrawer';
import { AccountInformationSection } from './sections/AccountInformationSection';
import { AddressSection } from './sections/AddressSection';
import { BillingSection } from './sections/BillingSection';
import { AlertsRisksSection } from './sections/AlertsRisksSection';
import { AuditTrailSection } from './sections/AuditTrailSection';
import { AssetsSection, type AssetsSubView } from './sections/AssetsSection';
import { BlacklistViewSection } from './sections/BlacklistViewSection';
import { ContactInformationSection } from './sections/ContactInformationSection';
import { ContactAssetsInformationSection } from './sections/ContactAssetsInformationSection';
import { TopicFieldsSection } from './sections/TopicFieldsSection';
import { AccountContactLeadSection } from './sections/AccountContactLeadSection';
import { PenaltyViewSection } from './sections/PenaltyViewSection';

// Deep links from elsewhere in the app (queue notification, toasts, the
// Linked Services panel) only ever name one of these three ServiceTab
// values - see AssetsSection's own note on why 'assets' lands on Overview.
const SERVICE_TABS = new Set<string>(['mobile', 'fibre', 'assets']);
function toAssetsSubView(tab: string | undefined): AssetsSubView {
  return tab === 'mobile' || tab === 'fibre' ? tab : 'overview';
}

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
  const [demoDrawerOpen, setDemoDrawerOpen] = useState(false);

  // Deep link from a service link elsewhere in the app - currently the queue
  // notification's Active lines breakdown. `tab` picks the tab, `serviceRef`
  // names which service that tab should load.
  //
  // Seeded as the initial state AND re-applied per navigation, because
  // neither alone is enough:
  //
  //   - Initial state alone breaks the common case. The links live in the
  //     queue notification, which usually sits on top of the very record it
  //     links into, so the target path is the path already open. React Router
  //     does not remount for that, useState keeps its first value, and the tab
  //     never moved. This was the actual observed failure.
  //   - An effect alone flashes Profile for a frame before switching.
  //
  // Keyed on location.key, which React Router changes once per navigation.
  // That is what keeps this from fighting the agent: clicking a tab by hand
  // does not change the key, so the effect does not re-run and drag them back
  // to the linked tab.
  //
  // Location state rather than a URL segment, matching how nav-origin context
  // already travels in this app (see resolveActiveNavPath). The consequence is
  // deliberate: it survives history navigation but is dropped on reload, so a
  // reloaded page falls back to Profile with nothing selected rather than to a
  // half-restored selection.
  const location = useLocation();
  const linked = (location.state ?? {}) as { tab?: string; serviceRef?: string };
  const [activeTab, setActiveTab] = useState(linked.tab && SERVICE_TABS.has(linked.tab) ? 'assets' : 'account-info');
  const [assetsSubView, setAssetsSubView] = useState<AssetsSubView>(toAssetsSubView(linked.tab));
  const [selectedServiceRef, setSelectedServiceRef] = useState(linked.serviceRef);

  useEffect(() => {
    if (!linked.tab || !SERVICE_TABS.has(linked.tab)) return;
    setActiveTab('assets');
    setAssetsSubView(toAssetsSubView(linked.tab));
    setSelectedServiceRef(linked.serviceRef);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  // Service sources Customer360Data does not carry. Loaded here rather than
  // folded into getCustomer360 so that aggregation keeps its existing shape -
  // these four feed the service inventory only.
  const [serviceSources, setServiceSources] = useState<ServiceSources | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      mockDataEngine.list<AccountRecord>('accounts'),
      mockDataEngine.list<Record<string, unknown>>('installed-assets'),
      mockDataEngine.list<Record<string, unknown>>('gigahome-osntv-subscriptions'),
      mockDataEngine.list<Record<string, unknown>>('iptv-stb-bundles'),
      mockDataEngine.list<Record<string, unknown>>('smart-devices'),
    ]).then(([accounts, installedAssets, gigahome, iptvBundles, smartDevices]) => {
      if (cancelled) return;
      setServiceSources({ accounts, installedAssets, gigahome, iptvBundles, smartDevices });
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
  const holderStatus = accountHolderStatus(data.accounts);
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

  // Empty until the sources land, so the tabs render their own empty state
  // for a moment rather than briefly claiming the customer has no services.
  const services = serviceSources ? listCustomerServices(data.customer, serviceSources) : [];

  const onInteractionLogged = (record: Record<string, unknown>) =>
    setData((prev) => (prev ? { ...prev, activities: [record, ...prev.activities] } : prev));

  // Customer 360's 13 approved tab sections - each is one of
  // customer360-fields.json's own `topic` values (see
  // customer360VisibilityEngine.ts), so the visibility engine's department
  // lookups keep working unchanged even though the *labels* below use the
  // business's requested wording rather than the JSON's own spelling.
  //
  // Ordered by usage/frequency/importance, derived from that same JSON's
  // per-department real-time vs. drill-down density (2026-09-29 request):
  // broad, everyday topics first (Account Information, Assets, Contact
  // Information, Billing & Payments, Account Address), then topics that are
  // frequently glanced but narrow in scope, then the situational/compliance
  // topics that are only opened when directly relevant, with EBU last since
  // it touches only 2 of 11 departments and is real-time for none of them.
  const tabs: TabItem[] = [
    {
      key: 'account-info',
      label: 'Account Information',
      content: <AccountInformationSection customer={data.customer} accounts={data.accounts} services={services} data={data} />,
    },
    {
      key: 'assets',
      label: 'Assets',
      content: (
        <AssetsSection
          customer={customer}
          services={services}
          servicesLoaded={serviceSources !== undefined}
          selectedServiceRef={selectedServiceRef}
          initialSubView={assetsSubView}
          data={data}
        />
      ),
    },
    { key: 'contact-info', label: 'Contact Information', content: <ContactInformationSection data={data} onTicketCreated={addTicket} /> },
    { key: 'billing', label: 'Billing & Payments', content: <BillingSection data={data} /> },
    { key: 'account-address', label: 'Account Address', content: <AddressSection data={data} onTicketCreated={addTicket} /> },
    { key: 'alerts-risks', label: 'Alert & Risks', content: <AlertsRisksSection data={data} /> },
    ...(isTopicVisible(activePersonaId, 'Contact/Assets Information')
      ? [{ key: 'contact-assets-info', label: 'Contact/Assets Information', content: <ContactAssetsInformationSection data={data} /> }]
      : []),
    ...(isTopicVisible(activePersonaId, 'Blacklist View')
      ? [{ key: 'blacklist', label: 'Blacklist View', content: <BlacklistViewSection data={data} /> }]
      : []),
    ...(isTopicVisible(activePersonaId, 'Account/Contact Lead')
      ? [{ key: 'account-contact-lead', label: 'Account/Contact Lead', content: <AccountContactLeadSection data={data} /> }]
      : []),
    ...(isTopicVisible(activePersonaId, 'Activation/Modification Sidebar')
      ? [
          {
            key: 'activation-modification',
            label: 'Activation/Modification Side Bar',
            content: <TopicFieldsSection personaId={activePersonaId} topic="Activation/Modification Sidebar" />,
          },
        ]
      : []),
    ...(isTopicVisible(activePersonaId, 'Penalty View')
      ? [{ key: 'penalty-view', label: 'Penalty View', content: <PenaltyViewSection data={data} /> }]
      : []),
    {
      key: 'audit-trail',
      label: 'Audit Trail',
      content: <AuditTrailSection data={data} onTicketCreated={addTicket} onInteractionLogged={onInteractionLogged} />,
    },
    ...(isTopicVisible(activePersonaId, 'EBU')
      ? [{ key: 'ebu', label: 'EBU', content: <TopicFieldsSection personaId={activePersonaId} topic="EBU" /> }]
      : []),
  ];

  return (
    <div className="p-8">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div className="flex items-center gap-3">
          <h1 className="text-[length:var(--fs-h3)] font-medium text-fg">{data.customer.name}</h1>
          {data.customer.blacklisted && <Badge variant="danger">Blacklisted</Badge>}
          {data.customer.moiValidationStatus === 'Verified' && <Badge variant="success">Verified</Badge>}
          {isSessionVerified && <Badge variant="filled-neutral">Session Verified</Badge>}
          {/* Account-holder standing, beside the name - the most prominent
              slot on the page and the one an agent reads before anything
              else. It governs what they may do on the account, so it does not
              belong buried in a tab.

              Absent for a customer with no accounts rather than defaulted to
              either label: a new-connection walk-in is neither primary nor
              secondary yet. See accountHolderStatus. */}
          {holderStatus && (
            <Badge variant={holderStatus === 'Primary' ? 'accent' : 'filled-neutral'}>
              {holderStatus} Account Holder
            </Badge>
          )}
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
            <Tooltip content="Not authorised to edit customer records" placement="bottom">
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
      {/* Choosing a tab by hand clears the deep-linked selection. Without
          this, the "Selected" marker would stay on a service in a tab the
          agent has navigated away from and back to for their own reasons. */}
      <Tabs
        items={tabs}
        orientation="vertical"
        activeKey={activeTab}
        onChange={(key) => {
          setActiveTab(key);
          setSelectedServiceRef(undefined);
        }}
      />

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
