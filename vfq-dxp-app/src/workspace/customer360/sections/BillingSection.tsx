import { DataTable } from '../../../components/primitives/DataTable';
import { Badge } from '../../../components/primitives/Badge';
import type { Customer360Data } from '../../../engines/customer360Engine';

function formatBillPeriod(period: unknown): string {
  const match = /^(\d{4})-(\d{2})$/.exec(String(period ?? ''));
  if (!match) return String(period ?? '—');
  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function capitalize(value: unknown): string {
  const s = String(value ?? '');
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '—';
}

// Small metric card shared by the Credit Limit / Current Bill / Outstanding
// summary row — same tokens/border/radius the single Credit Limit card
// already used, just restructured (label, value, subtext stacked) so the
// three sit side by side ahead of the detail tables below.
function BillingMetricCard({ label, value, subtext }: { label: string; value: string; subtext: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-border-soft bg-bg p-4">
      <div className="text-[length:var(--fs-caption)] text-muted">{label}</div>
      <div className="text-fg font-medium text-[length:var(--fs-h5)]">{value}</div>
      <div className="text-[length:var(--fs-caption)] text-fg-2 mt-1">{subtext}</div>
    </div>
  );
}

// No billing screens exist anywhere in the 213-screen catalogue today (the
// "Billing & Adjustments" module was never given a src/modules folder) — so
// unlike Mobile/Fibre there's no wizard to launch here. This tab is
// deliberately read-only: real data (bills/payments/adjustments/credit
// limits/deposits, already joined by customerId/accountId), no fabricated
// transactional actions.
export function BillingSection({ data }: { data: Customer360Data }) {
  const creditLimit = data.creditLimits[0];
  const account = data.accounts[0];

  const latestBill = [...data.bills].sort((a, b) =>
    String(a.billPeriod ?? '').localeCompare(String(b.billPeriod ?? '')),
  ).at(-1);

  const billedTotal = data.bills
    .filter((b) => b.status === 'billed')
    .reduce((sum, b) => sum + Number(b.totalAmount ?? 0), 0);
  const paidTotal = data.payments.reduce((sum, p) => sum + Number(p.amountQar ?? 0), 0);
  const outstanding = Math.max(0, billedTotal - paidTotal);

  const hasMetrics = Boolean(creditLimit) || Boolean(latestBill);

  return (
    <div className="space-y-6">
      {hasMetrics && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {creditLimit && (
            <BillingMetricCard
              label="Credit limit"
              value={`${String(creditLimit.creditLimitQar ?? creditLimit.creditLimitQAR ?? '—')} QAR`}
              subtext={
                Boolean(creditLimit.restrictionApplied)
                  ? 'Restriction applied'
                  : String(account?.accountType ?? String(creditLimit.customerSegment ?? '—'))
              }
            />
          )}
          {latestBill && (
            <BillingMetricCard
              label="Current bill"
              value={`${String(latestBill.totalAmount ?? '—')} QAR`}
              subtext={`${formatBillPeriod(latestBill.billPeriod)} · ${capitalize(latestBill.status)}`}
            />
          )}
          {latestBill && (
            <BillingMetricCard
              label="Outstanding"
              value={`${outstanding} QAR`}
              subtext={outstanding > 0 ? 'Overdue balance' : 'No overdue balance'}
            />
          )}
        </div>
      )}

      <section>
        <h3 className="text-[length:var(--fs-body-lg)] font-medium text-fg mb-2">Bills</h3>
        <DataTable
          rows={data.bills}
          rowKey={(r) => String(r.billId)}
          emptyMessage="No bills on file."
          columns={[
            { key: 'billPeriod', header: 'Period' },
            { key: 'type', header: 'Type' },
            { key: 'totalAmount', header: 'Total (QAR)' },
            {
              key: 'status',
              header: 'Status',
              render: (r) => <Badge variant={r.status === 'billed' ? 'success' : 'filled-neutral'}>{String(r.status)}</Badge>,
            },
          ]}
        />
      </section>

      <section>
        <h3 className="text-[length:var(--fs-body-lg)] font-medium text-fg mb-2">Payments</h3>
        <DataTable
          rows={data.payments}
          rowKey={(r) => String(r.paymentId)}
          emptyMessage="No payments on file."
          columns={[
            { key: 'capturedAt', header: 'Date' },
            { key: 'chargeType', header: 'Charge' },
            { key: 'amountQar', header: 'Amount (QAR)' },
            { key: 'paymentMethod', header: 'Method' },
            { key: 'status', header: 'Status' },
          ]}
        />
      </section>

      <section>
        <h3 className="text-[length:var(--fs-body-lg)] font-medium text-fg mb-2">Adjustments &amp; refunds</h3>
        <DataTable
          rows={data.adjustments}
          rowKey={(r) => String(r.adjustmentId)}
          emptyMessage="No adjustments on file."
          columns={[
            { key: 'reason', header: 'Reason' },
            { key: 'direction', header: 'Direction' },
            { key: 'amount', header: 'Amount' },
          ]}
        />
      </section>

      <section>
        <h3 className="text-[length:var(--fs-body-lg)] font-medium text-fg mb-2">Deposits</h3>
        <DataTable
          rows={data.deposits}
          rowKey={(r) => String(r.depositId)}
          emptyMessage="No deposits on file."
          columns={[
            { key: 'amount', header: 'Amount' },
            { key: 'currency', header: 'Currency' },
            { key: 'refundStatus', header: 'Refund status' },
          ]}
        />
      </section>
    </div>
  );
}
