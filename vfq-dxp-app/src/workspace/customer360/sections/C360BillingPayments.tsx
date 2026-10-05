import { useMemo, useState } from 'react';
import { Icon } from '../../../components/primitives/Icon';
import { computeBillingSummary, withinBillHistoryWindow, type Customer360Data } from '../../../engines/customer360Engine';
import type { CustomerService } from '../../../engines/customerServicesEngine';
import { GridTable, IC, KpiGrid, KpiTile, Panel, Pill, StatusPill, TabPage, UnderlineTabs, fmtDate, qar, type GridCol } from './C360Kit';
import { Dv } from '../demoValues';
import { str } from '../../../lib/values';

type Rec = Record<string, unknown>;
const DASH = '-';
const PAGE = 5;

/** "2026-07" -> "01 Jul 2026 - 31 Jul 2026". */
function periodRange(period: unknown): string {
  const m = /^(\d{4})-(\d{2})$/.exec(String(period ?? ''));
  if (!m) return str(period) ?? DASH;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const first = new Date(y, mo - 1, 1);
  const last = new Date(y, mo, 0);
  const f = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return `${f(first)} – ${f(last)}`;
}

function billStatusLabel(status: unknown): string {
  const s = String(status ?? '').toLowerCase();
  if (s === 'billed') return 'Unpaid';
  if (!s) return DASH;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function daysUntil(iso: unknown): number | undefined {
  const t = new Date(String(iso ?? '')).getTime();
  if (Number.isNaN(t)) return undefined;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((t - today.getTime()) / 86_400_000);
}

const isBillRow = (b: Rec) => b.status === 'billed' || b.status === 'paid';

function Chevron() {
  return (
    <button type="button" disabled aria-label="Open" className="text-fg disabled:opacity-60 disabled:cursor-not-allowed">
      <Icon path={IC.chevRight} className="w-4 h-4" />
    </button>
  );
}

/** Red link-styled action that has no destination yet - rendered inert. */
function InertLink({ children }: { children: string }) {
  return (
    <span aria-disabled="true" title="Not available yet" className="text-accent font-medium text-[length:var(--fs-body)] opacity-40 cursor-not-allowed whitespace-nowrap">
      {children} &rarr;
    </span>
  );
}

export function C360BillingPayments({ data, goToTab }: { data: Customer360Data; services: CustomerService[]; goToTab?: (key: string) => void }) {
  const [profileId, setProfileId] = useState('all');
  const [tab, setTab] = useState('bills');
  const [showAllBills, setShowAllBills] = useState(false);

  const profiles = data.billingProfiles as Rec[];
  const selected = profiles.find((p) => p.billingProfileId === profileId);
  const forProfile = (r: Rec) => !selected || r.billingProfileId === selected.billingProfileId;

  const summary = computeBillingSummary(data);
  const bills = useMemo(
    () => (data.bills as Rec[]).filter(forProfile).sort((a, b) => String(b.billPeriod ?? '').localeCompare(String(a.billPeriod ?? ''))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.bills, profileId],
  );
  const billed = bills.filter((b) => withinBillHistoryWindow(b.billPeriod) && isBillRow(b));
  const latestBill = selected ? billed[0] : summary.latestBill;
  const outstandingOf = (list: Rec[]) => list.filter((b) => b.status === 'billed').reduce((s, b) => s + Number(b.totalAmount ?? 0), 0);
  const outstanding = selected ? outstandingOf(bills) : summary.outstanding;
  const lastPayment = summary.previousPayment;
  const unbilled = latestBill?.currentChargesQAR;
  const dueIn = daysUntil(latestBill?.dueDate);

  const historyBills = bills.filter(isBillRow);
  const unbilledRows = bills.filter((b) => b.status === 'unbilled' || b.type === 'hotBill');
  const payments = [...(data.payments as Rec[])].sort((a, b) => String(b.capturedAt ?? '').localeCompare(String(a.capturedAt ?? '')));

  const stageProfile = selected ?? profiles[0];
  const ptpStatus = str(stageProfile?.promiseToPayStatus);
  const ptpEligible = stageProfile ? (outstanding > 0 && (ptpStatus ?? 'None') === 'None' ? 'Yes' : 'No') : undefined;
  const ebill = str(stageProfile?.billMedium);

  const billCols: GridCol<Rec>[] = [
    { key: '#', header: '#', render: (_r, i) => i + 1 },
    { key: 'billId', header: 'Bill Number', render: (r) => str(r.billId) ?? DASH },
    { key: 'period', header: 'Bill Period', render: (r) => periodRange(r.billPeriod) },
    { key: 'billDate', header: 'Bill Date', render: (r) => <Dv k="billDate" row={{ period: str(r.billPeriod) }} /> },
    { key: 'amt', header: 'Amount (QAR)', render: (r) => str(r.totalAmount) ?? DASH },
    { key: 'status', header: 'Status', render: (r) => (r.status ? <StatusPill status={billStatusLabel(r.status)} /> : DASH) },
    { key: 'act', header: 'Actions', className: 'text-center', render: () => <Chevron /> },
  ];

  const profileCols: GridCol<Rec>[] = [
    { key: '#', header: '#', render: (_r, i) => i + 1 },
    {
      key: 'name',
      header: 'Billing Profile',
      render: (r) => (
        <div className="min-w-0">
          <div className="font-medium break-words">{str(r.name) ?? DASH}</div>
          <div className="text-fg-2 text-[length:var(--fs-caption)]">{str(r.billingProfileId) ?? DASH}</div>
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (r) => (str(r.collectionStatus) ? <StatusPill status={String(r.collectionStatus)} /> : DASH) },
    {
      key: 'out',
      header: 'Outstanding Amount',
      render: (r) => {
        const v = outstandingOf((data.bills as Rec[]).filter((b) => b.billingProfileId === r.billingProfileId));
        return <span className={`font-semibold ${v > 0 ? 'text-accent' : ''}`}>{qar(v)}</span>;
      },
    },
    {
      key: 'due',
      header: 'Due Date',
      render: (r) => {
        const pb = (data.bills as Rec[]).filter((b) => b.billingProfileId === r.billingProfileId && isBillRow(b)).sort((a, b) => String(b.billPeriod ?? '').localeCompare(String(a.billPeriod ?? '')))[0];
        return fmtDate(pb?.dueDate) ?? DASH;
      },
    },
    { key: 'cycle', header: 'Bill Cycle', render: (r) => str(r.billingCycle) ?? DASH },
    { key: 'type', header: 'Bill Type', render: (r) => str(r.billingType) ?? DASH },
    {
      key: 'act',
      header: 'Actions',
      className: 'text-center',
      render: (r) => (
        <button type="button" aria-label="Filter page to this billing profile" onClick={() => setProfileId(String(r.billingProfileId))} className="text-fg hover:text-accent">
          <Icon path={IC.chevRight} className="w-4 h-4" />
        </button>
      ),
    },
  ];

  const paymentCols: GridCol<Rec>[] = [
    { key: '#', header: '#', render: (_r, i) => i + 1 },
    { key: 'id', header: 'Payment ID', render: (r) => str(r.paymentId) ?? DASH },
    { key: 'date', header: 'Date', render: (r) => fmtDate(r.capturedAt) ?? DASH },
    { key: 'method', header: 'Method', render: (r) => str(r.paymentMethod) ?? DASH },
    { key: 'channel', header: 'Channel', render: (r) => str(r.captureChannel) ?? DASH },
    { key: 'amt', header: 'Amount (QAR)', render: (r) => str(r.amountQar) ?? DASH },
    { key: 'status', header: 'Status', render: (r) => (str(r.status) ? <StatusPill status={String(r.status)} /> : DASH) },
  ];

  const unbilledCols: GridCol<Rec>[] = [
    { key: '#', header: '#', render: (_r, i) => i + 1 },
    { key: 'period', header: 'Bill Period', render: (r) => periodRange(r.billPeriod) },
    { key: 'mrc', header: 'MRC (QAR)', render: (r) => str(r.mrc) ?? DASH },
    { key: 'vas', header: 'VAS (QAR)', render: (r) => str(r.vas) ?? DASH },
    { key: 'vat', header: 'VAT (QAR)', render: (r) => str(r.vat) ?? DASH },
    { key: 'cur', header: 'Current Charges (QAR)', render: (r) => str(r.currentChargesQAR) ?? DASH },
  ];

  const shownBills = showAllBills ? historyBills : historyBills.slice(0, PAGE);

  const profileSelect = (
    <label className="flex items-center gap-2 rounded-[var(--radius-button)] border border-[var(--field-card-border)] bg-bg px-3 py-1.5">
      <span className="text-muted text-[length:var(--fs-caption)] whitespace-nowrap">Billing Profile</span>
      <span className="relative">
        <select
          value={profileId}
          onChange={(e) => setProfileId(e.target.value)}
          aria-label="Billing Profile"
          className="appearance-none bg-transparent outline-none pr-6 text-fg text-[length:var(--fs-body)] cursor-pointer max-w-56"
        >
          <option value="all">All Billing Profiles</option>
          {profiles.map((p) => (
            <option key={String(p.billingProfileId)} value={String(p.billingProfileId)}>
              {str(p.name) ?? String(p.billingProfileId)}
            </option>
          ))}
        </select>
        <Icon path={IC.chevDown} className="w-4 h-4 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-fg-2" />
      </span>
    </label>
  );

  return (
    <TabPage
      icon={IC.wallet}
      tone="blue"
      title="Billing & Payments"
      subtitle="View billing profile, bills, payments, outstanding balance and recharge information"
      actions={
        <>
          {profileSelect}
          <button type="button" disabled aria-label="More actions" className="w-9 h-9 rounded-[var(--radius-button)] border border-[var(--field-card-border)] bg-bg flex items-center justify-center opacity-40 cursor-not-allowed">
            <Icon path={IC.dots} className="w-4 h-4" />
          </button>
        </>
      }
    >
      <KpiGrid>
        <KpiTile
          icon={IC.alert}
          tone="red"
          label="Outstanding Amount"
          value={<span className="text-accent">{qar(outstanding)}</span>}
          caption={
            <button type="button" disabled className="mt-1 rounded-[var(--radius-sm)] bg-accent text-accent-on px-6 py-1 text-[length:var(--fs-btn-compact)] font-medium opacity-40 cursor-not-allowed">
              Pay Now
            </button>
          }
        />
        <KpiTile
          icon={IC.calendar}
          tone="blue"
          label="Due Date"
          value={fmtDate(latestBill?.dueDate) ?? DASH}
          caption={
            dueIn !== undefined && outstanding > 0 ? (
              <span className="text-accent">({dueIn >= 0 ? `${dueIn} day${dueIn === 1 ? '' : 's'}` : `${-dueIn} day${dueIn === -1 ? '' : 's'} overdue`})</span>
            ) : undefined
          }
        />
        <KpiTile
          icon={IC.file}
          tone="blue"
          label="Latest Bill"
          value={qar(latestBill?.totalAmount) ?? DASH}
          caption={latestBill ? `Bill Period: ${periodRange(latestBill.billPeriod)}` : undefined}
          chevron
          onClick={() => setTab('bills')}
        />
        <KpiTile
          icon={IC.card}
          tone="amber"
          label="Last Payment"
          value={qar(lastPayment?.amountQar) ?? DASH}
          caption={lastPayment ? [fmtDate(lastPayment.capturedAt), str(lastPayment.captureChannel) && `via ${String(lastPayment.captureChannel)}`].filter(Boolean).join(' ') : undefined}
          chevron
          onClick={() => setTab('payments')}
        />
        <KpiTile icon={IC.bars} tone="red" label="Unbilled Usage" value={qar(unbilled) ?? DASH} chevron onClick={() => setTab('unbilled')} />
      </KpiGrid>

      <div className="space-y-4">
        <div className="space-y-4 min-w-0">
          <Panel
            icon={IC.bars}
            title="Billing Profile(s)"
            flush
            action={
              <button type="button" disabled className="mr-4 rounded-[var(--radius-button)] bg-accent text-accent-on px-4 py-2 text-[length:var(--fs-btn-compact)] font-medium opacity-40 cursor-not-allowed">
                Add Payment
              </button>
            }
          >
            <GridTable cols={profileCols} rows={profiles} rowKey={(r) => String(r.billingProfileId)} selectedKey={selected ? String(selected.billingProfileId) : undefined} empty="No billing profile on file." />
          </Panel>

          <section className="rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg min-w-0">
            <div className="px-4 pt-2">
              <UnderlineTabs active={tab} onChange={setTab} items={[{ key: 'bills', label: 'Bill History' }, { key: 'payments', label: 'Payment History' }, { key: 'unbilled', label: 'Unbilled Usage' }, { key: 'recharge', label: 'Recharge History (Prepaid)' }]} />
            </div>
            {tab === 'bills' && (
              <>
                <GridTable cols={billCols} rows={shownBills} rowKey={(r) => String(r.billId)} empty="No bills on file." />
                {historyBills.length > PAGE && (
                  <div className="px-4 py-3">
                    <button type="button" onClick={() => setShowAllBills((v) => !v)} className="text-accent font-medium text-[length:var(--fs-body)] hover:underline">
                      {showAllBills ? 'Show fewer bills' : 'View All Bills'} &rarr;
                    </button>
                  </div>
                )}
              </>
            )}
            {tab === 'payments' && <GridTable cols={paymentCols} rows={payments} rowKey={(r) => String(r.paymentId)} empty="No payments on file." />}
            {tab === 'unbilled' && <GridTable cols={unbilledCols} rows={unbilledRows} rowKey={(r) => String(r.billId)} empty="No unbilled usage on file." />}
            {tab === 'recharge' && <p className="text-muted text-[length:var(--fs-body)] py-4 text-center">No prepaid recharge history on file.</p>}
          </section>
        </div>

        <div className="grid grid-cols-1 @4xl:grid-cols-2 gap-4 items-stretch">
            <Panel
              icon={IC.shield}
              title="Dunning & Barring"
              action={goToTab ? <button type="button" onClick={() => goToTab('alerts-risks')} className="text-accent font-medium text-[length:var(--fs-body)] hover:underline whitespace-nowrap">View Details &rarr;</button> : undefined}
            >
              <dl>
                {[
                  { label: 'Current Dunning Stage', value: str(stageProfile?.collectionStage) ? <Pill tone="amber">{String(stageProfile?.collectionStage)}</Pill> : DASH },
                  { label: 'Amount Required to Avoid Barring', value: <Dv k="amountAvoidBarring" /> },
                  { label: 'OG Barring Date', value: <Dv k="ogBarringDate" /> },
                  { label: 'IC Barring Date', value: <Dv k="icBarringDate" /> },
                  { label: 'Eligible for PTP', value: ptpEligible ? <Pill tone={ptpEligible === 'Yes' ? 'green' : 'grey'}>{ptpEligible}</Pill> : DASH },
                ].map((r) => (
                  <div key={r.label} className="flex items-center justify-between gap-4 py-2 border-b border-border-soft last:border-0 text-[length:var(--fs-body)]">
                    <dt className="text-fg-2">{r.label}</dt>
                    <dd className="text-fg font-medium text-right min-w-0 break-words">{r.value}</dd>
                  </div>
                ))}
              </dl>
            </Panel>

            <Panel icon={IC.settings} title="Bill Settings" action={<InertLink>Manage</InertLink>}>
              <dl>
                {[
                  { label: 'Bill Email', value: str(stageProfile?.billingContactEmail) ?? DASH },
                  { label: 'Bill Type', value: str(stageProfile?.billingType) ?? DASH },
                  { label: 'Bill Cycle', value: str(stageProfile?.billingCycle) ?? DASH },
                  { label: 'eBill / Paperless', value: ebill ? <Pill tone={/email|ebill|e-bill|paperless/i.test(ebill) ? 'green' : 'grey'}>{/email|ebill|e-bill|paperless/i.test(ebill) ? 'Enabled' : 'Disabled'}</Pill> : DASH },
                ].map((r) => (
                  <div key={r.label} className="flex items-center justify-between gap-4 py-2 border-b border-border-soft last:border-0 text-[length:var(--fs-body)]">
                    <dt className="text-fg-2">{r.label}</dt>
                    <dd className="text-fg font-medium text-right min-w-0 break-words">{r.value}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
        </div>

          <Panel icon={IC.card} title="Payment Methods" action={<InertLink>Manage</InertLink>}>
            {str(stageProfile?.paymentMethod) ? (
              <div className="flex items-center gap-3 py-1">
                <span className="w-10 h-10 rounded-[var(--radius-button)] bg-surface flex items-center justify-center shrink-0">
                  <Icon path={IC.card} className="w-5 h-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-fg font-medium text-[length:var(--fs-body)] break-words">{String(stageProfile?.paymentMethod)}</div>
                  <div className="text-fg-2 text-[length:var(--fs-caption)]">Auto-pay: {str(stageProfile?.autoPayStatus) ?? DASH}</div>
                </div>
              </div>
            ) : (
              <p className="text-muted text-[length:var(--fs-body)] py-2">No payment method on file.</p>
            )}
          </Panel>
      </div>
    </TabPage>
  );
}
