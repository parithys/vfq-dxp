import { CUSTOMER_IDENTIFICATION_LABEL } from '../../../data/stepLabels';
import { addressSummary, billingAccountStep, cafSignatureStep, checkoutSummaryStep, customerQualificationStep, paymentStep, planSummary } from '../../../capabilities';
import { FixedPlanStepView, InstallationAddressStep, NumberDevicesStep } from './FixedStepViews';
import type { ZsbAddressValue } from '../../../components/patterns/ZsbAddressStep';
import { appointmentBookingStep } from '../../../capabilities';
import type { SummaryField } from '../../../components/patterns/wizard/stepSummary';
import type { WizardStep } from '../../../components/patterns/wizard/guidedWizardTypes';
import { appointmentSummary } from '../../../components/patterns/wizard/commonSummaries';
import {
  serviceTypeLabel,
  type FixedInstallationValue,
  type FixedDevice,
} from './fixedActivationModel';
import type { useJourneyCustomerLock } from '../../../capabilities';

type Values = Record<string, unknown>;
const at = (v: Values, ...path: string[]): unknown => path.reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Values)[k] : undefined), v);

// ---- 1. Contact Identification -------------------------------------------------------------------------------
// New Connection's Contact step as-is (scan -> verify -> Fetch (MOI), eligibility, billing-account resolver,
// customer type), entered as the existing-customer variant without a preset customer: whoever the ID belongs to
// is matched by eligibility, never forced to be new. The MOI fields stay read-only and under-18 stays a hard stop.
export function fixedContactStep(guardedContactChange: ReturnType<typeof useJourneyCustomerLock>['guardedContactChange']): WizardStep {
  return { ...customerQualificationStep({ flow: 'existing', existingCustomerId: undefined, guardedContactChange }), label: CUSTOMER_IDENTIFICATION_LABEL };
}

// ---- 2. Installation Address ---------------------------------------------------------------------------------
export const fixedInstallationSummary: SummaryField[] = [
  { key: 'serviceType', label: 'Service Type', type: 'text', optional: true, value: (v) => serviceTypeLabel(at(v, 'installation', 'serviceType')) },
  ...addressSummary,
];

export function fixedAddressStep(): WizardStep {
  return {
    key: 'address',
    label: 'Installation Address',
    summary: fixedInstallationSummary,
    render: ({ values, setValue }) => <InstallationAddressStep values={values} setValue={setValue} />,
    isValid: (values) => {
      const a = values.address as ZsbAddressValue | undefined;
      const i = values.installation as FixedInstallationValue | undefined;
      if (!a?.zone || !a.streetNo || !a.buildingNo) return false;
      // Fixed-Line and 5G Home have no service type; Fibre sets Fiber itself and FWA asks for Indoor or Outdoor.
      if (values.homeProduct === 'fixed-line' || values.homeProduct === '5g-home') return true;
      if (!i?.serviceType) return false;
      return i.serviceType !== 'fiber' || i.rfs === 'rfs';
    },
  };
}

// ---- 3. Plan -------------------------------------------------------------------------------------------------
export function fixedPlanStep(): WizardStep {
  return {
    key: 'plan',
    label: 'Plan & Add-ons',
    summary: planSummary,
    render: ({ values, setValue }) => <FixedPlanStepView values={values} setValue={setValue} />,
    isValid: (values) => Boolean(values.productId) && (values.creditCheckPass === true || values.creditCheckAcknowledged === true),
  };
}

// ---- 4. Number & Devices -------------------------------------------------------------------------------------
// The fixed line number is allocated by the system; the devices follow from the service type and plan.
export function fixedNumberStep(): WizardStep {
  return {
    key: 'number',
    label: 'Number & Devices',
    summary: [
      { key: 'msisdn', label: 'Fixed Line Number', type: 'text', value: (v) => at(v, 'msisdn') },
      { key: 'devices', label: 'Devices', type: 'text', optional: true, value: (v) => ((at(v, 'devices') as FixedDevice[] | undefined) ?? []).map((d) => d.name).join(', ') || undefined },
    ],
    render: ({ values, setValue }) => <NumberDevicesStep values={values} setValue={setValue} />,
    isValid: (values) => Boolean(values.msisdn),
  };
}

// ---- 5. Appointment ------------------------------------------------------------------------------------------
export function fixedAppointmentStep(): WizardStep {
  return { ...appointmentBookingStep(), summary: appointmentSummary };
}

// ---- CAF & Signature -----------------------------------------------------------------------------------------
// New Connection's CAF step, unchanged for the agent; in the customer-view pop-up the Terms & Conditions grow to
// full height so the page scrolls (no inner scrollbar) and the signature block follows the last section.
export function fixedCafStep(): WizardStep {
  const isMirror = new URLSearchParams(typeof window === 'undefined' ? '' : (window.location?.search ?? '')).get('mirror') === '1';
  return cafSignatureStep({ variant: 'full', termsScrollMode: isMirror ? 'page' : undefined });
}

/**
 * The Fixed Line steps after Customer Identification and Product Selection (the first two steps of New Connection, which
 * Fixed Line shares with the other products): Installation Address, Billing Profile (resolved for the agent), Plan, Number and
 * Devices, Checkout, CAF, Payment (which moves on once paid) and the installation Appointment, which submits. Covers fibre and
 * both 5G Home (FWA) service types.
 */
export function fixedLineSteps(): WizardStep[] {
  return [fixedAddressStep(), billingAccountStep(), fixedPlanStep(), fixedNumberStep(), checkoutSummaryStep(), fixedCafStep(), paymentStep({ submitOnPaid: true }), fixedAppointmentStep()];
}
