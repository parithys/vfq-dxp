import { formatQar, VAT_RATE } from '../../engines/postpaidPricing';
import type { SimTypeValue } from '../domain/SimTypeStep';
import type { SummaryTable } from './CheckoutSummaryTables';
import type { CheckoutSummaryDerived } from './useCheckoutSummary';

interface DetailedTablesArgs extends CheckoutSummaryDerived {
  customerName: string | undefined;
  altPhone: string | undefined;
  billingMethod: string | undefined;
  msisdn: string | undefined;
  billLimit: number | undefined;
  simType: SimTypeValue | undefined;
}

// The 'detailed' layout's three-table read-back (summary, Due today,
// Approximate Bill Explainer) plus the CAF step's own customer-facing tables.
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
  creditLimitQar,
  charges,
  monthlyRecurringQar,
  firstBill,
  customerName,
  altPhone,
  billingMethod,
  msisdn,
  billLimit,
  simType,
}: DetailedTablesArgs): { tables: SummaryTable[]; cafTables: SummaryTable[] } {
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
  const q = (n: number) => formatQar(n, 'QAR');
  const numberRows: { label?: string; value: string }[] = msisdn
    ? [
        { label: 'Number', value: `${msisdn} (${isStarNumber ? 'Star' : 'Free'})` },
        { value: `Number Value ${q(numberDelta)}` },
        { value: `Discount Value: ${q(discountValueQar)}` },
        { value: `Lock-in Value: ${q(lockInValueQar)}` },
        {
          value: isStarNumber
            ? starTier
              ? `lock-in: ${starTier.lockInDurationMonths}-months`
              : 'lock-in: not yet banded - confirm before signature'
            : 'lock-in: none',
        },
      ]
    : [{ label: 'Number', value: '-' }];
  const summaryRows: { label?: string; value: string }[] = [
    { label: 'Customer Name', value: customerName ?? '-' },
    { label: 'Alternate phone #', value: altPhone || '-' },
    { label: 'Plan', value: plan?.name ?? '-' },
    {
      label: 'Add-ons',
      value: addons.length ? addons.map((a) => `${a.name} (QR ${a.mrcQAR}/mo)`).join(', ') : 'None',
    },
    ...numberRows,
    ...(creditLimitQar !== undefined
      ? [
          { label: 'Credit limit', value: `QR ${creditLimitQar}` },
          { label: 'Bill limit', value: billLimit !== undefined ? `QR ${billLimit}` : `Up to QR ${creditLimitQar}` },
        ]
      : []),
    ...(billingMethod ? [{ label: 'Billing', value: billingMethod }] : []),
    { label: `VAT (${Math.round(VAT_RATE * 100)}%)`, value: `${formatQar(charges.vatQar, 'QR')}/mo` },
  ];
  const dueRows: { label: string; value: string }[] = [
    ...(isStarNumber || numberChargeQar > 0
      ? [{ label: isStarNumber ? 'Star Number charge:' : 'Number charge:', value: `Due value ${q(numberChargeQar)}` }]
      : []),
    ...(hrnAdvance > 0 ? [{ label: 'HRN Fee', value: q(hrnAdvance) }] : []),
  ];
  if (dueRows.length === 0) dueRows.push({ label: 'Due value', value: q(0) });
  const billRows: { label: string; value: string; detail?: string }[] = [
    { label: 'Plan value', value: q(charges.planQar) },
    {
      label: 'Discount Value',
      value: discount
        ? `${q(charges.discountQar)}${discount.durationMonths ? ` for first ${discount.durationMonths} months` : ' (no expiry)'}`
        : 'None',
    },
    { label: 'Partial Plan Charge', value: q(partialPlanQar) },
    { label: 'Partial Add-on Charge', value: q(partialAddonQar) },
    { label: 'Monthly Bill Cycle', value: '1st of every-month' },
    {
      label: 'Approximate first bill amount',
      value: q(firstBill.totalQar),
      detail: 'Partial charges plus one month in advance',
    },
    { label: 'Approximate second bill amount', value: q(monthlyRecurringQar) },
  ];
  const tables: SummaryTable[] = [
    { boldLabels: true, rows: summaryRows },
    { title: 'Due today', rows: dueRows },
    { title: 'Approximate Bill Explainer', rows: billRows },
  ];
  // The customer-facing read-back for the CAF step: its own row set (no
  // alternate phone, plan/number lock-ins spelled out, Total Payable Today).
  const cafTables: SummaryTable[] = [
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
        { label: 'Plan Lock-in', value: plan?.commitmentMonths ? `${plan.commitmentMonths} months` : 'No lock-in' },
        { label: 'Add-ons', value: addons.length ? addons.map((a) => `${a.name} (QR ${a.mrcQAR}/mo)`).join(', ') : 'None' },
        { label: 'SIM Type', value: simType?.simType ?? '-' },
        ...(creditLimitQar !== undefined
          ? [
              { label: 'Credit limit', value: `QR ${creditLimitQar}`, boldLabel: true },
              { label: 'Bill limit', value: billLimit !== undefined ? `QR ${billLimit}` : `Up to QR ${creditLimitQar}`, boldLabel: true },
            ]
          : []),
        { label: `VAT (${Math.round(VAT_RATE * 100)}%)`, value: `${formatQar(charges.vatQar, 'QR')}/mo`, boldLabel: true },
      ],
    },
    {
      title: 'Approximate Bill Explainer',
      rows: [
        ...billRows,
        {
          label: 'Total Payable Today',
          value: `Due value ${q(numberChargeQar)}${hrnAdvance > 0 ? `, Upfront Charges: ${q(hrnAdvance)}` : ''}`,
        },
      ],
    },
  ];
  return { tables, cafTables };
}
