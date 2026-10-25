import type { WizardStep } from '../../components/patterns/wizard/guidedWizardTypes';
import type { CrossSalesValue } from '../../capabilities';
import type { CustomerBenefit } from '../../engines/customerBenefitEngine';
import {
  billingAccountStep,
  cafSignatureStep,
  checkoutSummaryStep,
  numberSelectionStep,
  paymentStep,
  postpaidExtrasStep,
  postpaidPlanStep,
  serviceAddressStep,
  simTypeStep,
  actualUserStep,
} from '../../capabilities';
import { starEntitlementQar } from '../../engines/postpaidPricing';
import type { Product } from './newConnectionModel';
import type { DeviceType } from '../../lib/deviceType';

/** What the postpaid steps need from the journey: the plan catalogue and the customer's benefits. */
export interface PostpaidStepContext {
  products: Product[];
  customerBenefits: CustomerBenefit[] | undefined;
  /** The device in use: makes the SIM serial scan-led on a tablet and type-led on the web (as the prepaid journey does). */
  device?: DeviceType;
}

// An accepted offer already fixes the plan, so the agent goes straight from the product step to Number Selection; with no
// accepted offer the full path runs.
const offerAccepted = (values: Record<string, unknown>) => (values.crossSales as CrossSalesValue | undefined)?.decision === 'accepted';

/**
 * The New Postpaid steps, after Customer Verification and Product Selection: Address, Billing Profile (resolved for the
 * agent), Plan and Add-ons, Number, SIM, Checkout, the full CAF and Payment, which submits.
 */
export function postpaidSteps({ products, customerBenefits, device }: PostpaidStepContext): WizardStep[] {
  const planContext = { products, customerBenefits, skipWhen: offerAccepted };
  return [
    serviceAddressStep({ mode: 'structured', autoPass: true }),
    billingAccountStep(),
    postpaidPlanStep(planContext),
    postpaidExtrasStep(planContext),
    numberSelectionStep({
      priceField: 'numberPriceQAR',
      // Refresh sits at the right of the title row and reloads the number inventory on every tab.
      refresh: true,
      plan: (values) => {
        const plan = products.find((p) => p.productId === values.productId);
        return plan ? { mrcQar: plan.mrcQAR, starEntitlementQar: starEntitlementQar(plan) } : undefined;
      },
    }),
    simTypeStep({ device }),
    // After the SIM, before the summary and the CAF: who will use the line (when it is not the owner) is named on the Supplementary Form.
    actualUserStep(),
    checkoutSummaryStep({
      // An accepted offer fixes the plan, so the Plan & Add-ons step is skipped and 'plan' is not a reachable
      // key - jump to Number Selection (the first step still editable) instead of doing nothing.
      editStepKey: (values) => (offerAccepted(values) ? 'number' : 'plan'),
    }),
    cafSignatureStep({ variant: 'full' }),
    // "On successful WinCash confirmation, return to DXP, submit the order, and create the interaction activity"
    // (2026-09-28): Payment is the last step, so Continue here would only ever mean "submit".
    paymentStep({ submitOnPaid: true }),
  ];
}
