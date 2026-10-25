import type { GuidedContactValue } from '../../capabilities';
import type { CustomerTypeValue } from '../../capabilities/CustomerType/customerTypeModel';
import type { EligibilityResult } from '../../components/domain/eligibilityTypes';
import { SUPPORTING_ID_DISCOUNT_TYPES } from '../../components/patterns/postpaidPlanModel';

/**
 * Whether the order is a B2B2C one: the customer type the agent accepted is B2B2C, or - when no customer type was chosen at all - the
 * employer on the registry record says so. A customer type chosen as Standard (or the benefit rejected) decides it: an employer on the
 * record does not make a Standard customer's order B2B2C.
 */
export function isB2B2COrder(contact: Pick<GuidedContactValue, 'isB2B2C'>, customerType: CustomerTypeValue | undefined): boolean {
  if (customerType?.type === 'b2b2c') return !customerType.rejected;
  return customerType?.type === undefined && Boolean(contact.isB2B2C);
}

/**
 * Whether an order is held for manager approval rather than completing (the one rule New Mobile Postpaid, MNP, Pre-to-Post and the line-change
 * journeys share): an identity entered by hand, a B2B2C customer, an HRN advance payment, an eligibility check that routes to approval, or a
 * MADA / B2B2C discount (its supporting document is verified first).
 */
export function routesToApproval(args: {
  contact: GuidedContactValue;
  eligibility: EligibilityResult | undefined;
  customerType: CustomerTypeValue | undefined;
  /** The discount chosen, by its type (addons-discounts `addonType`). */
  discountType?: string;
  /**
   * The order is for a prepaid line. Prepaid has no HRN approval and no B2B2C or special-discount routing (Mobile Prepaid BRSD CAM_03 / CAM_04; the
   * same reading submitPrepaidOrder and submitMnpOrder apply): only an identity entered by hand and the eligibility checks' own approval routes hold it.
   */
  prepaid?: boolean;
}): boolean {
  const { contact, eligibility, customerType, discountType, prepaid } = args;
  const byHand = Boolean(contact.manualEntry);
  const byEligibility = Boolean(eligibility?.checks.some((c) => c.outcome === 'approval-routing'));
  if (prepaid) return byHand || byEligibility;
  return (
    byHand ||
    isB2B2COrder(contact, customerType) ||
    Boolean(eligibility?.requiresHrnAdvance) ||
    byEligibility ||
    SUPPORTING_ID_DISCOUNT_TYPES.has(discountType ?? '')
  );
}
