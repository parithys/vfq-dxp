import { useEffect } from 'react';
import { Badge } from '../../../components/primitives/Badge';
import { Button } from '../../../components/primitives/Button';
import type { CheckoutTotals } from '../../../components/patterns/checkoutSummaryModel';
import { HRN_ADVANCE_QAR } from '../../../engines/postpaidPricing';
import { normalizePortInNumber, PORT_IN_DEPOSIT_QAR, PORT_IN_FEE_QAR } from '../../../data/portInRules';
import { useEntityStore } from '../../../stores/entityStore';
import type { GateCheck } from './mnpValidationGate';

export interface MnpCheckoutProps {
  customerName?: string;
  portInNumber?: string;
  donorOperator?: string;
  productId?: string;
  simSerial?: string;
  mnpType: 'postpaid' | 'prepaid';
  /** The billing profile the order goes on (postpaid only). */
  billingLabel?: string;
  requiresHrnAdvance: boolean;
  gate: GateCheck[];
  onTotalsComputed: (totals: CheckoutTotals) => void;
  /** Back to the step that fixes a failed check. */
  onFix: (checkId: string) => void;
}

const qar = (n: number) => `QAR ${n.toLocaleString('en-GB')}`;

function Line({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5">
      <span className="text-fg-2 text-[length:var(--fs-body)]">{label}</span>
      <span className="text-fg text-[length:var(--fs-body)] text-right break-words">{value || '-'}</span>
    </div>
  );
}

/**
 * Cart check-out for an MNP port-in (MNP BRSD CVC / BR-MNP-009 / BR-MNP-011): the order as it will be submitted, the validation gate
 * (every mandatory customer, billing, SIM, MNP and product validation, each with its result), and what is due today. The amount is
 * the sum of the applicable port-in charges, deposit and advance payment (BR-MNP-011): the BRSD gives no Port-In fee or deposit, so
 * the only amount that can be due is the postpaid HRN advance; when nothing is due the Payment step issues a zero-value receipt.
 */
export function MnpCheckout({ customerName, portInNumber, donorOperator, productId, simSerial, mnpType, billingLabel, requiresHrnAdvance, gate, onTotalsComputed, onFix }: MnpCheckoutProps) {
  const loadKind = useEntityStore((s) => s.loadKind);
  const products = useEntityStore((s) => s.records['products']);
  useEffect(() => {
    void loadKind('products');
  }, [loadKind]);

  const plan = (products ?? []).find((p) => p.productId === productId);
  const postpaid = mnpType === 'postpaid';
  const hrnAdvanceQar = postpaid && requiresHrnAdvance ? HRN_ADVANCE_QAR : 0;
  const dueTodayQar = PORT_IN_FEE_QAR + PORT_IN_DEPOSIT_QAR + hrnAdvanceQar;
  const monthlyRecurringQar = postpaid ? Number(plan?.mrcQAR ?? 0) : 0;

  useEffect(() => {
    onTotalsComputed({ dueTodayQar, monthlyRecurringQar, hrnAdvanceQar });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dueTodayQar, monthlyRecurringQar, hrnAdvanceQar]);

  const failed = gate.filter((c) => !c.ok);

  return (
    <div className="space-y-6">
      <section className="card p-4 card-surface" aria-label="Validation gate">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-fg text-[length:var(--fs-body)]">Validations</h3>
          <Badge variant={failed.length === 0 ? 'success' : 'danger'}>{failed.length === 0 ? 'All validations passed' : `${failed.length} to fix`}</Badge>
        </div>
        <ul className="divide-y divide-border-soft">
          {gate.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-2">
              <span className="text-fg text-[length:var(--fs-body)]">{c.label}</span>
              {c.ok ? (
                <Badge variant="success">Done</Badge>
              ) : (
                <span className="flex items-center gap-3">
                  <span className="text-danger text-[length:var(--fs-caption)]">{c.detail}</span>
                  <Button variant="secondary" compact onClick={() => onFix(c.id)}>
                    Fix
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>
        {failed.length > 0 && <p className="text-fg-2 text-[length:var(--fs-caption)] mt-2">Payment and submission stay blocked until every validation is done.</p>}
      </section>

      <section className="card p-4" aria-label="Order summary">
        <h3 className="font-bold text-fg text-[length:var(--fs-body)] mb-1">Order summary</h3>
        <div className="divide-y divide-border-soft">
          <Line label="Customer" value={customerName} />
          <Line label="Port-in number" value={normalizePortInNumber(portInNumber ?? '')} />
          <Line label="Donor operator" value={donorOperator} />
          <Line label="Plan type" value={postpaid ? 'Postpaid' : 'Prepaid'} />
          <Line label="Plan" value={plan ? String(plan.name) : productId} />
          {postpaid && <Line label="Billing profile" value={billingLabel} />}
          <Line label="Vodafone SIM" value={simSerial} />
          {postpaid && <Line label="Monthly recurring" value={`${qar(monthlyRecurringQar)}/mo`} />}
        </div>
      </section>

      <section className="card p-4" aria-label="Due today">
        <h3 className="font-bold text-fg text-[length:var(--fs-body)] mb-1">Due today</h3>
        <div className="divide-y divide-border-soft">
          <Line label="Port-in charge" value={qar(PORT_IN_FEE_QAR)} />
          <Line label="Deposit" value={qar(PORT_IN_DEPOSIT_QAR)} />
          {postpaid && <Line label="Advance payment (HRN)" value={qar(hrnAdvanceQar)} />}
          <div className="flex justify-between gap-4 pt-2">
            <span className="text-fg font-bold text-[length:var(--fs-body)]">Total payable today</span>
            <span className="text-fg font-bold text-[length:var(--fs-body)]">{qar(dueTodayQar)}</span>
          </div>
        </div>
        {dueTodayQar === 0 && <p className="text-fg-2 text-[length:var(--fs-caption)] mt-2">Nothing is due, so a zero-value receipt is issued at payment.</p>}
      </section>
    </div>
  );
}
