import { useMemo, useState } from 'react';
import { downloadCsv } from '../../engines/csvExport';
import { Icon } from '../../components/primitives/Icon';
import { accountAddressResolvers } from './sections/accountAddressResolvers';
import { Card, KV, Pill, asText, dateTime, type Ctx } from './telesalesOverview';
import { ActionList, BarChart, Field, HeaderButton, HeaderLink, ICON, PillTabs, SectionHeader, StatStrip, Table, TableCard, TileLinks, pillFor, yesNo, WideBlock } from './telesalesKit';
import { rowDate } from './telesalesSectionsA';
import { strOrEmpty as str } from '../../lib/values';

// Address, Leads, Orders & Tickets and Audit Trail sections of the Telesales Overview page.

type Rec = Record<string, unknown>;
const demoOf = (ctx: Ctx) => (ctx.data.overviewDemo[0] ?? {}) as Rec;
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const SELECT = 'w-full rounded-[var(--field-radius)] border border-[var(--field-border)] bg-bg px-3 py-2 text-[length:var(--fs-body)]';
const FIELD_LABEL = 'block text-muted uppercase tracking-wide text-[length:var(--fs-caption-upper)] mb-1';

// ============================================================================ Address
export function AddressSection({ ctx }: { ctx: Ctx }) {
  const { data } = ctx;
  const demo = demoOf(ctx);
  const a = (d: string) => asText(accountAddressResolvers[d]?.(data));
  const zone = str(a('Zone')) || '-';
  const street = str(a('Street')) || '-';
  const building = str(a('Building')) || '-';
  const rfs = str(a('RFS Flag (Y/N)'));
  const serv = (demo.serviceability ?? {}) as Rec;
  const type = (demo.addressType ?? {}) as Rec;
  const history = arr<Rec>(demo.addressHistory);
  return (
    <>
      <SectionHeader
        icon={ICON.globe}
        title="Address"
        description="View and manage the customer's registered address, National Address System (NAS) details and serviceability information."
        actions={<HeaderButton primary>⟳ Update Address</HeaderButton>}
      />
      <div className="contents">
        <Card title="National Address (NAS)" icon={ICON.globe}>
          <div className="flex items-center gap-3 px-5 py-3 border-b border-[var(--field-card-border)]">
            <Pill tone="green">Verified</Pill>
            <button type="button" className="text-accent font-semibold text-[length:var(--fs-body)]">View in Map →</button>
          </div>
          <KV label="Zone">{zone}</KV>
          <KV label="Street">{street}</KV>
          <KV label="Building">{building}</KV>
          <KV label="RFS Flag">{rfs ? yesNo(rfs) : '-'}</KV>
        </Card>
        <Card title="Open Address (Manual / Alternative)" icon={ICON.globe} link="Edit">
          <div className="p-5 space-y-3">
            {[
              ['Zone', zone],
              ['Street', street],
              ['Building', building],
              ['RFS Flag', rfs || '-'],
            ].map(([label, value]) => (
              <label key={label} className="block">
                <span className={FIELD_LABEL}>{label}</span>
                <select className={SELECT} defaultValue={value} aria-label={label}>
                  <option>{value}</option>
                </select>
              </label>
            ))}
          </div>
        </Card>
        <Card title="Location Map" icon={ICON.globe}>
          <div className="p-5">
            <div className="relative h-44 rounded-[var(--radius-card)] bg-gradient-to-br from-[var(--telesales-map-from)] to-[var(--telesales-map-to)] overflow-hidden">
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-accent text-accent-on flex items-center justify-center">
                <Icon path={ICON.globe} className="w-5 h-5" />
              </span>
              <div className="absolute right-3 bottom-3 rounded-[var(--radius-button)] bg-bg px-3 py-2 text-[length:var(--fs-caption)]">
                <div className="font-bold text-fg">{zone}</div>
                <div className="text-fg-2">{street}</div>
                <div className="text-fg-2">{building}</div>
              </div>
            </div>
            <button type="button" className="text-accent font-semibold text-[length:var(--fs-body)] mt-3">View in Google Maps →</button>
          </div>
        </Card>
      </div>
      <div className="contents">
        <Card title="Serviceability Information" icon={ICON.bars}>
          {['Mobile Coverage', 'Fixed Line', 'Fibre (Home)', 'TV Service', '5G Coverage'].map((k) => (
            <Field key={k} label={k}>
              <Pill tone="green">{str(serv[k]) || 'Available'}</Pill>
            </Field>
          ))}
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-fg-2">Remarks</span>
            <span className="text-fg font-bold text-[length:var(--fs-body-lg)]">{str(serv.Remarks)}</span>
          </div>
        </Card>
        <Card title="Address Type & Usage" icon={ICON.globe} link="Edit">
          <div className="p-5 space-y-3">
            {[
              ['Address Type', str(type.addressType)],
              ['Usage Type', str(type.usageType)],
            ].map(([label, value]) => (
              <label key={label} className="block">
                <span className={FIELD_LABEL}>{label}</span>
                <select className={SELECT} defaultValue={value} aria-label={label}>
                  <option>{value}</option>
                </select>
              </label>
            ))}
            <label className="block">
              <span className={FIELD_LABEL}>Valid From</span>
              <input readOnly value={type.validFrom ? dateTime(type.validFrom).d : '-'} className={`${SELECT} bg-surface`} aria-label="Valid From" />
            </label>
            <label className="block">
              <span className={FIELD_LABEL}>Valid To</span>
              <input readOnly value={type.validTo ? dateTime(type.validTo).d : '-'} className={`${SELECT} bg-surface`} aria-label="Valid To" />
            </label>
          </div>
          <KV label="Is Mailing Address">{yesNo(type.isMailing as boolean)}</KV>
          <KV label="Is Billing Address">{yesNo(type.isBilling as boolean)}</KV>
        </Card>
        <Card title="Related Information" icon={ICON.search}>
          <ActionList
            items={[
              { title: 'Address History', sub: 'View full previous addresses' },
              { title: 'NAS Details', sub: 'View full NAS information' },
              { title: 'Linked Connections', sub: 'See which services are linked to this address', onClick: () => ctx.goToTab('ts-products') },
              { title: 'Address Validation', sub: 'Check and validate address' },
              { title: 'Serviceability Check', sub: 'Check product availability at this address' },
            ]}
          />
        </Card>
      </div>
      <WideBlock className="">
        <TableCard
          title={`Address History (${history.length})`}
          icon={ICON.refresh}
          link="View All"
          rows={history}
          cols={[
            { header: '#', render: (_r, i) => i + 1 },
            { header: 'Address Type', render: (r) => str(r.type) },
            { header: 'Zone', render: (r) => str(r.zone) },
            { header: 'Street', render: (r) => str(r.street) },
            { header: 'Building', render: (r) => str(r.building) },
            { header: 'RFS Flag', render: (r) => (r.rfs ? <Pill tone="green">Yes</Pill> : 'No') },
            { header: 'Valid From', render: (r) => dateTime(r.from).d },
            { header: 'Valid To', render: (r) => (r.to ? dateTime(r.to).d : '-') },
            { header: 'Status', render: (r) => <Pill tone={str(r.status) === 'Current' ? 'green' : 'neutral'}>{str(r.status)}</Pill> },
            { header: 'Updated By', render: (r) => str(r.by) },
            { header: 'Updated On', render: (r) => rowDate(r.on) },
            { header: 'Action', render: () => <span className="text-accent font-semibold">View</span> },
          ]}
        />
      </WideBlock>
    </>
  );
}

// ============================================================================ Leads
export function LeadsSection({ ctx }: { ctx: Ctx }) {
  const { data } = ctx;
  const demo = demoOf(ctx);
  const leads = data.leads;
  const [query, setQuery] = useState('');
  const [type, setType] = useState('All Lead Types');
  const [status, setStatus] = useState('All Statuses');
  const [picked, setPicked] = useState<string | undefined>();
  const stat = (s: string) => leads.filter((l) => str(l.status).toLowerCase().includes(s)).length;
  const types = ['All Lead Types', ...Array.from(new Set(leads.map((l) => str(l.serviceNeeded)).filter(Boolean)))];
  const statuses = ['All Statuses', ...Array.from(new Set(leads.map((l) => str(l.status)).filter(Boolean)))];
  const shown = leads.filter(
    (l) =>
      (type === 'All Lead Types' || str(l.serviceNeeded) === type) &&
      (status === 'All Statuses' || str(l.status) === status) &&
      `${str(l.leadId)} ${str(l.serviceNeeded)} ${str(l.mobileNumber)} ${str(l.status)} ${str(l.comments)}`.toLowerCase().includes(query.toLowerCase())
  );
  const cur = leads.find((l) => str(l.leadId) === picked);
  const activities = arr<{ at: string; activity: string; by: string }>(demo.leadActivities);
  return (
    <>
      <SectionHeader
        icon={ICON.search}
        title="Leads"
        description="View and manage all leads associated with this customer. Capture new opportunities and track their progress from enquiry to conversion."
        actions={
          <>
            <HeaderLink onClick={() => ctx.goToTab('ts-leads')}>All Leads ›</HeaderLink>
          </>
        }
      />
      <StatStrip
        items={[
          { value: leads.length, label: 'Total Leads', icon: ICON.grid },
          { value: stat('open') + stat('new'), label: 'Open Leads', icon: ICON.refresh },
          { value: stat('progress') + stat('callback') + stat('contacted') + stat('qualified'), label: 'In Progress', icon: ICON.refresh },
          { value: stat('convert'), label: 'Converted', icon: ICON.check },
          { value: stat('closed') + stat('lost'), label: 'Closed / Lost' },
        ]}
      />
      <WideBlock className="grid grid-cols-1 lg:grid-cols-[1fr_20rem] gap-4 items-start">
        <div className="space-y-4">
          <Card title={`Leads List (${leads.length})`} icon={ICON.search}>
            <div className="px-4 py-3 flex gap-2 border-b border-[var(--field-card-border)]">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by lead type, MSISDN, status or comments..." aria-label="Search leads" className="flex-1 min-w-0 rounded-[var(--field-radius)] border border-[var(--field-border)] bg-surface px-3 py-2 text-[length:var(--fs-caption)]" />
              <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Lead type" className="rounded-[var(--field-radius)] border border-[var(--field-border)] bg-bg px-2 text-[length:var(--fs-caption)]">
                {types.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Lead status" className="rounded-[var(--field-radius)] border border-[var(--field-border)] bg-bg px-2 text-[length:var(--fs-caption)]">
                {statuses.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <Table
              rows={shown}
              empty="No leads on file for this customer."
              cols={[
                { header: '#', render: (_l, i) => i + 1 },
                { header: 'Lead ID', render: (l) => <button type="button" className="font-bold" onClick={() => setPicked(str(l.leadId))}>{str(l.leadId)}</button> },
                { header: 'Lead Type', render: (l) => str(l.serviceNeeded) },
                { header: 'MSISDN / Service', render: (l) => str(l.mobileNumber) || '-' },
                { header: 'Created By', render: (l) => str(l.ownerId) },
                { header: 'Created On', render: (l) => (l.createdAt ? rowDate(l.createdAt) : l.callbackDate ? dateTime(l.callbackDate).d : '-') },
                { header: 'Status', render: (l) => <Pill tone={pillFor(str(l.status))}>{str(l.status)}</Pill> },
                { header: 'Comments', render: (l) => str(l.comments) || '-' },
                { header: 'Actions', render: () => <span className="text-accent font-bold">···</span> },
              ]}
            />
          </Card>
          <Card title="Lead Details" icon={ICON.search}>
            {cur ? (
              <>
                <KV label="Lead ID">{str(cur.leadId)}</KV>
                <KV label="Lead Type">{str(cur.serviceNeeded)}</KV>
                <KV label="MSISDN / Service">{str(cur.mobileNumber) || '-'}</KV>
                <KV label="Created By">{str(cur.ownerId)}</KV>
                <KV label="Created Via">{str(cur.createdVia) || '-'}</KV>
                <KV label="Status">
                  <Pill tone={pillFor(str(cur.status))}>{str(cur.status)}</Pill>
                </KV>
                <KV label="Comments">{str(cur.comments) || '-'}</KV>
              </>
            ) : (
              <div className="py-10 text-center text-muted">
                <Icon path={ICON.search} className="w-8 h-8 mx-auto mb-2" />
                <div className="text-[length:var(--fs-body-lg)]">Select a lead from the list</div>
                <div className="text-[length:var(--fs-caption)]">to view full details, update information and add notes.</div>
              </div>
            )}
          </Card>
          <TableCard
            title="Recent Lead Activities"
            icon={ICON.refresh}
            link="View All"
            rows={activities}
            cols={[
              { header: 'Date & Time', render: (r) => rowDate(r.at) },
              { header: 'Activity', render: (r) => r.activity },
              { header: 'Performed By', render: (r) => r.by },
            ]}
          />
        </div>
        <div className="space-y-4">
          <Card title="Quick Actions" icon={ICON.bars}>
            <ActionList
              items={[
                { title: 'Create New Lead', sub: 'Capture a new sales opportunity', icon: ICON.star },
                { title: 'Convert to Sales Order', sub: 'Proceed with eligible journey', icon: ICON.check },
                { title: 'Add Follow-up', sub: 'Schedule a follow-up reminder', icon: ICON.refresh },
                { title: 'View Lead History', sub: 'See all lead activities for this customer', icon: ICON.search },
              ]}
            />
          </Card>
          <Card title="Lead Guidelines" icon={ICON.shield}>
            <ul className="px-5 py-4 text-fg-2 text-[length:var(--fs-body)] space-y-3">
              <li>Use appropriate Lead Type based on customer interest.</li>
              <li>Add detailed comments to help with follow-up.</li>
              <li>Convert eligible leads to a sales order.</li>
              <li>Follow up on open leads regularly.</li>
            </ul>
          </Card>
          <Card title="Related Information" icon={ICON.search}>
            <ActionList
              items={[
                { title: 'Customer Offers', sub: 'View eligible offers for this customer' },
                { title: 'Connections', sub: "View customer's active connections", onClick: () => ctx.goToTab('ts-products') },
                { title: 'Orders', sub: 'View orders created from leads', onClick: () => ctx.goToTab('ts-history') },
                { title: 'Activity History', sub: 'View all customer activities', onClick: () => ctx.goToTab('ts-history') },
              ]}
            />
          </Card>
        </div>
      </WideBlock>
    </>
  );
}

// ============================================================================ Orders & Tickets
const PAGE = 5;
function Pager({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="flex gap-2 px-5 py-4">
      {Array.from({ length: pages }, (_, i) => (
        <button key={i} type="button" onClick={() => onChange(i)} className={`w-9 h-9 rounded-[var(--radius-button)] border text-[length:var(--fs-body)] ${i === page ? 'bg-accent text-accent-on border-accent' : 'bg-bg border-border hover:bg-surface'}`}>
          {i + 1}
        </button>
      ))}
    </div>
  );
}

export function OrdersTicketsSection({ ctx }: { ctx: Ctx }) {
  const { data } = ctx;
  const orders = [...data.orders].sort((a, b) => str(b.createdAt).localeCompare(str(a.createdAt)));
  const tickets = [...data.tickets].sort((a, b) => str(b.createdAt).localeCompare(str(a.createdAt)));
  const [oq, setOq] = useState('');
  const [ot, setOt] = useState('All Order Types');
  const [os, setOs] = useState('All Statuses');
  const [op, setOp] = useState(0);
  const [tq, setTq] = useState('');
  const [tc, setTc] = useState('All Categories');
  const [ts, setTs] = useState('All Statuses');
  const [tp, setTp] = useState(0);
  const [chart, setChart] = useState('orders');
  const opt = (list: string[]) => list.map((v) => <option key={v}>{v}</option>);
  const oTypes = ['All Order Types', ...Array.from(new Set(orders.map((o) => str(o.orderType)).filter(Boolean)))];
  const oStats = ['All Statuses', ...Array.from(new Set(orders.map((o) => str(o.status)).filter(Boolean)))];
  const tCats = ['All Categories', ...Array.from(new Set(tickets.map((t) => str(t.category)).filter(Boolean)))];
  const tStats = ['All Statuses', ...Array.from(new Set(tickets.map((t) => str(t.status)).filter(Boolean)))];
  const fo = orders.filter((o) => (ot === 'All Order Types' || str(o.orderType) === ot) && (os === 'All Statuses' || str(o.status) === os) && `${str(o.orderId)} ${str(o.orderType)} ${str(o.status)}`.toLowerCase().includes(oq.toLowerCase()));
  const ft = tickets.filter((t) => (tc === 'All Categories' || str(t.category) === tc) && (ts === 'All Statuses' || str(t.status) === ts) && `${str(t.ticketId)} ${str(t.category)} ${str(t.status)}`.toLowerCase().includes(tq.toLowerCase()));
  const cnt = (list: Rec[], re: RegExp) => list.filter((x) => re.test(str(x.status))).length;
  const overdue = tickets.filter((t) => t.slaDueAt && new Date(str(t.slaDueAt)) < new Date() && !/solved|closed|complete|cancel/i.test(str(t.status))).length;
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleDateString('en-GB', { month: 'short' }) };
  });
  const bucket = (list: Rec[]) => months.map((m) => ({ label: m.label, value: list.filter((x) => str(x.createdAt).startsWith(m.key)).length }));
  const feed = [
    ...orders.map((o) => ({ at: o.createdAt, activity: 'Order created', ref: str(o.orderId), by: str(o.createdBy ?? '-') })),
    ...tickets.map((t) => ({ at: t.createdAt, activity: 'Ticket created', ref: str(t.ticketId), by: str(t.createdBy ?? '-') })),
    ...data.payments.map((p) => ({ at: p.capturedAt, activity: 'Payment received', ref: str(p.receiptNumber ?? p.paymentId), by: 'Customer' })),
  ]
    .filter((e) => e.at)
    .sort((a, b) => str(b.at).localeCompare(str(a.at)))
    .slice(0, 5);
  const pageOf = <T,>(list: T[], p: number) => list.slice(p * PAGE, p * PAGE + PAGE);
  return (
    <>
      <SectionHeader icon={ICON.card} title="Orders & Tickets" description="View and manage all orders and trouble tickets for this customer. Track status, view details and take quick actions." />
      <StatStrip
        items={[
          { value: orders.length, label: 'Total Orders' },
          { value: cnt(orders, /complete|deliver/i), label: 'Completed', tone: 'ok' },
          { value: cnt(orders, /progress|draft|submitted|approval/i), label: 'In Progress' },
          { value: cnt(orders, /cancel/i), label: 'Cancelled', tone: 'bad' },
          { value: tickets.length, label: 'Total Trouble Tickets' },
          { value: cnt(tickets, /solved|resolved|closed/i), label: 'Resolved', tone: 'ok' },
          { value: cnt(tickets, /open|not solved|progress/i), label: 'Open' },
          { value: overdue, label: 'Overdue', tone: 'warn' },
        ]}
      />
      <WideBlock className="">
      <Card title={`Orders ({orders.length})`} icon={ICON.card} link="View All Orders" onLink={() => ctx.goToTab('ts-history')}>
        <div className="px-4 py-3 flex gap-2 border-b border-[var(--field-card-border)]">
          <input value={oq} onChange={(e) => { setOq(e.target.value); setOp(0); }} placeholder="Search by order number, product or status..." aria-label="Search orders" className="flex-1 min-w-0 rounded-[var(--field-radius)] border border-[var(--field-border)] bg-surface px-3 py-2 text-[length:var(--fs-caption)]" />
          <select value={ot} onChange={(e) => { setOt(e.target.value); setOp(0); }} aria-label="Order type" className="rounded-[var(--field-radius)] border border-[var(--field-border)] bg-bg px-2 text-[length:var(--fs-caption)]">{opt(oTypes)}</select>
          <select value={os} onChange={(e) => { setOs(e.target.value); setOp(0); }} aria-label="Order status" className="rounded-[var(--field-radius)] border border-[var(--field-border)] bg-bg px-2 text-[length:var(--fs-caption)]">{opt(oStats)}</select>
          <HeaderButton primary>+ New Order</HeaderButton>
        </div>
        <Table
          rows={pageOf(fo, op)}
          empty="No orders on file for this customer."
          cols={[
            { header: 'Order Number', render: (o) => <b>{str(o.orderId)}</b> },
            { header: 'Date', render: (o) => (o.createdAt ? dateTime(o.createdAt).d : '-') },
            { header: 'Product / Service', render: (o) => str(o.orderType) },
            { header: 'Order Type', render: (o) => str(o.orderSubType ?? o.orderType) },
            { header: 'Status', render: (o) => <Pill tone={pillFor(str(o.status))}>{str(o.status)}</Pill> },
            { header: 'Channel', render: (o) => str(o.sourceChannel) || '-' },
            { header: 'Actions', render: () => <span className="text-accent font-bold">···</span> },
          ]}
        />
        <Pager page={op} pages={Math.ceil(fo.length / PAGE)} onChange={setOp} />
      </Card>
      </WideBlock>
      <WideBlock className="">
        <Card title={`Trouble Tickets (${tickets.length})`} icon={ICON.help} link="View All Tickets" onLink={() => ctx.goToTab('ts-history')}>
          <div className="px-4 py-3 flex gap-2 border-b border-[var(--field-card-border)]">
            <input value={tq} onChange={(e) => { setTq(e.target.value); setTp(0); }} placeholder="Search by ticket number, issue or status..." aria-label="Search tickets" className="flex-1 min-w-0 rounded-[var(--field-radius)] border border-[var(--field-border)] bg-surface px-3 py-2 text-[length:var(--fs-caption)]" />
            <select value={tc} onChange={(e) => { setTc(e.target.value); setTp(0); }} aria-label="Ticket category" className="rounded-[var(--field-radius)] border border-[var(--field-border)] bg-bg px-2 text-[length:var(--fs-caption)]">{opt(tCats)}</select>
            <select value={ts} onChange={(e) => { setTs(e.target.value); setTp(0); }} aria-label="Ticket status" className="rounded-[var(--field-radius)] border border-[var(--field-border)] bg-bg px-2 text-[length:var(--fs-caption)]">{opt(tStats)}</select>
            <HeaderButton primary>+ Create Ticket</HeaderButton>
          </div>
          <Table
            rows={pageOf(ft, tp)}
            empty="No trouble tickets on file for this customer."
            cols={[
              { header: 'Ticket Number', render: (t) => <b>{str(t.ticketId)}</b> },
              { header: 'Date', render: (t) => (t.createdAt ? dateTime(t.createdAt).d : '-') },
              { header: 'Issue Category', render: (t) => str(t.category) },
              { header: 'Priority', render: (t) => <Pill tone={pillFor(str(t.priority).replace(/^\d-/, ''))}>{str(t.priority).replace(/^\d-/, '')}</Pill> },
              { header: 'Status', render: (t) => <Pill tone={pillFor(str(t.status))}>{str(t.status)}</Pill> },
              { header: 'Channel', render: (t) => str(t.channel ?? t.createdVia) || '-' },
              { header: 'Actions', render: () => <span className="text-accent font-bold">···</span> },
            ]}
          />
          <Pager page={tp} pages={Math.ceil(ft.length / PAGE)} onChange={setTp} />
        </Card>
      </WideBlock>
      <div className="contents">
        <TableCard
          title="Recent Activities"
          icon={ICON.refresh}
          link="View All"
          rows={feed}
          cols={[
            { header: 'Date & Time', render: (e) => rowDate(e.at) },
            { header: 'Activity', render: (e) => e.activity },
            { header: 'Reference', render: (e) => <b>{e.ref}</b> },
            { header: 'Performed By', render: (e) => e.by },
          ]}
        />
        <Card title="Order & Ticket Insights" icon={ICON.bars}>
          <div className="px-5 pt-3">
            <PillTabs active={chart} onChange={setChart} items={[{ key: 'orders', label: 'Orders' }, { key: 'tickets', label: 'Trouble Tickets' }]} />
          </div>
          <BarChart data={bucket(chart === 'orders' ? orders : tickets)} height={140} />
        </Card>
        <Card title="Quick Actions" icon={ICON.bars}>
          <ActionList
            items={[
              { title: 'Create New Order', sub: 'Place a new order for this customer' },
              { title: 'Create Trouble Ticket', sub: 'Log a new issue or request' },
              { title: 'View Order History', sub: 'See all past orders' },
              { title: 'View Trouble Ticket History', sub: 'See all past tickets' },
              { title: 'Check Order / Ticket Status', sub: 'Track an existing request' },
            ]}
          />
        </Card>
      </div>
      <WideBlock className="">
        <Card title="Related Information" icon={ICON.search}>
          <TileLinks
            columns={5}
            items={[
              { key: 'ia', title: 'Installed Assets', sub: 'View all installed assets', icon: ICON.grid, onClick: () => ctx.goToTab('ts-products') },
              { key: 'cn', title: 'Connections', sub: 'View customer connections', icon: ICON.phone, onClick: () => ctx.goToTab('ts-products') },
              { key: 'bp', title: 'Billing Profile', sub: 'View billing profiles', icon: ICON.card, onClick: () => ctx.goToTab('ts-billing') },
              { key: 'ch', title: 'Contact History', sub: 'View communication history', icon: ICON.user, onClick: () => ctx.goToTab('ts-contact') },
              { key: 'at', title: 'Audit Trail', sub: 'View all changes and activities', icon: ICON.refresh, onClick: () => ctx.goToTab('ts-history') },
            ]}
          />
        </Card>
      </WideBlock>
    </>
  );
}

// ============================================================================ Audit Trail
const AUDIT_PAGE = 10;
export function AuditSection({ ctx }: { ctx: Ctx }) {
  const { data } = ctx;
  const demo = demoOf(ctx);
  const [query, setQuery] = useState('');
  const [module, setModule] = useState('All Modules');
  const [action, setAction] = useState('All Actions');
  const [user, setUser] = useState('All Users');
  const [days, setDays] = useState(90);
  const [page, setPage] = useState(0);
  const rows = useMemo(() => {
    const real = data.auditTrail.map((a) => ({ at: str(a.timestamp), module: str(a.recordType) || 'Account', action: 'Updated', field: str(a.fieldModified), old: '', new: str(a.newValue), by: str(a.employeeUser), channel: '-', ref: str(a.recordId) }));
    const demoRows = arr<{ at: string; module: string; action: string; field: string; old: string | null; new: string; by: string; channel: string; ref: string }>(demo.auditRows).map((r) => ({ ...r, old: r.old ?? '' }));
    return [...real, ...demoRows].sort((a, b) => b.at.localeCompare(a.at));
  }, [data.auditTrail, demo.auditRows]);
  const anchor = rows[0] ? new Date(rows[0].at).getTime() : Date.now();
  const inRange = rows.filter((r) => (anchor - new Date(r.at).getTime()) / 86400000 <= days);
  const filtered = inRange.filter((r) => (module === 'All Modules' || r.module === module) && (action === 'All Actions' || r.action === action) && (user === 'All Users' || r.by === user) && `${r.field} ${r.new} ${r.ref} ${r.module}`.toLowerCase().includes(query.toLowerCase()));
  const uniq = (k: 'module' | 'action' | 'by') => Array.from(new Set(rows.map((r) => r[k]).filter(Boolean)));
  const count = (re: RegExp) => rows.filter((r) => re.test(r.module)).length;
  const moduleTone = (m: string) => (/order/i.test(m) ? 'bg-[var(--telesales-module-tag-bg)] text-[var(--telesales-module-tag-fg)]' : 'bg-[var(--telesales-module-tag-bg)] text-[var(--telesales-module-tag-fg)]');
  const summary: [string, number][] = [
    ['Orders', count(/order/i)],
    ['Trouble Tickets', count(/ticket/i)],
    ['Account', count(/account/i)],
    ['Contacts', count(/contact/i)],
    ['Activities', count(/activit/i)],
  ];
  const maxSum = Math.max(1, ...summary.map(([, n]) => n));
  const pages = Math.ceil(filtered.length / AUDIT_PAGE);
  const exportRows = () => downloadCsv(`${data.customer.customerId}-audit-trail.csv`, filtered.map((r) => ({ dateTime: r.at, module: r.module, action: r.action, field: r.field, oldValue: r.old, newValue: r.new, performedBy: r.by, channel: r.channel, reference: r.ref })));
  const reset = () => {
    setQuery('');
    setModule('All Modules');
    setAction('All Actions');
    setUser('All Users');
    setDays(90);
    setPage(0);
  };
  const keyChanges = rows.slice(0, 5);
  const first = rows[rows.length - 1];
  return (
    <>
      <SectionHeader
        icon={ICON.refresh}
        title="Audit Trail"
        description="View all changes, activities and events related to this customer across orders, contacts, account, activities and trouble tickets."
        actions={
          <>
            <span className="inline-flex items-center gap-2 rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg px-4 py-2 text-fg font-semibold text-[length:var(--fs-body)]">
              <Icon path={ICON.card} className="w-4 h-4" />
              {first ? dateTime(first.at).d : '-'} – {rows[0] ? dateTime(rows[0].at).d : '-'}
            </span>
            <HeaderButton primary onClick={exportRows}>
              Export ›
            </HeaderButton>
          </>
        }
      />
      <SectionHeader actions={
<div className="basis-full order-last flex gap-2 flex-wrap">
            <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} placeholder="Search by keyword, reference number or details..." aria-label="Search audit trail" className="flex-1 min-w-48 rounded-[var(--field-radius)] border border-[var(--field-border)] bg-surface px-3 py-2 text-[length:var(--fs-caption)]" />
            <select value={module} onChange={(e) => { setModule(e.target.value); setPage(0); }} aria-label="Module" className="rounded-[var(--field-radius)] border border-[var(--field-border)] bg-bg px-2 text-[length:var(--fs-caption)]">
              {['All Modules', ...uniq('module')].map((v) => <option key={v}>{v}</option>)}
            </select>
            <select value={action} onChange={(e) => { setAction(e.target.value); setPage(0); }} aria-label="Action" className="rounded-[var(--field-radius)] border border-[var(--field-border)] bg-bg px-2 text-[length:var(--fs-caption)]">
              {['All Actions', ...uniq('action')].map((v) => <option key={v}>{v}</option>)}
            </select>
            <select value={user} onChange={(e) => { setUser(e.target.value); setPage(0); }} aria-label="User" className="rounded-[var(--field-radius)] border border-[var(--field-border)] bg-bg px-2 text-[length:var(--fs-caption)]">
              {['All Users', ...uniq('by')].map((v) => <option key={v}>{v}</option>)}
            </select>
            <button type="button" onClick={reset} className="text-accent font-semibold text-[length:var(--fs-body)]">⟳ Reset</button>
          </div>
      } />
      <StatStrip
        items={[
          { value: rows.length, label: 'Total Records' },
          { value: count(/account/i), label: 'Account Changes' },
          { value: count(/contact/i), label: 'Contact Updates' },
          { value: count(/order/i), label: 'Order Events' },
          { value: count(/ticket/i), label: 'Trouble Ticket Events' },
          { value: count(/activit/i), label: 'Other Activities' },
        ]}
      />
      <WideBlock className="grid grid-cols-1 lg:grid-cols-[1fr_20rem] gap-4 items-start">
        <div className="space-y-4">
          <Card title="" icon={ICON.refresh}>
            <Table
              rows={filtered.slice(page * AUDIT_PAGE, page * AUDIT_PAGE + AUDIT_PAGE)}
              empty="No records match the filters."
              cols={[
                { header: 'Date & Time', render: (r) => rowDate(r.at) },
                { header: 'Module', render: (r) => <span className={`inline-block rounded-[var(--radius-button)] px-2 py-0.5 text-[length:var(--fs-caption)] font-semibold ${moduleTone(r.module)}`}>{r.module}</span> },
                { header: 'Action', render: (r) => r.action },
                { header: 'Field / Item', render: (r) => r.field },
                { header: 'Old Value', render: (r) => <span className="text-muted">{r.old || '-'}</span> },
                { header: 'New Value', render: (r) => r.new },
                { header: 'Performed By', render: (r) => r.by },
                { header: 'Channel', render: (r) => r.channel },
                { header: 'Reference No.', render: (r) => <b>{r.ref}</b> },
              ]}
            />
            <div className="flex items-center justify-between px-5 py-4 border-t border-[var(--field-card-border)]">
              <span className="text-muted text-[length:var(--fs-body)]">
                Showing {filtered.length === 0 ? 0 : page * AUDIT_PAGE + 1}–{Math.min(filtered.length, (page + 1) * AUDIT_PAGE)} of {filtered.length} records
              </span>
              <div className="flex gap-2">
                {Array.from({ length: pages }, (_, i) => (
                  <button key={i} type="button" onClick={() => setPage(i)} className={`w-9 h-9 rounded-[var(--radius-button)] border text-[length:var(--fs-body)] ${i === page ? 'bg-accent text-accent-on border-accent' : 'bg-bg border-border hover:bg-surface'}`}>
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Audit Summary" icon={ICON.bars}>
            <div className="px-5 py-4 space-y-3">
              {summary.map(([label, n]) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="w-28 text-fg-2 text-[length:var(--fs-body)]">{label}</span>
                  <span className="flex-1 h-2 rounded-full bg-surface overflow-hidden">
                    <span className="block h-full bg-accent" style={{ width: `${(n / maxSum) * 100}%` }} />
                  </span>
                  <span className="w-6 text-right font-bold text-fg">{n}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Quick Filters" icon={ICON.search}>
            <div className="px-5 py-4 flex gap-2">
              {[7, 30, 90].map((d) => (
                <button key={d} type="button" onClick={() => { setDays(d); setPage(0); }} className={`flex-1 rounded-[var(--radius-button)] px-2 py-2 text-[length:var(--fs-caption)] border ${days === d ? 'bg-accent text-accent-on border-accent font-semibold' : 'bg-bg text-fg-2 border-border'}`}>
                  Last {d} days
                </button>
              ))}
            </div>
            <ActionList
              items={[
                { title: 'Account Changes', sub: 'Show account changes only', onClick: () => { setModule('Account'); setPage(0); } },
                { title: 'Contact Updates', sub: 'Show contact updates only', onClick: () => { setModule('Contact'); setPage(0); } },
                { title: 'Order Events', sub: 'Show order events only', onClick: () => { setModule('Order'); setPage(0); } },
                { title: 'Trouble Ticket Events', sub: 'Show ticket events only', onClick: () => { setModule('Trouble Ticket'); setPage(0); } },
                { title: 'Activity Logs', sub: 'Show activity logs only', onClick: () => { setModule('Activity'); setPage(0); } },
              ]}
            />
          </Card>
          <Card title="Related Actions" icon={ICON.grid}>
            <ActionList
              items={[
                { title: 'View Order History', sub: 'See all past orders', onClick: () => ctx.goToTab('ts-history') },
                { title: 'View Trouble Ticket History', sub: 'See all past tickets', onClick: () => ctx.goToTab('ts-history') },
                { title: 'View Contact History', sub: 'See contact changes', onClick: () => ctx.goToTab('ts-contact') },
                { title: 'View Account History', sub: 'See account changes', onClick: () => ctx.goToTab('ts-products') },
              ]}
            />
          </Card>
        </div>
      </WideBlock>
      <WideBlock className="">
        <Card title="Recent Key Changes" icon={ICON.star}>
          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            {keyChanges.map((k, i) => (
              <div key={i} className="rounded-[var(--radius-card)] border border-[var(--field-card-border)] p-4">
                <Icon path={ICON.card} className="w-4 h-4 text-muted" />
                <div className="text-fg font-bold text-[length:var(--fs-body)] mt-4">{k.field} {k.action}</div>
                <div className="text-fg-2 text-[length:var(--fs-caption)] mt-1 break-words">{k.old ? `${k.old} → ${k.new}` : k.ref}</div>
                <div className="text-muted text-[length:var(--fs-caption)] mt-2">{rowDate(k.at)}</div>
              </div>
            ))}
          </div>
        </Card>
      </WideBlock>
    </>
  );
}
