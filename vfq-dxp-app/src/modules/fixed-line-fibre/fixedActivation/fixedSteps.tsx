import { cloneElement, isValidElement, type ReactElement } from 'react';
import { cafStep } from '../../new-connection/steps/cafStep';
import { contactStep } from '../../new-connection/steps/contactStep';
import type { NewConnectionStepContext } from '../../new-connection/steps/stepContext';
import { FixedPlanStepView, InstallationAddressStep, NumberDevicesStep } from './FixedStepViews';
import type { ZsbAddressValue } from '../../../components/patterns/ZsbAddressStep';
import { AppointmentBookingStep } from '../../../components/patterns/AppointmentBookingStep';
import type { AppointmentBookingValue } from '../../../components/patterns/AppointmentBookingStep';
import type { SummaryField } from '../../../components/patterns/wizard/stepSummary';
import type { WizardStep } from '../../../components/patterns/wizard/guidedWizardTypes';
import { appointmentSummary } from '../../../components/patterns/wizard/commonSummaries';
import { addressSummary, planSummary } from '../../new-connection/steps/stepSummaries';
import {
  serviceTypeLabel,
  type FixedInstallationValue,
  type FixedDevice,
} from './fixedActivationModel';
import type { useJourneyCustomerLock } from '../../new-connection/hooks/useJourneyCustomerLock';

type Values = Record<string, unknown>;
const at = (v: Values, ...path: string[]): unknown => path.reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Values)[k] : undefined), v);

// ---- 1. Contact Identification -------------------------------------------------------------------------------
// New Connection's Contact step as-is (scan -> verify -> Fetch (MOI), eligibility, billing-account resolver,
// customer type), entered as the existing-customer variant without a preset customer: whoever the ID belongs to
// is matched by eligibility, never forced to be new. The MOI fields stay read-only and under-18 stays a hard stop.
export function fixedContactStep(guardedContactChange: ReturnType<typeof useJourneyCustomerLock>['guardedContactChange']): WizardStep {
  return { ...contactStep({ flow: 'existing', existingCustomerId: undefined, guardedContactChange } as NewConnectionStepContext), label: 'Contact' };
}

// ---- 2. Installation Address ---------------------------------------------------------------------------------
export const fixedInstallationSummary: SummaryField[] = [
  { key: 'serviceType', label: 'Service Type', type: 'text', value: (v) => serviceTypeLabel(at(v, 'installation', 'serviceType')) },
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
      if (!i?.serviceType || !a?.zone || !a.streetNo || !a.buildingNo) return false;
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
  return {
    key: 'appointment',
    label: 'Appointment',
    summary: appointmentSummary,
    render: ({ values, setValue }) => (
      <AppointmentBookingStep value={(values.appointment as AppointmentBookingValue) ?? {}} onChange={(v) => setValue('appointment', v)} />
    ),
    isValid: (values) => {
      const a = values.appointment as AppointmentBookingValue | undefined;
      return Boolean(a?.cluster && a?.date && a?.timeSlot);
    },
  };
}

// ---- CAF & Signature -----------------------------------------------------------------------------------------
// New Connection's CAF step, unchanged for the agent; in the customer-view pop-up the Terms & Conditions grow to
// full height so the page scrolls (no inner scrollbar) and the signature block follows the last section.
export function fixedCafStep(): WizardStep {
  const base = cafStep();
  return {
    ...base,
    render: (ctx) => {
      const el = base.render(ctx);
      const isMirror = new URLSearchParams(window.location.search).get('mirror') === '1';
      return isMirror && isValidElement(el) ? cloneElement(el as ReactElement<{ termsScrollMode?: string }>, { termsScrollMode: 'page' }) : el;
    },
  };
}
