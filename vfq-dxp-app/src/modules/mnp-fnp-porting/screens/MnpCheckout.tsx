import { useEffect } from 'react';
import { Badge } from '../../../components/primitives/Badge';
import { Button } from '../../../components/primitives/Button';
import type { CheckoutTotals } from '../../../components/patterns/checkoutSummaryModel';
import { normalizePortInNumber, PORT_IN_DEPOSIT_QAR, PORT_IN_FEE_QAR } from '../../../data/portInRules';
import { useEntityStore } from '../../../stores/entityStore';
import type { GateCheck } from './mnpValidationGate';

export interface MnpCheckoutProps {
  customerName?: string;
  portInNumber?: string;
  donorOperator?: string;
  productId?: string;
  simSerial?: string;
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

/** BR-MNP-009's validation gate: every mandatory validation with its result, and a way back to fix a failed one. */
export function MnpValidationGate({ gate, onFix }: { gate: GateCheck[]; onFix: (checkId: string) => void }) {
  const failed = gate.filter((c) => !c.ok);
  return (
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
  );
}

/**
 * The prepaid port-in's cart check-out (MNP BRSD CVC / BR-MNP-009 / BR-MNP-011): the order as it will be submitted, the validation
 * gate and what is due today. A postpaid port-in uses the shared Checkout Summary capability instead (with the same gate above it).
 * The amount is the sum of the applicable port-in charges and deposit (BR-MNP-011); the BRSD gives none, so a prepaid port-in owes
 * nothing today and the Payment step issues a zero-value receipt.
 */
export function MnpCheckout({ customerName, portInNumber, donorOperator, productId, simSerial, gate, onTotalsComputed, onFix }: MnpCheckoutProps) {
  const loadKind = useEntityStore((s) => s.loadKind);
  const products = useEntityStore((s) => s.records['products']);
  useEffect(() => {
    void loadKind('products');
  }, [loadKind]);

  const plan = (products ?? []).find((p) => p.productId === productId);
  const dueTodayQar = PORT_IN_FEE_QAR + PORT_IN_DEPOSIT_QAR;

  useEffect(() => {
    onTotalsComputed({ dueTodayQar, monthlyRecurringQar: 0, hrnAdvanceQar: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dueTodayQar]);

  return (
    <div className="space-y-6">
      <MnpValidationGate gate={gate} onFix={onFix} />

      <section className="card p-4" aria-label="Order summary">
        <h3 className="font-bold text-fg text-[length:var(--fs-body)] mb-1">Order summary</h3>
        <div className="divide-y divide-border-soft">
          <Line label="Customer" value={customerName} />
          <Line label="Port-in number" value={normalizePortInNumber(portInNumber ?? '')} />
          <Line label="Donor operator" value={donorOperator} />
          <Line label="Plan type" value="Prepaid" />
          <Line label="Plan" value={plan ? String(plan.name) : productId} />
          <Line label="Vodafone SIM" value={simSerial} />
        </div>
      </section>

      <section className="card p-4" aria-label="Due today">
        <h3 className="font-bold text-fg text-[length:var(--fs-body)] mb-1">Due today</h3>
        <div className="divide-y divide-border-soft">
          <Line label="Port-in charge" value={qar(PORT_IN_FEE_QAR)} />
          <Line label="Deposit" value={qar(PORT_IN_DEPOSIT_QAR)} />
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
