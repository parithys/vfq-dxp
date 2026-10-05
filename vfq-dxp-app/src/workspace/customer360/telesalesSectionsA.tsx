import { useState } from 'react';
import { Icon } from '../../components/primitives/Icon';
import { accountInformationResolvers } from './sections/accountInformationResolvers';
import { contactInformationResolvers } from './sections/contactInformationResolvers';
import { buildAssetsFieldResolver } from './sections/assetsResolvers';
import { blacklistResolvers } from './sections/blacklistResolvers';
import { getVisibleTopicFields } from '../../engines/customer360VisibilityEngine';
import { Card, KV, Label, Pill, Value, asText, dateTime, num, type Ctx } from './telesalesOverview';
import { ActionList, Avatar, Field, HeaderButton, HeaderLink, ICON, PillTabs, SectionHeader, StatStrip, Table, TableCard, pillFor, yesNo, WideBlock } from './telesalesKit';
import { strOrEmpty as str } from '../../lib/values';

// Account, Contacts and Connections & Services sections of the Telesales Overview page.

type Rec = Record<string, unknown>;
const demoOf = (ctx: Ctx) => (ctx.data.overviewDemo[0] ?? {}) as Rec;
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
export const rowDate = (iso: unknown) => {
  const t = dateTime(iso);
  return t.t ? `${t.d} ${t.t}` : t.d;
};

/** Everything the page's activity-style tables draw on, newest first. */
export function activityEntries(ctx: Ctx) {
  const { data } = ctx;
  return [
    ...data.activities.map((a) => ({ at: a.transactionDate, type: str(a.activityName ?? a.topic ?? a.journey ?? a.actionTaken ?? 'Activity'), detail: str(a.comments ?? a.activityReason ?? a.notes), channel: str(a.channel ?? '-'), tone: 'blue' as const })),
    ...data.payments.map((p) => ({ at: p.capturedAt, type: 'Payment', detail: `QAR ${str(p.amountQar)}`, channel: str(p.captureChannel ?? '-'), tone: 'green' as const })),
    ...data.orders.map((o) => ({ at: o.createdAt ?? o.orderDate, type: str(o.orderType ?? 'Order'), detail: `${str(o.orderId)} - ${str(o.status)}`, channel: str(o.sourceChannel ?? '-'), tone: 'green' as const })),
    ...data.tickets.map((t) => ({ at: t.createdAt, type: 'Trouble Ticket', detail: `${str(t.ticketId)} - ${str(t.status)}`, channel: str(t.channel ?? '-'), tone: 'red' as const })),
    ...data.simSwapOrders.map((s) => ({ at: s.createdAt ?? s.requestedAt, type: 'SIM Swap', detail: str(s.simSwapReason ?? s.status), channel: 'Store', tone: 'amber' as const })),
  ]
    .filter((e) => e.at)
    .sort((a, b) => str(b.at).localeCompare(str(a.at)));
}

const toneColor = { blue: 'bg-[#2563eb]', green: 'bg-success', red: 'bg-danger', amber: 'bg-[#d97706]' } as const;

// ============================================================================ Account
export function AccountSection({ ctx }: { ctx: Ctx }) {
  const { data, services } = ctx;
  const r = (d: string) => accountInformationResolvers[d]?.({ data, services });
  const demo = demoOf(ctx);
  const dunning = asText(r('Current Dunning Stage')) as string | undefined;
  const bar = (asText(data.overviewExtras[0]?.aboutToBar as string | undefined) ?? 'No') as string;
  const count = (cats: string[]) => services.filter((s) => cats.includes(s.category)).length;
  const emails = arr<string>(demo.billingEmails).length ? arr<string>(demo.billingEmails) : [str(data.billingProfiles[0]?.billingContactEmail)].filter(Boolean);
  const [allEmails, setAllEmails] = useState(false);
  const keyContacts = arr<{ role: string; name: string | null; mobile: string | null; email: string | null }>(demo.keyContacts);
  const isBusinessSegment = /enterprise|ebu|business|corporate/i.test(str(data.customer.segment));
  const entries = activityEntries(ctx).slice(0, 5);
  const orders = [...data.orders].sort((a, b) => str(b.createdAt).localeCompare(str(a.createdAt))).slice(0, 5);
  const pend: [string, string][] = [
    ['Pending TON Requests', 'Pending TON requests'],
    ['Pending Adjustments', 'Pending Adjustments'],
    ['Pending SIM Swap', 'Pending Sim swap'],
  ];
  return (
    <>
      <SectionHeader
        icon={ICON.card}
        title="Account"
        description="View and manage account information, key contacts, related actions and recent milestones for this customer."
        actions={
          <>
            <HeaderLink onClick={() => ctx.goToTab('ts-products')}>View Account Hierarchy →</HeaderLink>
            <HeaderButton primary onClick={() => ctx.goToTab('ts-leads')}>
              + Create Lead
            </HeaderButton>
          </>
        }
      />
      <div className="contents">
        <Card title="Account Information" icon={ICON.card} link="View Account Hierarchy" onLink={() => ctx.goToTab('ts-products')}>
          <div className="px-5 py-4 grid grid-cols-3 gap-4">
            <div>
              <Label>Account Number</Label>
              <Value>{str(data.accounts[0]?.accountId)}</Value>
            </div>
            <div>
              <Label>Primary MSISDN</Label>
              <Value>{str(r('Primary MSISDN'))}</Value>
            </div>
            <div>
              <Label>Segment</Label>
              <Value>{str(r('Segment'))}</Value>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-6 px-0">
            <KV label="Current Dunning Stage">
              <Pill tone={dunning && !/^(none|no dunning|current)$/i.test(dunning) ? 'amber' : 'green'}>{dunning ?? '-'}</Pill>
            </KV>
            <KV label="About to OG/IC Bar">{yesNo(bar)}</KV>
            <KV label="Credit Limit">{str(r('Credit Limit')) || '-'}</KV>
            {pend.map(([label, d]) => (
              <KV key={d} label={label}>
                <Pill tone="amber">{num(r(d)) ?? 0}</Pill>
              </KV>
            ))}
          </div>
          <div className="px-5 py-4 grid grid-cols-4 gap-2">
            {[
              ['Mobile', ICON.phone, ['Prepaid', 'Postpaid']],
              ['Fixed Line', ICON.phone, ['Fixed Line']],
              ['TV', ICON.grid, ['TV / Entertainment']],
              ['GigaHome', ICON.globe, ['GigaHome Fibre', 'GigaHome 5G']],
            ].map(([label, icon, cats]) => (
              <div key={label as string} className="rounded-[var(--radius-card)] bg-surface px-2 py-3 text-center">
                <Icon path={icon as string} className="w-5 h-5 mx-auto text-fg" />
                <div className="text-fg font-bold text-[length:var(--fs-h4)]">{count(cats as string[])}</div>
                <div className="text-muted text-[length:var(--fs-caption)]">{label as string}</div>
              </div>
            ))}
          </div>
          <div className="px-5 pb-5">
            <div className="text-fg-2 font-semibold text-[length:var(--fs-body)] border-b border-[var(--field-card-border)] pb-2 mb-2">Billing Email ID(s)</div>
            <ul className="text-fg text-[length:var(--fs-body)] space-y-1">
              {(allEmails ? emails : emails.slice(0, 2)).map((e) => (
                <li key={e}>• {e}</li>
              ))}
            </ul>
            {emails.length > 2 && (
              <button type="button" className="text-accent font-semibold text-[length:var(--fs-body)] mt-1" onClick={() => setAllEmails((v) => !v)}>
                {allEmails ? 'Show less' : `+${emails.length - 2} more`}
              </button>
            )}
          </div>
        </Card>

        {/* Key Contacts (account manager, escalation) belong to business accounts. The seeded list is the same
            three roles for every customer, so it is shown only for the Enterprise (EBU) segment. */}
        {isBusinessSegment && (
          <Card title="Key Contacts" icon={ICON.user} link="View All" onLink={() => ctx.goToTab('ts-contact')}>
            {keyContacts.length === 0 && <p className="px-5 py-4 text-muted text-[length:var(--fs-body)]">No key contacts on file.</p>}
            {keyContacts.map((k) => (
              <div key={k.role} className="flex gap-4 px-5 py-4 border-b border-[var(--field-card-border)] last:border-0">
                <Avatar name={k.name ?? 'Manager'} />
                <div className="min-w-0">
                  <div className="text-muted uppercase tracking-wide text-[length:var(--fs-caption-upper)]">{k.role}</div>
                  {k.name && <div className="text-fg font-semibold text-[length:var(--fs-body-lg)]">{k.name}</div>}
                  {k.mobile && (
                    <div className="text-fg-2 text-[length:var(--fs-body)] inline-flex items-center gap-2">
                      <Icon path={ICON.phone} className="w-3.5 h-3.5" />
                      {k.mobile}
                    </div>
                  )}
                  {k.email && (
                    <div className="text-fg-2 text-[length:var(--fs-body)] flex items-center gap-2">
                      <Icon path={ICON.globe} className="w-3.5 h-3.5" />
                      {k.email}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </Card>
        )}

        <Card title="Related Actions" icon={ICON.bars}>
          <ActionList
            items={[
              { title: 'New Activation / Migration', sub: 'Cross-Sales, AutoBase, Happy Offer', icon: ICON.chevron },
              { title: 'Modify Existing Plan', sub: 'Change plan or add-ons', icon: ICON.refresh },
              { title: 'Request SIM Swap', sub: 'Initiate SIM replacement', icon: ICON.refresh },
              { title: 'Create Trouble Ticket', sub: 'Log an issue for this account', icon: ICON.help, onClick: () => ctx.goToTab('ts-history') },
              { title: 'Create Lead', sub: 'Capture sales opportunity', icon: ICON.star, onClick: () => ctx.goToTab('ts-leads') },
            ]}
          />
        </Card>
      </div>

      <div className="contents">
        <Card title="Recent Milestones / Interactions" icon={ICON.refresh} link="View All" onLink={() => ctx.goToTab('ts-history')}>
          <div className="px-5 py-3">
            {entries.length === 0 && <p className="text-muted text-[length:var(--fs-body)] py-2">Nothing on file.</p>}
            {entries.map((e, i) => {
              const t = dateTime(e.at);
              return (
                <div key={i} className="flex gap-4 py-3">
                  <div className="w-24 shrink-0 text-fg-2 text-[length:var(--fs-caption)]">
                    <div>{t.d}</div>
                    <div>{t.t}</div>
                  </div>
                  <span className={`w-8 h-8 rounded-full ${toneColor[e.tone]} flex items-center justify-center text-white shrink-0`}>
                    <Icon path={ICON.refresh} className="w-3.5 h-3.5" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-fg font-semibold text-[length:var(--fs-body-lg)]">{e.type}</div>
                    <div className="text-fg-2 text-[length:var(--fs-body)]">{e.detail}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
        <TableCard
          title="Last 5 Activities"
          icon={ICON.star}
          link="View All"
          onLink={() => ctx.goToTab('ts-history')}
          rows={entries}
          empty="No activity on file."
          cols={[
            { header: 'Date & Time', render: (e) => rowDate(e.at) },
            { header: 'Activity Type', render: (e) => e.type },
            { header: 'Details', render: (e) => e.detail },
            { header: 'Channel', render: (e) => e.channel },
          ]}
        />
        <TableCard
          title="Last 5 Orders"
          icon={ICON.card}
          link="View All"
          onLink={() => ctx.goToTab('ts-history')}
          rows={orders}
          empty="No orders on file."
          cols={[
            { header: 'Order Number', render: (o) => <b>{str(o.orderId)}</b> },
            { header: 'Date', render: (o) => (o.createdAt ? dateTime(o.createdAt).d : '-') },
            { header: 'Product / Service', render: (o) => str(o.orderType) },
            { header: 'Status', render: (o) => <Pill tone={pillFor(str(o.status))}>{str(o.status)}</Pill> },
          ]}
        />
      </div>
    </>
  );
}

// ============================================================================ Contacts
interface ContactRow {
  key: string;
  name: string;
  badge?: string;
  badgeTone?: 'solid' | 'green';
  relation: string;
  mobile: string;
  email: string;
  self?: boolean;
}

export function ContactsSection({ ctx }: { ctx: Ctx }) {
  const { data, services } = ctx;
  const demo = demoOf(ctx);
  const meta = (demo.contactMeta ?? {}) as Rec;
  const prefs = (demo.commPrefs ?? {}) as Rec;
  const c = (d: string) => asText(contactInformationResolvers[d]?.({ data, services }));
  const [selected, setSelected] = useState('self');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('All Roles');
  const authorised = data.authorisedContacts;
  const others = arr<{ name: string; relation: string; mobile: string; email: string }>(demo.otherContacts);
  const rows: ContactRow[] = [
    { key: 'self', name: str(data.customer.name), badge: 'Primary', badgeTone: 'solid', relation: 'Customer (Self)', mobile: str(data.customer.phone), email: str(data.customer.email), self: true },
    ...authorised.map((a, i) => ({ key: `a${i}`, name: str(a.name), badge: 'Authorised', badgeTone: 'green' as const, relation: 'Authorised Person', mobile: str(a.mobile), email: str(a.email) })),
    ...others.map((o, i) => ({ key: `o${i}`, name: o.name, relation: o.relation, mobile: o.mobile, email: o.email })),
  ];
  const shown = rows.filter((r) => (role === 'All Roles' || r.relation === role) && `${r.name} ${r.relation} ${r.email}`.toLowerCase().includes(query.toLowerCase()));
  const cur = rows.find((r) => r.key === selected) ?? rows[0];
  const total = rows.length;
  const notif = rows.filter((r) => r.relation === 'Notification Contact').length;
  const roles = arr<{ role: string; authorised: boolean; from: string; to: string | null; status: string }>([
    { role: 'Account Owner', authorised: true, from: '2018-01-12', to: null, status: 'Active' },
    { role: 'Service Management', authorised: true, from: '2018-01-12', to: null, status: 'Active' },
    { role: 'Billing Management', authorised: true, from: '2018-01-12', to: null, status: 'Active' },
    { role: 'Order Placement', authorised: true, from: '2018-01-12', to: null, status: 'Active' },
  ]);
  const activities = arr<{ at: string; activity: string; by: string }>(demo.contactActivities);
  const idStatus = data.customer.blacklisted ? 'Blacklisted' : 'Whitelisted';
  return (
    <>
      <SectionHeader
        icon={ICON.user}
        title="Contacts"
        description="View and manage all contacts associated with this customer. Access authorised persons, roles and communication preferences."
        actions={<HeaderButton primary>+ Add Contact ›</HeaderButton>}
      />
      <StatStrip
        items={[
          { value: total, label: 'Total Contacts' },
          { value: 1, label: 'Primary Contact' },
          { value: authorised.length, label: 'Authorised Persons' },
          { value: notif, label: 'Notification Contacts' },
          { value: str(c('Preferred Language')) || '-', label: 'Preferred Language' },
          { value: str(c('Total Number of Connections')) || services.length, label: 'Total Connections' },
        ]}
      />
      <div className="contents">
        <div className="contents">
          <Card title={`Contacts List (${total})`} icon={ICON.user}>
            <div className="px-4 py-3 flex gap-2 border-b border-[var(--field-card-border)]">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search contacts by name, role or email..."
                aria-label="Search contacts"
                className="flex-1 min-w-0 rounded-[var(--field-radius)] border border-[var(--field-border)] bg-surface px-3 py-2 text-[length:var(--fs-caption)]"
              />
              <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filter by role" className="rounded-[var(--field-radius)] border border-[var(--field-border)] bg-bg px-2 text-[length:var(--fs-caption)]">
                {['All Roles', 'Customer (Self)', 'Authorised Person', 'Notification Contact', 'Family Member'].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
            {shown.map((r) => (
              <button key={r.key} type="button" onClick={() => setSelected(r.key)} className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b border-[var(--field-card-border)] last:border-0 hover:bg-surface ${cur?.key === r.key ? 'bg-surface' : ''}`}>
                <Avatar name={r.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-fg font-semibold text-[length:var(--fs-body-lg)] truncate">{r.name}</span>
                    {r.badge && <Pill tone={r.badgeTone ?? 'green'}>{r.badge}</Pill>}
                  </span>
                  <span className="block text-fg-2 text-[length:var(--fs-caption)]">{r.relation}</span>
                  <span className="block text-fg-2 text-[length:var(--fs-caption)] truncate">
                    {r.mobile} | {r.email}
                  </span>
                </span>
                <Icon path={ICON.chevron} className="w-4 h-4 text-muted shrink-0 mt-2" />
              </button>
            ))}
          </Card>
          <TableCard
            title={`Authorised Persons (${authorised.length})`}
            icon={ICON.shield}
            link="View All"
            onLink={() => ctx.goToTab('ts-contact')}
            rows={authorised}
            empty="No authorised persons on file."
            cols={[
              { header: 'Name', render: (a) => str(a.name) },
              { header: 'Role', render: (a) => str(a.jobTitle ?? (a.roles as string[] | undefined)?.join(', ')) },
              { header: 'Mobile Number', render: (a) => str(a.mobile) },
            ]}
          />
        </div>

        <div className="contents">
          <Card title="Contact Details" icon={ICON.user} link="Edit">
            <div className="px-5 py-4 flex items-center gap-3 flex-wrap">
              <Avatar name={cur?.name ?? ''} />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-fg font-bold text-[length:var(--fs-body-lg)]">{cur?.name}</span>
                  {cur?.badge && <Pill tone={cur.badgeTone ?? 'green'}>{cur.badge === 'Primary' ? 'Primary Contact' : cur.badge}</Pill>}
                </div>
                <div className="text-fg-2 text-[length:var(--fs-caption)]">{cur?.relation}</div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-6">
            <KV label="ID Type">{str(c('ID Type')) === 'QID' ? 'Qatar ID' : str(c('ID Type')) || '-'}</KV>
            <KV label="ID Number">{str(c('ID Number')) || '-'}</KV>
            <KV label="ID Status">
              <Pill tone={data.customer.blacklisted ? 'red' : 'green'}>{idStatus}</Pill>
            </KV>
            <KV label="Date of Birth">{c('DOB') ? dateTime(c('DOB')).d : '-'}</KV>
            <KV label="Tenure">{str(meta.tenure) || '-'}</KV>
            <KV label="Preferred Language">{str(c('Preferred Language')) || '-'}</KV>
            <KV label="Email">{cur?.email || '-'}</KV>
            <KV label="Mobile Number">{cur?.mobile ? `${cur.mobile}${cur.self ? ' (Primary)' : ''}` : '-'}</KV>
            <KV label="Notification MSISDN">{str(c('Notification MSISDN')) || '-'}</KV>
            <KV label="Employer">{str(meta.employer) || '-'}</KV>
            <KV label="Total Number of Connections">{str(c('Total Number of Connections')) || services.length}</KV>
            <KV label="Credit Score">
              <Pill tone="green">{str(meta.creditScore) || '-'}</Pill>
            </KV>
            </div>
          </Card>
          <TableCard
            title="Authorisation & Roles"
            icon={ICON.shield}
            link="View History"
            rows={roles}
            cols={[
              { header: 'Role', render: (r) => r.role },
              { header: 'Authorised', render: () => yesNo(true) },
              { header: 'From Date', render: (r) => dateTime(r.from).d },
              { header: 'To Date', render: (r) => r.to ?? '-' },
              { header: 'Status', render: (r) => <Pill tone="green">{r.status}</Pill> },
            ]}
          />
          <TableCard
            title="Recent Contact Activities"
            icon={ICON.refresh}
            link="View All"
            rows={activities}
            cols={[
              { header: 'Date & Time', render: (a) => rowDate(a.at) },
              { header: 'Activity', render: (a) => a.activity },
              { header: 'Performed By', render: (a) => a.by },
            ]}
          />
        </div>

        <div className="contents">
          <Card title="Communication Preferences" icon={ICON.phone} link="Edit">
            <Field label="Preferred Language">{str(c('Preferred Language')) || '-'}</Field>
            <Field label="Email for Billing">{yesNo(prefs.emailForBilling as boolean)}</Field>
            <Field label="Email">{str(data.customer.email) || '-'}</Field>
            <Field label="Notification MSISDN">{str(c('Notification MSISDN')) || '-'}</Field>
            <Field label="Marketing Communication">{yesNo(prefs.marketing as boolean)}</Field>
            <Field label="SMS Notifications">{yesNo(prefs.sms as boolean)}</Field>
            <Field label="Email Notifications">{yesNo(prefs.emailNotifications as boolean)}</Field>
          </Card>
          <Card title="Additional Information" icon={ICON.grid}>
            <Field label="QCB Check">
              <Pill tone="green">{str(c('QCB Check')) || '-'}</Pill>
            </Field>
            <Field label="Cross Sale Offers Flag">{yesNo(str(c('Cross sale offers flag')))}</Field>
            <Field label="Sales Enhancement Offers">{yesNo(c('Sales enhansment offers') ? 'Yes' : 'No')}</Field>
          </Card>
          <Card title="Related Actions" icon={ICON.bars}>
            <ActionList
              items={[
                { title: 'View Contact Hierarchy', sub: 'View parent and related contacts' },
                { title: 'Manage Authorisations', sub: 'Update roles and permissions' },
                { title: 'View Audit Trail', sub: 'See all contact related activities', onClick: () => ctx.goToTab('ts-history') },
                { title: 'Create Trouble Ticket', sub: 'Log an issue for this contact', onClick: () => ctx.goToTab('ts-history') },
              ]}
            />
          </Card>
        </div>
      </div>
    </>
  );
}

// ============================================================================ Connections & Services
const SERVICE_FILTERS = ['All Services', 'Mobile', 'Fixed Line', 'TV', 'GigaHome'];

export function ConnectionsSection({ ctx }: { ctx: Ctx }) {
  const { data, services } = ctx;
  const [query, setQuery] = useState('');
  const [type, setType] = useState('All Services');
  const [status, setStatus] = useState('All Status');
  const [picked, setPicked] = useState(services[0]?.ref);
  const [tab, setTab] = useState('overview');
  const group = (cat: string) => (cat === 'Prepaid' || cat === 'Postpaid' ? 'Mobile' : cat === 'TV / Entertainment' ? 'TV' : cat.startsWith('GigaHome') ? 'GigaHome' : cat);
  const shown = services.filter((s) => (type === 'All Services' || group(s.category) === type) && (status === 'All Status' || (s.status ?? 'Active') === status) && `${s.identifier} ${s.label} ${s.category}`.toLowerCase().includes(query.toLowerCase()));
  const cur = services.find((s) => s.ref === picked) ?? services[0];
  const res = buildAssetsFieldResolver(cur, data);
  const addons = data.addonsDiscounts.filter((a) => a.category !== 'Discount');
  const discounts = data.addonsDiscounts.filter((a) => a.category === 'Discount');
  const creditLimit = data.creditLimits[0];
  const billLimit = res('Bill Limit') ?? (creditLimit ? `QAR ${str(creditLimit.creditLimitQar ?? creditLimit.creditLimitQAR)}` : '-');
  const bal = data.inPlatformBalances[0];
  const use = data.serviceUsage[0];
  const ex = data.overviewExtras[0];
  const voiceTotal = Number(ex?.voiceAllowanceMin ?? 500);
  const voiceLeft = bal?.voiceBalanceMinutes != null ? Number(bal.voiceBalanceMinutes) : Math.max(0, voiceTotal - Number(use?.currentVoiceUsageMinutes ?? 0));
  const smsTotal = Number(ex?.smsAllowance ?? 500);
  const smsLeft = bal?.smsBalanceCount != null ? Number(bal.smsBalanceCount) : Number(ex?.smsRemaining ?? 0);
  const dataTotal = use ? Number(use.currentDataUsageGB) + Number(use.availableDataBalanceGB) : 0;
  const dataLeft = bal?.dataBalanceGB != null ? Number(bal.dataBalanceGB) : Number(use?.availableDataBalanceGB ?? 0);
  const bar = (label: string, left: number, total: number, unit: string) => (
    <div key={label} className="flex items-center gap-3 px-5 py-2.5">
      <span className="w-12 text-fg-2 text-[length:var(--fs-caption)]">{label}</span>
      <span className="flex-1 h-2 rounded-full bg-surface overflow-hidden">
        <span className="block h-full bg-accent" style={{ width: `${total ? Math.min(100, (left / total) * 100) : 0}%` }} />
      </span>
      <span className="text-fg font-semibold text-[length:var(--fs-caption)] whitespace-nowrap">
        {left} of {total} {unit}
      </span>
    </div>
  );
  const entries = activityEntries(ctx).slice(0, 5);
  const cdr = [...data.callDetailRecords].sort((a, b) => str(b.callDate).localeCompare(str(a.callDate))).slice(0, 5);
  const usageBehaviour = arr<{ name: string }>((data.demoCatalog[0] ?? {}).usageInsights).slice(0, 4).map((u) => u.name.replace(/ User$/, ''));
  const pr = (s: string) => str(res(s));
  const c = (cats: string[]) => services.filter((s) => cats.includes(s.category)).length;
  return (
    <>
      <SectionHeader
        icon={ICON.bars}
        title="Connections & Services"
        description="View and manage all mobile, fixed line, TV and GigaHome connections associated with this customer."
        actions={
          <>
            <select aria-label="View by" className="rounded-[var(--radius-button)] border border-border bg-bg px-3 py-2 text-[length:var(--fs-body)]">
              <option>View by Service Type</option>
            </select>
            <HeaderButton primary>+ New Connection</HeaderButton>
          </>
        }
      />
      <StatStrip
        items={[
          { value: c(['Prepaid', 'Postpaid']), label: 'Mobile Connections' },
          { value: c(['Fixed Line']), label: 'Fixed Line' },
          { value: c(['TV / Entertainment']), label: 'TV Connections' },
          { value: c(['GigaHome Fibre', 'GigaHome 5G']), label: 'GigaHome' },
        ]}
      />
      <WideBlock className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-4 items-start">
        <Card title="" icon={ICON.bars}>
          <div className="px-4 py-3 flex gap-2 border-b border-[var(--field-card-border)]">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by MSISDN, service number or plan name..." aria-label="Search connections" className="flex-1 min-w-0 rounded-[var(--field-radius)] border border-[var(--field-border)] bg-surface px-3 py-2 text-[length:var(--fs-caption)]" />
            <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Service type" className="rounded-[var(--field-radius)] border border-[var(--field-border)] bg-bg px-2 text-[length:var(--fs-caption)]">
              {SERVICE_FILTERS.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status" className="rounded-[var(--field-radius)] border border-[var(--field-border)] bg-bg px-2 text-[length:var(--fs-caption)]">
              {['All Status', 'Active', 'Suspended'].map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </div>
          {shown.map((s) => {
            const rr = buildAssetsFieldResolver(s, data);
            return (
              <button key={s.ref} type="button" onClick={() => setPicked(s.ref)} className={`w-full text-left px-5 py-4 border-b border-[var(--field-card-border)] last:border-0 hover:bg-surface ${cur?.ref === s.ref ? 'bg-surface' : ''}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 min-w-0">
                    <Icon path={ICON.phone} className="w-4 h-4 shrink-0" />
                    <span className="text-fg font-bold text-[length:var(--fs-body-lg)] truncate">{s.identifier}</span>
                    <Pill tone={pillFor(s.status ?? 'Active') === 'red' ? 'red' : 'green'}>{s.status ?? 'Active'}</Pill>
                  </span>
                  <Icon path={ICON.chevron} className="w-4 h-4 text-muted shrink-0" />
                </div>
                <div className="text-fg-2 text-[length:var(--fs-caption)] mt-1">
                  {group(s.category)} | {s.category} | {s.label}
                </div>
                <div className="grid grid-cols-5 gap-2 mt-2 text-[length:var(--fs-caption)]">
                  {[
                    ['Plan Name', str(rr('Plan Name')) || s.label],
                    ['Bill Limit', str(rr('Bill Limit')) || '-'],
                    ['Active Add-ons', String(addons.length)],
                    ['Active Discount', discounts.length ? `${discounts.length}` : '-'],
                    ['Usage Behaviour', usageBehaviour[0] ?? '-'],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <div className="text-muted uppercase text-[length:var(--fs-micro)]">{k}</div>
                      <div className="text-fg font-semibold">{v}</div>
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
          {shown.length === 0 && <p className="px-5 py-4 text-muted text-[length:var(--fs-body)]">No connections match.</p>}
        </Card>

        <Card title="" icon={ICON.bars}>
          {cur ? (
            <>
              <div className="px-5 py-4 flex items-start justify-between">
                <div>
                  <div className="text-fg font-bold text-[length:var(--fs-h4)]">{cur.identifier}</div>
                  <div className="text-fg-2 text-[length:var(--fs-body)]">
                    {group(cur.category)} | {cur.category} | {cur.label}
                  </div>
                </div>
                <Pill tone="green">{cur.status ?? 'Active'}</Pill>
              </div>
              <div className="px-5 pb-3">
                <PillTabs
                  active={tab}
                  onChange={setTab}
                  items={[
                    { key: 'overview', label: 'Overview' },
                    { key: 'usage', label: 'Usage' },
                    { key: 'plan', label: 'Plan & Add-ons' },
                    { key: 'benefits', label: 'Benefits' },
                    { key: 'doi', label: 'Device (DOI)' },
                    { key: 'more', label: 'More' },
                  ]}
                />
              </div>
              {tab === 'overview' && (
                <>
                  <div className="grid grid-cols-2 border-t border-[var(--field-card-border)]">
                    <div className="border-r border-[var(--field-card-border)]">
                      <div className="flex items-center justify-between px-5 py-3">
                        <span className="text-fg font-semibold">Service Details</span>
                        <span className="text-accent font-semibold text-[length:var(--fs-caption)]">Edit</span>
                      </div>
                      <KV label="MSISDN">{cur.identifier}</KV>
                      <KV label="Service Type">{group(cur.category)}</KV>
                      <KV label="Status">{cur.status ?? 'Active'}</KV>
                      <KV label="Plan Name">{pr('Plan Name') || cur.label}</KV>
                      <KV label="MSISDN Activation Date">{pr('MSISDN Activation Date') ? dateTime(pr('MSISDN Activation Date')).d : '-'}</KV>
                      <KV label="Postpaid Activation Date">{pr('Postpaid Activation Date') ? dateTime(pr('Postpaid Activation Date')).d : '-'}</KV>
                      <KV label="Plan Activation Date">{pr('Plan Activation Date') ? dateTime(pr('Plan Activation Date')).d : '-'}</KV>
                      <KV label="SIM Serial">{pr('Sim serial') || '-'}</KV>
                      <KV label="Star Number Value">{yesNo(res('Star number value') ? 'Yes' : 'No')}</KV>
                      <KV label="AutoBase Eligibility">
                        <Pill tone="green">Eligible</Pill>
                      </KV>
                    </div>
                    <div>
                      <div className="flex items-center justify-between px-5 py-3">
                        <span className="text-fg font-semibold">Financials</span>
                        <button type="button" onClick={() => ctx.goToTab('ts-billing')} className="text-accent font-semibold text-[length:var(--fs-caption)]">
                          View Usage
                        </button>
                      </div>
                      <KV label="Bill Limit">{billLimit}</KV>
                      <KV label="Current Balance">{bal ? `QAR ${str(bal.mainBalanceQAR ?? 0)}` : '-'}</KV>
                      <KV label="Pending Discounts">{discounts.length}</KV>
                      <KV label="Active Discount">{discounts[0] ? str(discounts[0].name) : '-'}</KV>
                      {bar('Data', dataLeft, Math.round(dataTotal), 'GB')}
                      {bar('Voice', voiceLeft, voiceTotal, 'Mins')}
                      {bar('SMS', smsLeft, smsTotal, 'SMS')}
                      <KV label="Primary Balance">{bal ? `QAR ${str(bal.mainBalanceQAR ?? 0)}` : '-'}</KV>
                    </div>
                  </div>
                  <div className="px-5 py-4 space-y-3 border-t border-[var(--field-card-border)] text-[length:var(--fs-body)]">
                    <div>
                      <span className="text-fg font-semibold">✓ Active Add-ons ({addons.length})</span> <span className="text-accent font-semibold">View All</span>
                      <div className="flex flex-wrap gap-3 mt-1 text-fg-2">
                        {addons.length === 0 && <span>None</span>}
                        {addons.map((a) => (
                          <span key={str(a.addonDiscountId)}>
                            {str(a.name)} <Pill tone="green">Active</Pill>
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-fg font-semibold">Barring Flags</span> <span className="text-accent font-semibold">View Details</span>
                      <div className="flex flex-wrap gap-3 mt-1 text-fg-2">
                        {['Outgoing Bar', 'Incoming Bar', 'Any Barring Flags'].map((b) => (
                          <span key={b}>
                            {b} <Pill tone="red">No</Pill>
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-fg font-semibold">Usage Behaviour</span> <span className="text-accent font-semibold">View Details</span>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {usageBehaviour.map((u) => (
                          <Pill key={u} tone="amber">
                            {u}
                          </Pill>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-fg font-semibold">App &amp; Digital</span> <span className="text-accent font-semibold">View Details</span>
                      <div className="text-fg-2 mt-1">
                        App User: <b className="text-fg">{data.digitalEngagement[0] ? (data.digitalEngagement[0].appActiveUser ? 'Yes' : 'No') : '-'}</b> Last Login:{' '}
                        <b className="text-fg">{data.digitalEngagement[0]?.appLastLoginAt ? dateTime(data.digitalEngagement[0].appLastLoginAt).d : '-'}</b> Digital Adoption:{' '}
                        <b className="text-fg">{data.digitalEngagement[0] ? `${str(data.digitalEngagement[0].appDigitalAdoptionPct)}%` : '-'}</b> App Version: <b className="text-fg">{str(data.digitalEngagement[0]?.appVersion) || '-'}</b> Phone Version:{' '}
                        <b className="text-fg">{str(ex?.phoneVersion) || '-'}</b>
                      </div>
                    </div>
                  </div>
                </>
              )}
              {tab === 'usage' && (
                <div className="border-t border-[var(--field-card-border)] py-2">
                  {bar('Data', dataLeft, Math.round(dataTotal), 'GB')}
                  {bar('Voice', voiceLeft, voiceTotal, 'Mins')}
                  {bar('SMS', smsLeft, smsTotal, 'SMS')}
                </div>
              )}
              {tab === 'plan' && (
                <div className="border-t border-[var(--field-card-border)]">
                  <KV label="Plan Name">{pr('Plan Name') || cur.label}</KV>
                  <KV label="Active Add-ons">{addons.map((a) => str(a.name)).join(', ') || 'None'}</KV>
                  <KV label="Active Discounts">{discounts.map((a) => str(a.name)).join(', ') || 'None'}</KV>
                  <KV label="Bill Limit">{billLimit}</KV>
                </div>
              )}
              {tab === 'benefits' && (
                <div className="border-t border-[var(--field-card-border)]">
                  <KV label="Plan and Add-ons Benefits">{pr('Plan and Add-ons Benefits') || '-'}</KV>
                </div>
              )}
              {tab === 'doi' && (
                <div className="border-t border-[var(--field-card-border)]">
                  <KV label="DOI Handset Type">{pr('DOI Handset Type') || '-'}</KV>
                  <KV label="DOI Price">{pr('DOI Price') || '-'}</KV>
                  <KV label="DOI Remaining Amount">{pr('DOI Remaining Amount') || '-'}</KV>
                  <KV label="DOI Tenure">{pr('DOI Tennure') || '-'}</KV>
                </div>
              )}
              {tab === 'more' && (
                <div className="border-t border-[var(--field-card-border)]">
                  <KV label="Service reference">{cur.ref}</KV>
                  <KV label="Category">{cur.category}</KV>
                </div>
              )}
            </>
          ) : (
            <p className="px-5 py-4 text-muted">No connection selected.</p>
          )}
        </Card>
      </WideBlock>
      <div className="contents">
        <TableCard
          title="Recent Usage (Last 10)"
          icon={ICON.refresh}
          link="View All"
          onLink={() => ctx.goToTab('ts-products')}
          rows={cdr}
          empty="No recent usage on file."
          cols={[
            { header: 'Date & Time', render: (r) => rowDate(r.callDate) },
            { header: 'Type', render: (r) => str(r.callType) },
            { header: 'Details', render: (r) => str(r.destination) },
            { header: 'Amount / Volume', render: (r) => <b>{`${Math.round(Number(r.durationSeconds ?? 0) / 60)} Mins`}</b> },
          ]}
        />
        <TableCard
          title="Recent Activities"
          icon={ICON.star}
          link="View All"
          onLink={() => ctx.goToTab('ts-history')}
          rows={entries}
          cols={[
            { header: 'Date & Time', render: (e) => rowDate(e.at) },
            { header: 'Activity', render: (e) => e.type },
            { header: 'Channel', render: (e) => e.channel },
          ]}
        />
        <Card title="Quick Actions" icon={ICON.bars} link="View All">
          <ActionList
            items={[
              { title: 'Change Plan', sub: 'Modify current plan' },
              { title: 'Add / Remove Add-ons', sub: 'Manage add-ons' },
              { title: 'Request SIM Swap', sub: 'Initiate SIM replacement' },
              { title: 'View Device / DOI', sub: 'Check device installment' },
              { title: 'Trouble Ticket', sub: 'Log an issue for this line', onClick: () => ctx.goToTab('ts-history') },
            ]}
          />
        </Card>
      </div>
    </>
  );
}

// Re-exported so the Overview page can keep its Blacklist view / table helpers in one place.
export { Table, blacklistResolvers, getVisibleTopicFields };
