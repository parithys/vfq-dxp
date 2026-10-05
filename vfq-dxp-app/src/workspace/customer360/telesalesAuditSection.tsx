import { useMemo, useState } from 'react';
import { downloadCsv } from '../../engines/csvExport';
import { Icon } from '../../components/primitives/Icon';
import { Card, dateTime, type Ctx } from './telesalesOverview';
import { ActionList, HeaderButton, ICON, SectionHeader, StatStrip, Table, WideBlock } from './telesalesKit';
import { rowDate, demoOf, arr } from './telesalesShared';
import { strOrEmpty as str } from '../../lib/values';
import { AUDIT_PAGE } from './telesalesListShared';

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
