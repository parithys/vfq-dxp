import { Modal } from '../../../components/primitives/Modal';
import { Button } from '../../../components/primitives/Button';
import type { Customer360Data } from '../../../engines/customer360Engine';
import type { CustomerService } from '../../../engines/customerServicesEngine';
import { DetailRows, IC, IconTile, Pill, qar } from '../sections/C360Kit';
import type { QueryIssue } from './queryFlowModel';

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
  onClose: () => void;
  onCloseInteraction: () => void;
  onCreateTicket: () => void;
}) {
  const account = data.accounts[0] as (Customer360Data['accounts'][number] & { barringStatus?: string; barringType?: string | null }) | undefined;
  const billingProfile = data.billingProfiles[0] as Rec | undefined;
  const creditLimit = data.creditLimits[0] as Rec | undefined;
  const balance = data.inPlatformBalances[0] as Rec | undefined;

  const openTickets = data.tickets.filter((t) => !CLOSED.test(String(t.status ?? '')));
  const openOrders = data.orders.filter((o) => !CLOSED.test(String(o.status ?? '')));
  const barring = account?.barringType ?? (account?.barringStatus === 'Not Barred' ? 'No' : text(account?.barringStatus));
  const balanceParts = [
    balance?.mainBalanceQAR != null ? qar(Number(balance.mainBalanceQAR)) : undefined,
    balance?.dataBalanceGB != null ? `${balance.dataBalanceGB} GB` : undefined,
    balance?.voiceBalanceMinutes != null ? `${balance.voiceBalanceMinutes} Mins` : undefined,
    balance?.smsBalanceCount != null ? `${balance.smsBalanceCount} SMS` : undefined,
  ].filter(Boolean);
  const limit = (v: unknown) => (v != null ? qar(Number(v)) : undefined);

  const summary = [
    { label: 'Query Issue', value: issue.name },
    { label: 'Query Category', value: issue.category },
    { label: 'Query Service Type', value: serviceType },
    { label: 'MSISDN', value: service?.identifier ?? 'Not selected' },
    { label: 'Plan Name', value: service?.label ?? NOT_ON_FILE },
    // A service with no status recorded is shown as Active everywhere else in Customer 360; same here.
    { label: 'SIM State', value: service ? (service.status ?? 'Active') : NOT_ON_FILE },
    { label: 'Account Number', value: account?.accountId ?? NOT_ON_FILE },
  ];
  const additional = [
    { label: 'Asset Barring (incl. OG/IC)', value: barring ?? NOT_ON_FILE },
    { label: 'Bill Limit', value: limit(creditLimit?.creditLimitQar ?? creditLimit?.creditLimitQAR) ?? NOT_ON_FILE },
    { label: 'Billing Profile', value: text(billingProfile?.billingType) ?? text(billingProfile?.name) ?? NOT_ON_FILE },
    { label: 'Credit Limit', value: limit(billingProfile?.creditLimitQAR) ?? NOT_ON_FILE },
    { label: 'In Progress Ticket', value: openTickets.length > 0 ? 'Yes' : 'No' },
    { label: 'Open Order', value: openOrders.length > 0 ? 'Yes' : 'No' },
    { label: 'Balance (QAR, Data, Voice, SMS)', value: balanceParts.length ? balanceParts.join(' | ') : NOT_ON_FILE },
  ];

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
          <Pill tone="red">{issue.category}</Pill>
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
