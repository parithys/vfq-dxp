import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useStartNewConnection } from '../useStartNewConnection';
import { RevealValue, useFieldAccess } from '../fieldAccess';
import { Icon } from '../../../components/primitives/Icon';
import type { Customer360Data } from '../../../engines/customer360Engine';
import type { CustomerService } from '../../../engines/customerServicesEngine';
import { buildAssetsFieldResolver } from './assetsResolvers';
import { ActionButton, Donut, fmtDate, fmtDateTime, FilterSelect, GridTable, IC, IconTile, KpiTile, Panel, Pill, Progress, qar, SearchBox, StatusPill, TabPage, UnderlineTabs } from './C360Kit';
import type { GridCol, Tone } from './C360Kit';
import { ServiceActionsMenu } from '../CustomerActionsMenu';
import { Dv } from '../demoValues';
import { str, num } from '../../../lib/values';

const dash = (v: ReactNode | undefined | null): ReactNode => (v === undefined || v === null || v === '' ? '-' : v);

type Row = Record<string, unknown>;

/** Table / panel label for a service's type. */
function typeLabel(s: CustomerService): string {
  switch (s.category) {
    case 'Prepaid':
    case 'Postpaid':
      return 'Mobile';
    case 'GigaHome Fibre':
    case 'GigaHome 5G':
      return 'GigaHome';
    case 'TV / Entertainment':
      return 'TV';
    case 'Fixed Line':
      return 'Fixed Line';
    default:
      return 'IoT';
  }
}

const TYPE_TILES: { label: string; icon: string; tone: Tone }[] = [
  { label: 'Mobile', icon: IC.mobile, tone: 'red' },
  { label: 'Fixed Line', icon: IC.bars, tone: 'purple' },
  { label: 'TV', icon: IC.tv, tone: 'amber' },
  { label: 'GigaHome', icon: IC.wifi, tone: 'blue' },
  { label: 'IoT', icon: IC.cpu, tone: 'grey' },
];

const normStatus = (v: string | undefined): string | undefined => (v === undefined ? undefined : /^active/i.test(v) ? 'Active' : v);

const SORTS = [
  { value: 'msisdn-asc', label: 'Sort by: MSISDN (Asc)' },
  { value: 'msisdn-desc', label: 'Sort by: MSISDN (Desc)' },
  { value: 'plan-asc', label: 'Sort by: Plan (Asc)' },
  { value: 'status-asc', label: 'Sort by: Status (Asc)' },
];

const SUB_TABS = [
  { key: 'addons', label: 'Add-ons & Offers' },
  { key: 'usage', label: 'Usage History' },
  { key: 'penalties', label: 'Lock-in & Penalties' },
  { key: 'assets', label: 'Installed Assets' },
  { key: 'related', label: 'Related Orders & Tickets' },
];

/** One tinted gauge-less circle used for the Primary Balance. */
function BalanceCircle({ value }: { value: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-20 h-20 rounded-full border-[3px] border-accent bg-[color-mix(in_oklab,var(--accent),var(--bg)_92%)] flex items-center justify-center text-center">
        <span className="font-bold text-accent text-[length:var(--fs-body)] px-1 break-words">{value}</span>
      </div>
      <span className="text-fg-2 text-[length:var(--fs-caption)]">Primary Balance</span>
    </div>
  );
}

function Field({ label, value }: { label: string; value: ReactNode | undefined | null }) {
  const mode = useFieldAccess()(label);
  if (mode === 'hidden') return null;
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-border-soft last:border-0 text-[length:var(--fs-body)]">
      <dt className="text-fg-2 shrink-0">{label}</dt>
      <dd className="text-fg font-medium min-w-0 break-words text-right">{mode === 'drill-down' ? <RevealValue>{dash(value)}</RevealValue> : dash(value)}</dd>
    </div>
  );
}

/**
 * Customer 360 "Products & Services" tab: KPI strip, searchable / sortable service table, the selected service's
 * detail panel and the per-service sub-tabs. Everything is bound to Customer360Data; a missing value shows "-".
 */
export function C360ProductsServices({ data, services, goToTab }: { data: Customer360Data; services: CustomerService[]; goToTab?: (key: string) => void }) {
  const startNewConnection = useStartNewConnection(data.customer.customerId);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [sort, setSort] = useState('msisdn-asc');
  const [selectedRef, setSelectedRef] = useState<string | undefined>(services[0]?.ref);
  const [subTab, setSubTab] = useState('addons');
  const [panelOpen, setPanelOpen] = useState(true);

  const account = data.accounts[0];
  const creditLimit = data.creditLimits[0];
  const billLimit = qar(num(creditLimit?.creditLimitQar ?? creditLimit?.creditLimitQAR));
  const usage = data.serviceUsage[0];
  const balance = data.inPlatformBalances[0];
  const extras = data.overviewExtras[0];
  const digital = data.digitalEngagement[0];
  const barringStatus = (account as unknown as { barringStatus?: string; barringType?: string } | undefined)?.barringStatus;
  const barringType = (account as unknown as { barringType?: string } | undefined)?.barringType;

  const info = useMemo(() => {
    const out = new Map<string, { asset?: Row; status?: string; plan?: string; addons: Row[]; discounts: Row[]; primary: boolean; simSerial?: string }>();
    for (const s of services) {
      const r = buildAssetsFieldResolver(s, data);
      const asset = data.installedAssets.find((ia) => ia.serviceId === s.ref || ia.installedAssetId === s.ref);
      const matched = asset ? data.addonsDiscounts.filter((ad) => ad.planId === asset.promotion) : [];
      out.set(s.ref, {
        asset,
        status: normStatus(str(s.tab === 'mobile' ? r('MSISDN Status (Active, Suspended, Barred)') : (asset?.status ?? s.status))),
        plan: str(r('Plan Name')),
        addons: matched.filter((a) => a.category !== 'Discount'),
        discounts: matched.filter((a) => a.category === 'Discount'),
        primary: s.identifier === data.customer.phone,
        simSerial: str(r('Sim serial')),
      });
    }
    return out;
  }, [services, data]);

  const get = (s: CustomerService) => info.get(s.ref)!;
  const isMobile = (s: CustomerService) => s.tab === 'mobile';

  // Data / voice / text consumption is held per account, so it is attached to the customer's primary line only.
  const dataUsed = num(usage?.currentDataUsageGB);
  const dataTotal = dataUsed !== undefined && num(usage?.availableDataBalanceGB) !== undefined ? dataUsed + Number(usage?.availableDataBalanceGB) : undefined;
  const voiceUsed = num(usage?.currentVoiceUsageMinutes);
  const voiceTotal = num(extras?.voiceAllowanceMin);
  const smsTotal = num(extras?.smsAllowance);
  const smsUsed = smsTotal !== undefined && num(extras?.smsRemaining) !== undefined ? smsTotal - Number(extras?.smsRemaining) : undefined;
  const pct = (used: number | undefined, total: number | undefined) => (used !== undefined && total ? (used / total) * 100 : 0);

  const active = services.filter((s) => get(s).status === 'Active').length;
  const statuses = Array.from(new Set(services.map((s) => get(s).status).filter((x): x is string => Boolean(x))));
  const types = Array.from(new Set(services.map(typeLabel)));

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = services.filter((s) => {
      const i = info.get(s.ref)!;
      if (typeFilter !== 'all' && typeLabel(s) !== typeFilter) return false;
      if (statusFilter !== 'all' && i.status !== statusFilter) return false;
      return !q || [s.identifier, s.label, i.plan, typeLabel(s)].some((v) => v?.toLowerCase().includes(q));
    });
    const key = (s: CustomerService) => (sort.startsWith('plan') ? (info.get(s.ref)?.plan ?? s.label) : sort.startsWith('status') ? (info.get(s.ref)?.status ?? '') : s.identifier);
    const dir = sort.endsWith('desc') ? -1 : 1;
    return [...list].sort((a, b) => dir * key(a).localeCompare(key(b), undefined, { numeric: true }));
  }, [services, info, query, typeFilter, statusFilter, sort]);

  const selected = services.find((s) => s.ref === selectedRef);
  const sel = selected ? get(selected) : undefined;
  const select = (s: CustomerService) => {
    setSelectedRef(s.ref);
    setPanelOpen(true);
  };
  const filterCount = (typeFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0);

  const columns: GridCol<CustomerService>[] = [
    { key: 'n', header: '#', render: (_s, i) => i + 1, className: 'w-10' },
    {
      key: 'msisdn',
      header: 'MSISDN / Service ID',
      render: (s) => (
        <div className="min-w-0">
          <div className="font-semibold break-words">{s.identifier}</div>
          {get(s).primary && <Pill tone="blue">Primary</Pill>}
        </div>
      ),
    },
    { key: 'type', header: 'Service Type', render: (s) => typeLabel(s) },
    { key: 'plan', header: 'Plan / Product', render: (s) => <span className="break-words">{dash(get(s).plan ?? s.label)}</span> },
    { key: 'status', header: 'Status', render: (s) => (get(s).status ? <StatusPill status={get(s).status as string} /> : '-') },
    {
      key: 'balance',
      header: 'Current Balance',
      render: (s) =>
        get(s).primary && isMobile(s) && dataUsed !== undefined && dataTotal ? (
          <div className="min-w-28">
            <div className="text-[length:var(--fs-caption)] whitespace-nowrap">
              {dataUsed} GB <span className="text-fg-2">/ {Number(dataTotal.toFixed(1))} GB</span>
            </div>
            <Progress pct={pct(dataUsed, dataTotal)} />
          </div>
        ) : (
          <Dv k="serviceBalance" row={{ category: s.category }} />
        ),
    },
    { key: 'limit', header: 'Bill Limit', render: (s) => (isMobile(s) ? dash(billLimit) : <Dv k="serviceBillLimit" row={{ category: s.category }} />) },
    { key: 'addons', header: 'Add-ons', render: (s) => (get(s).asset ? get(s).addons.length : <Dv k="serviceAddons" />) },
    {
      key: 'actions',
      header: 'Actions',
      render: (s) => (
        <span className="inline-flex items-center gap-1">
          <ServiceActionsMenu
            customerId={data.customer.customerId}
            customerName={data.customer.name}
            service={s}
            onSupport={goToTab ? () => goToTab('tickets-support') : undefined}
          />
          <button type="button" aria-label={`View ${s.identifier}`} onClick={() => select(s)} className="text-fg">
            <Icon path={IC.chevRight} className="w-4 h-4" />
          </button>
        </span>
      ),
    },
  ];

  // Sub-tab bodies
  const addonRows = sel?.addons ?? [];
  const cdrs = [...data.callDetailRecords].sort((a, b) => String(b.callDate ?? '').localeCompare(String(a.callDate ?? ''))).slice(0, 10);
  const relatedOrders = selected ? data.orders.filter((o) => o.msisdn === selected.ref || (sel?.asset && o.orderId === sel.asset.orderNumber)) : [];
  const dateCell = (v: unknown) => dash(fmtDate(v));

  const subBody = (() => {
    switch (subTab) {
      case 'addons':
        return (
          <div className="space-y-3">
            <h4 className="flex items-center gap-2 text-fg font-semibold text-[length:var(--fs-body)]">
              <Icon path={IC.clock} className="w-4 h-4" />
              Active Add-ons ({sel?.status === 'Active' ? addonRows.length : 0})
            </h4>
            <GridTable
              rows={addonRows as Row[]}
              rowKey={(r) => String(r.addonDiscountId)}
              empty="No add-ons on file for this service."
              cols={[
                { key: 'name', header: 'Add-on Name', render: (r) => dash(str(r.name)) },
                { key: 'type', header: 'Type', render: (r) => dash(str(r.addonType)) },
                { key: 'status', header: 'Status', render: () => (sel?.status ? <StatusPill status={sel.status} /> : '-') },
                { key: 'start', header: 'Start Date', render: () => dateCell(sel?.asset?.effectiveFrom) },
                { key: 'end', header: 'Expiry Date', render: () => dateCell(sel?.asset?.effectiveTo) },
                { key: 'price', header: 'Price', render: (r) => dash(qar(num(r.price))) },
              ]}
            />
          </div>
        );
      case 'usage':
        return (
          <GridTable
            rows={selected && isMobile(selected) ? (cdrs as Row[]) : []}
            rowKey={(r) => String(r.cdrId)}
            empty={selected && !isMobile(selected) ? 'Usage history is recorded for mobile lines only.' : 'No usage on file for this customer.'}
            cols={[
              { key: 'date', header: 'Date', render: (r) => dateCell(r.callDate) },
              { key: 'type', header: 'Type', render: (r) => dash(str(r.callType)) },
              { key: 'dest', header: 'Destination', render: (r) => dash(str(r.destination)) },
              { key: 'dur', header: 'Duration (s)', render: (r) => dash(str(r.durationSeconds)) },
              { key: 'charge', header: 'Charge', render: (r) => dash(qar(num(r.chargeQAR))) },
            ]}
          />
        );
      case 'penalties':
        return (
          <GridTable
            rows={data.penalties as Row[]}
            rowKey={(r) => String(r.penaltyId)}
            empty="No lock-in or penalty records for this customer."
            cols={[
              { key: 'type', header: 'Action', render: (r) => <span className="capitalize">{dash(str(r.actionType))}</span> },
              { key: 'amt', header: 'Amount', render: (r) => dash(num(r.calculatedValue) !== undefined ? `${String(r.currency ?? 'QAR')} ${String(r.calculatedValue)}` : undefined) },
              { key: 'status', header: 'Status', render: (r) => (str(r.status) ? <StatusPill status={String(r.status)} /> : '-') },
              { key: 'at', header: 'Calculated', render: (r) => dash(fmtDateTime(r.calculatedAt).date) },
              { key: 'src', header: 'Source', render: (r) => dash(str(r.calculationSource)) },
            ]}
          />
        );
      case 'assets':
        return (
          <GridTable
            rows={data.installedAssets as Row[]}
            rowKey={(r) => String(r.installedAssetId)}
            selectedKey={sel?.asset ? String(sel.asset.installedAssetId) : undefined}
            empty="No installed assets for this customer."
            cols={[
              { key: 'p', header: 'Product / Service', render: (r) => dash(str(r.productServiceName)) },
              { key: 'id', header: 'Service ID', render: (r) => dash(str(r.serviceId)) },
              { key: 'st', header: 'Status', render: (r) => (str(r.status) ? <StatusPill status={String(r.status)} /> : '-') },
              { key: 'from', header: 'Effective From', render: (r) => dateCell(r.effectiveFrom) },
              { key: 'price', header: 'Price', render: (r) => dash(qar(num(r.price))) },
            ]}
          />
        );
      default:
        return (
          <div className="space-y-4">
            <div>
              <h4 className="text-fg font-semibold text-[length:var(--fs-body)] mb-2">Orders ({relatedOrders.length})</h4>
              <GridTable
                rows={relatedOrders as Row[]}
                rowKey={(r) => String(r.orderId)}
                empty="No orders linked to this service."
                cols={[
                  { key: 'id', header: 'Order', render: (r) => dash(str(r.orderId)) },
                  { key: 'type', header: 'Type', render: (r) => dash(str(r.orderType)) },
                  { key: 'st', header: 'Status', render: (r) => (str(r.status) ? <StatusPill status={String(r.status)} /> : '-') },
                  { key: 'at', header: 'Created', render: (r) => dateCell(r.createdAt) },
                  { key: 'tot', header: 'Total', render: (r) => dash(qar(num(r.totalQAR))) },
                ]}
              />
            </div>
            <div>
              <h4 className="text-fg font-semibold text-[length:var(--fs-body)] mb-2">Customer tickets ({data.tickets.length})</h4>
              <GridTable
                rows={data.tickets as Row[]}
                rowKey={(r) => String(r.ticketId)}
                empty="No tickets for this customer."
                cols={[
                  { key: 'id', header: 'Ticket', render: (r) => dash(str(r.ticketId)) },
                  { key: 'cat', header: 'Category', render: (r) => dash(str(r.category)) },
                  { key: 'st', header: 'Status', render: (r) => (str(r.status) ? <StatusPill status={String(r.status)} /> : '-') },
                  { key: 'pr', header: 'Priority', render: (r) => dash(str(r.priority)) },
                  { key: 'at', header: 'Created', render: (r) => dateCell(r.createdAt) },
                ]}
              />
            </div>
          </div>
        );
    }
  })();

  const planType = selected && isMobile(selected) ? selected.category : undefined;
  const mobileSel = selected ? isMobile(selected) : false;
  const sMobilePrimary = mobileSel && sel?.primary;
  const discount = sel?.discounts[0];

  return (
    <TabPage
      icon={IC.box}
      title="Products & Services"
      subtitle="View and manage all customer connections, plans, add-ons, devices and services"
      actions={
        <>
          <ActionButton primary icon={IC.plus} onClick={startNewConnection}>
            Add Service
          </ActionButton>
        </>
      }
    >
      <div className="grid grid-cols-1 @lg:grid-cols-2 @4xl:grid-cols-[repeat(2,minmax(0,1fr))_minmax(0,3.2fr)] gap-3">
        <KpiTile icon={IC.box} tone="blue" label="Total Connections" value={services.length} />
        <KpiTile icon={IC.shieldCheck} tone="green" label="Active Services" value={active} />
        <section className="@lg:col-span-2 @4xl:col-span-1 rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg p-4 min-w-0">
          <h3 className="text-fg font-semibold text-[length:var(--fs-body)] mb-2">Service Types</h3>
          <ul className="grid grid-cols-2 @lg:grid-cols-5 gap-3">
            {TYPE_TILES.map((t) => (
              <li key={t.label} className="flex items-center gap-2 min-w-0">
                <IconTile icon={t.icon} tone={t.tone} size="sm" />
                <div className="min-w-0">
                  <div className="text-fg-2 text-[length:var(--fs-caption)] truncate">{t.label}</div>
                  <div className="text-fg font-bold text-[length:var(--fs-body-lg)] leading-tight">{services.filter((s) => typeLabel(s) === t.label).length}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className={`grid grid-cols-1 gap-4 items-start ${panelOpen ? '@6xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]' : ''}`}>
        <div className="space-y-4 min-w-0">
          <Panel
            icon={IC.bars}
            title={`All Services (${services.length})`}
            flush
            action={
              <div className="flex flex-wrap items-center justify-end gap-2 min-w-0">
                <div className="w-56 max-w-full flex">
                  <SearchBox value={query} onChange={setQuery} placeholder="Search by MSISDN, plan or service" />
                </div>
                <button
                  type="button"
                  aria-expanded={filterOpen}
                  onClick={() => setFilterOpen((o) => !o)}
                  className="inline-flex items-center gap-2 rounded-[var(--radius-button)] border border-[var(--field-card-border)] bg-bg px-3 py-2 text-[length:var(--fs-body)] text-fg hover:bg-surface"
                >
                  <Icon path={IC.filter} className="w-4 h-4" />
                  Filter{filterCount > 0 ? ` (${filterCount})` : ''}
                  <Icon path={IC.chevDown} className="w-4 h-4" />
                </button>
                <label className="rounded-[var(--radius-button)] border border-[var(--field-card-border)] bg-bg">
                  <span className="sr-only">Sort services</span>
                  <select value={sort} onChange={(e) => setSort(e.target.value)} className="bg-transparent outline-none px-3 py-2 text-[length:var(--fs-body)] text-fg cursor-pointer">
                    {SORTS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            }
          >
            {filterOpen && (
              <div className="flex flex-wrap gap-3 px-4 pb-3">
                <FilterSelect label="Service Type" value={typeFilter} onChange={setTypeFilter} options={[{ value: 'all', label: 'All types' }, ...types.map((t) => ({ value: t, label: t }))]} />
                <FilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={[{ value: 'all', label: 'All statuses' }, ...statuses.map((t) => ({ value: t, label: t }))]} />
                {filterCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setTypeFilter('all');
                      setStatusFilter('all');
                    }}
                    className="text-accent text-[length:var(--fs-body)] hover:underline"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
            <GridTable
              cols={columns}
              rows={rows}
              rowKey={(s) => s.ref}
              selectedKey={panelOpen ? selectedRef : undefined}
              onSelect={select}
              empty={services.length === 0 ? 'No connections on file for this customer.' : 'No services match the current search or filters.'}
            />
          </Panel>

          <section className="rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg p-4 space-y-4 min-w-0">
            <UnderlineTabs items={SUB_TABS} active={subTab} onChange={setSubTab} />
            {!selected && services.length > 0 && <p className="text-muted text-[length:var(--fs-body)]">Select a service to see its details.</p>}
            {(selected || services.length === 0) && subBody}
          </section>
        </div>

        {panelOpen && (
          <aside className="rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg p-4 space-y-4 min-w-0">
            {!selected || !sel ? (
              <p className="text-muted text-[length:var(--fs-body)] py-6 text-center">{services.length === 0 ? 'No services to show.' : 'Select a service to see its details.'}</p>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <IconTile icon={mobileSel ? IC.mobile : selected.tab === 'fibre' ? IC.wifi : IC.cpu} tone="red" />
                  <span className="text-fg font-bold text-[length:var(--fs-h5)] break-words min-w-0">{selected.identifier}</span>
                  {sel.status && <StatusPill status={sel.status} />}
                  {sel.primary && (
                    <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--field-card-border)] bg-surface px-2.5 py-0.5 text-[length:var(--fs-caption)] text-fg-2">
                      <Icon path={IC.star} className="w-3.5 h-3.5" />
                      Primary MSISDN
                    </span>
                  )}
                  <button type="button" aria-label="Close details" onClick={() => setPanelOpen(false)} className="ml-auto text-fg-2 hover:text-fg">
                    <Icon path={IC.x} className="w-5 h-5" />
                  </button>
                </div>

                <Panel icon={IC.box} title="Plan & Usage" className="bg-[color-mix(in_oklab,var(--surface),var(--bg)_50%)]">
                  <div className="flex flex-wrap items-center gap-4">
                    <dl className="flex-1 min-w-48">
                      <Field label="Plan Name" value={sel.plan ?? selected.label} />
                      <Field label="Plan Type" value={planType} />
                      <Field label="Activation Date" value={fmtDate(sel.asset?.effectiveFrom) ?? <Dv k="activationDate" />} />
                      <Field label="Contract End Date" value={fmtDate(sel.asset?.effectiveTo) ?? <Dv k="contractEnd" row={{ from: sel.asset?.effectiveFrom }} />} />
                      <Field label="Customer Since" value={<Dv k="customerSince" />} />
                    </dl>
                    {mobileSel && (
                      <div className="flex flex-wrap gap-3 justify-center">
                        <Donut pct={sMobilePrimary ? pct(dataUsed, dataTotal) : 0} value={sMobilePrimary && dataUsed !== undefined ? `${dataUsed} GB` : '-'} unit={sMobilePrimary && dataTotal ? `of ${Number(dataTotal.toFixed(1))} GB` : undefined} caption="Data" />
                        <Donut pct={sMobilePrimary ? pct(voiceUsed, voiceTotal) : 0} value={sMobilePrimary && voiceUsed !== undefined ? voiceUsed : '-'} unit={sMobilePrimary && voiceTotal ? `of ${voiceTotal} Mins` : undefined} caption="Voice" />
                        <Donut pct={sMobilePrimary ? pct(smsUsed, smsTotal) : 0} value={sMobilePrimary && smsUsed !== undefined ? smsUsed : '-'} unit={sMobilePrimary && smsTotal ? `of ${smsTotal} SMS` : undefined} caption="Text" />
                        <BalanceCircle value={sMobilePrimary ? (qar(num(balance?.mainBalanceQAR)) ?? '-') : '-'} />
                      </div>
                    )}
                  </div>
                </Panel>

                <div className="grid grid-cols-1 @lg:grid-cols-2 @6xl:grid-cols-1 @7xl:grid-cols-2 gap-4">
                  <Panel icon={IC.settings} title="Service Details">
                    <dl>
                      <Field label="Service Status" value={sel.status ? <StatusPill status={sel.status} /> : undefined} />
                      <Field label="Barrings" value={mobileSel ? (barringType ?? (barringStatus === 'Not Barred' ? 'None' : barringStatus)) : undefined} />
                      <Field label="Bill Limit" value={mobileSel ? billLimit : undefined} />
                      <Field label="Discount" value={discount ? `${String(discount.name)}${num(discount.durationMonths) !== undefined ? ` (${String(discount.durationMonths)} months)` : ''}` : <Dv k="discount" />} />
                      <Field label="SIM Serial Number" value={sel.simSerial ?? <Dv k="simSerial" />} />
                    </dl>
                  </Panel>
                  <div className="space-y-4 min-w-0">
                    <Panel
                      icon={IC.gift}
                      title={`Add-ons (${sel.addons.length})`}
                      action={
                        <button type="button" onClick={() => setSubTab('addons')} className="text-accent font-medium text-[length:var(--fs-body)] hover:underline whitespace-nowrap">
                          View All &rarr;
                        </button>
                      }
                    >
                      {sel.addons.length === 0 ? (
                        <p className="text-muted text-[length:var(--fs-body)]">No add-ons on file.</p>
                      ) : (
                        <ul>
                          {sel.addons.map((a) => (
                            <li key={String(a.addonDiscountId)} className="flex items-center justify-between gap-2 py-1.5 text-[length:var(--fs-body)]">
                              <span className="text-fg min-w-0 break-words">{String(a.name)}</span>
                              {sel.status && <StatusPill status={sel.status} />}
                            </li>
                          ))}
                        </ul>
                      )}
                    </Panel>
                    <Panel icon={IC.mobile} title="Device & App">
                      <dl>
                        <Field label="App User" value={digital ? (digital.appActiveUser ? 'Yes' : 'No') : undefined} />
                        <Field label="Last Login" value={digital?.appLastLoginAt ? [fmtDateTime(digital.appLastLoginAt).date, fmtDateTime(digital.appLastLoginAt).time].filter(Boolean).join(' - ') : undefined} />
                        <Field label="App Version" value={[str(digital?.appVersion), str(extras?.phoneVersion)].filter(Boolean).join(' | ') || undefined} />
                      </dl>
                    </Panel>
                  </div>
                </div>
              </>
            )}
          </aside>
        )}
      </div>
    </TabPage>
  );
}
