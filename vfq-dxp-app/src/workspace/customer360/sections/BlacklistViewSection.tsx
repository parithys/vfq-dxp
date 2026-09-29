import { Badge } from '../../../components/primitives/Badge';
import { computeBillingSummary, type Customer360Data } from '../../../engines/customer360Engine';

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[length:var(--fs-caption)] text-muted">{label}</div>
      <div className="text-fg text-[length:var(--fs-body)]">{value ?? '-'}</div>
    </div>
  );
}

/** Customer 360's "Blacklist View" tab - built entirely from real fields
 * already on the customer/account/billing records (customer.blacklisted /
 * blacklistReason / blacklistCategory, accounts, latest bill), matching
 * customer360-fields.json's Blacklist View topic (Blacklisted ID Status,
 * Account Number, Total amount, Bill Period, Bill Number, MSISDNs). No
 * dedicated blacklist dataset exists in this corpus, so nothing here is
 * invented beyond what those records already carry. */
export function BlacklistViewSection({ data }: { data: Customer360Data }) {
  const { customer, accounts } = data;
  const { latestBill, outstanding } = computeBillingSummary(data);
  const msisdns = Array.from(
    new Set([customer.phone, ...data.contacts.map((c) => c.cellNumber as string | undefined)].filter(Boolean))
  ) as string[];

  if (!customer.blacklisted) {
    return <p className="text-muted text-[length:var(--fs-body)]">This customer is not blacklisted.</p>;
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-border-soft bg-bg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[length:var(--fs-caption-upper)] uppercase tracking-wide font-semibold text-fg">Blacklisted ID Status</h3>
        <Badge variant="danger">
          {customer.blacklistCategory ? `Blacklisted - ${customer.blacklistCategory}` : 'Blacklisted'}
        </Badge>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Reason" value={customer.blacklistReason} />
        <Field label="Account Number" value={accounts.map((a) => a.accountId).join(', ')} />
        <Field label="Total amount" value={`${outstanding} QAR`} />
        <Field label="Bill Period" value={latestBill ? String(latestBill.billPeriod) : undefined} />
        <Field label="Bill Number" value={latestBill ? String(latestBill.billId) : undefined} />
        <Field label="MSISDNs" value={msisdns.length > 0 ? msisdns.join(', ') : undefined} />
      </div>
    </div>
  );
}
