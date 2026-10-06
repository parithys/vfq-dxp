import { cloneElement, isValidElement, type ReactElement } from 'react';
import { cafStep } from '../../new-connection/steps/cafStep';
import { FixedPlanStepView, InstallationAddressStep, NumberDevicesStep } from './FixedStepViews';
import { GuidedContactStep } from '../../../components/patterns/GuidedContactStep';
import { hasIdentityDetails, isValidAltPhone, isValidEmail } from '../../../components/patterns/guidedContactModel';
import type { GuidedContactValue } from '../../../components/patterns/guidedContactModel';
import { BillingAccountAutoResolver } from '../../../components/patterns/BillingAccountAutoResolver';
import type { BillingAccountValue } from '../../../components/patterns/billingAccountModel';
import { EligibilityGateStep } from '../../../components/domain/EligibilityGateStep';
import type { EligibilityResult } from '../../../components/domain/eligibilityTypes';
import type { ZsbAddressValue } from '../../../components/patterns/ZsbAddressStep';
import { AppointmentBookingStep } from '../../../components/patterns/AppointmentBookingStep';
import type { AppointmentBookingValue } from '../../../components/patterns/AppointmentBookingStep';
import type { SummaryField } from '../../../components/patterns/wizard/stepSummary';
import type { WizardStep } from '../../../components/patterns/wizard/guidedWizardTypes';
import { appointmentSummary } from '../../../components/patterns/wizard/commonSummaries';
import { idTypesFor } from '../../../data/idTypes';
import { CustomerTypeStep } from '../../new-connection/steps/CustomerTypeStep';
import { isCustomerTypeValid } from '../../new-connection/steps/customerTypeModel';
import type { CustomerTypeValue } from '../../new-connection/steps/customerTypeModel';
import { CustomerStatusBanner } from '../../new-connection/steps/JourneyBanners';
import { EligibilityOutcomePanel, OutcomeActions } from '../../new-connection/steps/EligibilityOutcomes';
import { addressSummary, contactSummary, planSummary } from '../../new-connection/steps/stepSummaries';
import {
  serviceTypeLabel,
  type FixedInstallationValue,
  type FixedDevice,
} from './fixedActivationModel';
import type { useJourneyCustomerLock } from '../../new-connection/hooks/useJourneyCustomerLock';

type Values = Record<string, unknown>;
const at = (v: Values, ...path: string[]): unknown => path.reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Values)[k] : undefined), v);

// ---- 1. Contact Identification -------------------------------------------------------------------------------
// Same scan -> verify -> Fetch (MOI) -> eligibility sequence as Postpaid. The MOI-returned parameters are
// read-only, and under-18 is a hard stop (both enforced by the shared identity step and eligibility engine).
export function fixedContactStep(guardedContactChange: ReturnType<typeof useJourneyCustomerLock>['guardedContactChange']): WizardStep {
  return {
    key: 'contact',
    label: 'Contact',
    summary: contactSummary,
    hideCustomerView: true,
    render: ({ values, setValue }) => {
      const contact = values.contact as GuidedContactValue | undefined;
      const eligibility = values.eligibility as EligibilityResult | undefined;
      return (
        <>
          <GuidedContactStep
            allowedIdTypes={idTypesFor('new-connection')}
            unavailableIdTypes={[]}
            verifyThenFetch
            value={contact ?? {}}
            onChange={(v) => guardedContactChange(v, setValue)}
            showIptvToggle={false}
          />
          <div className="mt-6 pt-6 border-t border-border-soft space-y-4">
            <CustomerStatusBanner customerId={eligibility?.customerId} />
            <EligibilityOutcomePanel />
            <EligibilityGateStep
              announcePass={false}
              idNumber={contact?.moiResult ? contact.idNumber : undefined}
              result={eligibility}
              onResult={(r) => setValue('eligibility', r)}
            />
            {contact?.moiResult && eligibility && !eligibility.hardStop && !eligibility.softStop && (
              <div className="space-y-4">
                <h3 className="text-fg font-semibold text-[length:var(--fs-h5)]">Additional Discounts</h3>
                {/* Headless: resolves (or creates) the customer's billing account for the Billing Profile step. */}
                <BillingAccountAutoResolver
                  customerId={eligibility.customerId}
                  customerName={contact.moiResult.name}
                  value={(values.billingAccount as BillingAccountValue) ?? {}}
                  onChange={(v) => setValue('billingAccount', v)}
                />
                {/* Customer type (B2B2C, Retired, MADA), captured exactly as in New Connection. */}
                <CustomerTypeStep
                  value={(values.customerType as CustomerTypeValue) ?? {}}
                  onChange={(v) => setValue('customerType', v)}
                  idNumber={contact.idNumber}
                  onReject={() => {
                    setValue('customerType', { type: 'none', rejected: true });
                    setValue('discountId', undefined);
                    setValue('discountSupportingId', undefined);
                    setValue('discountProofDocument', undefined);
                  }}
                  derivedCompany={
                    contact.isB2B2C
                      ? { companyName: contact.companyName, companyAccountId: contact.companyAccountId, companyIsNew: contact.companyIsNew }
                      : undefined
                  }
                />
              </div>
            )}
          </div>
        </>
      );
    },
    isValid: (values) => {
      const c = values.contact as GuidedContactValue | undefined;
      const e = values.eligibility as EligibilityResult | undefined;
      const identityOk = Boolean(
        c?.moiResult && hasIdentityDetails(c ?? {}) && isValidEmail(c?.email) && (!c?.altPhone || isValidAltPhone(c.altPhone))
      );
      return identityOk && Boolean(e) && !e?.hardStop && !e?.softStop && isCustomerTypeValid(values.customerType as CustomerTypeValue | undefined);
    },
    primaryAction: ({ values, abandon, defaultButton }) => (
      <OutcomeActions
        eligibility={values.eligibility as EligibilityResult | undefined}
        defaultButton={defaultButton}
        onAbandon={() => abandon({ hideKeepWorking: true })}
      />
    ),
  };
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
