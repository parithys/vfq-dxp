import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../../components/primitives/Icon';
import type { Customer360Data } from '../../../engines/customer360Engine';
import type { CustomerService } from '../../../engines/customerServicesEngine';
import {
  ActionButton,
  DetailRows,
  FilterSelect,
  GridTable,
  IC,
  IconTile,
  KpiGrid,
  KpiTile,
  Pager,
  Panel,
  Pill,
  SearchBox,
  StatusPill,
  TabPage,
  UnderlineTabs,
  ViewPill,
  fmtDate,
  fmtDateTime,
  qar,
  usePaging,
  type Tone,
} from './c360Kit';
import { Dv } from '../demoValues';
import { str } from '../../../lib/values';

const ORDER_DETAIL_ROUTE = '/order-management/order-approval-detail-attachments-order-details-activities-a';
const DAY = 86_400_000;

const RANGES = [
  { value: '30d', label: 'Last 30 days', days: 30 },
  { value: '6m', label: 'Last 6 months', days: 183 },
  { value: '12m', label: 'Last 12 months', days: 365 },
  { value: 'all', label: 'All time', days: 0 },
];

type ActType = 'Customer Interaction' | 'Order' | 'Ticket' | 'Account Change' | 'Payment' | 'OOB Charge' | 'System Activity';

const TYPE_STYLE: Record<ActType, { icon: string; tone: Tone }> = {
  'Customer Interaction': { icon: IC.headset, tone: 'red' },
  Order: { icon: IC.file, tone: 'blue' },
  Ticket: { icon: IC.clipboard, tone: 'amber' },
  'Account Change': { icon: IC.settings, tone: 'purple' },
  Payment: { icon: IC.card, tone: 'green' },
  'OOB Charge': { icon: IC.wallet, tone: 'blue' },
  'System Activity': { icon: IC.database, tone: 'grey' },
};

const stamp = (v: unknown): number => {
  const t = new Date(String(v ?? '')).getTime();
  return Number.isNaN(t) ? 0 : t;
};

interface Activity {
  id: string;
  type: ActType;
  at: number;
  /** Source value carried no time of day. */
  dateOnly: boolean;
  description: string;
  user?: string;
  channel?: string;
  location?: string;
  status?: string;
  orderId?: string;
  ticketId?: string;
  msisdn?: string;
  remarks?: string;
}

function buildActivities(data: Customer360Data): Activity[] {
  const out: Activity[] = [];
  const dateOnly = (v: unknown) => !/T\d/.test(String(v ?? ''));

  for (const a of data.activities) {
    out.push({
      id: String(a.activityNumber),
      type: 'Customer Interaction',
      at: stamp(a.transactionDate),
      dateOnly: dateOnly(a.transactionDate),
      description: str(a.comments) ?? str(a.journey) ?? String(a.activityNumber),
      user: str(a.agentId),
      channel: str(a.channel),
      location: str(a.area),
      status: str(a.status),
      orderId: str(a.orderId),
      msisdn: str(a.msisdn),
      remarks: str(a.comments),
    });
  }
  for (const o of data.orders) {
    out.push({
      id: `ORD-ACT-${String(o.orderId)}`,
      type: 'Order',
      at: stamp(o.createdAt),
      dateOnly: dateOnly(o.createdAt),
      description: `${str(o.orderType) ?? 'Order'} order created`,
      user: str(o.createdBy),
      channel: str(o.sourceChannel),
      status: str(o.status),
      orderId: str(o.orderId),
      msisdn: str(o.msisdn),
    });
  }
  for (const s of data.simSwapOrders) {
    out.push({
      id: String(s.simSwapOrderId),
      type: 'Order',
      at: 0,
      dateOnly: true,
      description: 'SIM Swap order created',
      status: str(s.status),
      msisdn: str(s.msisdn),
      remarks: str(s.comments),
    });
  }
  for (const t of data.tickets) {
    out.push({
      id: `TT-ACT-${String(t.ticketId)}`,
      type: 'Ticket',
      at: stamp(t.createdAt),
      dateOnly: dateOnly(t.createdAt),
      description: `${String(t.ticketId)} - ${str(t.status) ?? 'Created'}`,
      user: str(t.createdBy),
      status: str(t.status),
      ticketId: str(t.ticketId),
      remarks: str(t.actualIssue),
    });
  }
  for (const a of data.auditTrail) {
    const field = str(a.fieldModified) ?? 'Record';
    const value = str(a.newValue);
    out.push({
      id: String(a.auditId),
      type: 'Account Change',
      at: stamp(a.timestamp),
      dateOnly: dateOnly(a.timestamp),
      description: value ? `${field} changed to ${value}` : `${field} changed`,
      user: str(a.employeeUser),
      remarks: `${str(a.recordType) ?? 'Record'} ${str(a.recordId) ?? ''}`.trim(),
    });
  }
  for (const p of data.payments) {
    out.push({
      id: String(p.paymentId),
      type: 'Payment',
      at: stamp(p.capturedAt),
      dateOnly: dateOnly(p.capturedAt),
      description: `${qar(p.amountQar) ?? 'Payment'}${str(p.chargeType) ? ` - ${str(p.chargeType)}` : ''}`,
      channel: str(p.captureChannel),
      status: str(p.status),
      orderId: str(p.orderId),
      remarks: str(p.receiptNumber) ? `Receipt ${str(p.receiptNumber)}` : undefined,
    });
  }
  // A call record is an out-of-bundle charge only where it was actually charged.
  for (const c of data.callDetailRecords) {
    if (!(Number(c.chargeQAR) > 0)) continue;
    out.push({
      id: String(c.cdrId),
      type: 'OOB Charge',
      at: stamp(c.callDate),
      dateOnly: dateOnly(c.callDate),
      description: `${str(c.callType) ?? 'Usage'} out of bundle charge (${qar(c.chargeQAR)})`,
      user: 'System',
      channel: 'System',
    });
  }
  for (const c of data.communications) {
    out.push({
      id: String(c.communicationId),
      type: 'System Activity',
      at: stamp(c.sentAt),
      dateOnly: dateOnly(c.sentAt),
      description: str(c.messageText) ?? `${str(c.channel) ?? 'Message'} sent to customer`,
      user: 'System',
      channel: str(c.channel),
      status: str(c.deliveryState),
    });
  }
  return out.sort((a, b) => b.at - a.at);
}

const rangeText = (days: number, now: number): string => {
  if (!days) return 'All time';
  return `${fmtDate(new Date(now - days * DAY).toISOString())} - ${fmtDate(new Date(now).toISOString())}`;
};

export function C360Activities({ data }: { data: Customer360Data; services: CustomerService[]; goToTab?: (key: string) => void }) {
  const navigate = useNavigate();
  const [now] = useState(() => Date.now());
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [range, setRange] = useState('6m');
  const [pageSize, setPageSize] = useState(10);
  const [pickedId, setPickedId] = useState<string>();

  const all = useMemo(() => buildActivities(data), [data]);
  const days = RANGES.find((r) => r.value === range)?.days ?? 0;
  // Records with no timestamp can't be placed against a range, so they stay visible.
  const inRange = all.filter((a) => days === 0 || a.at === 0 || a.at >= now - days * DAY);

  const count = (types: ActType[]) => inRange.filter((a) => types.includes(a.type)).length;
  const kpi = {
    total: inRange.length,
    interactions: count(['Customer Interaction']),
    changes: count(['Account Change']),
    transactions: count(['Payment', 'OOB Charge']),
    other: count(['Order', 'Ticket', 'System Activity']),
  };

  const TABS: { key: string; label: string; types?: ActType[] }[] = [
    { key: 'all', label: 'All' },
    { key: 'interactions', label: 'Customer Interactions', types: ['Customer Interaction'] },
    { key: 'orders', label: 'Orders', types: ['Order'] },
    { key: 'tickets', label: 'Tickets', types: ['Ticket'] },
    { key: 'changes', label: 'Account Changes', types: ['Account Change'] },
    { key: 'transactions', label: 'Transactions', types: ['Payment', 'OOB Charge'] },
    { key: 'oob', label: 'OOB Charges', types: ['OOB Charge'] },
    { key: 'system', label: 'System Activities', types: ['System Activity'] },
  ];
  const tabTypes = TABS.find((t) => t.key === tab)?.types;
  const q = query.trim().toLowerCase();
  const rows = inRange.filter((a) => {
    if (tabTypes && !tabTypes.includes(a.type)) return false;
    if (typeFilter !== 'all' && a.type !== typeFilter) return false;
    if (channelFilter !== 'all' && a.channel !== channelFilter) return false;
    if (q && ![a.id, a.description, a.user, a.type].some((v) => v?.toLowerCase().includes(q))) return false;
    return true;
  });

  const paging = usePaging(rows, pageSize);
  const selected = all.find((a) => a.id === pickedId) ?? rows[0];
  const firstShown = paging.total === 0 ? 0 : (paging.page - 1) * pageSize + 1;
  const lastShown = Math.min(paging.page * pageSize, paging.total);

  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    paging.setPage(1);
  };

  const typeOptions = [{ value: 'all', label: 'All' }, ...Object.keys(TYPE_STYLE).map((v) => ({ value: v, label: v }))];
  const channelOptions = [{ value: 'all', label: 'All' }, ...Array.from(new Set(all.map((a) => a.channel).filter(Boolean) as string[])).map((v) => ({ value: v, label: v }))];

  const when = selected && selected.at ? fmtDateTime(new Date(selected.at).toISOString()) : {};

  return (
    <TabPage icon={IC.activity} tone="blue" title="Activities" subtitle="View all customer interactions, activities, transactions and changes across channels">
      <KpiGrid>
        <KpiTile icon={IC.file} tone="blue" label="Total Activities" value={kpi.total} caption={RANGES.find((r) => r.value === range)?.label} />
        <KpiTile icon={IC.headset} tone="red" label="Customer Interactions" value={kpi.interactions} caption="Calls, Store, Digital" />
        <KpiTile icon={IC.settings} tone="blue" label="Account Changes" value={kpi.changes} caption="Account & Profile" />
        <KpiTile icon={IC.swap} tone="red" label="Transactions" value={kpi.transactions} caption="Payments, OOB" />
        <KpiTile icon={IC.clock} tone="purple" label="Other Activities" value={kpi.other} caption="Orders, Tickets, System" />
      </KpiGrid>

      <div className="grid grid-cols-1 @6xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] gap-4 items-start">
        <section className="rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg p-4 space-y-4 min-w-0">
          <UnderlineTabs
            active={tab}
            onChange={(k) => {
              setTab(k);
              paging.setPage(1);
            }}
            items={TABS.map((t) => ({ key: t.key, label: t.label }))}
          />
          <div className="flex flex-wrap items-stretch gap-3">
            <SearchBox value={query} onChange={reset(setQuery)} placeholder="Search by activity ID, description or user" />
            <FilterSelect label="Activity Type" value={typeFilter} options={typeOptions} onChange={reset(setTypeFilter)} />
            <FilterSelect label="Date Range" value={range} options={RANGES.map((r) => ({ value: r.value, label: r.label }))} onChange={reset(setRange)} />
            <FilterSelect label="Channel" value={channelFilter} options={channelOptions} onChange={reset(setChannelFilter)} />
          </div>
          <GridTable
            rows={paging.slice}
            rowKey={(a) => a.id}
            selectedKey={selected?.id}
            onSelect={(a) => setPickedId(a.id)}
            empty="No activities match the current filters."
            cols={[
              { key: 'n', header: '#', render: (_a, i) => firstShown + i },
              {
                key: 'at',
                header: 'Date & Time',
                className: 'whitespace-nowrap',
                render: (a) => {
                  if (!a.at) return <Dv k="activityDateTime" row={{ id: a.id, type: a.type }} />;
                  const d = fmtDateTime(new Date(a.at).toISOString());
                  return (
                    <div className="leading-tight">
                      <div>{d.date}</div>
                      {!a.dateOnly && d.time && <div className="text-fg-2 text-[length:var(--fs-caption)]">{d.time}</div>}
                    </div>
                  );
                },
              },
              {
                key: 'type',
                header: 'Activity Type',
                render: (a) => (
                  <span className="flex items-center gap-2.5">
                    <IconTile icon={TYPE_STYLE[a.type].icon} tone={TYPE_STYLE[a.type].tone} size="sm" />
                    <span>{a.type}</span>
                  </span>
                ),
              },
              { key: 'description', header: 'Description', className: 'min-w-44 break-words' },
              { key: 'user', header: 'User ID', className: 'break-words', render: (a) => a.user ?? <Dv k="activityUser" row={{ type: a.type }} /> },
              { key: 'channel', header: 'Channel', render: (a) => a.channel ?? <Dv k="activityChannel" row={{ type: a.type }} /> },
              { key: 'location', header: 'Location', render: (a) => a.location ?? <Dv k="activityLocation" row={{ type: a.type }} /> },
              {
                key: 'actions',
                header: 'Actions',
                render: (a) => (
                  <span className="flex items-center gap-3">
                    <ViewPill onClick={() => setPickedId(a.id)} />
                    <Icon path={IC.chevRight} className="w-4 h-4 text-fg" />
                  </span>
                ),
              },
            ]}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-fg-2 text-[length:var(--fs-body)]">
              Showing {firstShown}&ndash;{lastShown} of {paging.total} activities
            </span>
            <div className="flex items-center gap-3">
              <Pager page={paging.page} pages={paging.pages} onPage={paging.setPage} />
              <label className="relative rounded-[var(--radius-button)] border border-[var(--field-card-border)] bg-bg">
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    paging.setPage(1);
                  }}
                  aria-label="Rows per page"
                  className="bg-transparent outline-none appearance-none pl-3 pr-8 py-1.5 text-fg text-[length:var(--fs-body)] cursor-pointer"
                >
                  {[10, 25, 50].map((n) => (
                    <option key={n} value={n}>
                      {n} per page
                    </option>
                  ))}
                </select>
                <Icon path={IC.chevDown} className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-fg-2" />
              </label>
            </div>
          </div>
        </section>

        <div className="space-y-4 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ActionButton icon={IC.download} disabled>
              Export
            </ActionButton>
            <span className="inline-flex items-center gap-2 rounded-[var(--radius-button)] border border-[var(--field-card-border)] bg-bg px-3 py-2 text-fg text-[length:var(--fs-body)]">
              <Icon path={IC.calendar} className="w-4 h-4" />
              {rangeText(days, now)}
            </span>
          </div>
          <Panel icon={IC.clipboard} title="Activity Details">
            {selected ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 min-w-0">
                  <IconTile icon={TYPE_STYLE[selected.type].icon} tone={TYPE_STYLE[selected.type].tone} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-fg font-bold text-[length:var(--fs-body-lg)] break-words min-w-0">{selected.description}</div>
                      <Pill tone={TYPE_STYLE[selected.type].tone}>{selected.type.replace(' Activity', '')}</Pill>
                    </div>
                    <div className="text-fg-2 text-[length:var(--fs-caption)]">{when.date ? `${when.date}${!selected.dateOnly && when.time ? `  |  ${when.time}` : ''}` : '-'}</div>
                  </div>
                </div>
                <DetailRows
                  rows={[
                    { label: 'Activity ID', value: selected.id.replace(/^(ORD|TT)-ACT-/, ''), strong: false },
                    { label: 'Activity Type', value: selected.type, strong: false },
                    { label: 'Order ID', value: selected.orderId ?? '-', strong: false },
                    { label: 'Description', value: selected.description, strong: false },
                    { label: 'MSISDN', value: selected.msisdn ?? '-', strong: false },
                    { label: 'User ID', value: selected.user ?? <Dv k="activityUser" row={{ type: selected.type }} />, strong: false },
                    { label: 'Channel', value: selected.channel ?? <Dv k="activityChannel" row={{ type: selected.type }} />, strong: false },
                    { label: 'Location', value: selected.location ?? <Dv k="activityLocation" row={{ type: selected.type }} />, strong: false },
                    { label: 'Status', value: selected.status ? <StatusPill status={selected.status} /> : '-', strong: false },
                    { label: 'Related Ticket', value: selected.ticketId ?? <Dv k="relatedTicket" />, strong: false },
                    { label: 'Related Offer', value: <Dv k="relatedOffer" />, strong: false },
                    { label: 'Remarks', value: selected.remarks ?? <Dv k="activityRemarks" row={{ type: selected.type }} />, strong: false },
                  ]}
                />
                <button
                  type="button"
                  disabled={!selected.orderId}
                  onClick={() => selected.orderId && navigate(`${ORDER_DETAIL_ROUTE}?id=${selected.orderId}`)}
                  className="w-full rounded-[var(--radius-button)] border border-accent px-4 py-2 text-[length:var(--fs-btn-compact)] font-medium text-accent enabled:hover:bg-[color-mix(in_oklab,var(--accent),var(--bg)_94%)] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  View Related Order &rarr;
                </button>
              </div>
            ) : (
              <p className="text-muted text-[length:var(--fs-body)] py-4 text-center">Select an activity to see its details.</p>
            )}
          </Panel>
        </div>
      </div>
    </TabPage>
  );
}
