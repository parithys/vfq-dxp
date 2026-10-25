import { formatQar } from '../../engines/postpaidPricing';
import type { SimTypeValue } from '../domain/SimTypeStep';
import type { Product, StarNumberTier } from './checkoutSummaryModel';
import type { CheckoutSummaryDerived } from './useCheckoutSummary';

interface CafSummaryRowsArgs
  extends Pick<
    CheckoutSummaryDerived,
    | 'discount'
    | 'addons'
    | 'isStarNumber'
    | 'numberDelta'
    | 'starEntitlementQar'
    | 'numberChargeQar'
    | 'dueTodayQar'
    | 'hrnAdvance'
    | 'firstBill'
    | 'monthlyRecurringQar'
    | 'charges'
  > {
  plan: Product;
  customerName: string | undefined;
  msisdn: string | undefined;
  simType: SimTypeValue | undefined;
  starTier: StarNumberTier | undefined;
}

// Customer-facing rows for the CAF step's "Key Information" panel.
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
export function buildCafSummaryRows({
  plan,
  customerName,
  msisdn,
  simType,
  discount,
  addons,
  isStarNumber,
  numberDelta,
  starTier,
  starEntitlementQar,
  numberChargeQar,
  dueTodayQar,
  hrnAdvance,
  firstBill,
  monthlyRecurringQar,
  charges,
}: CafSummaryRowsArgs): { label: string; value: string }[] {
  const simSerial = simType?.simSerial;
  const simIccid = simType?.simIccid;
  return [
    { label: 'Customer Name', value: customerName ?? '-' },
    { label: 'Selected Number', value: msisdn ? `${msisdn} (${isStarNumber ? 'Star' : 'Free'})` : '-' },
    // The number's own catalogue value, separate from what it's actually
    // BILLED at (that's Star Number Charges below, net of BR-115's
    // entitlement) - a free-tier number still has a real catalogue price
    // (2026-09-28 "show its actual price"), it's simply not charged.
    {
      label: 'Number Value',
      value: msisdn ? (isStarNumber ? `QAR ${numberDelta} one-time` : `QAR ${numberDelta} (no charge to customer)`) : '-',
    },
    { label: 'Plan', value: plan.name },
    { label: 'Plan Price', value: `QAR ${plan.mrcQAR}/mo` },
    {
      label: 'Discount',
      value: discount
        ? `${discount.name} (${Math.round(Math.abs(discount.price) * 100)}%) - ${formatQar(charges.discountQar)}/mo`
        : 'None',
    },
    {
      label: 'Discount Duration',
      value: discount ? (discount.durationMonths ? `${discount.durationMonths} months` : 'No expiry') : 'N/A',
    },
    { label: 'Add-Ons', value: addons.length ? addons.map((a) => `${a.name} (QAR ${a.mrcQAR}/mo)`).join(', ') : 'None' },
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
    { label: 'Plan Lock-In', value: plan.commitmentMonths ? `${plan.commitmentMonths} months` : 'No lock-in' },
    ...(isStarNumber
      ? [
          {
            label: 'Star Number Lock-In',
            value: starTier ? `${starTier.lockInDurationMonths} months` : 'To be confirmed',
          },
          {
            label: 'Star Number Charges',
            value:
              starEntitlementQar !== undefined && numberChargeQar > 0
                ? `QAR ${numberChargeQar} (QAR ${numberDelta} sticker price, QAR ${starEntitlementQar} entitled on this plan)`
                : `No extra charge${starEntitlementQar !== undefined ? ` - within the QAR ${starEntitlementQar} plan entitlement` : ''}`,
          },
        ]
      : []),
    {
      label: 'Key Charges',
      value: `QAR ${dueTodayQar} today · QAR ${firstBill.totalQar} first bill · QAR ${monthlyRecurringQar}/mo thereafter`,
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
      value: `QAR ${dueTodayQar}${
        [
          hrnAdvance > 0 ? `QAR ${hrnAdvance} HRN advance` : null,
          isStarNumber && numberChargeQar > 0 ? `QAR ${numberChargeQar} Star Number charge` : null,
        ].filter(Boolean).length
          ? ` (includes ${[
              hrnAdvance > 0 ? `QAR ${hrnAdvance} HRN advance` : null,
              isStarNumber && numberChargeQar > 0 ? `QAR ${numberChargeQar} Star Number charge` : null,
            ]
              .filter(Boolean)
              .join(' + ')})`
          : ''
      }`,
    },
    {
      label: 'Prorated First Bill',
      value: `QAR ${firstBill.totalQar} (${firstBill.proratedDays} of ${firstBill.cycleDays} days this cycle)`,
    },
    { label: 'Approximate Subsequent Bill', value: `QAR ${monthlyRecurringQar}/mo` },
  ];
}
