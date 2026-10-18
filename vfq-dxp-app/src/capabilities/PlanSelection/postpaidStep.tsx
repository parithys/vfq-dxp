import { PLAN_SELECTION_LABEL } from '../../data/stepLabels';
import type { GuidedContactValue } from '../../components/patterns/guidedContactModel';
import { planChoiceSummary, planExtrasSummary } from './summary';
import type { CustomerBenefit } from '../../engines/customerBenefitEngine';
import type { EligibilityResult } from '../../components/domain/eligibilityTypes';
import { PlanSelection } from './PlanSelection';
import type { WizardStep } from '../../components/patterns/wizard/guidedWizardTypes';
import type { CustomerTypeValue } from '../CustomerType/customerTypeModel';
import { isCustomerTypeValid } from '../CustomerType/customerTypeModel';

/** What the postpaid plan steps need from their journey. */
export interface PostpaidPlanContext {
  /** The plan catalogue (fetched once by the journey, shared with Number Selection's Star entitlement). */
  products: { productId: string; preBundledOffer?: boolean }[];
  /** The benefits the customer holds, for choosing which discounts to offer. */
  customerBenefits: CustomerBenefit[] | undefined;
  /** Leave the Plan and Add-ons steps out of the journey (an accepted offer already fixes the plan). */
  skipWhen?: (values: Record<string, unknown>) => boolean;
  /** A plan not offered (the line's current plan, when the journey changes it). */
  hiddenProductId?: (values: Record<string, unknown>) => string | undefined;
}

export function postpaidPlanStep(ctx: PostpaidPlanContext): WizardStep {
  return {
    key: 'plan',
    summary: planChoiceSummary,
    skip: ctx.skipWhen,
    label: PLAN_SELECTION_LABEL,
    render: ({ values, setValue }) => renderPlanStep('plan', ctx, values, setValue),
    isValid: (values) => Boolean(values.productId),
    // "For pre-bundled eligible offers, skip add-on selection" - re-evaluates on every value change.
    autoAdvanceWhen: (values) => Boolean(ctx.products.find((p) => p.productId === values.productId)?.preBundledOffer),
  };
}

// The chosen plan's add-ons, bill limit and eligible discounts, with the monthly summary (the step after Plan).
export function postpaidExtrasStep(ctx: PostpaidPlanContext): WizardStep {
  return {
    key: 'planExtras',
    summary: planExtrasSummary,
    skip: ctx.skipWhen,
    label: 'Add-ons',
    subheading: 'Personalise the plan with optional services and spending controls.',
    render: ({ values, setValue }) => renderPlanStep('extras', ctx, values, setValue),
    // Bill limit is the only gate; add-ons and discounts never block.
    isValid: (values) => values.billLimitPass !== false,
  };
}

function renderPlanStep(
  mode: 'plan' | 'extras',
  { customerBenefits, hiddenProductId }: PostpaidPlanContext,
  values: Record<string, unknown>,
  setValue: (field: string, value: unknown) => void
) {
  {
    {
      const eligibility = values.eligibility as EligibilityResult | undefined;
      return (
        <>
        <PlanSelection
          kind="postpaid"
          mode={mode}
          customerContext={{
            nationality: eligibility?.nationality,
            customerType: (values.customerType as CustomerTypeValue | undefined)?.type,
            idType: (values.contact as GuidedContactValue | undefined)?.idType,
          }}
          customerBenefits={customerBenefits}
          specialDiscountType={((v) => (v?.type && v.type !== 'none' && !v.rejected ? v.type : undefined))(values.customerType as CustomerTypeValue | undefined)}
          customerBenefit={((values.customerType as CustomerTypeValue | undefined)?.officeAccepted || isCustomerTypeValid(values.customerType as CustomerTypeValue | undefined) && (values.customerType as CustomerTypeValue | undefined)?.type === 'b2b2c') ? (values.customerType as CustomerTypeValue).type : undefined}
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
          hiddenProductId={hiddenProductId?.(values)}
        />
        </>
      );
    }
  }
}
