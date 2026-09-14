import { DataTable } from '../../../components/primitives/DataTable';
import { Badge } from '../../../components/primitives/Badge';
import { computeBillingSummary, type Customer360Data } from '../../../engines/customer360Engine';
import { MetricCard } from '../MetricCard';

function capitalize(value: unknown): string {
  const s = String(value ?? '');
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '—';
}

// No billing screens exist anywhere in the 213-screen catalogue today (the
// "Billing & Adjustments" module was never given a src/modules folder) — so
// unlike Mobile/Fibre there's no wizard to launch here. This tab is
// deliberately read-only: real data (bills/payments/adjustments/credit
// limits/deposits, already joined by customerId/accountId), no fabricated
// transactional actions.
export function BillingSection({ data }: { data: Customer360Data }) {
  const account = data.accounts[0];
  const { creditLimit, latestBill, outstanding, formattedBillPeriod } = computeBillingSummary(data);
  const hasMetrics = Boolean(creditLimit) || Boolean(latestBill);

  return (
    <div className="space-y-6">
      {hasMetrics && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {creditLimit && (
            <MetricCard
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
            <MetricCard
              label="Current bill"
              value={`${String(latestBill.totalAmount ?? '—')} QAR`}
              subtext={`${formattedBillPeriod} · ${capitalize(latestBill.status)}`}
            />
          )}
          {latestBill && (
            <MetricCard
              label="Outstanding"
              value={`${outstanding} QAR`}
              subtext={outstanding > 0 ? 'Overdue balance' : 'No overdue balance'}
            />
          )}
        </div>
      )}

      <section>
        <h3 className="text-[length:var(--fs-caption-upper)] uppercase tracking-wide font-semibold text-fg mb-2">Bills</h3>
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
        <h3 className="text-[length:var(--fs-caption-upper)] uppercase tracking-wide font-semibold text-fg mb-2">Payments</h3>
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
        <h3 className="text-[length:var(--fs-caption-upper)] uppercase tracking-wide font-semibold text-fg mb-2">Adjustments &amp; refunds</h3>
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
        <h3 className="text-[length:var(--fs-caption-upper)] uppercase tracking-wide font-semibold text-fg mb-2">Deposits</h3>
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
