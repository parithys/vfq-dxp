import type { WizardStep } from '../../../components/patterns/wizard/guidedWizardTypes';
import * as sums from '../../../components/patterns/wizard/commonSummaries';
import { attachSummaries } from '../../../components/patterns/wizard/stepSummary';
import { billingAccountStep, cafSignatureStep, checkoutSummaryStep, paymentStep, planSelectionStep, postpaidExtrasStep, postpaidPlanStep, prepaidExtrasStep, serviceAddressStep, simSerialStep } from '../../../capabilities';
import type { PostpaidStepContext } from '../../new-connection/postpaidSteps';
import { CHECKOUT_LABEL } from '../../../data/stepLabels';
import type { EligibilityResult } from '../../../components/domain/eligibilityTypes';
import { normalizePortInNumber } from '../../../data/portInRules';
import { MnpCheckout, MnpValidationGate } from './MnpCheckout';
import { gatePasses, mnpValidationGate } from './mnpValidationGate';
import { contactOf, isPrepaidMnp, mnpFormInputOf } from './mnpFormInput';

export { mnpFormInputOf };
import { DonorDetailsStep, donorDetailsValid } from '../../../components/patterns/DonorDetailsStep';
import type { DonorDetailsValue } from '../../../components/patterns/DonorDetailsStep';
import { DonorAttachmentStep, mnpFormSigned } from '../../../components/patterns/DonorAttachmentStep';
import type { DonorAttachmentValue } from '../../../components/patterns/DonorAttachmentStep';

// The MNP port-in steps, after Customer Identification and Product Selection (the first two steps of New Connection, which
// MNP shares with the other products; the Postpaid/Prepaid choice is made on the product step and kept as `mnpType`).
//   Postpaid: Address -> Billing Profile -> SIM Serial -> Plan -> Add-ons (Bill Limit, discounts) -> Donor Details -> Checkout -> MNP Form -> CAF -> Payment -> Activity.
//   Prepaid:  Address -> SIM Serial -> Plan (prepaid pack + discount) -> Donor Details -> Checkout -> MNP Form -> CAF -> Payment -> Activity,
// with no billing account (a prepaid line carries no credit limit or bill cycle, BR-002/BR-005) and the BR-233
// balance-forfeiture declaration on the CAF. NewMnpWizard.tsx keeps the evidence behind each.
const FIX_STEP: Record<string, string> = { customer: 'contact', eligibility: 'product', billing: 'billingAccount', plan: 'plan', sim: 'sim', mnp: 'donor-details' };

export function mnpSteps({ products = [], customerBenefits }: Partial<Pick<PostpaidStepContext, 'products' | 'customerBenefits'>> = {}): WizardStep[] {
  const planContext = { products, customerBenefits };
  const postpaidOnly = (step: WizardStep): WizardStep => ({ ...step, skip: isPrepaidMnp });
  const prepaidOnly = (step: WizardStep): WizardStep => ({ ...step, skip: (values) => !isPrepaidMnp(values) });
  return attachSummaries([
    serviceAddressStep({
      mode: 'structured',
      autoPass: true,
      identity: (values) => ({ idNumber: contactOf(values)?.idNumber, nationality: contactOf(values)?.moiResult?.nationality }),
    }),
    postpaidOnly(billingAccountStep()),
    simSerialStep(),
    // The same Plan and Add-ons steps as New Mobile Postpaid: plan cards, add-ons, eligible discounts, bill limit.
    postpaidOnly(postpaidPlanStep(planContext)),
    postpaidOnly(postpaidExtrasStep(planContext)),
    { ...prepaidOnly(planSelectionStep({ kind: 'prepaid', segment: (values) => (values.eligibility as EligibilityResult | undefined)?.segment })), summary: sums.planSummary() },
    {
      ...prepaidOnly(prepaidExtrasStep({ segment: (values) => (values.eligibility as EligibilityResult | undefined)?.segment })),
      summary: [
        { key: 'discount', label: 'Discount', type: 'select', optional: true, labelFrom: { kind: 'addons-discounts', idField: 'addonDiscountId', labelField: 'name' }, value: (v) => v.discountId },
        { key: 'addons', label: 'Add-ons', type: 'multi', optional: true, labelFrom: { kind: 'addons-discounts', idField: 'addonDiscountId', labelField: 'name' }, value: (v) => v.addonIds },
      ],
    },
    {
      key: 'donor-details',
      label: 'Donor Details',
      render: ({ values, setValue }) => (
        <DonorDetailsStep
          value={(values.donorDetails as DonorDetailsValue) ?? {}}
          onChange={(v) => setValue('donorDetails', v)}
        />
      ),
      isValid: (values) => donorDetailsValid(values.donorDetails as DonorDetailsValue | undefined),
    },
    // BRSD #8 Cart check-out: the validation gate (BR-MNP-009) and what is due today (BR-MNP-011). Continue stays off until every
    // mandatory customer, billing, SIM, MNP and product validation is done. Postpaid is the shared Checkout Summary capability (the
    // port-in number is its number), with the gate above it; prepaid reads back its single pack.
    {
      ...postpaidOnly(
        checkoutSummaryStep({
          msisdn: (values) => normalizePortInNumber((values.donorDetails as DonorDetailsValue | undefined)?.portInNumber ?? '') ?? undefined,
          before: ({ values, goToStepKey }) => <MnpValidationGate gate={mnpValidationGate(values, 'checkout')} onFix={(id) => goToStepKey(FIX_STEP[id] ?? 'contact')} />,
          isValid: (values) => gatePasses(mnpValidationGate(values, 'checkout')),
        })
      ),
    },
    {
      ...prepaidOnly({
        key: 'checkout',
        label: CHECKOUT_LABEL,
        summary: [{ key: 'due', label: 'Total Payable Today', type: 'text', value: (v) => {
          const due = (v.checkoutTotals as { dueTodayQar?: number } | undefined)?.dueTodayQar;
          return typeof due === 'number' ? `QAR ${due.toLocaleString('en-GB')}` : undefined;
        } }],
        render: ({ values, setValue, goToStepKey }) => {
          const donor = values.donorDetails as DonorDetailsValue | undefined;
          return (
            <MnpCheckout
              customerName={contactOf(values)?.moiResult?.name}
              portInNumber={donor?.portInNumber}
              donorOperator={donor?.donorOperator}
              productId={values.productId as string | undefined}
              simSerial={values.simSerial as string | undefined}
              gate={mnpValidationGate(values, 'checkout')}
              onTotalsComputed={(totals) => setValue('checkoutTotals', totals)}
              onFix={(id) => goToStepKey(FIX_STEP[id] ?? 'contact')}
            />
          );
        },
        isValid: (values) => gatePasses(mnpValidationGate(values, 'checkout')),
      }),
    },
    {
      key: 'donor-attachment',
      label: 'MNP Form',
      render: ({ values, setValue }) => (
        <DonorAttachmentStep
          value={(values.donorAttachment as DonorAttachmentValue) ?? {}}
          onChange={(v) => setValue('donorAttachment', v)}
          form={mnpFormInputOf(values)}
        />
      ),
      // Signed, and signed on the data the journey holds now (a later change to it regenerates the form and clears the signature).
      isValid: (values) => mnpFormSigned(values.donorAttachment as DonorAttachmentValue | undefined, mnpFormInputOf(values)),
    },
    // Postpaid: the full CAF, as New Mobile Postpaid - the customer reads back the order the Checkout Summary computed and signs on
    // the device's pad (Digital on the web, Touch Screen on a tablet, which is also what the validation gate requires).
    postpaidOnly(cafSignatureStep({ variant: 'full', customerName: (values) => contactOf(values)?.moiResult?.name })),
    prepaidOnly(
      cafSignatureStep({
        customerName: (values) => contactOf(values)?.moiResult?.name,
        // Prepaid port-in only: BR-233 - unused balance is forfeited on switching, shown before signature, and the
        // CAF reads back the ID it was identified with.
        keyInformation: (values) =>
          isPrepaidMnp(values)
            ? [
                'Any unused prepaid balance must be used before the number is switched - remaining balance is forfeited once porting completes.',
                "Porting is a request, not an instant switch - the donor operator's response determines the final port date.",
              ]
            : undefined,
        idDocument: (values) => (isPrepaidMnp(values) ? { label: contactOf(values)?.idType ?? 'ID Number', value: contactOf(values)?.idNumber } : undefined),
        // As the New Connection journeys: the CAF type follows the device (Digital on the web, Touch Screen on a tablet) and both are
        // signed on screen - which is also what the validation gate requires, so the step can no longer pass while the gate fails.
        autoDetectDevice: true,
        needsSignature: (type) => type === 'Digital' || type === 'Touch Screen',
      })
    ),
    // BR-MNP-011: the port-in charges, deposit and advance payment are collected before submission; with nothing due, a zero-value receipt.
    // As the New Connection journeys: Payment is the last step and submits the order the moment it is confirmed; the agent's
    // activity note is the confirmation page's Create Activity.
    paymentStep({ zeroValueReceipt: true, submitOnPaid: true }),
  ], {
    address: sums.addressFormSummary(),
    sim: [
      { key: 'serial', label: 'SIM Serial Number', type: 'text', sensitive: true, value: (v) => v.simSerial },
      { key: 'valid', label: 'Validated', type: 'toggle', value: (v) => Boolean(v.simValid) },
    ],
    'donor-details': sums.donorSummary,
    'donor-attachment': sums.donorAttachmentSummary,
    caf: sums.cafSummary,
    payment: sums.paymentSummary,
  });
}
