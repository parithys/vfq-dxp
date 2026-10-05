import type { GuidedContactValue } from '../../../components/patterns/guidedContactModel';
import { planSummary } from './stepSummaries';
import type { EligibilityResult } from '../../../components/domain/eligibilityTypes';
import { PostpaidPlanAddonsStep } from '../../../components/patterns/PostpaidPlanAddonsStep';
import type { WizardStep } from '../../../components/patterns/wizard/guidedWizardTypes';
import { PlanSourceBanner } from './JourneyBanners';
import type { CustomerTypeValue } from './customerTypeModel';
import type { CrossSalesValue } from './crossSalesModel';
import type { NewConnectionStepContext } from './stepContext';

export function planStep({ customerBenefits, products }: NewConnectionStepContext): WizardStep {
  return {
    key: 'plan',
    summary: planSummary,
    // An accepted offer already fixes the plan, so the agent goes straight
    // from Offers to Number Selection; Skip (no offer) runs the full path.
    skip: (values) => (values.crossSales as CrossSalesValue | undefined)?.decision === 'accepted',
    label: 'Plan & Add-ons',
    render: ({ values, setValue }) => {
      const eligibility = values.eligibility as EligibilityResult | undefined;
      return (
        <>
        <PlanSourceBanner
          offerName={(values.crossSales as CrossSalesValue | undefined)?.offerName}
          customerType={(values.customerType as CustomerTypeValue | undefined)?.type}
        />
        <PostpaidPlanAddonsStep
          customerContext={{
            nationality: eligibility?.nationality,
            customerType: (values.customerType as CustomerTypeValue | undefined)?.type,
            idType: (values.contact as GuidedContactValue | undefined)?.idType,
          }}
          customerBenefits={customerBenefits}
          customerBenefit={(values.customerType as CustomerTypeValue | undefined)?.officeAccepted ? (values.customerType as CustomerTypeValue).type : undefined}
          selectedProductId={values.productId as string | undefined}
          onSelectProduct={(id) => setValue('productId', id)}
          onDeselectProduct={() => setValue('productId', undefined)}
          discountId={values.discountId as string | undefined}
          onSelectDiscount={(id) => setValue('discountId', id)}
          addonIds={(values.addonIds as string[] | undefined) ?? []}
          onAddonsChange={(ids) => setValue('addonIds', ids)}
          discountSupportingId={values.discountSupportingId as string | undefined}
          onDiscountSupportingIdChange={(id) => setValue('discountSupportingId', id)}
          billLimit={values.billLimit as number | undefined}
          onBillLimitChange={(amount, pass) => {
            setValue('billLimit', amount);
            setValue('billLimitPass', pass);
          }}
          requiresHrnAdvance={Boolean(eligibility?.requiresHrnAdvance)}
          discountProofDocument={values.discountProofDocument as { fileName: string; sizeBytes: number } | undefined}
          onDiscountProofDocumentChange={(doc) => setValue('discountProofDocument', doc)}
        />
        </>
      );
    },
    // Restored 2026-09-28: Bill Limit is back in this step (see the
    // component's own note), so billLimitPass is a real flag again
    // rather than the dead one this comment used to explain away.
    isValid: (values) => Boolean(values.productId) && values.billLimitPass !== false,
    // "For pre-bundled eligible offers, skip Plan/Add-on Selection
    // and proceed to Number Selection" (2026-09-28) - re-evaluates on
    // every value change (see GuidedActivationWizard's own note on
    // autoAdvanceWhen), so it fires the moment such a plan is picked,
    // not only on arrival at this step.
    autoAdvanceWhen: (values) =>
      Boolean(products.find((p) => p.productId === values.productId)?.preBundledOffer),
  };
}
