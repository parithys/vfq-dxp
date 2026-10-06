import type { GuidedContactValue } from '../../../components/patterns/guidedContactModel';
import { planChoiceSummary, planExtrasSummary } from './stepSummaries';
import type { EligibilityResult } from '../../../components/domain/eligibilityTypes';
import { PostpaidPlanAddonsStep } from '../../../components/patterns/PostpaidPlanAddonsStep';
import type { WizardStep } from '../../../components/patterns/wizard/guidedWizardTypes';
import type { CustomerTypeValue } from './customerTypeModel';
import type { CrossSalesValue } from './crossSalesModel';
import type { NewConnectionStepContext } from './stepContext';

export function planStep(ctx: NewConnectionStepContext): WizardStep {
  return {
    key: 'plan',
    summary: planChoiceSummary,
    // An accepted offer already fixes the plan, so the agent goes straight
    // from Offers to Number Selection; Skip (no offer) runs the full path.
    skip: (values) => (values.crossSales as CrossSalesValue | undefined)?.decision === 'accepted',
    label: 'Plan',
    render: ({ values, setValue }) => renderPlanStep('plan', ctx, values, setValue),
    isValid: (values) => Boolean(values.productId),
    // "For pre-bundled eligible offers, skip add-on selection" - re-evaluates on every value change.
    autoAdvanceWhen: (values) => Boolean(ctx.products.find((p) => p.productId === values.productId)?.preBundledOffer),
  };
}

// The chosen plan's add-ons, bill limit and eligible discounts, with the monthly summary (the step after Plan).
export function planExtrasStep(ctx: NewConnectionStepContext): WizardStep {
  return {
    key: 'planExtras',
    summary: planExtrasSummary,
    skip: (values) => (values.crossSales as CrossSalesValue | undefined)?.decision === 'accepted',
    label: 'Add-ons',
    render: ({ values, setValue }) => renderPlanStep('extras', ctx, values, setValue),
    // Bill limit is the only gate; add-ons and discounts never block.
    isValid: (values) => values.billLimitPass !== false,
  };
}

function renderPlanStep(
  mode: 'plan' | 'extras',
  { customerBenefits }: NewConnectionStepContext,
  values: Record<string, unknown>,
  setValue: (field: string, value: unknown) => void
) {
  {
    {
      const eligibility = values.eligibility as EligibilityResult | undefined;
      return (
        <>
        <PostpaidPlanAddonsStep
          mode={mode}
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
          // Passed on to the later steps: where the plan came from and what an offer bundles.
          onSelectionChange={({ source, bundled }) => {
            setValue('selectionSource', source);
            setValue('bundledItems', bundled);
          }}
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
    }
  }
}
