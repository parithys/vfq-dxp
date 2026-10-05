import { MsisdnPicker } from '../../../components/domain/MsisdnPicker';
import { numberSummary } from './stepSummaries';
import { starEntitlementQar } from '../../../engines/postpaidPricing';
import type { WizardStep } from '../../../components/patterns/wizard/guidedWizardTypes';
import type { NewConnectionStepContext } from './stepContext';

export function numberStep({ products }: NewConnectionStepContext): WizardStep {
  return {
    key: 'number',
    summary: numberSummary,
    label: 'Number Selection',
    hideCustomerView: true,
    render: ({ values, setValue }) => (
      <MsisdnPicker
        selected={values.msisdn as string | undefined}
        onSelect={(msisdn, priceQAR) => {
          setValue('msisdn', msisdn);
          setValue('numberPriceQAR', priceQAR);
        }}
        // Clicking the chosen number again clears it (toggle).
        onDeselect={() => {
          setValue('msisdn', undefined);
          setValue('numberPriceQAR', undefined);
        }}
        planMrcQar={products.find((p) => p.productId === values.productId)?.mrcQAR}
        starEntitlementQar={(() => {
          const plan = products.find((p) => p.productId === values.productId);
          return plan ? starEntitlementQar(plan) : undefined;
        })()}
        // "This section is not required" (2026-09-28) - Postpaid only;
        // the other four journeys sharing MsisdnPicker keep Manual
        // MSISDN Entry, since nothing was said about them.
        allowManualEntry={false}
        inlineToolbar
        hideReservedBadge
      />
    ),
    isValid: (values) => Boolean(values.msisdn),
  };
}
