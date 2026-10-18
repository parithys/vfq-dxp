import type { WizardStep } from '../../../components/patterns/wizard/guidedWizardTypes';
import { PhoneNumberInput } from '../../../components/primitives/PhoneNumberInput';
import { isQatarMobileLocalNumber } from '../../../components/primitives/countryDialCodes';
import { attachSummaries } from '../../../components/patterns/wizard/stepSummary';
import {
  billingAccountStep,
  cafSignatureStep,
  checkoutSummaryStep,
  customerQualificationStep,
  paymentStep,
  postpaidExtrasStep,
  postpaidPlanStep,
} from '../../../capabilities';
import type { QualificationContext } from '../../../capabilities';
import type { PostpaidStepContext } from '../../new-connection/postpaidSteps';

/** A complete Qatar mobile number: +974 and 8 digits with a mobile leading digit. */
const isValidMsisdn = (raw: string) => {
  const digits = raw.replace(/[\s-]/g, '');
  return digits.startsWith('+974') && isQatarMobileLocalNumber(digits.slice(4));
};

/** The prepaid line being converted - kept as `msisdn`, the key Checkout and the CAF read the order's number from. */
function prepaidNumberStep(): WizardStep {
  return {
    key: 'msisdn',
    label: 'Prepaid Number',
    heading: 'Prepaid number to convert',
    subheading: 'The customer’s prepaid line that moves to a postpaid plan. The number and its balance stay as they are.',
    render: ({ values, setValue }) => (
      <div className="max-w-md">
        <PhoneNumberInput
          label="Prepaid number"
          required
          fixedIso="QA"
          maxNationalDigits={8}
          value={(values.msisdn as string | undefined) ?? ''}
          onChange={(e) => setValue('msisdn', e.target.value)}
          error={values.msisdn && !isValidMsisdn(String(values.msisdn)) ? 'Enter a valid Qatar mobile number.' : undefined}
        />
      </div>
    ),
    isValid: (values) => isValidMsisdn(String(values.msisdn ?? '')),
  };
}

/**
 * Prepaid to Postpaid Conversion, on the same shared steps as New Mobile Postpaid: Customer Identification (the
 * eligibility checks and the customer lock), the prepaid number, Billing Profile, Offers & Plans, Add-ons, Checkout, the full
 * CAF & Signature, and Payment, which submits. The line already exists, so there is no address, number or SIM step.
 */
export function preToPostSteps(
  ctx: QualificationContext & Pick<PostpaidStepContext, 'products' | 'customerBenefits'>
): WizardStep[] {
  const planContext = { products: ctx.products, customerBenefits: ctx.customerBenefits };
  return attachSummaries(
    [
      customerQualificationStep(ctx),
      prepaidNumberStep(),
      billingAccountStep(),
      postpaidPlanStep(planContext),
      postpaidExtrasStep(planContext),
      checkoutSummaryStep(),
      cafSignatureStep({ variant: 'full' }),
      paymentStep({ zeroValueReceipt: true, submitOnPaid: true }),
    ],
    { msisdn: [{ key: 'msisdn', label: 'Prepaid Number', type: 'text', value: (v) => v.msisdn }] }
  );
}
