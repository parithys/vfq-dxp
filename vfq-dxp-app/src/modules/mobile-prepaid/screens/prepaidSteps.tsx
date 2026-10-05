import type { WizardStep } from '../../../components/patterns/wizard/guidedWizardTypes';
import * as sums from '../../../components/patterns/wizard/commonSummaries';
import { attachSummaries } from '../../../components/patterns/wizard/stepSummary';
import type { IdLookupValue } from '../../../components/patterns/idLookupModel';
import { MsisdnPicker } from '../../../components/domain/MsisdnPicker';
import { EligibilityGateStep } from '../../../components/domain/EligibilityGateStep';
import type { EligibilityResult } from '../../../components/domain/eligibilityTypes';
import { ZsbAddressStep } from '../../../components/patterns/ZsbAddressStep';
import type { ZsbAddressValue } from '../../../components/patterns/ZsbAddressStep';
import { PrepaidPlanStep } from '../../../components/patterns/PrepaidPlanStep';
import { SimTypeStep } from '../../../components/domain/SimTypeStep';
import type { SimTypeValue } from '../../../components/domain/SimTypeStep';
import { PrepaidCheckoutStep } from '../../../components/patterns/PrepaidCheckoutStep';
import type { PrepaidCheckoutTotals } from '../../../components/patterns/PrepaidCheckoutStep';
import { CafSignatureCapture } from '../../../components/patterns/CafSignatureCapture';
import { KeyInformationPanel } from '../../../components/patterns/KeyInformationPanel';
import { idLookupStep, isCafValid, type CafValue } from '../../../components/patterns/wizard/wizardSteps';
import { WinCashPaymentStep } from '../../../components/patterns/WinCashPaymentStep';
import type { WinCashPaymentValue } from '../../../components/patterns/WinCashPaymentStep';

// The New Prepaid Activation steps (Contact -> Eligibility -> Address -> Plan & Discount -> Number -> SIM Type ->
// Checkout -> CAF & Key Information -> Payment). The step-to-requirement map is in NewPrepaidWizard.tsx.
export function buildPrepaidSteps(): WizardStep[] {
  return attachSummaries([
    idLookupStep({ key: 'contact', label: 'Contact (ID capture)', field: 'contact' }),
    {
      key: 'eligibility',
      label: 'Eligibility',
      description: 'Blacklist & line cap',
      render: ({ values, setValue }) => {
        const contact = values.contact as IdLookupValue | undefined;
        return (
          <EligibilityGateStep
            idNumber={contact?.idNumber}
            journeyType="prepaid"
            result={values.eligibility as EligibilityResult | undefined}
            onResult={(r) => setValue('eligibility', r)}
          />
        );
      },
      isValid: (values) => (values.eligibility as EligibilityResult | undefined)?.pass === true,
    },
    {
      key: 'address',
      label: 'Address & Contact Details',
      render: ({ values, setValue }) => {
        const contact = values.contact as IdLookupValue | undefined;
        return (
          <ZsbAddressStep
            value={(values.address as ZsbAddressValue) ?? {}}
            onChange={(v) => setValue('address', v)}
            idNumber={contact?.idNumber}
            nationality={contact?.moiResult?.nationality}
          />
        );
      },
      // Mandatory: No per FLD-523-526, same as the postpaid wizard's Address step.
      isValid: () => true,
    },
    {
      key: 'plan',
      label: 'Plan & Discount',
      render: ({ values, setValue }) => (
        <PrepaidPlanStep
          selectedProductId={values.productId as string | undefined}
          onSelectProduct={(id) => setValue('productId', id)}
          discountId={values.discountId as string | undefined}
          onSelectDiscount={(id) => setValue('discountId', id)}
        />
      ),
      isValid: (values) => Boolean(values.productId),
    },
    {
      key: 'number',
      label: 'Number Selection',
      render: ({ values, setValue }) => (
        <MsisdnPicker
          selected={values.msisdn as string | undefined}
          onSelect={(msisdn, priceQAR) => {
            setValue('msisdn', msisdn);
            setValue('priceQAR', priceQAR);
          }}
          inlineToolbar
          hideReservedBadge
          onDeselect={() => {
            setValue('msisdn', undefined);
            setValue('priceQAR', undefined);
          }}
        />
      ),
      isValid: (values) => Boolean(values.msisdn),
    },
    {
      key: 'simType',
      label: 'SIM Type',
      render: ({ values, setValue }) => {
        const contact = values.contact as IdLookupValue | undefined;
        return (
          <SimTypeStep
            value={(values.simType as SimTypeValue) ?? {}}
            customerEmail={contact?.moiResult?.email}
            onChange={(v) => setValue('simType', v)}
          />
        );
      },
      isValid: (values) => {
        const s = values.simType as SimTypeValue | undefined;
        if (s?.simType === 'Physical') return s.simValid === true;
        if (s?.simType === 'eSIM') return s.esimIssued === true;
        return false;
      },
    },
    {
      key: 'checkout',
      label: 'Checkout',
      render: ({ values, setValue }) => {
        const contact = values.contact as IdLookupValue | undefined;
        return (
          <PrepaidCheckoutStep
            customerName={contact?.moiResult?.name}
            idType={contact?.idType ?? 'QID'}
            planProductId={values.productId as string | undefined}
            discountId={values.discountId as string | undefined}
            msisdn={values.msisdn as string | undefined}
            numberPriceQar={values.priceQAR as number | undefined}
            simType={values.simType as SimTypeValue | undefined}
            onTotalsComputed={(totals) => setValue('checkoutTotals', totals)}
          />
        );
      },
      isValid: () => true,
    },
    {
      key: 'caf',
      label: 'CAF & Key Information',
      render: ({ values, setValue }) => {
        const contact = values.contact as IdLookupValue | undefined;
        return (
          <div className="space-y-6">
            {/* MPRA_001_CAF_02 (BR-009): displayed before CAF submission, refreshed
                on any cart amendment since it's derived live from the selected pack. */}
            <KeyInformationPanel
              items={[
                'No plan lock-in period applies to prepaid packs.',
                'No Device on Installment applies - this is a SIM/number activation only.',
                'Pack validity and balance terms apply per the selected pack (see Plan & Discount step).',
              ]}
            />
            <CafSignatureCapture
              value={(values.caf as CafValue) ?? {}}
              onChange={(v) => setValue('caf', v)}
              customerName={contact?.moiResult?.name}
            />
          </div>
        );
      },
      isValid: (values) => isCafValid(values.caf as CafValue | undefined),
    },
    {
      key: 'payment',
      label: 'Payment',
      render: ({ values, setValue }) => (
        <WinCashPaymentStep
          amountDueQAR={(values.checkoutTotals as PrepaidCheckoutTotals | undefined)?.totalDueQar ?? 0}
          value={(values.payment as WinCashPaymentValue) ?? {}}
          onChange={(v) => setValue('payment', v)}
        />
      ),
      isValid: (values) => Boolean((values.payment as WinCashPaymentValue | undefined)?.paid),
    },
        ], {
    contact: sums.identitySummary('contact'),
    address: sums.addressFormSummary(),
    plan: [...sums.planSummary(), { key: 'discount', label: 'Discount', type: 'select', optional: true, labelFrom: { kind: 'addons-discounts', idField: 'addonDiscountId', labelField: 'name' }, value: (v) => v.discountId }],
    number: sums.numberSummary('priceQAR'),
    simType: sums.simTypeFormSummary(),
    checkout: [{ key: 'due', label: 'Total Payable Today', type: 'text', value: (v) => ((v.checkoutTotals as { totalDueQar?: number } | undefined)?.totalDueQar != null ? `QAR ${(v.checkoutTotals as { totalDueQar: number }).totalDueQar.toLocaleString('en-GB')}` : undefined) }],
    caf: sums.cafSummary,
    payment: sums.paymentSummary,
  });
}
