import { useEffect, useState } from 'react';
import * as mockDataEngine from '../../engines/mockDataEngine';
import type { DoiSelection } from '../domain/DeviceInstallmentStep';
import type { SimTypeValue } from '../domain/SimTypeStep';
import type { EligibilityResult } from '../domain/EligibilityGateStep';

interface Product {
  productId: string;
  name: string;
  mrcQAR: number;
}

export interface CheckoutTotals {
  dueTodayQar: number;
  monthlyRecurringQar: number;
  hrnAdvanceQar: number;
}

interface CheckoutSummaryStepProps {
  customerName: string | undefined;
  productId: string | undefined;
  addonIds: string[];
  msisdn: string | undefined;
  numberPriceQar: number | undefined;
  doi: DoiSelection | undefined;
  simType: SimTypeValue | undefined;
  eligibility: EligibilityResult | undefined;
  onTotalsComputed: (totals: CheckoutTotals) => void;
}

// "Checkout" (reference flow step 9, evidenced as SCR "checkout-screen-retail-
// new-postpaid") — read-only order summary presented before CAF generation,
// consolidating every prior step's selections and computing what's due today
// (premium-number delta + device down payment + HRN advance) versus the
// ongoing monthly recurring charge (plan + add-ons + device installment).
export function CheckoutSummaryStep({
  customerName,
  productId,
  addonIds,
  msisdn,
  numberPriceQar,
  doi,
  simType,
  eligibility,
  onTotalsComputed,
}: CheckoutSummaryStepProps) {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    mockDataEngine.list<Product>('products').then(setProducts);
  }, []);

  const plan = products.find((p) => p.productId === productId);
  const addons = products.filter((p) => addonIds.includes(p.productId));
  const numberDelta = numberPriceQar ?? 0;
  const hrnAdvance = eligibility?.requiresHrnAdvance ? 100 : 0;

  const dueTodayQar = numberDelta + (doi?.downPaymentQar ?? 0) + hrnAdvance;
  const monthlyRecurringQar = (plan?.mrcQAR ?? 0) + addons.reduce((sum, a) => sum + a.mrcQAR, 0) + (doi?.monthlyInstallmentQar ?? 0);

  useEffect(() => {
    onTotalsComputed({ dueTodayQar, monthlyRecurringQar, hrnAdvanceQar: hrnAdvance });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dueTodayQar, monthlyRecurringQar, hrnAdvance]);

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between py-2 border-b border-border-soft last:border-0">
      <dt className="text-fg-2">{label}</dt>
      <dd className="text-fg">{value}</dd>
    </div>
  );

  return (
    <div className="space-y-4">
      <dl className="rounded-[var(--radius-card)] border border-border-soft bg-surface p-4">
        <Row label="Customer" value={customerName ?? '—'} />
        <Row label="Plan" value={plan ? `${plan.name} — QR ${plan.mrcQAR}/mo` : '—'} />
        {addons.map((a) => (
          <Row key={a.productId} label={`Add-on: ${a.name}`} value={`QR ${a.mrcQAR}/mo`} />
        ))}
        <Row label="Number" value={msisdn ? `${msisdn}${numberDelta > 0 ? ` (premium, QR ${numberDelta} one-time)` : ''}` : '—'} />
        {doi && <Row label="Device" value={`${doi.deviceName} — QR ${doi.downPaymentQar} down, QR ${doi.monthlyInstallmentQar}/mo x ${doi.installmentMonths}`} />}
        <Row label="SIM Type" value={simType?.simType ?? '—'} />
        {hrnAdvance > 0 && <Row label="HRN advance payment" value={`QR ${hrnAdvance} (BR-187)`} />}
      </dl>

      <div className="rounded-[var(--radius-card)] border border-accent/40 bg-surface-warm p-4 space-y-1">
        <div className="flex justify-between text-fg font-semibold">
          <span>Due today</span>
          <span>QR {dueTodayQar}</span>
        </div>
        <div className="flex justify-between text-fg-2 text-[length:var(--fs-caption)]">
          <span>Monthly recurring, going forward</span>
          <span>QR {monthlyRecurringQar}/mo</span>
        </div>
      </div>
    </div>
  );
}
