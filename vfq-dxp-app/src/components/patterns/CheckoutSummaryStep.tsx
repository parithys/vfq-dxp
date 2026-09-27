import { useEffect, useState } from 'react';
import * as mockDataEngine from '../../engines/mockDataEngine';
import { monthlyCharges, firstBillCharges, formatQar, VAT_RATE } from '../../engines/postpaidPricing';
import type { EligibilityResult } from '../domain/EligibilityGateStep';

interface Product {
  productId: string;
  name: string;
  mrcQAR: number;
  /** Plan lock-in, straight off the catalogue row. */
  commitmentMonths?: number;
}

/**
 * Star-number lock-in, banded by the number's one-time price. Real catalogue
 * data (public/mock-data/star-number-tiers.json) - a premium number carries its
 * own commitment independent of the plan's, and the 2026-09-27 walkthrough asks
 * for both on the read-back.
 */
interface StarNumberTier {
  tierId: string;
  valueRangeMin: number;
  valueRangeMax: number;
  lockInDurationMonths: number;
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
  eligibility: EligibilityResult | undefined;
  onTotalsComputed: (totals: CheckoutTotals) => void;
  /**
   * The same facts, as label/value rows, for the CAF step to read back to the
   * customer before signature. Published from HERE rather than rebuilt there
   * so both surfaces derive from one calculation - the drift this component's
   * own discount bug (2026-09-26) was caused by.
   */
  onSummaryComputed?: (rows: { label: string; value: string }[]) => void;
}

// "Checkout" (reference flow step 9, evidenced as SCR "checkout-screen-retail-
// new-postpaid") - read-only order summary presented before CAF generation,
// consolidating every prior step's selections and computing what's due today
// (premium-number delta + device down payment + HRN advance) versus the
// ongoing monthly recurring charge (plan + add-ons + device installment).
export function CheckoutSummaryStep({
  customerName,
  idNumber,
  billingMethod,
  productId,
  discountId,
  addonIds,
  msisdn,
  numberPriceQar,
  eligibility,
  onTotalsComputed,
  onSummaryComputed,
}: CheckoutSummaryStepProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [discounts, setDiscounts] = useState<{ addonDiscountId: string; name: string; price: number }[]>([]);
  const [starTiers, setStarTiers] = useState<StarNumberTier[]>([]);

  useEffect(() => {
    mockDataEngine.list<Product>('products').then(setProducts);
    mockDataEngine
      .list<{ addonDiscountId: string; name: string; price: number }>('addons-discounts')
      .then(setDiscounts);
    mockDataEngine.list<StarNumberTier>('star-number-tiers').then(setStarTiers);
  }, []);

  const plan = products.find((p) => p.productId === productId);
  const addons = products.filter((p) => addonIds.includes(p.productId));
  const discount = discounts.find((d) => d.addonDiscountId === discountId);
  const numberDelta = numberPriceQar ?? 0;
  const hrnAdvance = eligibility?.requiresHrnAdvance ? 100 : 0;

  const dueTodayQar = numberDelta + hrnAdvance;
  // A priced number is a Star number; a zero-priced one is Free. The picker
  // already encodes that distinction in the price it hands back, so this reads
  // it rather than plumbing a second "category" value through the wizard.
  const isStarNumber = numberDelta > 0;
  const starTier = isStarNumber
    ? starTiers.find((t) => numberDelta >= t.valueRangeMin && numberDelta <= t.valueRangeMax)
    : undefined;
  // "Maximum Bill Limit equals account Credit Limit" (business-rules.json).
  // This journey dropped its Bill Limit editor on 2026-09-25, so there is no
  // agent-set value to show - what the customer must be told is the cap, which
  // that rule defines as the credit limit. Stated as a cap, not invented as a
  // figure, because no default bill limit exists in the data for this plan.
  const creditLimitQar = eligibility?.defaultCreditLimitQar;
  // One shared itemisation with the Plan step and the order payload - see
  // engines/postpaidPricing.ts. Derived here rather than restated, because
  // this figure is what the agent reads to the customer and the order's is
  // what they are billed, and the two diverging is exactly the bug this
  // module was extracted to end.
  const charges = monthlyCharges({
    planQar: plan?.mrcQAR ?? 0,
    discountRate: discount?.price,
    addonsQar: addons.reduce((sum, a) => sum + a.mrcQAR, 0),
  });
  const monthlyRecurringQar = charges.totalQar;
  // The first INVOICE, distinct from dueTodayQar (paid at the counter today)
  // and from monthlyRecurringQar (the exact figure from month two onward).
  // See firstBillCharges' own note for the evidenced shape and the assumed
  // cycle day it depends on. new Date() here, not injected: this is app
  // runtime rendering for an agent at the counter right now, not a workflow
  // script - "today" IS the activation date being priced.
  const firstBill = firstBillCharges(charges, new Date());

  useEffect(() => {
    onTotalsComputed({ dueTodayQar, monthlyRecurringQar, hrnAdvanceQar: hrnAdvance });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dueTodayQar, monthlyRecurringQar, hrnAdvance]);

  // Customer-facing rows for CAF. Only published once the catalogue reads have
  // landed, so CAF never shows a summary with "-" where a plan name belongs.
  useEffect(() => {
    if (!onSummaryComputed || !plan) return;
    onSummaryComputed([
      { label: 'Number', value: msisdn ? `${msisdn} (${isStarNumber ? 'Star' : 'Free'})` : '-' },
      { label: 'Plan', value: `${plan.name} - QR ${plan.mrcQAR}/mo` },
      { label: 'Add-ons', value: addons.length ? addons.map((a) => `${a.name} (QR ${a.mrcQAR}/mo)`).join(', ') : 'None' },
      {
        label: 'Discount',
        value: discount
          ? `${discount.name} (${Math.round(Math.abs(discount.price) * 100)}%) - ${formatQar(charges.discountQar, 'QR')}/mo`
          : 'None',
      },
      ...(isStarNumber ? [{ label: 'Star-number value', value: `QR ${numberDelta} one-time` }] : []),
      {
        label: 'Lock-in period',
        value: [
          plan.commitmentMonths ? `Plan ${plan.commitmentMonths} months` : null,
          starTier ? `Star number ${starTier.lockInDurationMonths} months` : null,
        ]
          .filter(Boolean)
          .join(' · ') || 'None',
      },
      {
        label: 'Key charges',
        value: `QR ${dueTodayQar} today · QR ${firstBill.totalQar} first bill · QR ${monthlyRecurringQar}/mo thereafter`,
      },
      ...(creditLimitQar !== undefined
        ? [
            { label: 'Credit limit', value: `QR ${creditLimitQar}` },
            { label: 'Bill limit', value: `Up to QR ${creditLimitQar}` },
          ]
        : []),
      {
        label: 'Important terms',
        value: 'VAT included in the monthly figure. Cancelling inside any lock-in ends the agreement early.',
      },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.productId, discount?.addonDiscountId, addons.length, msisdn, numberDelta, dueTodayQar, monthlyRecurringQar, starTier?.tierId, creditLimitQar]);

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
        <Row label="Plan" value={plan ? `${plan.name} - QR ${plan.mrcQAR}/mo` : '-'} />
        {/* The number now carries its status (Free / Star) on the same row,
            which is what the 2026-09-27 walkthrough asks the agent to read
            back. Mobile and SIM Type rows were removed in the same pass. */}
        <Row
          label="Number"
          value={
            msisdn
              ? `${msisdn} - ${isStarNumber ? `Star, QR ${numberDelta} one-time` : 'Free'}`
              : '-'
          }
        />
        {creditLimitQar !== undefined && <Row label="Credit limit" value={`QR ${creditLimitQar}`} />}
        {creditLimitQar !== undefined && (
          <Row label="Bill limit" value={`Up to QR ${creditLimitQar} (capped at the credit limit)`} />
        )}
        {/* Conditional: the postpaid journey dropped its Billing step on
            2026-09-25, so there is nothing to report there. Other journeys
            that still collect one are unaffected. */}
        {billingMethod && <Row label="Billing" value={billingMethod} />}
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
        {/* First bill and ongoing recurring are two different numbers on a
            postpaid line, and this panel used to show only the second one -
            "Monthly recurring, going forward" was already the ongoing figure,
            but nothing distinguished it from what the FIRST invoice actually
            carries. The CAF disclaimer this journey's own signature step
            shows the customer is explicit that those differ: the first bill
            is a prorated part-month plus one full month billed in advance,
            not the plain recurring charge. */}
        <div className="flex justify-between text-fg-2 text-[length:var(--fs-caption)]">
          <span>
            First month's bill
            <span className="block text-muted">
              {firstBill.proratedDays} of {firstBill.cycleDays} days this cycle, plus one month in advance
            </span>
          </span>
          <span className="shrink-0">QR {firstBill.totalQar}</span>
        </div>
        <div className="flex justify-between text-fg-2 text-[length:var(--fs-caption)]">
          <span>Recurring monthly bill, from month 2</span>
          <span>QR {monthlyRecurringQar}/mo</span>
        </div>
      </div>

      {/* Order summary (2026-09-27 walkthrough). Everything here is derived
          from catalogue data the order already carries - plan commitmentMonths
          and star-number-tiers' lockInDurationMonths - rather than restated, so
          it cannot drift from what was actually sold. The cancellation line is
          phrased from the lock-in it reads, and deliberately does NOT quote an
          early-termination fee: no such figure exists in the corpus, and
          inventing one on a document the customer is about to sign would be
          worse than pointing at the full terms. */}
      <div className="rounded-[var(--radius-card)] border border-border-soft bg-surface p-4 space-y-2">
        <h4 className="text-fg font-medium text-[length:var(--fs-body)]">Order summary</h4>
        <dl className="text-[length:var(--fs-caption)]">
          <Row
            label="Plan lock-in"
            value={plan?.commitmentMonths ? `${plan.commitmentMonths} months` : 'No lock-in'}
          />
          {isStarNumber && (
            <Row
              label="Star-number commitment"
              value={
                starTier
                  ? `${starTier.lockInDurationMonths} months (${starTier.tierId})`
                  : 'Not banded - confirm before signature'
              }
            />
          )}
          <Row
            label="Key charges"
            value={`QR ${dueTodayQar} today, QR ${firstBill.totalQar} first bill, QR ${monthlyRecurringQar}/mo thereafter`}
          />
          <Row
            label="Cancellation"
            value={
              plan?.commitmentMonths || starTier
                ? 'Cancelling inside the lock-in ends the agreement early - charges apply per the full terms'
                : 'No lock-in applies to this order'
            }
          />
        </dl>
        <a
          href="https://www.vodafone.qa/en/terms-and-conditions"
          target="_blank"
          rel="noreferrer"
          className="inline-block text-[length:var(--fs-caption)] text-accent underline"
        >
          Read the complete terms and conditions
        </a>
      </div>
    </div>
  );
}
