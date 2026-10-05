import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../../components/primitives/Icon';
import { useEntityStore } from '../../../stores/entityStore';
import { TicketCreationModal, type NewTicketValue } from '../../../modules/trouble-ticketing-complaints/screens/TicketCreationModal';
import { buildNewTicketRecord } from '../../../modules/trouble-ticketing-complaints/ticketReferenceData';
import type { Customer360Data } from '../../../engines/customer360Engine';
import type { CustomerService } from '../../../engines/customerServicesEngine';
import {
  ActionButton,
  FilterSelect,
  GridTable,
  IC,
  KebabButton,
  KpiGrid,
  KpiTile,
  LinkAction,
  Pill,
  Panel,
  DetailRows,
  SearchBox,
  StatusPill,
  TabPage,
  UnderlineTabs,
  ViewPill,
  fmtDate,
  fmtDateTime,
  type Tone,
} from './c360Kit';

const TICKET_DETAIL_ROUTE = '/trouble-ticketing-complaints/ticket-homepage';
const RESOLVED = new Set(['Solved', 'Completed', 'Closed']);
const CLOSED = new Set(['Solved', 'Completed', 'Closed', 'Cancelled']);
const DAY = 86_400_000;

const RANGES = [
  { value: '30d', label: 'Last 30 days', days: 30 },
  { value: '6m', label: 'Last 6 months', days: 183 },
  { value: '12m', label: 'Last 12 months', days: 365 },
  { value: 'all', label: 'All time', days: 0 },
];

const str = (v: unknown): string | undefined => (v === undefined || v === null || v === '' ? undefined : String(v));
const time = (v: unknown): number => {
  const t = new Date(String(v ?? '')).getTime();
  return Number.isNaN(t) ? 0 : t;
};

interface Ticket {
  id: string;
  raw: Record<string, unknown>;
  type: string;
  subType?: string;
  issue: string;
  status: string;
  priority: string;
  createdAt: number;
  createdBy?: string;
  assignedTo?: string;
  slaHours?: number;
  open: boolean;
  resolved: boolean;
  overdue: boolean;
  pendingCustomer: boolean;
}

/** "3-Medium" -> "Medium"; the number prefix is the LOV's sort key, not part of the label. */
const priorityLabel = (p: string) => p.replace(/^\d+\s*-\s*/, '');
function priorityTone(p: string): Tone {
  const l = priorityLabel(p).toLowerCase();
  if (/asap|high|critical/.test(l)) return 'red';
  if (/medium/.test(l)) return 'amber';
  if (/low/.test(l)) return 'blue';
  return 'grey';
}

function lastUpdated(t: Record<string, unknown>): number {
  const acts = (t.activities as { createdAt?: string }[] | undefined) ?? [];
  const esc = (t.escalations as { escalatedAt?: string }[] | undefined) ?? [];
  return Math.max(time(t.createdAt), time(t.assignedAt), time(t.closedAt), ...acts.map((a) => time(a.createdAt)), ...esc.map((e) => time(e.escalatedAt)));
}

const fmtStamp = (ms: number): string | undefined => {
  if (!ms) return undefined;
  const { date, time: tm } = fmtDateTime(new Date(ms).toISOString());
  return tm ? `${date}  |  ${tm}` : date;
};

function noteText(n: unknown): string | undefined {
  if (typeof n === 'string') return n;
  if (n && typeof n === 'object') {
    const o = n as Record<string, unknown>;
    return str(o.text) ?? str(o.note) ?? str(o.content) ?? str(o.description);
  }
  return undefined;
}

interface ActivityRow {
  key: string;
  at: number;
  activity: string;
  user: string;
  details: string;
}

function activityFor(t: Ticket): ActivityRow[] {
  const r = t.raw;
  const rows: ActivityRow[] = [{ key: `${t.id}-created`, at: t.createdAt, activity: 'Ticket created', user: t.createdBy ?? '-', details: t.issue }];
  ((r.activities as Record<string, unknown>[] | undefined) ?? []).forEach((a, i) =>
    rows.push({ key: `${t.id}-a${i}`, at: time(a.createdAt), activity: str(a.type) ?? 'Update', user: str(a.createdBy) ?? '-', details: str(a.description) ?? '-' }),
  );
  ((r.escalations as Record<string, unknown>[] | undefined) ?? []).forEach((e, i) =>
    rows.push({ key: `${t.id}-e${i}`, at: time(e.escalatedAt), activity: 'Ticket escalated', user: str(e.escalatedBy) ?? '-', details: str(e.reason) ?? '-' }),
  );
  if (str(r.closedAt)) rows.push({ key: `${t.id}-closed`, at: time(r.closedAt), activity: 'Ticket closed', user: '-', details: str(r.resolutionCode) ?? '-' });
  return rows.sort((a, b) => b.at - a.at);
}

export function C360TicketsSupport({
  data,
  goToTab,
  onTicketCreated,
}: {
  data: Customer360Data;
  services: CustomerService[];
  goToTab?: (key: string) => void;
  onTicketCreated?: (ticket: Record<string, unknown>) => void;
}) {
  const navigate = useNavigate();
  const createRecord = useEntityStore((s) => s.createRecord);
  const [modalOpen, setModalOpen] = useState(false);
  const [now] = useState(() => Date.now());
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [range, setRange] = useState('6m');
  const [pickedId, setPickedId] = useState<string>();

  const tickets: Ticket[] = useMemo(
    () =>
      data.tickets
        .map((t) => {
          const status = String(t.status ?? '-');
          const closed = CLOSED.has(status);
          const due = time(t.slaDueAt);
          return {
            id: String(t.ticketId),
            raw: t,
            type: str(t.category) ?? '-',
            subType: str(t.area),
            issue: str(t.actualIssue) ?? '-',
            status,
            priority: str(t.priority) ?? '-',
            createdAt: time(t.createdAt),
            createdBy: str(t.createdBy),
            assignedTo: str(t.assignedTo),
            slaHours: typeof t.slaTargetHours === 'number' ? t.slaTargetHours : undefined,
            open: !closed,
            resolved: RESOLVED.has(status),
            overdue: !closed && due > 0 && due < now,
            pendingCustomer: !closed && /pending.*customer|customer.*(action|pending)/i.test(status),
          };
        })
        .sort((a, b) => b.createdAt - a.createdAt),
    [data.tickets, now],
  );

  const kpi = {
    total: tickets.length,
    open: tickets.filter((t) => t.open).length,
    resolved: tickets.filter((t) => t.resolved).length,
    overdue: tickets.filter((t) => t.overdue).length,
    pending: tickets.filter((t) => t.pendingCustomer).length,
  };

  const days = RANGES.find((r) => r.value === range)?.days ?? 0;
  const inRange = tickets.filter((t) => days === 0 || t.createdAt >= now - days * DAY);
  const tabCount = {
    all: inRange.length,
    open: inRange.filter((t) => t.open).length,
    resolved: inRange.filter((t) => t.resolved).length,
    overdue: inRange.filter((t) => t.overdue).length,
    pending: inRange.filter((t) => t.pendingCustomer).length,
  };

  const q = query.trim().toLowerCase();
  const rows = inRange.filter((t) => {
    if (tab === 'open' && !t.open) return false;
    if (tab === 'resolved' && !t.resolved) return false;
    if (tab === 'overdue' && !t.overdue) return false;
    if (tab === 'pending' && !t.pendingCustomer) return false;
    if (typeFilter !== 'all' && t.type !== typeFilter) return false;
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (q && ![t.id, t.type, t.subType, t.issue, t.status, t.createdBy].some((v) => v?.toLowerCase().includes(q))) return false;
    return true;
  });

  const selected = tickets.find((t) => t.id === pickedId) ?? rows[0];
  const activity = selected ? activityFor(selected) : [];

  const createTicket = async (value: NewTicketValue) => {
    const ticketId = `TT-${Date.now().toString().slice(-6)}`;
    const record = buildNewTicketRecord({ ticketId, ...value, createdBy: 'AGENT-VINODHINIR' });
    await createRecord('trouble-tickets', record);
    onTicketCreated?.(record);
    setModalOpen(false);
  };

  const openFull = (id: string) => navigate(`${TICKET_DETAIL_ROUTE}?id=${id}`);
  const showTab = (key: string) => {
    setTab(key);
    setRange('all');
  };

  const complaints = tickets.filter((t) => /complaint/i.test(t.type)).length;
  const related = [
    { label: 'Related Orders', icon: IC.cart, count: data.orders.length, onClick: goToTab ? () => goToTab('orders') : undefined },
    { label: 'Related Activities', icon: IC.activity, count: data.activities.length, onClick: goToTab ? () => goToTab('activities') : undefined },
    {
      label: 'Related Complaints',
      icon: IC.alert,
      count: complaints,
      onClick: () => {
        setTab('all');
        setRange('all');
        setTypeFilter('all');
        setStatusFilter('all');
        setQuery('Complaints');
      },
    },
    { label: 'Related Leads', icon: IC.target, count: data.leads.length, onClick: goToTab ? () => goToTab('offers-leads') : undefined },
  ];

  const typeOptions = [{ value: 'all', label: 'All' }, ...Array.from(new Set(tickets.map((t) => t.type))).map((v) => ({ value: v, label: v }))];
  const statusOptions = [{ value: 'all', label: 'All' }, ...Array.from(new Set(tickets.map((t) => t.status))).map((v) => ({ value: v, label: v }))];

  const created = selected ? fmtDateTime(new Date(selected.createdAt).toISOString()) : {};

  return (
    <TabPage
      icon={IC.headset}
      tone="blue"
      title="Tickets & Support"
      subtitle="View and manage all customer support tickets, service requests and related cases"
      actions={
        <>
          <ActionButton primary icon={IC.plus} onClick={() => setModalOpen(true)}>
            Create Ticket
          </ActionButton>
          <KebabButton />
        </>
      }
    >
      <KpiGrid>
        <KpiTile icon={IC.file} tone="blue" label="Total Tickets" value={kpi.total} caption="All time" />
        <KpiTile icon={IC.clock} tone="amber" label="Open Tickets" value={kpi.open} link="View all" onLink={() => showTab('open')} />
        <KpiTile icon={IC.checkCircle} tone="green" label="Resolved Tickets" value={kpi.resolved} link="View all" onLink={() => showTab('resolved')} />
        <KpiTile icon={IC.xCircle} tone="red" label="Overdue Tickets" value={kpi.overdue} link="View all" onLink={() => showTab('overdue')} />
        <KpiTile icon={IC.users} tone="purple" label="Pending Customer Action" value={kpi.pending} link="View all" onLink={() => showTab('pending')} />
      </KpiGrid>

      <div className="grid grid-cols-1 @6xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          <section className="rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg p-4 space-y-4 min-w-0">
            <UnderlineTabs
              active={tab}
              onChange={setTab}
              items={[
                { key: 'all', label: `All Tickets (${tabCount.all})` },
                { key: 'open', label: `Open (${tabCount.open})` },
                { key: 'resolved', label: `Resolved (${tabCount.resolved})` },
                { key: 'overdue', label: `Overdue (${tabCount.overdue})` },
                { key: 'pending', label: `Pending Customer Action (${tabCount.pending})` },
              ]}
            />
            <div className="flex flex-wrap items-stretch gap-3">
              <SearchBox value={query} onChange={setQuery} placeholder="Search by Ticket ID, issue or service type" />
              <FilterSelect label="Ticket Type" value={typeFilter} options={typeOptions} onChange={setTypeFilter} />
              <FilterSelect label="Status" value={statusFilter} options={statusOptions} onChange={setStatusFilter} />
              <FilterSelect label="Date Range" value={range} options={RANGES.map((r) => ({ value: r.value, label: r.label }))} onChange={setRange} />
            </div>
            <GridTable
              rows={rows}
              rowKey={(t) => t.id}
              selectedKey={selected?.id}
              onSelect={(t) => setPickedId(t.id)}
              empty="No tickets match the current filters."
              cols={[
                { key: 'n', header: '#', render: (_t, i) => i + 1 },
                { key: 'id', header: 'Ticket ID', className: 'whitespace-nowrap' },
                { key: 'type', header: 'Ticket Type', className: 'min-w-28' },
                { key: 'issue', header: 'Actual Issue', className: 'min-w-36 break-words' },
                { key: 'service', header: 'Service / MSISDN', render: () => '-' },
                { key: 'status', header: 'Status', render: (t) => <StatusPill status={t.status} /> },
                { key: 'priority', header: 'Priority', render: (t) => (t.priority === '-' ? '-' : <Pill tone={priorityTone(t.priority)}>{priorityLabel(t.priority)}</Pill>) },
                { key: 'createdAt', header: 'Created On', className: 'whitespace-nowrap', render: (t) => fmtDate(new Date(t.createdAt).toISOString()) ?? '-' },
                { key: 'createdBy', header: 'Created By', className: 'break-words', render: (t) => t.createdBy ?? '-' },
                {
                  key: 'actions',
                  header: 'Actions',
                  render: (t) => (
                    <span className="flex items-center gap-3">
                      <ViewPill onClick={() => setPickedId(t.id)} />
                      <Icon path={IC.chevRight} className="w-4 h-4 text-fg" />
                    </span>
                  ),
                },
              ]}
            />
          </section>

          <div className="grid grid-cols-1 @4xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] gap-4">
            <Panel
              icon={IC.refresh}
              title="Recent Ticket Activity"
              action={selected ? <LinkAction onClick={() => openFull(selected.id)}>View All</LinkAction> : undefined}
            >
              <GridTable
                dense
                rows={activity}
                rowKey={(a) => a.key}
                empty="No activity recorded for this ticket."
                cols={[
                  { key: 'at', header: 'Date & Time', className: 'whitespace-nowrap', render: (a) => fmtStamp(a.at)?.replace('  |  ', ' ') ?? '-' },
                  { key: 'activity', header: 'Activity', className: 'font-semibold' },
                  { key: 'user', header: 'User', className: 'break-words' },
                  { key: 'details', header: 'Details', className: 'min-w-40 break-words' },
                ]}
              />
            </Panel>

            <Panel icon={IC.link} title="Related Information">
              <ul>
                {related.map((r) => (
                  <li key={r.label} className="border-b border-border-soft last:border-0">
                    <button type="button" onClick={r.onClick} disabled={!r.onClick} className="w-full flex items-center gap-3 py-2.5 text-[length:var(--fs-body)] text-left enabled:hover:bg-surface disabled:opacity-50 disabled:cursor-not-allowed">
                      <Icon path={r.icon} className="w-4 h-4 text-fg-2 shrink-0" />
                      <span className="flex-1 text-fg-2">{r.label}</span>
                      <span className="text-fg font-medium">{r.count}</span>
                      <Icon path={IC.chevRight} className="w-4 h-4 text-fg shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>

        <Panel icon={IC.file} title="Ticket Details" action={selected ? <StatusPill status={selected.status} /> : undefined}>
          {selected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-12 h-12 rounded-[var(--radius-button)] flex items-center justify-center shrink-0 bg-surface text-[var(--signal-blue)]">
                  <Icon path={IC.tag} className="w-6 h-6" />
                </span>
                <div className="min-w-0">
                  <div className="text-fg font-bold text-[length:var(--fs-body-lg)]">{selected.id}</div>
                  <div className="text-fg-2 text-[length:var(--fs-caption)] break-words">{[selected.issue, fmtDate(new Date(selected.createdAt).toISOString()), selected.createdBy].filter(Boolean).join('  |  ')}</div>
                </div>
              </div>
              <DetailRows
                rows={[
                  { label: 'Ticket Type', value: selected.type, strong: false },
                  { label: 'Sub Type', value: selected.subType ?? '-', strong: false },
                  { label: 'Actual Issue', value: selected.issue, strong: false },
                  { label: 'Service / MSISDN', value: '-', strong: false },
                  { label: 'Status', value: <StatusPill status={selected.status} />, strong: false },
                  { label: 'Priority', value: selected.priority === '-' ? '-' : <Pill tone={priorityTone(selected.priority)}>{priorityLabel(selected.priority)}</Pill>, strong: false },
                  { label: 'Created On', value: created.date ? `${created.date}${created.time ? `  |  ${created.time}` : ''}` : '-', strong: false },
                  { label: 'Created By', value: selected.createdBy ?? '-', strong: false },
                  { label: 'Assigned To', value: selected.assignedTo ?? '-', strong: false },
                  { label: 'SLA', value: selected.slaHours !== undefined ? `Response within ${selected.slaHours} hours` : '-', strong: false },
                  { label: 'Last Updated', value: fmtStamp(lastUpdated(selected.raw)) ?? '-', strong: false },
                  { label: 'Notes', value: noteText(((selected.raw.publicNotes as unknown[] | undefined) ?? []).at(-1)) ?? '-', strong: false },
                ]}
              />
              <div className="grid grid-cols-1 @lg:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => openFull(selected.id)}
                  className="rounded-[var(--radius-button)] border border-accent px-4 py-2 text-[length:var(--fs-btn-compact)] font-medium text-accent hover:bg-[color-mix(in_oklab,var(--accent),var(--bg)_94%)]"
                >
                  View Full Ticket &rarr;
                </button>
                <ActionButton disabled>Add Note</ActionButton>
              </div>
            </div>
          ) : (
            <p className="text-muted text-[length:var(--fs-body)] py-4 text-center">Select a ticket to see its details.</p>
          )}
        </Panel>
      </div>

      <TicketCreationModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmit={createTicket} initialCustomerId={data.customer.customerId} />
    </TabPage>
  );
}
