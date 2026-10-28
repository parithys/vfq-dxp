import { defaultBillLimitQar, formatQar, VAT_RATE } from '../../engines/postpaidPricing';
import { numberWaiverLabel } from '../../engines/numberWaiver';
import type { SimTypeValue } from '../domain/SimTypeStep';
import type { SummaryTable } from './CheckoutSummaryTables';
import type { CheckoutSummaryDerived } from './useCheckoutSummary';
import { formatQarAny } from '../../lib/format';
import { toLocalMsisdn } from '../domain/msisdnPickerModel';

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
  numberWaiver,
  numberWaivedQar,
  numberPayableQar,
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
    { label: 'Pro Rated Charges', value: q(partialPlanQar) },
    { label: 'Pro-Rated Add-On Charges', value: q(partialAddonQar) },
    { label: 'Monthly Bill Cycle', value: '1st of every-month' },
    { label: 'Approximate First Bill Amount', value: q(firstBill.totalQar) },
    { label: 'Approximate Second Bill Amount', value: q(monthlyRecurringQar) },
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
        { label: 'Selected Number', value: msisdn ? `${toLocalMsisdn(msisdn)} (${isStarNumber ? 'Star' : 'Free'})` : '-', boldValue: true },
        { label: 'Number Value', value: q(numberDelta) },
        { label: 'Number Discount Value', value: q(discountValueQar) },
        { label: 'Number Lock-in Value:', value: q(lockInValueQar) },
        ...(isStarNumber
          ? [{ label: 'Star Number Lock-In', value: starTier ? `${starTier.lockInDurationMonths} months` : 'To be confirmed' }]
          : []),
        { label: 'Plan Name', value: plan?.name ?? '-' },
        { label: 'Star Number Lock-In', value: plan?.commitmentMonths ? `${plan.commitmentMonths} months` : 'No lock-in' },
        { label: 'Add-Ons', value: addons.length ? addons.map((a) => `${a.name} (${formatQar(a.mrcQAR)}/mo)`).join(', ') : 'None' },
        { label: 'SIM Type', value: simType?.simType ?? '-' },
        ...(simType?.simType === 'Physical' ? [{ label: 'SIM Serial Number', value: simType.simSerial ?? '-' }] : []),
        ...(creditLimitQar !== undefined
          ? [
              { label: 'Credit Limit', value: `${formatQar(creditLimitQar)}`, boldLabel: true, agentOnly: true },
              { label: 'Bill Limit', value: billLimit !== undefined || plan?.mrcQAR !== undefined ? `${formatQarAny(billLimit ?? (plan ? defaultBillLimitQar(plan.mrcQAR, creditLimitQar) : plan))}` : `Up to ${formatQarAny(creditLimitQar)}`, boldLabel: true, agentOnly: true },
            ]
          : []),
      ],
    },
    {
      // What the customer pays at the counter today; the Total Payable Today line that used to end the explainer lives here.
      title: 'Upfront Charges',
      rows: [
        // Waive Off (Number Selection): the charge, what was waived and what is left, so the Total Payable Today can be followed line by line.
        ...(numberWaiver && numberWaivedQar > 0
          ? [
              { label: 'Number Upfront Charge', value: q(numberChargeQar) },
              { label: numberWaiverLabel(numberWaiver), value: `- ${q(numberWaivedQar)}` },
              { label: 'Number Charge After Waiver', value: q(numberPayableQar) },
            ]
          : [{ label: 'Number Charge After Discount', value: q(numberChargeQar) }]),
        { label: 'Advance Payment', value: q(hrnAdvance) },
        // The VAT contained in the number charge paid today (quoted figures are VAT-inclusive); the advance payment is a deposit, not a taxable charge.
        { label: `VAT (${Math.round(VAT_RATE * 100)}%)`, value: q(Math.round((numberPayableQar - numberPayableQar / (1 + VAT_RATE)) * 100) / 100) },
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
