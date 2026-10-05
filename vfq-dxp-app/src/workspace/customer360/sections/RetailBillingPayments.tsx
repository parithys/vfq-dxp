import { Badge } from '../../../components/primitives/Badge';
import { Icon } from '../../../components/primitives/Icon';
import { computeBillingSummary, type Customer360Data } from '../../../engines/customer360Engine';
import { Card, Row } from './retailCards';

const WALLET_ICON = 'M3 5h18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M1 10h22';
const CHART_ICON = 'M6 20V10 M12 20V4 M18 20v-6';
const BILL_ICON = 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h8';
const BALANCE_ICON = 'M12 8c4.97 0 9-1.34 9-3s-4.03-3-9-3-9 1.34-9 3 4.03 3 9 3z M21 12c0 1.66-4.03 3-9 3s-9-1.34-9-3 M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5';
const ELIGIBLE_ICON = 'M20 6L9 17l-5-5';

const qar = (n: unknown) => (n === undefined || n === null || n === '' ? undefined : `QAR ${String(n)}`);

function formatDate(iso: unknown): string | undefined {
  if (!iso) return undefined;
  const d = new Date(String(iso));
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * The Retail Sales Agent's Billing & Payments tab: five cards over the billing data Customer 360 already holds.
 * A row with no data on file is left out rather than filled in.
 */
export function RetailBillingPayments({ data }: { data: Customer360Data }) {
  const { latestBill, outstanding, previousPayment, formattedBillPeriod } = computeBillingSummary(data);
  const inWindow = data.bills.filter((b) => b.status === 'billed' || b.status === 'paid');
  const avg = inWindow.length > 0 ? Math.round((inWindow.reduce((sum, b) => sum + Number(b.totalAmount ?? 0), 0) / inWindow.length) * 100) / 100 : undefined;
  const ptp = data.billingProfiles[0]?.promiseToPayStatus;

  return (
    <div>
      <h2 className="flex items-center gap-3 text-fg font-semibold text-[length:var(--fs-h4)] pb-3 mb-4 border-b border-border-soft">
        <Icon path={WALLET_ICON} className="w-6 h-6" />
        Billing &amp; Payments
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <Card icon={CHART_ICON} title="Charges & Spend">
          <dl>
            <Row label="Postpaid - Monthly Recurring Charge" value={qar(latestBill?.mrc)} end />
            <Row label="Postpaid - Average Bill/Spend" value={qar(avg)} end />
          </dl>
        </Card>

        <Card icon={BILL_ICON} title="Latest Bill">
          <dl>
            <Row label="Latest Bill" value={qar(latestBill?.totalAmount)} end />
            <Row label="Bill Number" value={latestBill?.billId as string | undefined} end />
            <Row label="Bill Period" value={latestBill ? formattedBillPeriod : undefined} end />
          </dl>
        </Card>

        <Card icon={BALANCE_ICON} title="Outstanding & Unbilled">
          <dl>
            <Row label="Outstanding Balance" value={qar(outstanding)} end />
            <Row label="Unbilled Usage" value={qar(latestBill?.currentChargesQAR)} end />
            <Row label="Due Date" value={formatDate(latestBill?.dueDate)} end />
          </dl>
        </Card>

        <Card icon={WALLET_ICON} title="Last Payment">
          <dl>
            <Row label="Last Payment" value={qar(previousPayment?.amountQar)} end />
            <Row label="Payment Date" value={formatDate(previousPayment?.capturedAt)} end />
            <Row label="Payment Channel" value={previousPayment?.paymentMethod as string | undefined} end />
          </dl>
        </Card>

        <Card icon={ELIGIBLE_ICON} title="Eligibility">
          <dl>
            <Row
              label="PTP Eligible"
              value={ptp !== undefined ? <Badge variant={/^(yes|y|eligible)$/i.test(String(ptp)) ? 'tag-green' : 'filled-neutral'}>{String(ptp)}</Badge> : undefined}
              end
            />
          </dl>
        </Card>
      </div>
    </div>
  );
}
