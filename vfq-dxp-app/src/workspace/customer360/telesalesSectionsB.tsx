import { useState } from 'react';
import { computeBillingSummary } from '../../engines/customer360Engine';
import { Icon } from '../../components/primitives/Icon';
import { accountInformationResolvers } from './sections/accountInformationResolvers';
import { contactInformationResolvers } from './sections/contactInformationResolvers';
import { buildAssetsFieldResolver } from './sections/assetsResolvers';
import { Card, KV, Label, Pill, Ring, Value, asText, dateTime, num, type Ctx } from './telesalesOverview';
import { ActionList, BarChart, Field, HeaderButton, ICON, PillTabs, SectionHeader, StatStrip, TableCard, pillFor, yesNo, WideBlock } from './telesalesKit';
import { rowDate } from './telesalesSectionsA';
import { strOrEmpty as str } from '../../lib/values';

// Billing & Payments, Offers & Opportunities and Usage & Behaviour sections of the Telesales Overview page.

type Rec = Record<string, unknown>;
const demoOf = (ctx: Ctx) => (ctx.data.overviewDemo[0] ?? {}) as Rec;
const catalogOf = (ctx: Ctx) => (ctx.data.demoCatalog[0] ?? {}) as Rec;
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const qar = (n: number) => `QAR ${Number.isInteger(n) ? n : n.toFixed(2)}`;
const monthLabel = (period: string) => {
  const [y, m] = period.split('-').map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
};

// ============================================================================ Billing & Payments
export function BillingSection({ ctx }: { ctx: Ctx }) {
  const { data, services } = ctx;
  const demo = demoOf(ctx);
  const r = (d: string) => accountInformationResolvers[d]?.({ data, services });
  const { outstanding, latestBill, paidTotal } = computeBillingSummary(data);
  const unbilled = Number(latestBill?.currentChargesQAR ?? 0);
  const required = outstanding + unbilled;
  const bills = [...data.bills].sort((a, b) => str(a.billPeriod).localeCompare(str(b.billPeriod)));
  const payments = [...data.payments].sort((a, b) => str(b.capturedAt).localeCompare(str(a.capturedAt))).slice(0, 5);
  const lastPay = payments[0];
  const profile = data.billingProfiles[0] ?? {};
  const emails = arr<string>(demo.billingEmails);
  const dunning = str(r('Current Dunning Stage')) || '-';
  const bar = str(data.overviewExtras[0]?.aboutToBar) || 'No';
  const ptpOpen = str(profile.promiseToPayStatus ?? 'None') !== 'None';
  const ptp = outstanding > 0 && !ptpOpen ? 'Yes' : 'No';
  const ex = data.overviewExtras[0];
  const bal = data.inPlatformBalances[0];
  const use = data.serviceUsage[0];
  const dataTotal = use ? Number(use.currentDataUsageGB) + Number(use.availableDataBalanceGB) : 0;
  const dataLeft = bal?.dataBalanceGB != null ? Number(bal.dataBalanceGB) : Number(use?.availableDataBalanceGB ?? 0);
  const voiceTotal = Number(ex?.voiceAllowanceMin ?? 500);
  const voiceLeft = bal?.voiceBalanceMinutes != null ? Number(bal.voiceBalanceMinutes) : Math.max(0, voiceTotal - Number(use?.currentVoiceUsageMinutes ?? 0));
  const smsTotal = Number(ex?.smsAllowance ?? 500);
  const smsLeft = bal?.smsBalanceCount != null ? Number(bal.smsBalanceCount) : Number(ex?.smsRemaining ?? 0);
  const tile = (label: string, value: string, red?: boolean) => (
    <div key={label} className="rounded-[var(--radius-card)] bg-surface p-3">
      <div className="text-fg font-semibold text-[length:var(--fs-body)] leading-tight">{label}</div>
      <div className={`font-bold text-[length:var(--fs-h4)] mt-1 ${red ? 'text-accent' : 'text-fg'}`}>{value}</div>
    </div>
  );
  return (
    <>
      <SectionHeader icon={ICON.card} title="Billing & Payments" description="View billing summary, current bill, payment history and dunning information for this customer." />
      <div className="contents">
        <Card title="Billing Summary" icon={ICON.card} link="View Full Details" onLink={() => ctx.goToTab('ts-billing')}>
          <div className="p-5 grid grid-cols-2 gap-3">
            {tile('Outstanding Balance', qar(outstanding), true)}
            {tile('Unbilled Usage', qar(unbilled))}
            {tile('Due Date', latestBill?.dueDate ? dateTime(latestBill.dueDate).d : '-')}
            {tile('Amount Required to Pay', qar(required))}
          </div>
          <KV label="Postpaid - MRC">{str(r('Postpaid - Monthly Recurring Charge')) || (latestBill?.mrc !== undefined ? `QAR ${str(latestBill.mrc)}` : '-')}</KV>
          <KV label="Postpaid - Average Bill">{bills.length ? qar(bills.reduce((a, b) => a + Number(b.totalAmount ?? 0), 0) / bills.length) : '-'}</KV>
          <KV label="Prepaid - Avg. Recharge">{arr<Rec>(demo.recharges).length ? qar(arr<Rec>(demo.recharges).reduce((a, b) => a + Number(b.amountQar ?? 0), 0) / arr<Rec>(demo.recharges).length) : '-'}</KV>
          <KV label="Prepaid - Top Recharge Type">{str(arr<Rec>(demo.recharges)[0]?.type) || '-'}</KV>
          <KV label="Last Payment">
            {lastPay ? (
              <span>
                <b>{qar(Number(lastPay.amountQar))}</b> <span className="text-muted text-[length:var(--fs-caption)]">{dateTime(lastPay.capturedAt).d} · {str(lastPay.captureChannel)}</span>
              </span>
            ) : (
              '-'
            )}
          </KV>
        </Card>

        <Card title="Current Bill" icon={ICON.card} link="View Bill" onLink={() => ctx.goToTab('ts-billing')}>
          <KV label="Bill Period">{latestBill ? monthLabel(str(latestBill.billPeriod)) : '-'}</KV>
          <KV label="Bill Number">{str(latestBill?.billId) || '-'}</KV>
          <KV label="Issue Date">{latestBill?.issueDate ? dateTime(latestBill.issueDate).d : '-'}</KV>
          <KV label="Due Date">{latestBill?.dueDate ? dateTime(latestBill.dueDate).d : '-'}</KV>
          <KV label="Total Amount">{latestBill ? qar(Number(latestBill.totalAmount ?? 0)) : '-'}</KV>
          <KV label="Amount Paid">{qar(paidTotal)}</KV>
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-accent font-semibold text-[length:var(--fs-body)]">Outstanding Amount</span>
            <span className="text-accent font-bold text-[length:var(--fs-h4)]">{qar(outstanding)}</span>
          </div>
          <div className="px-5 pb-5 space-y-3">
            <HeaderButton primary>Make a Payment</HeaderButton>
            <div>
              <button type="button" className="text-accent font-semibold text-[length:var(--fs-body)] inline-flex items-center gap-2">
                <Icon path={ICON.download} className="w-4 h-4" />
                Download PDF
              </button>
            </div>
          </div>
        </Card>

        <Card title="Quick Actions" icon={ICON.bars}>
          <ActionList
            items={[
              { title: 'Make a Payment', sub: 'Process a customer payment' },
              { title: 'View Bill', sub: 'Download and view bills' },
              { title: 'Set up Payment Arrangement', sub: 'Check PTP eligibility' },
              { title: 'Update Billing Email', sub: 'Add or modify billing recipients' },
              { title: 'View Billing Profile', sub: 'See all billing profiles' },
              { title: 'Request Adjustment', sub: 'Submit an adjustment request' },
            ]}
          />
        </Card>
      </div>

      <div className="contents">
        <Card title="Billing History" icon={ICON.refresh} link="View All Bills" onLink={() => ctx.goToTab('ts-billing')}>
          {bills.length > 0 && <BarChart data={bills.slice(-6).map((b) => ({ label: monthLabel(str(b.billPeriod)).replace(' ', ' '), value: Number(b.totalAmount ?? 0) }))} />}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[length:var(--fs-body)]">
              <thead>
                <tr className="bg-surface">
                  {['Bill Period', 'Bill Number', 'Bill Amount', 'Status', 'Action'].map((h) => (
                    <th key={h} className="px-5 py-3 text-muted font-semibold uppercase tracking-wide text-[length:var(--fs-caption-upper)]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--field-card-border)]">
                {[...bills].reverse().slice(0, 5).map((b) => (
                  <tr key={str(b.billId)}>
                    <td className="px-5 py-3">{monthLabel(str(b.billPeriod))}</td>
                    <td className="px-5 py-3">{str(b.billId)}</td>
                    <td className="px-5 py-3 font-bold">{qar(Number(b.totalAmount ?? 0))}</td>
                    <td className="px-5 py-3">
                      <Pill tone={str(b.status) === 'billed' ? 'red' : pillFor(str(b.status))}>{str(b.status) === 'billed' ? 'Unpaid' : str(b.status).replace(/^./, (c) => c.toUpperCase())}</Pill>
                    </td>
                    <td className="px-5 py-3 text-accent font-semibold">View</td>
                  </tr>
                ))}
                {bills.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-4 text-muted">
                      No bills on file.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Payment History" icon={ICON.card} link="View All Payments" onLink={() => ctx.goToTab('ts-billing')}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[length:var(--fs-body)]">
              <thead>
                <tr className="bg-surface">
                  {['Date & Time', 'Amount', 'Channel', 'Status', 'Ref. No.'].map((h) => (
                    <th key={h} className="px-5 py-3 text-muted font-semibold uppercase tracking-wide text-[length:var(--fs-caption-upper)]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--field-card-border)]">
                {payments.map((p) => (
                  <tr key={str(p.paymentId)}>
                    <td className="px-5 py-3">{rowDate(p.capturedAt)}</td>
                    <td className="px-5 py-3 font-bold">{qar(Number(p.amountQar ?? 0))}</td>
                    <td className="px-5 py-3">{str(p.paymentMethod ?? p.captureChannel)}</td>
                    <td className="px-5 py-3">
                      <Pill tone={pillFor(str(p.status ?? 'Successful'))}>{str(p.status ?? 'Successful')}</Pill>
                    </td>
                    <td className="px-5 py-3">{str(p.receiptNumber ?? p.paymentId)}</td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-4 text-muted">
                      No payments on file.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--field-card-border)]">
            <span className="inline-flex items-center gap-2 text-fg font-semibold">
              <Icon path={ICON.bars} className="w-4 h-4" />
              Unbilled Usage
            </span>
            <button type="button" onClick={() => ctx.goToTab('ts-products')} className="text-accent font-semibold text-[length:var(--fs-body)]">
              View Usage Details →
            </button>
          </div>
          <div className="px-5 pb-5 grid grid-cols-4 gap-2 items-end">
            <Ring value={String(dataLeft)} unit="GB" sub={`of ${Math.round(dataTotal)} GB`} fraction={dataTotal ? dataLeft / dataTotal : undefined} label="Data" />
            <Ring value={String(voiceLeft)} sub={`of ${voiceTotal} Mins`} fraction={voiceTotal ? voiceLeft / voiceTotal : undefined} label="Voice" />
            <Ring value={String(smsLeft)} sub={`of ${smsTotal} SMS`} fraction={smsTotal ? smsLeft / smsTotal : undefined} label="SMS" />
            <Ring value={qar(Number(bal?.mainBalanceQAR ?? 0))} fraction={1} label="Primary Balance" wide />
          </div>
        </Card>
      </div>

      <div className="contents">
        <Card title="Dunning & Credit Information" icon={ICON.shield}>
          <div className="p-5 grid grid-cols-3 gap-4">
            <div>
              <Label>Current Dunning Stage</Label>
              <Pill tone={/^(none|no dunning|current)$/i.test(dunning) ? 'green' : 'amber'}>{dunning}</Pill>
            </div>
            <div>
              <Label>About to OG/IC Bar</Label>
              {yesNo(bar)}
            </div>
            <div>
              <Label>OG/IC Barring Dates</Label>
              <Value>{str(r('OG/IC Barring Dates')) || '-'}</Value>
            </div>
            <div>
              <Label>Credit Limit</Label>
              <Value big>{str(r('Credit Limit')) || '-'}</Value>
            </div>
            <div>
              <Label>Amount Required to Pay</Label>
              <Value big>{qar(required)}</Value>
            </div>
            <div>
              <Label>Overdue Amount</Label>
              <div className="text-accent font-bold text-[length:var(--fs-h4)]">{qar(outstanding)}</div>
            </div>
          </div>
        </Card>
        <Card title="Payment Arrangement (PTP)" icon={ICON.card}>
          <KV label="PTP Eligible">{yesNo(ptp)}</KV>
          <KV label="Pending TON Requests">
            <Pill tone="amber">{num(r('Pending TON requests')) ?? 0}</Pill>
          </KV>
          <KV label="Pending Adjustments">
            <Pill tone="amber">{num(r('Pending Adjustments')) ?? 0}</Pill>
          </KV>
          <KV label="Pending SIM Swap">
            <Pill tone="amber">{num(r('Pending Sim swap')) ?? 0}</Pill>
          </KV>
        </Card>
        <Card title="Billing Information" icon={ICON.card}>
          <KV label="Billing Email ID(s)">
            <span className="break-all">{emails.length ? emails.slice(0, 2).join(' ') : str(profile.billingContactEmail) || '-'}</span>
          </KV>
          <KV label="Billing Profile">{str(profile.name) || '-'}</KV>
          <KV label="Bill Delivery Method">{str(profile.billMedium) ? `${str(profile.billMedium)} (eBill)` : '-'}</KV>
          <KV label="Multiple Billing Recipients">{yesNo(emails.length > 1)}</KV>
          <KV label="Preferred Language">{str(contactInformationResolvers['Preferred Language']?.({ data, services })) || '-'}</KV>
        </Card>
        <Card title="Related Links" icon={ICON.search}>
          <ActionList
            items={[
              { title: 'All Billing Profiles', sub: 'View and manage billing profiles', onClick: () => ctx.goToTab('ts-billing') },
              { title: 'Payment Terms & Policies', sub: 'View customer payment terms' },
              { title: 'Request Adjustment', sub: 'Submit a billing adjustment' },
              { title: 'View Orders', sub: 'See recent and past orders', onClick: () => ctx.goToTab('ts-history') },
            ]}
          />
        </Card>
      </div>
    </>
  );
}

// ============================================================================ Offers & Opportunities
export function OffersSection({ ctx }: { ctx: Ctx }) {
  const { data, services } = ctx;
  const cat = catalogOf(ctx);
  const demo = demoOf(ctx);
  const nbo = arr<{ badge: string; name: string; tagline: string; benefits: string[]; personalised: boolean }>(cat.nextBestOffers);
  const other = arr<{ name: string; sub: string; icon: string }>(cat.otherEligible);
  const discounts = arr<{ name: string; sub: string }>(cat.eligibleDiscounts);
  const opps = arr<{ name: string; sub: string; status: string }>(cat.additionalOpportunities);
  const cross = arr<Rec>(cat.crossSell);
  const sales = arr<Rec>(cat.salesEnhancement);
  const history = arr<Rec>(demo.offerHistory);
  const real = data.crossSalesOffers;
  // A real next-best offer for this customer leads the recommendations when there is one.
  const lead = real[0] ? str(real[0].offerName) : undefined;
  const cards = nbo.map((o, i) => (i === 0 && lead ? { ...o, name: lead } : o));
  const iconFor = (k: string) => (k === 'globe' ? ICON.globe : k === 'phone' ? ICON.phone : k === 'card' ? ICON.card : k === 'grid' ? ICON.grid : ICON.user);
  const doi = str(data.deviceInstallments[0]?.eligibilityListMembership);
  const c = (d: string) => asText(contactInformationResolvers[d]?.({ data, services }));
  const row = (name: string, sub: string, icon: string, pill?: ReactNodeLike) => (
    <div key={name} className="flex items-center gap-3 px-5 py-4 border-b border-[var(--field-card-border)] last:border-0">
      <span className="text-accent shrink-0">
        <Icon path={icon} className="w-5 h-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-fg font-semibold text-[length:var(--fs-body-lg)]">{name}</div>
        <div className="text-fg-2 text-[length:var(--fs-caption)]">{sub}</div>
      </div>
      {pill}
      <Icon path={ICON.chevron} className="w-4 h-4 text-muted shrink-0" />
    </div>
  );
  return (
    <>
      <SectionHeader
        icon={ICON.star}
        title="Offers & Opportunities"
        description="Personalised offers, eligible discounts and cross-sell opportunities based on customer profile and eligibility."
        actions={
          <>
            <HeaderButton>⟳ Check Latest Offers</HeaderButton>
            <HeaderButton primary>Start Sales Journey ›</HeaderButton>
          </>
        }
      />
      <StatStrip
        items={[
          { value: other.length ? Math.min(5, other.length) : 0, label: 'Eligible Offers', icon: ICON.grid },
          { value: cards.length, label: 'Next Best Offers', icon: ICON.star },
          { value: discounts.length, label: 'Eligible Discounts', icon: ICON.check },
          { value: doi ? 1 : 0, label: 'DOI Eligible', icon: ICON.phone },
          { value: cross.filter((x) => str(x.service) === 'Fixed Line').length, label: 'Fixed Line Offer', icon: ICON.globe },
          { value: str(c('Cross sale offers flag')) || 'No', label: 'Cross-Sell Flag', tone: 'ok' },
          { value: c('Sales enhansment offers') ? 'Yes' : 'No', label: 'Sales Enhancement', tone: 'ok' },
        ]}
      />
      <div className="contents">
        <Card title="Next Best Offers" icon={ICON.star} link="View All Offers" className="md:[grid-column:span_2]">
          <p className="px-5 py-3 text-fg-2 text-[length:var(--fs-body)]">AI recommended offers based on customer profile and usage behaviour.</p>
          <div className="px-5 pb-5 grid grid-cols-2 gap-4">
            {cards.map((o, i) => (
              <div key={o.name} className={`rounded-[var(--radius-card)] border p-4 ${i === 0 ? 'border-accent border-2' : 'border-[var(--field-card-border)]'}`}>
                <span className={`inline-block rounded-[var(--radius-button)] px-2 py-0.5 text-[length:var(--fs-caption)] font-bold text-white ${i === 0 ? 'bg-accent' : 'bg-[var(--telesales-blue)]'}`}>{o.badge}</span>
                <div className="text-fg font-bold text-[length:var(--fs-h4)] mt-8">{o.name}</div>
                <div className="text-fg-2 text-[length:var(--fs-body)] mb-2">{o.tagline}</div>
                <ul className="text-fg-2 text-[length:var(--fs-body)] space-y-1 mb-3">
                  {o.benefits.map((b) => (
                    <li key={b}>✓ {b}</li>
                  ))}
                </ul>
                {o.personalised && <div className="text-accent font-semibold text-[length:var(--fs-caption)] mb-3">Personalised for this customer</div>}
                <div className="flex gap-2">
                  <HeaderButton>View Details</HeaderButton>
                  <HeaderButton primary>Add to Cart</HeaderButton>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Other Eligible Offers" icon={ICON.check} link="View All Offers">
          {other.map((o) => row(o.name, o.sub, iconFor(o.icon), <Pill tone="green">Eligible</Pill>))}
        </Card>
      </div>
      <div className="contents">
        <Card title="Eligible Discounts" icon={ICON.star} link="View All">
          {discounts.map((d) => row(d.name, d.sub, ICON.check, <Pill tone="green">Eligible</Pill>))}
        </Card>
        <Card title="Additional Opportunities" icon={ICON.grid}>
          {opps.map((o) => row(o.name, o.sub, ICON.star, <Pill tone={o.status === 'Targeted' ? 'amber' : 'green'}>{o.status}</Pill>))}
        </Card>
      </div>
      <WideBlock className="space-y-4">
        <TableCard
          title="Cross-Sell Opportunities"
          icon={ICON.grid}
          link="View All"
          rows={cross}
          cols={[
            { header: 'Service Type', render: (x) => str(x.service) },
            { header: 'Offer', render: (x) => <b>{str(x.offer)}</b> },
            { header: 'Benefit', render: (x) => str(x.benefit) },
            { header: 'Eligibility', render: (x) => <Pill tone="green">{str(x.eligibility)}</Pill> },
            { header: 'Action', render: () => <span className="text-accent font-semibold">View Offer</span> },
          ]}
        />
        <TableCard
          title="Sales Enhancement Offers"
          icon={ICON.star}
          link="View All"
          rows={sales}
          cols={[
            { header: 'Offer', render: (x) => <b>{str(x.offer)}</b> },
            { header: 'Type', render: (x) => str(x.type) },
            { header: 'Valid Till', render: (x) => dateTime(x.validTill).d },
            { header: 'Status', render: (x) => <Pill tone="green">{str(x.status)}</Pill> },
            { header: 'Action', render: () => <span className="text-accent font-semibold">View</span> },
          ]}
        />
        <TableCard
          title="Offer History"
          icon={ICON.refresh}
          link="View All"
          rows={history}
          cols={[
            { header: 'Date', render: (x) => dateTime(x.at).d },
            { header: 'Offer / Campaign', render: (x) => <b>{str(x.offer)}</b> },
            { header: 'Status', render: (x) => <Pill tone={pillFor(str(x.status))}>{str(x.status)}</Pill> },
            { header: 'Channel', render: (x) => str(x.channel) },
          ]}
        />
      </WideBlock>
    </>
  );
}
type ReactNodeLike = import('react').ReactNode;

// ============================================================================ Usage & Behaviour
export function UsageSection({ ctx }: { ctx: Ctx }) {
  const { data, services } = ctx;
  const demo = demoOf(ctx);
  const cat = catalogOf(ctx);
  const [pickedRef, setPickedRef] = useState(services[0]?.ref);
  const [series, setSeries] = useState('data');
  const cur = services.find((s) => s.ref === pickedRef) ?? services[0];
  const res = buildAssetsFieldResolver(cur, data);
  const bal = data.inPlatformBalances[0];
  const use = data.serviceUsage[0];
  const ex = data.overviewExtras[0];
  const dig = data.digitalEngagement[0];
  const dataTotal = use ? Number(use.currentDataUsageGB) + Number(use.availableDataBalanceGB) : 0;
  const dataLeft = bal?.dataBalanceGB != null ? Number(bal.dataBalanceGB) : Number(use?.availableDataBalanceGB ?? 0);
  const voiceTotal = Number(ex?.voiceAllowanceMin ?? 500);
  const voiceLeft = bal?.voiceBalanceMinutes != null ? Number(bal.voiceBalanceMinutes) : Math.max(0, voiceTotal - Number(use?.currentVoiceUsageMinutes ?? 0));
  const smsTotal = Number(ex?.smsAllowance ?? 500);
  const smsLeft = bal?.smsBalanceCount != null ? Number(bal.smsBalanceCount) : Number(ex?.smsRemaining ?? 0);
  const trend = arr<{ month: string; dataRegular: number; dataOut: number; voiceRegular: number; voiceOut: number; smsRegular: number; smsOut: number }>(demo.usageTrend);
  const recharges = arr<Rec>(demo.recharges);
  const cdr = [...data.callDetailRecords].sort((a, b) => str(b.callDate).localeCompare(str(a.callDate))).slice(0, 10);
  const insights = arr<{ name: string; sub: string }>(cat.usageInsights);
  const addons = data.addonsDiscounts.filter((a) => a.category !== 'Discount');
  const discounts = data.addonsDiscounts.filter((a) => a.category === 'Discount');
  const creditLimit = data.creditLimits[0];
  const billLimit = res('Bill Limit') ?? (creditLimit ? `QAR ${str(creditLimit.creditLimitQar ?? creditLimit.creditLimitQAR)}` : '-');
  const used = (left: number, total: number) => (total ? `${Math.round(((total - left) / total) * 100)}% Used` : '');
  const chart = trend.map((t) => ({
    label: t.month,
    value: series === 'data' ? t.dataRegular : series === 'voice' ? t.voiceRegular : series === 'sms' ? t.smsRegular : t.dataRegular + t.voiceRegular / 20 + t.smsRegular / 20,
    extra: series === 'data' ? t.dataOut : series === 'voice' ? t.voiceOut : series === 'sms' ? t.smsOut : 0,
  }));
  const unit = series === 'data' ? 'GB' : series === 'voice' ? 'Min' : series === 'sms' ? 'SMS' : '';
  return (
    <>
      <SectionHeader
        icon={ICON.bars}
        title="Usage & Behaviour"
        description="View usage patterns, recharge history, digital engagement and behaviour insights across all connections."
        actions={
          <label className="inline-flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg px-4 py-2 text-[length:var(--fs-body)]">
            Select Connection
            <select value={pickedRef} onChange={(e) => setPickedRef(e.target.value)} aria-label="Select connection" className="bg-transparent font-medium">
              {services.map((s) => (
                <option key={s.ref} value={s.ref}>
                  {s.identifier} ({s.label})
                </option>
              ))}
            </select>
            <Pill tone="green">{cur?.status ?? 'Active'}</Pill>
          </label>
        }
      />
      <StatStrip
        items={[
          { value: <span>{dataLeft} GB <span className="text-muted font-normal text-[length:var(--fs-caption)]">of {Math.round(dataTotal)} GB</span></span>, label: 'Data Usage', icon: ICON.grid },
          { value: <span>{voiceLeft} <span className="text-muted font-normal text-[length:var(--fs-caption)]">of {voiceTotal} Mins</span></span>, label: 'Voice Usage', icon: ICON.phone },
          { value: <span>{smsLeft} <span className="text-muted font-normal text-[length:var(--fs-caption)]">of {smsTotal} SMS</span></span>, label: 'SMS Usage', icon: ICON.phone },
          { value: qar(Number(bal?.mainBalanceQAR ?? 0)), label: 'Primary Balance' },
          { value: dig?.appLastLoginAt ? dateTime(dig.appLastLoginAt).d : '-', label: dig?.appActiveUser ? 'Active User · Last App Login' : 'Last App Login' },
          { value: dig ? `${str(dig.appDigitalAdoptionPct)}%` : '-', label: 'Digital Adoption' },
          { value: str(ex?.phoneVersion) || '-', label: `Phone Version · App ${str(dig?.appVersion) || '-'}` },
        ]}
      />
      <div className="contents">
        <Card title="Usage Trend" icon={ICON.bars}>
          <div className="px-5 pt-3">
            <PillTabs
              active={series}
              onChange={setSeries}
              items={[
                { key: 'data', label: 'Data' },
                { key: 'voice', label: 'Voice' },
                { key: 'sms', label: 'SMS' },
                { key: 'total', label: 'Total' },
              ]}
            />
          </div>
          <BarChart data={chart} unit={unit} height={170} />
          <div className="px-5 pb-4 flex gap-5 text-fg-2 text-[length:var(--fs-caption)]">
            <span>
              <span className="inline-block w-2 h-2 rounded-full bg-accent mr-1" />
              Regular Usage
            </span>
            <span>
              <span className="inline-block w-2 h-2 rounded-full bg-[var(--telesales-chart-slate)] mr-1" />
              Out of Bundle
            </span>
          </div>
        </Card>
        <TableCard
          title="Recent Usage (Last 10)"
          icon={ICON.refresh}
          link="View All"
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
          title="Recharge History"
          icon={ICON.card}
          link="View All"
          rows={recharges}
          cols={[
            { header: 'Date', render: (r) => dateTime(r.at).d },
            { header: 'Amount', render: (r) => <b>{qar(Number(r.amountQar))}</b> },
            { header: 'Type', render: (r) => str(r.type) },
            { header: 'Channel', render: (r) => str(r.channel) },
          ]}
        />
      </div>
      <div className="contents">
        <Card title="Usage Behaviour Insights" icon={ICON.bars} link="View Details">
          <div className="p-5 grid grid-cols-2 gap-3">
            {insights.map((i) => (
              <div key={i.name} className="rounded-[var(--radius-card)] border border-[var(--field-card-border)] p-4">
                <Icon path={ICON.bars} className="w-4 h-4 text-muted" />
                <div className="text-fg font-bold text-[length:var(--fs-body)] mt-3">{i.name.replace('Calls', 'Calls').replace(/^High (Data|Roaming) (User)?$/, (m) => m)}</div>
                <div className="text-fg-2 text-[length:var(--fs-caption)]">{i.sub}</div>
              </div>
            ))}
          </div>
          <Field label="Last Login">{dig?.appLastLoginAt ? rowDate(dig.appLastLoginAt) : '-'}</Field>
          <Field label="Active User">{dig ? yesNo(dig.appActiveUser as boolean) : '-'}</Field>
          <Field label="Digital Adoption">{dig ? `${str(dig.appDigitalAdoptionPct)}%` : '-'}</Field>
          <Field label="App Version">{str(dig?.appVersion) || '-'}</Field>
        </Card>
        <Card title="App & Digital Behaviour" icon={ICON.user} link="View Details">
          <Field label="Registered Email">{str(data.customer.email) || '-'}</Field>
          <Field label="Phone Version">{str(ex?.phoneVersion) || '-'}</Field>
          <Field label="App User Since">{dig?.appUserSince ? dateTime(dig.appUserSince).d : '-'}</Field>
          <Field label="Preferred Channel">{dig ? 'App' : '-'}</Field>
        </Card>
      </div>
      <div className="contents">
        <Card title="Current Balances" icon={ICON.card} link="View Details">
          <div className="p-5 grid grid-cols-4 gap-2 items-end">
            <div className="text-center">
              <Ring value={String(dataLeft)} unit="GB" sub={`of ${Math.round(dataTotal)} GB`} fraction={dataTotal ? dataLeft / dataTotal : undefined} label="Data" />
              <div className="text-muted text-[length:var(--fs-caption)]">{used(dataLeft, dataTotal)}</div>
            </div>
            <div className="text-center">
              <Ring value={String(voiceLeft)} sub={`of ${voiceTotal} Mins`} fraction={voiceTotal ? voiceLeft / voiceTotal : undefined} label="Voice" />
              <div className="text-muted text-[length:var(--fs-caption)]">{used(voiceLeft, voiceTotal)}</div>
            </div>
            <div className="text-center">
              <Ring value={String(smsLeft)} sub={`of ${smsTotal} SMS`} fraction={smsTotal ? smsLeft / smsTotal : undefined} label="SMS" />
              <div className="text-muted text-[length:var(--fs-caption)]">{used(smsLeft, smsTotal)}</div>
            </div>
            <Ring value={qar(Number(bal?.mainBalanceQAR ?? 0))} fraction={1} label="Primary Balance" wide />
          </div>
        </Card>
        <Card title="Plan & Add-on Usage" icon={ICON.card} link="View Plan Details">
          <Field label="Plan Name">{str(res('Plan Name')) || cur?.label || '-'}</Field>
          <Field label="Active Add-ons">
            {addons.length} <span className="text-accent font-semibold">View All</span>
          </Field>
          <Field label="Active Discounts">{discounts.length ? str(discounts[0].name) : '-'}</Field>
          <Field label="Pending Discounts">{discounts.length}</Field>
          <Field label="Discount Expiry Date">{str(res('Existing Discounts Expiry Date')) || '-'}</Field>
          <Field label="Bill Limit">{billLimit}</Field>
        </Card>
        <Card title="Behaviour Flags" icon={ICON.shield}>
          <Field label="Repeat Call Flag">{yesNo(false)}</Field>
          <Field label="Barring Flags">{yesNo(false)}</Field>
          <Field label="Autobase Eligibility">{yesNo(true)}</Field>
          <Field label="Star Number Value">{yesNo(Boolean(res('Star number value')))}</Field>
          <Field label="Usage Pattern">{insights.slice(0, 2).map((i) => i.name.replace(/ (User|Calls)$/, '')).join(', ') || '-'}</Field>
          <Field label="Lifetime Value">{use ? 'High' : '-'}</Field>
        </Card>
      </div>
    </>
  );
}
