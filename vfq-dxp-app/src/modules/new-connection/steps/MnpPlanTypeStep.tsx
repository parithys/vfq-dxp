import { ChoiceCards } from '../../../components/primitives/ChoiceCards';
import type { WizardStep } from '../../../components/patterns/wizard/guidedWizardTypes';
import { ProductEligibility } from './ProductEligibility';
import { productEligibilityClear, selectMnpType } from './productChoice';
import type { ProductStepContext } from './ProductSelection';
import type { MnpType } from '../products';

const ICON_PHONE = 'M8 2h8a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z M11 18h2';
const ICON_TICKET = 'M3 6h18v12H3z M3 10h18 M6 15h4';

const planTypeLabel = (t: unknown) => (t === 'prepaid' ? 'Prepaid Plan' : t === 'postpaid' ? 'Postpaid Plan' : undefined);

/**
 * "Port the number onto": the step that opens the New MNP flow, whichever way the agent started it - selecting a New MNP offer
 * (which already names its plan type, shown chosen) or the New MNP button (nothing chosen yet). Product Selection no longer asks:
 * it only records that the product is MNP. The plan type decides the eligibility rules, the steps and the billing, so it is judged
 * here, for the type chosen, before the journey goes on.
 */
export function mnpPlanTypeStep(ctx: ProductStepContext): WizardStep {
  return {
    key: 'mnpType',
    label: 'Port the number onto',
    heading: 'Port the number onto',
    summary: [{ key: 'mnpType', label: 'Port the number onto', type: 'text', value: (v: Record<string, unknown>) => planTypeLabel(v.mnpType) }],
    render: ({ values, setValue }) => (
      <div className="space-y-6">
        <ChoiceCards<MnpType>
          legend="Port the number onto"
          items={[
            { key: 'postpaid', label: 'Postpaid Plan', icon: ICON_PHONE },
            { key: 'prepaid', label: 'Prepaid Plan', icon: ICON_TICKET },
          ]}
          value={values.mnpType as MnpType | undefined}
          onChange={(t) => selectMnpType(ctx, values, setValue, t)}
        />
        <ProductEligibility
          values={values}
          setValue={setValue}
          flow={ctx.flow}
          existingCustomerId={ctx.existingCustomerId}
          onSwitchToPrepaid={() => selectMnpType(ctx, values, setValue, 'prepaid')}
        />
      </div>
    ),
    isValid: (values) => Boolean(values.mnpType) && productEligibilityClear(values),
  };
}
