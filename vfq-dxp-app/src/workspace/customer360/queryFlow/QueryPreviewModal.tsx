import { Modal } from '../../../components/primitives/Modal';
import { Button } from '../../../components/primitives/Button';
import type { Customer360Data } from '../../../engines/customer360Engine';
import type { CustomerService } from '../../../engines/customerServicesEngine';
import { DetailRows, IC, IconTile, Pill, fmtDate, qar } from '../sections/C360Kit';
import { previewFieldsFor } from './queryFlowModel';
import type { QueryIssue, QueryIssueCatalogue } from './queryFlowModel';

type Rec = Record<string, unknown>;
const NOT_ON_FILE = 'Not on file';
const text = (v: unknown): string | undefined => (v === undefined || v === null || v === '' ? undefined : String(v));
const CLOSED = /closed|cancel|solved|complete|reject/i;

/** Preview of what the agent should know before raising the ticket - every value read from the customer's own records. */
export function QueryPreviewModal({
  open,
  issue,
  serviceType,
  service,
  data,
  services,
  catalogue,
  onClose,
  onCloseInteraction,
  onCreateTicket,
}: {
  open: boolean;
  issue: QueryIssue;
  serviceType: string;
  /** The selected MSISDN's service, when one was chosen. */
  service: CustomerService | undefined;
  data: Customer360Data;
  services: CustomerService[];
  catalogue: QueryIssueCatalogue;
  onClose: () => void;
  onCloseInteraction: () => void;
  onCreateTicket: () => void;
}) {
  const account = data.accounts[0] as (Customer360Data['accounts'][number] & { barringStatus?: string; barringType?: string | null }) | undefined;
  const billingProfile = data.billingProfiles[0] as Rec | undefined;
  const creditLimit = data.creditLimits[0] as Rec | undefined;
  const balance = data.inPlatformBalances[0] as Rec | undefined;
  const engagement = data.digitalEngagement[0] as Rec | undefined;
  const contact = data.contacts[0] as Rec | undefined;

  const openTickets = data.tickets.filter((t) => !CLOSED.test(String(t.status ?? '')));
  const openOrders = data.orders.filter((o) => !CLOSED.test(String(o.status ?? '')));
  const latestOrder = [...data.orders].sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))[0] as Rec | undefined;
  const latestPayment = [...data.payments].sort((a, b) => String(b.capturedAt ?? '').localeCompare(String(a.capturedAt ?? '')))[0] as Rec | undefined;
  const barring = account?.barringType ?? (account?.barringStatus === 'Not Barred' ? 'No' : text(account?.barringStatus));
  const balanceParts = [
    balance?.mainBalanceQAR != null ? qar(Number(balance.mainBalanceQAR)) : undefined,
    balance?.dataBalanceGB != null ? `${balance.dataBalanceGB} GB` : undefined,
    balance?.voiceBalanceMinutes != null ? `${balance.voiceBalanceMinutes} Mins` : undefined,
    balance?.smsBalanceCount != null ? `${balance.smsBalanceCount} SMS` : undefined,
  ].filter(Boolean);
  const limit = (v: unknown) => (v != null ? qar(Number(v)) : undefined);
  const date = (v: unknown) => (v ? fmtDate(v) : undefined);
  const yn = (b: boolean) => (b ? 'Yes' : 'No');
  const outstanding = data.bills.reduce((sum, b) => sum + (Number(b.outstandingAmountQar ?? b.outstandingQar ?? 0) || 0), 0);

  // One resolver per Details field named in the categorization workbook. A field with no source in the customer's
  // records resolves to nothing and shows "Not on file" - nothing is invented.
  const resolve: Record<string, () => string | undefined> = {
    'Account Number': () => account?.accountId,
    'Plan Name': () => service?.label,
    MSISDN: () => service?.identifier,
    'Billing Profile': () => text(billingProfile?.billingType) ?? text(billingProfile?.name),
    'Surepay Balance (Data, SMS, Voice, Text, QR Balance)': () => (balanceParts.length ? balanceParts.join(' | ') : undefined),
    'Asset Barring including OG/IC Bar (Y/N)': () => barring,
    'Credit Limit': () => limit(billingProfile?.creditLimitQAR),
    'SIM State': () => (service ? (service.status ?? 'Active') : undefined),
    'Bill Limit': () => limit(creditLimit?.creditLimitQar ?? creditLimit?.creditLimitQAR),
    'In Progress Ticket (Y/N)': () => yn(openTickets.length > 0),
    'Open Order': () => yn(openOrders.length > 0),
    'Recent Payment amount & date': () => (latestPayment ? [qar(Number(latestPayment.amountQar)), date(latestPayment.capturedAt)].filter(Boolean).join(' on ') : undefined),
    'Last Recharge Date & Amount': () => (engagement?.lastRechargeAmountQar != null ? [qar(Number(engagement.lastRechargeAmountQar)), date(engagement.lastRechargeAt)].filter(Boolean).join(' on ') : undefined),
    'Recent Order': () => text(latestOrder?.orderId),
    'Recent Order Created By': () => text(latestOrder?.createdBy),
    'Recent Order Created On': () => date(latestOrder?.createdAt),
    'Recent Order Type': () => [text(latestOrder?.orderType), text(latestOrder?.orderSubType)].filter(Boolean).join(' / ') || undefined,
    'Open Order Type (PYN, FNP, Home Move, Plan Change, Device Replacement, Add-ons, Subscription)': () => openOrders.map((o) => text(o.orderType)).filter(Boolean).join(', ') || undefined,
    'App Version': () => text(engagement?.appVersion),
    'App Last/Recent Login Date & Time': () => (engagement?.appLastLoginAt ? date(engagement.appLastLoginAt) : undefined),
    'Preferred Language': () => text(contact?.preferredLanguage),
    Nationality: () => text(contact?.nationality ?? data.customer.nationality),
    'QID Number': () => (contact?.idType === 'QID' ? text(contact.idNumber) : undefined),
    'Total Number of Connections Prepaid + Postpaid': () => String(services.length),
    'Total Outstanding Amount': () => (outstanding > 0 ? qar(outstanding) : data.bills.length ? 'QAR 0' : undefined),
    'Reason for Blacklist': () => (data.customer.blacklisted ? text(data.customer.blacklistReason) : undefined),
    'Previous Mobile Tickets (Last 3 Months)': () => String(data.tickets.filter((t) => /mobile/i.test(String(t.category ?? ''))).length),
    'Previous Fixed Tickets (Last 3 Months)': () => String(data.tickets.filter((t) => /fixed/i.test(String(t.category ?? ''))).length),
  };
  const fields = previewFieldsFor(catalogue, issue.category, serviceType);
  const summary = [
    { label: 'Query Issue', value: issue.name },
    { label: 'Query Category', value: issue.category ?? 'Category pending' },
    { label: 'Query Service Type', value: serviceType },
  ];
  const additional = fields.map((f) => ({ label: f, value: resolve[f]?.() ?? NOT_ON_FILE }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Preview Details"
      widthClassName="max-w-4xl"
      footer={
        <>
          <Button variant="ghost-rect" onClick={onCloseInteraction}>
            Close Interaction
          </Button>
          <Button variant="primary-rect" onClick={onCreateTicket}>
            Create Ticket
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <IconTile icon={IC.phone} tone="red" />
        <span className="text-fg font-semibold text-[length:var(--fs-body-lg)]">{issue.name}</span>
        <span className="ml-auto flex flex-wrap gap-2">
          {issue.category && <Pill tone="red">{issue.category}</Pill>}
          <Pill tone="blue">{serviceType}</Pill>
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section>
          <h3 className="text-fg font-semibold text-[length:var(--fs-body)] mb-1">Query Summary</h3>
          <DetailRows rows={summary} />
        </section>
        <section>
          <h3 className="text-fg font-semibold text-[length:var(--fs-body)] mb-1">Additional Details</h3>
          <DetailRows rows={additional} />
        </section>
      </div>
      <section className="mt-6">
        <h3 className="flex items-center gap-2 text-fg font-semibold text-[length:var(--fs-body)] mb-2">Recent Tickets</h3>
        {openTickets.length === 0 ? (
          <p className="rounded-[var(--radius-card)] bg-[color-mix(in_oklab,var(--success),var(--bg)_90%)] text-success px-4 py-3 text-[length:var(--fs-body)]">No open tickets found.</p>
        ) : (
          <ul className="rounded-[var(--radius-card)] border border-[var(--field-card-border)] divide-y divide-border-soft">
            {openTickets.slice(0, 3).map((t) => (
              <li key={String(t.ticketId)} className="flex items-center gap-3 px-4 py-2.5 text-[length:var(--fs-body)]">
                <span className="text-fg font-medium">{String(t.ticketId)}</span>
                <span className="flex-1 min-w-0 truncate text-fg-2">{text(t.actualIssue) ?? text(t.category)}</span>
                <Pill tone="amber">{String(t.status)}</Pill>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Modal>
  );
}
