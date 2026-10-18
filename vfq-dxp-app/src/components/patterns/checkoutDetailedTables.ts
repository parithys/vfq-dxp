import { formatQar, VAT_RATE } from '../../engines/postpaidPricing';
import type { SimTypeValue } from '../domain/SimTypeStep';
import type { SummaryTable } from './CheckoutSummaryTables';
import type { CheckoutSummaryDerived } from './useCheckoutSummary';

interface DetailedTablesArgs extends CheckoutSummaryDerived {
  customerName: string | undefined;
  msisdn: string | undefined;
  billLimit: number | undefined;
  simType: SimTypeValue | undefined;
}

// The 'detailed' layout's read-back: the Order Summary, the Upfront Charges (what is paid at the counter today) and the
// Approximate Bill Explainer.
export function buildDetailedTables({
  plan,
  addons,
  discount,
  numberDelta,
  hrnAdvance,
  isStarNumber,
  starTier,
  starEntitlementQar,
  numberChargeQar,
  dueTodayQar,
  creditLimitQar,
  charges,
  monthlyRecurringQar,
  firstBill,
  customerName,
  msisdn,
  billLimit,
  simType,
}: DetailedTablesArgs): SummaryTable[] {
  const ratio = firstBill.cycleDays ? firstBill.proratedDays / firstBill.cycleDays : 0;
  // Both partial lines are VAT-inclusive, like every other quoted figure, and
  // add up to the prorated part of the first bill.
  const partialPlanQar = Math.round((charges.planQar - charges.discountQar) * (1 + VAT_RATE) * ratio * 100) / 100;
  const partialAddonQar = Math.round((firstBill.proratedQar - partialPlanQar) * 100) / 100;
  // BR-115: the entitlement waives up to this much of the number's value; what
  // is waived is also the part the lock-in is held against.
  // Star numbers only: a non-star number is charged at its own price here, so no
  // entitlement discount is shown against it.
  const discountValueQar = isStarNumber && starEntitlementQar !== undefined ? Math.min(numberDelta, starEntitlementQar) : 0;
  const lockInValueQar = isStarNumber ? discountValueQar : 0;
  const q = (n: number) => formatQar(n);
  const billRows: { label: string; value: string; detail?: string }[] = [
    { label: 'Plan Rental', value: q(charges.planQar) },
    {
      label: 'Discounts',
      value: discount
        ? `${q(charges.discountQar)}${discount.durationMonths ? ` for first ${discount.durationMonths} months` : ' (no expiry)'}`
        : 'None',
    },
    { label: 'Pro rated charges', value: q(partialPlanQar) },
    { label: 'Pro-rated Add-On charges', value: q(partialAddonQar) },
    { label: 'Monthly Bill Cycle', value: '1st of every-month' },
    { label: 'Approximate first bill amount', value: q(firstBill.totalQar) },
    { label: 'Approximate second bill amount', value: q(monthlyRecurringQar) },
    // VAT is part of how the bill is built up, so it sits in the explainer (it was a line of the order summary).
    { label: `VAT (${Math.round(VAT_RATE * 100)}%)`, value: `${formatQar(charges.vatQar)}/mo` },
  ];
  // Order Summary and Approximate Bill Explainer, each fact once: the number's value, discount and lock-ins, the plan and
  // its lock-in, the add-ons, SIM type and limits; and the bill build-up ending in Total Payable Today (so there is no
  // separate "Due today" box restating the number charge).
  const tables: SummaryTable[] = [
    {
      title: 'Order Summary',
      rows: [
        { label: 'Customer Name', value: customerName ?? '-' },
        { label: 'Selected Number', value: msisdn ? `${msisdn} (${isStarNumber ? 'Star' : 'Free'})` : '-', boldValue: true },
        { label: 'Number Value', value: q(numberDelta) },
        { label: 'Number Discount Value', value: q(discountValueQar) },
        { label: 'Number Lock-in Value:', value: q(lockInValueQar) },
        ...(isStarNumber
          ? [{ label: 'Star Number Lock-in', value: starTier ? `${starTier.lockInDurationMonths} months` : 'Not yet banded - confirm before signature' }]
          : []),
        { label: 'Plan', value: plan?.name ?? '-' },
        { label: 'Lock-in Period', value: plan?.commitmentMonths ? `${plan.commitmentMonths} months` : 'No lock-in' },
        { label: 'Add-ons', value: addons.length ? addons.map((a) => `${a.name} (QAR ${a.mrcQAR}/mo)`).join(', ') : 'None' },
        { label: 'SIM Type', value: simType?.simType ?? '-' },
        ...(creditLimitQar !== undefined
          ? [
              { label: 'Credit limit', value: `QAR ${creditLimitQar}`, boldLabel: true },
              { label: 'Bill limit', value: billLimit !== undefined ? `QAR ${billLimit}` : `Up to QAR ${creditLimitQar}`, boldLabel: true },
            ]
          : []),
      ],
    },
    {
      // What the customer pays at the counter today; the Total Payable Today line that used to end the explainer lives here.
      title: 'Upfront Charges',
      rows: [
        { label: 'Number Charge After Discount', value: q(numberChargeQar) },
        { label: 'HRN Advance', value: q(hrnAdvance) },
        { label: 'Total Payable Today', value: q(dueTodayQar), boldLabel: true, boldValue: true },
      ],
    },
    {
      title: 'Approximate Bill Explainer',
      rows: billRows,
    },
  ];
  return tables;
}
