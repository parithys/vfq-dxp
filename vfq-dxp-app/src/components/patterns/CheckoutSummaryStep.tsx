import { useEffect, useState } from 'react';
import * as mockDataEngine from '../../engines/mockDataEngine';
import { monthlyCharges, formatQar, VAT_RATE } from '../../engines/postpaidPricing';
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
  /** Echoed onto the read-back summary - see the row-order note in the body. */
  idNumber: string | undefined;
  mobile: string | undefined;
  /** Optional - the postpaid journey no longer collects one. */
  billingMethod?: string;
  productId: string | undefined;
  /**
   * The chosen discount, if any. Added 2026-09-26 because this step did not
   * receive one and so priced every order at full plan rate: with a 15%
   * loyalty discount on a QAR 750 plan it read QAR 800/mo and reported that
   * through onTotalsComputed, while NewPostpaidWizard's onSubmit applied the
   * discount and created the order at 687.50. The agent read the customer a
   * monthly price the order did not carry.
   */
  discountId: string | undefined;
  addonIds: string[];
  msisdn: string | undefined;
  numberPriceQar: number | undefined;
  doi: DoiSelection | undefined;
  simType: SimTypeValue | undefined;
  eligibility: EligibilityResult | undefined;
  onTotalsComputed: (totals: CheckoutTotals) => void;
}

// "Checkout" (reference flow step 9, evidenced as SCR "checkout-screen-retail-
// new-postpaid") - read-only order summary presented before CAF generation,
// consolidating every prior step's selections and computing what's due today
// (premium-number delta + device down payment + HRN advance) versus the
// ongoing monthly recurring charge (plan + add-ons + device installment).
export function CheckoutSummaryStep({
  customerName,
  idNumber,
  mobile,
  billingMethod,
  productId,
  discountId,
  addonIds,
  msisdn,
  numberPriceQar,
  doi,
  simType,
  eligibility,
  onTotalsComputed,
}: CheckoutSummaryStepProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [discounts, setDiscounts] = useState<{ addonDiscountId: string; name: string; price: number }[]>([]);

  useEffect(() => {
    mockDataEngine.list<Product>('products').then(setProducts);
    mockDataEngine
      .list<{ addonDiscountId: string; name: string; price: number }>('addons-discounts')
      .then(setDiscounts);
  }, []);

  const plan = products.find((p) => p.productId === productId);
  const addons = products.filter((p) => addonIds.includes(p.productId));
  const discount = discounts.find((d) => d.addonDiscountId === discountId);
  const numberDelta = numberPriceQar ?? 0;
  const hrnAdvance = eligibility?.requiresHrnAdvance ? 100 : 0;

  const dueTodayQar = numberDelta + (doi?.downPaymentQar ?? 0) + hrnAdvance;
  // One shared itemisation with the Plan step and the order payload - see
  // engines/postpaidPricing.ts. Derived here rather than restated, because
  // this figure is what the agent reads to the customer and the order's is
  // what they are billed, and the two diverging is exactly the bug this
  // module was extracted to end.
  const charges = monthlyCharges({
    planQar: plan?.mrcQAR ?? 0,
    discountRate: discount?.price,
    addonsQar: addons.reduce((sum, a) => sum + a.mrcQAR, 0),
    installmentQar: doi?.monthlyInstallmentQar,
  });
  const monthlyRecurringQar = charges.totalQar;

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
        {/* Row order follows the supplied summary mockup: who they are, how we
            identify and reach them, what they bought, how they pay, then
            hardware. ID/Mobile/Billing are echoed here because Checkout is the
            last screen before signature - the agent reads this back to the
            customer, so the identifiers belong on it, not just the
            commercials. Add-ons always renders, showing "None" rather than
            disappearing: an absent row reads as an unanswered question. */}
        <Row label="Customer" value={customerName ?? '-'} />
        <Row label="ID" value={idNumber ?? '-'} />
        <Row label="Mobile" value={mobile ?? '-'} />
        <Row label="Plan" value={plan ? `${plan.name} - QR ${plan.mrcQAR}/mo` : '-'} />
        <Row label="Number" value={msisdn ? `${msisdn}${numberDelta > 0 ? ` (premium, QR ${numberDelta} one-time)` : ''}` : '-'} />
        <Row label="SIM Type" value={simType?.simType ?? '-'} />
        {/* Conditional: the postpaid journey dropped its Billing step on
            2026-09-25, so there is nothing to report there. Other journeys
            that still collect one are unaffected. */}
        {billingMethod && <Row label="Billing" value={billingMethod} />}
        {doi && <Row label="Device" value={`${doi.deviceName} - QR ${doi.downPaymentQar} down, QR ${doi.monthlyInstallmentQar}/mo x ${doi.installmentMonths}`} />}
        <Row
          label="Add-ons"
          value={addons.length ? addons.map((a) => `${a.name} (QR ${a.mrcQAR}/mo)`).join(', ') : 'None'}
        />
        {/* Shown so the monthly figure below can be arrived at from the rows
            above it. Without this the total was simply lower than Plan plus
            Add-ons with nothing on screen accounting for the difference. */}
        {discount && (
          <Row
            label="Discount"
            value={`${discount.name} (${Math.round(Math.abs(discount.price) * 100)}%) - ${formatQar(
              charges.discountQar,
              'QR'
            )}/mo`}
          />
        )}
        {/* The tax is on the read-back because the monthly figure below
            includes it - an agent reading out a total they cannot account for
            from the rows above has nothing to answer "why?" with. */}
        <Row label={`VAT (${Math.round(VAT_RATE * 100)}%)`} value={`${formatQar(charges.vatQar, 'QR')}/mo`} />
        {hrnAdvance > 0 && <Row label="HRN advance payment" value={`QR ${hrnAdvance}`} />}
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
