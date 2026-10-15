import { NUMBER_SELECTION_LABEL } from '../../data/stepLabels';
import type { WizardStep } from '../../components/patterns/wizard/guidedWizardTypes';
import { NumberSelection } from './NumberSelection';
import { numberSummary } from './summary';
import { Button } from '../../components/primitives/Button';
import { Icon } from '../../components/primitives/Icon';

/**
 * Number selection: the chosen number is stored under `msisdn` (and its price under `priceField`, when given).
 * `plan` reads the journey's selected plan from the values, for the Star entitlement note. `refresh` adds the
 * Refresh action to the step's title row. Journeys that need more (a summary, say) spread this and add it.
 */
export function numberSelectionStep(
  opts: {
    priceField?: string;
    plan?: (values: Record<string, unknown>) => { mrcQar?: number; starEntitlementQar?: number } | undefined;
    refresh?: boolean;
    allowManualEntry?: boolean;
    /** Offer "Use a Pre-Paired SIM" (Mobile Prepaid): the choice is kept under `prePaired`, and the number then comes from the SIM. */
    prePairedOption?: boolean;
 } = {}
): WizardStep {
  return {
    key: 'number',
    label: NUMBER_SELECTION_LABEL,
    summary: numberSummary(opts.priceField),
    ...(opts.refresh
      ? {
          hideCustomerView: true,
          headerAction: ({ values, setValue }) => (
            <Button
              variant="secondary"
              compact
              onClick={() => setValue('numberRefresh', ((values.numberRefresh as number | undefined) ?? 0) + 1)}
            >
              <Icon path="M21 12a9 9 0 1 1-3-6.7 M21 4v5h-5" className="w-4 h-4" />
              Refresh
            </Button>
          ),
 }
      : {}),
    render: ({ values, setValue }) => (
      <NumberSelection
        value={values.msisdn as string | undefined}
        refreshKey={opts.refresh ? (values.numberRefresh as number | undefined) : undefined}
        plan={opts.plan?.(values)}
        allowManualEntry={opts.allowManualEntry}
        prePaired={
          opts.prePairedOption
            ? {
                checked: values.prePaired === true,
                onChange: (checked) => {
                  setValue('prePaired', checked);
                  // The number belongs to whichever route is chosen, so switching route drops the other's number and SIM.
                  setValue('msisdn', undefined);
                  if (opts.priceField) setValue(opts.priceField, undefined);
                  setValue('simType', undefined);
                },
              }
            : undefined
        }
        onChange={(msisdn, price) => {
          setValue('msisdn', msisdn);
          if (opts.priceField) setValue(opts.priceField, price);
 }}
      />
    ),
    isValid: (values) => Boolean(values.msisdn) || (opts.prePairedOption === true && values.prePaired === true),
 };
}
