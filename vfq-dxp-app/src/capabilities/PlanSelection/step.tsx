import { PLAN_SELECTION_LABEL } from '../../data/stepLabels';
import type { WizardStep } from '../../components/patterns/wizard/guidedWizardTypes';
import { PlanSelection } from './PlanSelection';
import { BillLimitEditor } from '../../components/domain/BillLimitEditor';

/**
 * Plan selection for the journeys that sell a catalogue or prepaid plan; the chosen plan is stored under
 * `productId` (and `discountId` for prepaid).
 *
 *   'prepaid'     prepaid packs and the discount choice.
 *   'catalogue'   a plan of `planType`. `creditCheck` adds the credit check and gates on it passing or being
 *                 acknowledged; `billLimit` adds the bill-limit editor once a plan is chosen and gates on it passing.
 *
 * New Connection's postpaid plan / add-ons steps have their own builders (they read the offer, eligibility and
 * customer type) and mount PlanSelection kind 'postpaid' directly.
 */
export function planSelectionStep(
  opts:
    | { kind: 'prepaid'; segment?: (values: Record<string, unknown>) => string | undefined }
    | { kind: 'catalogue'; planType: string; creditCheck?: boolean; billLimit?: boolean }
): WizardStep {
  return {
    key: 'plan',
    label: PLAN_SELECTION_LABEL,
    render: ({ values, setValue }) =>
      opts.kind === 'prepaid' ? (
        <PlanSelection
          kind="prepaid"
          selectedProductId={values.productId as string | undefined}
          // A different pack carries its own discounts and add-ons, so the previous pack's are dropped.
          onSelectProduct={(id) => {
            if (id !== values.productId) {
              setValue('discountId', undefined);
              setValue('addonIds', []);
            }
            setValue('productId', id);
          }}
          discountId={values.discountId as string | undefined}
          onSelectDiscount={(id) => setValue('discountId', id)}
          segment={opts.segment?.(values)}
          addonIds={(values.addonIds as string[] | undefined) ?? []}
          onSelectAddons={(ids) => setValue('addonIds', ids)}
        />
      ) : (
        <div className="space-y-4">
          <PlanSelection
            kind="catalogue"
            planType={opts.planType}
            selectedProductId={values.productId as string | undefined}
            onSelect={(id) => setValue('productId', id)}
            {...(opts.creditCheck
              ? {
                  showCreditCheck: true,
                  creditCheckAcknowledged: values.creditCheckAcknowledged === true,
                  onAcknowledgeCreditCheck: (v: boolean) => setValue('creditCheckAcknowledged', v),
                  onCreditCheckResult: (pass: boolean) => setValue('creditCheckPass', pass),
 }
              : {})}
          />
          {opts.billLimit && Boolean(values.productId) && (
            <BillLimitEditor
              product="Mobile"
              value={values.billLimit as number | undefined}
              onChange={(amount, pass) => {
                setValue('billLimit', amount);
                setValue('billLimitPass', pass);
 }}
            />
          )}
        </div>
      ),
    isValid: (values) => {
      if (!values.productId) return false;
      if (opts.kind === 'catalogue') {
        if (opts.creditCheck && values.creditCheckPass !== true && values.creditCheckAcknowledged !== true) return false;
        if (opts.billLimit && values.billLimitPass === false) return false;
 }
      return true;
 },
 };
}
