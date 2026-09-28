import { useEffect, useState } from 'react';
import * as mockDataEngine from '../../engines/mockDataEngine';
import {
  monthlyCharges,
  firstBillCharges,
  formatQar,
  VAT_RATE,
  HRN_ADVANCE_QAR,
  FREE_NUMBER_PRICE_CEILING_QAR,
  STAR_NUMBER_ENTITLEMENT_MULTIPLIER,
  starNumberOverageQar,
} from '../../engines/postpaidPricing';
import { Button } from '../primitives/Button';
import type { EligibilityResult } from '../domain/EligibilityGateStep';
import type { SimTypeValue } from '../domain/SimTypeStep';

interface Product {
  productId: string;
  name: string;
  mrcQAR: number;
  /** Plan lock-in, straight off the catalogue row. */
  commitmentMonths?: number;
  /** Add-on data allowance, where the catalogue carries one (2026-09-28) -
   * optional because none of the seeded Add-on products currently do
   * (International 50 is minutes-only), but an add-on that does gets its
   * allowance read back here rather than only its price. */
  dataAllowanceGB?: number | null;
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

/**
 * Raw order facts for the CAF step's dynamic T&C bullets (2026-09-28) -
 * separate from `onSummaryComputed`'s label/value rows, which are already
 * formatted for display ("Plan 12 months - Star number 24 months") and so
 * cannot be substituted back into a wording template without re-parsing a
 * sentence. These are the same underlying numbers, published as numbers.
 */
export interface TncLegalFacts {
  planCommitmentMonths?: number;
  starLockInMonths?: number;
  discountName?: string;
  discountDurationMonths?: number | null;
  hrnAdvanceQar: number;
}

interface CheckoutSummaryStepProps {
  customerName: string | undefined;
  /**
   * Service-notification contact, echoed here under the SAME label the
   * Contact step uses ("Alternate phone #" - GuidedContactStep.tsx) rather
   * than a re-worded "Alternate Number", so the agent reads the same phrase
   * on both screens (2026-09-28 request).
   */
  altPhone: string | undefined;
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
  /**
   * The agent-set value from Plan & Add-ons' BillLimitEditor (2026-09-28
   * re-integration) - undefined when the agent never touched it, in which
   * case this screen falls back to stating the credit-limit cap rather than
   * a figure nobody actually set.
   */
  billLimit: number | undefined;
  /**
   * SIM Type's own selection (2026-09-28 "Update the Customer Confirmation
   * screen" request) - needed only for the customer-facing Key Information
   * recap below, which reads back what was issued. The agent's own <dl>
   * on this screen has never shown SIM details (2026-09-28 "Customer ID
   * Number, Customer Contact Number and SIM Type are deliberately absent");
   * that decision stands for the agent view, this is a second, separate
   * surface with its own requirements.
   */
  simType: SimTypeValue | undefined;
  onTotalsComputed: (totals: CheckoutTotals) => void;
  /**
   * The same facts, as label/value rows, for the CAF step to read back to the
   * customer before signature. Published from HERE rather than rebuilt there
   * so both surfaces derive from one calculation - the drift this component's
   * own discount bug (2026-09-26) was caused by.
   */
  onSummaryComputed?: (rows: { label: string; value: string }[]) => void;
  /**
   * Returns the agent to Plan & Add-ons (2026-09-28 "Edit" action). The
   * agent then walks Continue forward through Number/SIM Type as normal -
   * both retain their prior values, so this only re-opens the plan/discount/
   * add-ons/bill-limit choice, not a special skip-back-to-Checkout path.
   */
  onEdit: () => void;
  /** See TncLegalFacts - powers the CAF step's dynamic bullet summary. */
  onLegalFactsComputed?: (facts: TncLegalFacts) => void;
}

// "Checkout" (reference flow step 9, evidenced as SCR "checkout-screen-retail-
// new-postpaid") - read-only order summary presented before CAF generation,
// consolidating every prior step's selections and computing what's due today
// (premium-number delta + device down payment + HRN advance) versus the
// ongoing monthly recurring charge (plan + add-ons + device installment).
export function CheckoutSummaryStep({
  customerName,
  altPhone,
  billingMethod,
  productId,
  discountId,
  addonIds,
  msisdn,
  numberPriceQar,
  eligibility,
  billLimit,
  simType,
  onTotalsComputed,
  onSummaryComputed,
  onEdit,
  onLegalFactsComputed,
}: CheckoutSummaryStepProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [discounts, setDiscounts] = useState<
    { addonDiscountId: string; name: string; price: number; durationMonths: number | null }[]
  >([]);
  const [starTiers, setStarTiers] = useState<StarNumberTier[]>([]);

  useEffect(() => {
    mockDataEngine.list<Product>('products').then(setProducts);
    mockDataEngine
      .list<{ addonDiscountId: string; name: string; price: number; durationMonths: number | null }>(
        'addons-discounts'
      )
      .then(setDiscounts);
    mockDataEngine.list<StarNumberTier>('star-number-tiers').then(setStarTiers);
  }, []);

  const plan = products.find((p) => p.productId === productId);
  const addons = products.filter((p) => addonIds.includes(p.productId));
  const discount = discounts.find((d) => d.addonDiscountId === discountId);
  // The number's own sticker price - kept separate from what is actually
  // CHARGED (numberChargeQar below), so "Star value QR 5000 one-time" can
  // still be read back in full even when BR-115's entitlement covers most or
  // all of it.
  const numberDelta = numberPriceQar ?? 0;
  const hrnAdvance = eligibility?.requiresHrnAdvance ? HRN_ADVANCE_QAR : 0;
  // A number priced at or above FREE_NUMBER_PRICE_CEILING_QAR is a Star
  // number; anything below it is "free to the customer" (2026-09-28
  // direction), regardless of its exact catalogue price - the picker already
  // encodes this same boundary, so Checkout reads the identical threshold
  // rather than drifting from it with its own `> 0` cutoff.
  const isStarNumber = numberDelta >= FREE_NUMBER_PRICE_CEILING_QAR;
  const starTier = isStarNumber
    ? starTiers.find((t) => numberDelta >= t.valueRangeMin && numberDelta <= t.valueRangeMax)
    : undefined;
  // BR-115: the plan's MRC entitles the customer to a star number worth up to
  // MRC x 25 with no extra one-time charge - only the amount ABOVE that
  // entitlement is actually billed. Falls back to the full sticker price when
  // there is no plan yet to derive an entitlement from (shouldn't happen in
  // practice - Plan & Add-ons runs before Number Selection - but this avoids
  // a NaN entitlement rather than assuming the order of steps holds forever).
  const starEntitlementQar = plan ? plan.mrcQAR * STAR_NUMBER_ENTITLEMENT_MULTIPLIER : undefined;
  const numberChargeQar = isStarNumber && plan ? starNumberOverageQar(plan.mrcQAR, numberDelta) : numberDelta;
  const dueTodayQar = numberChargeQar + hrnAdvance;
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

  useEffect(() => {
    if (!onLegalFactsComputed || !plan) return;
    onLegalFactsComputed({
      planCommitmentMonths: plan.commitmentMonths,
      starLockInMonths: isStarNumber ? starTier?.lockInDurationMonths : undefined,
      discountName: discount?.name,
      discountDurationMonths: discount?.durationMonths,
      hrnAdvanceQar: hrnAdvance,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.commitmentMonths, isStarNumber, starTier?.lockInDurationMonths, discount?.name, discount?.durationMonths, hrnAdvance]);

  // Customer-facing rows for the CAF step's "Key Information" panel - the
  // screen the CUSTOMER actually reviews before signing, distinct from the
  // agent-only <dl> below. Only published once the catalogue reads have
  // landed, so that panel never shows a summary with "-" where a plan name
  // belongs.
  //
  // Reworked 2026-09-28 ("Ensure all relevant commercial and billing
  // information is visible to the customer in the confirmation view, not
  // only in the agent view") - this used to be a shorter recap (no SIM
  // details, no split-out lock-ins/charges, and it carried Credit limit/Bill
  // limit, which are operational figures for the agent to manage, not facts
  // the customer signs against). Customer ID Number and VAT stay off this
  // panel for the same reason the agent's own <dl> omits the first and never
  // itemises the second as a standalone figure: every quoted price here is
  // already VAT-inclusive (see monthlyCharges), so a separate VAT line would
  // assert a second, uninclusive number alongside it.
  useEffect(() => {
    if (!onSummaryComputed || !plan) return;
    const simSerial = simType?.simSerial;
    const simIccid = simType?.simIccid;
    onSummaryComputed([
      { label: 'Customer Name', value: customerName ?? '-' },
      { label: 'Selected Number', value: msisdn ? `${msisdn} (${isStarNumber ? 'Star' : 'Free'})` : '-' },
      // The number's own catalogue value, separate from what it's actually
      // BILLED at (that's Star Number Charges below, net of BR-115's
      // entitlement) - a free-tier number still has a real catalogue price
      // (2026-09-28 "show its actual price"), it's simply not charged.
      {
        label: 'Number Value',
        value: msisdn ? (isStarNumber ? `QR ${numberDelta} one-time` : `QR ${numberDelta} (no charge to customer)`) : '-',
      },
      { label: 'Plan', value: plan.name },
      { label: 'Plan Price', value: `QR ${plan.mrcQAR}/mo` },
      {
        label: 'Discount',
        value: discount
          ? `${discount.name} (${Math.round(Math.abs(discount.price) * 100)}%) - ${formatQar(charges.discountQar, 'QR')}/mo`
          : 'None',
      },
      {
        label: 'Discount Duration',
        value: discount ? (discount.durationMonths ? `${discount.durationMonths} months` : 'No expiry') : 'N/A',
      },
      { label: 'Add-ons', value: addons.length ? addons.map((a) => `${a.name} (QR ${a.mrcQAR}/mo)`).join(', ') : 'None' },
      { label: 'SIM Type', value: simType?.simType ?? '-' },
      {
        label: 'SIM Number / ICCID',
        value:
          simType?.simType === 'Physical'
            ? simSerial
              ? `${simSerial}${simIccid ? ` (ICCID: ${simIccid})` : ''}`
              : '-'
            : // The eSIM's activation code is deliberately NOT read back here -
              // it is the same string that generates the QR, and this journey's
              // own rule is that nothing eSIM-shaped is shown active before
              // payment (SimTypeStep's own note). Confirming issuance without
              // printing the code keeps that true on this panel too.
              simType?.simType === 'eSIM'
              ? 'eSIM - active after payment and order submission'
              : '-',
      },
      { label: 'Plan Lock-in', value: plan.commitmentMonths ? `${plan.commitmentMonths} months` : 'No lock-in' },
      ...(isStarNumber
        ? [
            {
              label: 'Star Number Lock-in',
              value: starTier ? `${starTier.lockInDurationMonths} months` : 'Not yet banded - confirm before signature',
            },
            {
              label: 'Star Number Charges',
              value:
                starEntitlementQar !== undefined && numberChargeQar > 0
                  ? `QR ${numberChargeQar} (QR ${numberDelta} sticker price, QR ${starEntitlementQar} entitled on this plan)`
                  : `No extra charge${starEntitlementQar !== undefined ? ` - within the QR ${starEntitlementQar} plan entitlement` : ''}`,
            },
          ]
        : []),
      {
        label: 'Key Charges',
        value: `QR ${dueTodayQar} today · QR ${firstBill.totalQar} first bill · QR ${monthlyRecurringQar}/mo thereafter`,
      },
      {
        label: 'Cancellation Implications',
        value:
          [
            plan.commitmentMonths
              ? `Ending the plan before ${plan.commitmentMonths} months incurs early-termination charges.`
              : null,
            isStarNumber && starTier?.lockInDurationMonths
              ? `The star number carries a separate ${starTier.lockInDurationMonths}-month lock-in.`
              : null,
          ]
            .filter(Boolean)
            .join(' ') || 'No lock-in - this order can be cancelled anytime without early-termination charges.',
      },
      {
        label: 'Total Payable Today',
        value: `QR ${dueTodayQar}${
          [
            hrnAdvance > 0 ? `QR ${hrnAdvance} HRN advance` : null,
            isStarNumber && numberChargeQar > 0 ? `QR ${numberChargeQar} Star Number charge` : null,
          ].filter(Boolean).length
            ? ` (includes ${[
                hrnAdvance > 0 ? `QR ${hrnAdvance} HRN advance` : null,
                isStarNumber && numberChargeQar > 0 ? `QR ${numberChargeQar} Star Number charge` : null,
              ]
                .filter(Boolean)
                .join(' + ')})`
            : ''
        }`,
      },
      {
        label: 'Prorated First Bill',
        value: `QR ${firstBill.totalQar} (${firstBill.proratedDays} of ${firstBill.cycleDays} days this cycle, plus one month in advance)`,
      },
      { label: 'Approximate Subsequent Bill', value: `QR ${monthlyRecurringQar}/mo` },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    customerName,
    plan?.productId,
    discount?.addonDiscountId,
    discount?.durationMonths,
    addons.length,
    msisdn,
    numberDelta,
    dueTodayQar,
    monthlyRecurringQar,
    starTier?.tierId,
    simType?.simType,
    simType?.simSerial,
    simType?.simIccid,
  ]);

  const Row = ({ label, value, detail }: { label: string; value: string; detail?: string }) => (
    <div className="flex justify-between gap-4 py-2 border-b border-border-soft last:border-0">
      <dt className="text-fg-2">{label}</dt>
      <dd className="text-fg text-right">
        {value}
        {detail && <span className="block text-[length:var(--fs-caption)] text-muted">{detail}</span>}
      </dd>
    </div>
  );

  // Number's own detail line (2026-09-28): status, Star value, the number's
  // OWN discount and its lock-in all together, rather than scattered across a
  // separate "Order summary" recap box (now retired - see below). "Discount:
  // None" is stated explicitly rather than omitted: no per-number discount
  // concept exists anywhere in the catalogue (numbers.json/star-number-
  // tiers.json carry no discount field), and the plan discount above applies
  // to the recurring MRC, not this one-time figure - so the honest answer is
  // "none", not silence that could read as an unanswered question.
  const numberDetail = msisdn
    ? [
        isStarNumber ? `Star value QR ${numberDelta} one-time` : null,
        // BR-115 entitlement/overage, stated either way rather than only when
        // it bites - "no extra charge" is as much a fact the agent should be
        // able to read back as "QR X extra" is.
        isStarNumber && starEntitlementQar !== undefined
          ? numberChargeQar > 0
            ? `QR ${numberChargeQar} extra beyond the QR ${starEntitlementQar} plan entitlement`
            : `Within the QR ${starEntitlementQar} plan entitlement - no extra charge`
          : null,
        'Discount: None',
        isStarNumber
          ? starTier
            ? `${starTier.lockInDurationMonths}-month lock-in`
            : 'Lock-in not banded - confirm before signature'
          : 'No lock-in',
      ]
        .filter(Boolean)
        .join(' · ')
    : undefined;

  return (
    <div className="space-y-4">
      {/* Edit (2026-09-28): returns to Plan & Add-ons via the wizard's
          goToStepKey rather than a bespoke navigation path - the agent then
          walks Continue back through Number/SIM Type as normal, both of
          which keep their prior values, landing back here unchanged. */}
      <div className="flex items-center justify-between">
        <p className="text-fg-2 text-[length:var(--fs-caption)]">Review with the customer before generating the CAF.</p>
        <Button variant="ghost-rect" compact onClick={onEdit}>
          Edit
        </Button>
      </div>

      <dl className="rounded-[var(--radius-card)] border border-border-soft bg-surface p-4">
        {/* Row order follows the supplied summary mockup: who they are, how we
            identify and reach them, what they bought, how they pay, then
            hardware. Add-ons always renders, showing "None" rather than
            disappearing: an absent row reads as an unanswered question.

            Customer ID Number, Customer Contact Number and SIM Type are
            deliberately absent (2026-09-28 request) - only Customer Name and
            the Alternate phone # (the service-notification contact, labelled
            to match the Contact step exactly) identify the customer here. */}
        <Row label="Customer Name" value={customerName ?? '-'} />
        <Row label="Alternate phone #" value={altPhone ?? '-'} />
        {/* Plan and Discount are separate line items (2026-09-28), each
            carrying its own validity period as a detail line rather than
            leaving lock-in/duration to a separate recap box. */}
        <Row
          label="Plan"
          value={plan ? `${plan.name} - QR ${plan.mrcQAR}/mo` : '-'}
          detail={plan ? (plan.commitmentMonths ? `${plan.commitmentMonths}-month lock-in` : 'No lock-in') : undefined}
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
            detail={discount.durationMonths ? `Valid ${discount.durationMonths} months` : 'No expiry'}
          />
        )}
        {/* Every activated add-on, its price, AND its data allowance where the
            catalogue carries one (2026-09-28) - none of the seeded Add-on
            products currently do (International 50 is minutes-only), so
            nothing visibly changes today, but an add-on that does carry one
            reads it back here rather than only its price. */}
        <Row
          label="Add-ons"
          value={
            addons.length
              ? addons
                  .map((a) => `${a.name} (QR ${a.mrcQAR}/mo${a.dataAllowanceGB ? `, ${a.dataAllowanceGB} GB` : ''})`)
                  .join(', ')
              : 'None'
          }
        />
        {/* The number now carries everything about it in one place: status
            (Free/Star), its own value, its own discount, and its own
            lock-in - see numberDetail above. */}
        <Row label="Number" value={msisdn ? `${msisdn} - ${isStarNumber ? 'Star' : 'Free'}` : '-'} detail={numberDetail} />
        {creditLimitQar !== undefined && <Row label="Credit limit" value={`QR ${creditLimitQar}`} />}
        {/* Bill limit (2026-09-28): the agent's own figure from Plan &
            Add-ons' BillLimitEditor once they have set one, falling back to
            stating the credit-limit cap when they have not - never a made-up
            number, and never silently absent. */}
        {creditLimitQar !== undefined && (
          <Row
            label="Bill limit"
            value={billLimit !== undefined ? `QR ${billLimit}` : `Up to QR ${creditLimitQar}`}
            detail={`Capped at the QR ${creditLimitQar} credit limit`}
          />
        )}
        {/* Conditional: the postpaid journey dropped its Billing step on
            2026-09-25, so there is nothing to report there. Other journeys
            that still collect one are unaffected. */}
        {billingMethod && <Row label="Billing" value={billingMethod} />}
        {/* The tax is on the read-back because the monthly figure below
            includes it - an agent reading out a total they cannot account for
            from the rows above has nothing to answer "why?" with. */}
        <Row label={`VAT (${Math.round(VAT_RATE * 100)}%)`} value={`${formatQar(charges.vatQar, 'QR')}/mo`} />
        {/* HRN (High Risk Nationality) advance payment - system-derived from
            the customer's nationality, not agent- or customer-entered, and
            surfaced here (rather than a separate customer-input placeholder)
            because there is nothing for either party to fill in: this is the
            consequence of that classification, not a form field. */}
        {hrnAdvance > 0 && <Row label="HRN advance payment" value={`QR ${hrnAdvance}`} />}
      </dl>

      <div className="rounded-[var(--radius-card)] border border-accent/40 bg-surface-warm p-4 space-y-1">
        {/* Due today itemised (2026-09-28): the bold total, then its two
            possible components broken out underneath, so the figure above is
            never one number the agent cannot account for. Either line is
            absent when it contributes nothing - a QR 0 row would answer a
            question nobody asked. */}
        <div className="flex justify-between text-fg font-semibold">
          <span>Due today</span>
          <span>QR {dueTodayQar}</span>
        </div>
        {isStarNumber && (
          <div className="flex justify-between text-fg-2 text-[length:var(--fs-caption)]">
            <span>
              Star Number charge
              {/* BR-115: only shown when there actually IS an overage - a QR 0
                  caption under a QR 0 charge answers a question nobody asked,
                  same reasoning as the rest of this itemisation. */}
              {starEntitlementQar !== undefined && numberChargeQar > 0 && (
                <span className="block text-muted">
                  QR {numberDelta} sticker price, QR {starEntitlementQar} entitled on this plan
                </span>
              )}
            </span>
            <span>QR {numberChargeQar}</span>
          </div>
        )}
        {hrnAdvance > 0 && (
          <div className="flex justify-between text-fg-2 text-[length:var(--fs-caption)]">
            <span>Upfront / HRN fee</span>
            <span>QR {hrnAdvance}</span>
          </div>
        )}
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
            First month's bill (approximate)
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
        {/* Reserved space (2026-09-28 request) for a full second-bill
            breakdown - deliberately NOT designed yet. This is a placeholder
            marking where that content will go, not a stand-in figure: no
            itemisation is invented here the way the rows above never invent
            one either. */}
        <div className="rounded-[var(--radius-sm)] border border-dashed border-border-soft p-3 mt-1">
          <p className="text-fg-2 text-[length:var(--fs-caption)] font-medium">Full second-bill breakdown</p>
          <p className="text-muted text-[length:var(--fs-caption)]">Reserved - detailed content not yet designed.</p>
        </div>
      </div>
    </div>
  );
}
