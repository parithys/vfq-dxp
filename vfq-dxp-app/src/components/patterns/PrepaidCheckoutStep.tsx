import { useEffect, useState } from 'react';
import * as mockDataEngine from '../../engines/mockDataEngine';
import { evaluateRule } from '../../engines/ruleEngine';
import type { SimTypeValue } from '../domain/SimTypeStep';

interface Product {
  productId: string;
  name: string;
  starterPackChargeQAR: number;
}

interface Discount {
  addonDiscountId: string;
  name: string;
  price: number;
  planId: string;
}

interface SimRecord {
  simSerial: string;
  iccid: string;
}

export interface PrepaidCheckoutTotals {
  starterPackChargeQar: number;
  simCardChargeQar: number;
  numberPriceQar: number;
  totalDueQar: number;
}

// The BRSD doesn't name a SIM card charge amount anywhere (no P-parameter
// covers it) — BR-348/BR-013 only decides whether a charge applies. QAR 15
// is a placeholder pending VFQ confirmation, not sourced from the BRSD.
const SIM_CARD_CHARGE_QAR = 15;

interface PrepaidCheckoutStepProps {
  customerName: string | undefined;
  idType: string | undefined;
  planProductId: string | undefined;
  discountId: string | undefined;
  msisdn: string | undefined;
  numberPriceQar: number | undefined;
  simType: SimTypeValue | undefined;
  onTotalsComputed: (totals: PrepaidCheckoutTotals) => void;
}

// MPRA_001_CVC_01–03 (Cart Validation & Check-Out, Starter pack & recharge
// charge collection, Payment summary display) — a prepaid-specific
// checkout/payment-summary screen. Deliberately not a reuse of
// CheckoutSummaryStep: that component is wired to postpaid-only concepts
// (Device on Installment, HRN advance payment) that don't apply here per
// BR-002/BR-005/CAM_04, and prepaid needs a charge CheckoutSummaryStep has
// no concept of at all (the BR-013/BR-348 SIM card charge).
export function PrepaidCheckoutStep({
  customerName,
  idType,
  planProductId,
  discountId,
  msisdn,
  numberPriceQar,
  simType,
  onTotalsComputed,
}: PrepaidCheckoutStepProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [sims, setSims] = useState<SimRecord[]>([]);

  useEffect(() => {
    mockDataEngine.list<Product>('products').then(setProducts);
    mockDataEngine.list<Discount>('addons-discounts').then(setDiscounts);
    mockDataEngine.list<SimRecord>('sims').then(setSims);
  }, []);

  const plan = products.find((p) => p.productId === planProductId);
  const discount = discounts.find((d) => d.addonDiscountId === discountId);
  const starterPackChargeQar = plan ? Math.round(plan.starterPackChargeQAR * (1 + (discount?.price ?? 0))) : 0;
  const simCardRule = evaluateRule('BR-348', { idType, rechargeAmountQar: starterPackChargeQar });
  const simCardChargeQar = simCardRule.pass ? 0 : SIM_CARD_CHARGE_QAR;
  const numberDelta = numberPriceQar ?? 0;
  const totalDueQar = starterPackChargeQar + simCardChargeQar + numberDelta;
  // DF-16 (SIM data group) requires ICCID alongside SIM Type/Serial — resolved
  // from the same sims.json record SimSerialScanner already validated against.
  // eSIM has no backing inventory record to resolve an ICCID from (see
  // SimTypeStep — no fabricated eSIM provisioning API), so it reads "Not
  // applicable" rather than a fabricated value.
  const resolvedIccid = simType?.simType === 'Physical' ? sims.find((s) => s.simSerial === simType.simSerial)?.iccid : undefined;

  useEffect(() => {
    onTotalsComputed({ starterPackChargeQar, simCardChargeQar, numberPriceQar: numberDelta, totalDueQar });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [starterPackChargeQar, simCardChargeQar, numberDelta, totalDueQar]);

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
        <Row label="Pack" value={plan ? `${plan.name} — QR ${starterPackChargeQar}` : 'SIM only, no pack selected'} />
        <Row label="Number" value={msisdn ? `${msisdn}${numberDelta > 0 ? ` (premium, QR ${numberDelta} one-time)` : ''}` : '—'} />
        <Row label="SIM Type" value={simType?.simType ?? '—'} />
        <Row label="ICCID" value={simType?.simType === 'eSIM' ? 'Not applicable (eSIM)' : (resolvedIccid ?? '—')} />
        <Row label="SIM Card Charge" value={simCardChargeQar > 0 ? `QR ${simCardChargeQar}` : 'Waived'} />
      </dl>

      <p className="text-[length:var(--fs-caption)] text-muted">{simCardRule.message}</p>

      <div className="rounded-[var(--radius-card)] border border-accent/40 bg-surface-warm p-4">
        <div className="flex justify-between text-fg font-semibold">
          <span>Total due today</span>
          <span>QR {totalDueQar}</span>
        </div>
      </div>
    </div>
  );
}
