import { useEffect, useState } from 'react';
import * as mockDataEngine from '../../engines/mockDataEngine';
import { monthlyCharges, firstBillCharges, HRN_ADVANCE_QAR, FREE_NUMBER_PRICE_CEILING_QAR, starNumberOverageQar, starEntitlementQar as planStarEntitlementQar } from '../../engines/postpaidPricing';
import type { EligibilityResult } from '../domain/eligibilityTypes';
import type { SimTypeValue } from '../domain/SimTypeStep';
import type { Product, StarNumberTier, CheckoutTotals, TncLegalFacts } from './checkoutSummaryModel';
import { buildCafSummaryRows } from './checkoutSummaryRows';

interface UseCheckoutSummaryArgs {
  customerName: string | undefined;
  productId: string | undefined;
  discountId: string | undefined;
  addonIds: string[];
  msisdn: string | undefined;
  numberPriceQar: number | undefined;
  eligibility: EligibilityResult | undefined;
  simType: SimTypeValue | undefined;
  onTotalsComputed: (totals: CheckoutTotals) => void;
  onSummaryComputed?: (rows: { label: string; value: string }[]) => void;
  onLegalFactsComputed?: (facts: TncLegalFacts) => void;
}

export type CheckoutSummaryDerived = ReturnType<typeof useCheckoutSummary>;

// Catalogue reads, the shared pricing derivation and the three publish-
// upward effects (totals, legal facts, customer-facing summary rows) for the
// Checkout step. Hook order is exactly the original component's.
export function useCheckoutSummary({
  customerName,
  productId,
  discountId,
  addonIds,
  msisdn,
  numberPriceQar,
  eligibility,
  simType,
  onTotalsComputed,
  onSummaryComputed,
  onLegalFactsComputed,
}: UseCheckoutSummaryArgs) {
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
  const starEntitlementQar = plan ? planStarEntitlementQar(plan) : undefined;
  const numberChargeQar = isStarNumber && plan ? starNumberOverageQar(plan.mrcQAR, numberDelta, planStarEntitlementQar(plan)) : numberDelta;
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
  // belongs. (Row content: see buildCafSummaryRows.)
  useEffect(() => {
    if (!onSummaryComputed || !plan) return;
    onSummaryComputed(
      buildCafSummaryRows({
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
      })
    );
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

  return {
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
  };
}
