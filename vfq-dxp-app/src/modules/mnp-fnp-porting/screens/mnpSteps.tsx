import type { WizardStep } from '../../../components/patterns/wizard/guidedWizardTypes';
import * as sums from '../../../components/patterns/wizard/commonSummaries';
import { attachSummaries } from '../../../components/patterns/wizard/stepSummary';
import { activityStep, billingAccountStep, cafSignatureStep, paymentStep, planSelectionStep, serviceAddressStep, simSerialStep } from '../../../capabilities';
import type { EligibilityResult } from '../../../components/domain/eligibilityTypes';
import type { BillingAccountValue } from '../../../components/patterns/billingAccountModel';
import { MnpCheckout } from './MnpCheckout';
import { gatePasses, mnpValidationGate } from './mnpValidationGate';
import { contactOf, isPrepaidMnp, mnpFormInputOf } from './mnpFormInput';

export { mnpFormInputOf };
import { DonorDetailsStep, donorDetailsValid } from '../../../components/patterns/DonorDetailsStep';
import type { DonorDetailsValue } from '../../../components/patterns/DonorDetailsStep';
import { DonorAttachmentStep, mnpFormSigned } from '../../../components/patterns/DonorAttachmentStep';
import type { DonorAttachmentValue } from '../../../components/patterns/DonorAttachmentStep';

// The MNP port-in steps, after Customer Identification and Product Selection (the first two steps of New Connection, which
// MNP shares with the other products; the Postpaid/Prepaid choice is made on the product step and kept as `mnpType`).
//   Postpaid: Address -> Billing Profile -> SIM Serial -> Plan (Bill Limit) -> Donor Details -> Checkout -> MNP Form -> CAF -> Payment -> Activity.
//   Prepaid:  Address -> SIM Serial -> Plan (prepaid pack + discount) -> Donor Details -> Checkout -> MNP Form -> CAF -> Payment -> Activity,
// with no billing account (a prepaid line carries no credit limit or bill cycle, BR-002/BR-005) and the BR-233
// balance-forfeiture declaration on the CAF. NewMnpWizard.tsx keeps the evidence behind each.
export function mnpSteps(): WizardStep[] {
  const postpaidOnly = (step: WizardStep): WizardStep => ({ ...step, skip: isPrepaidMnp });
  const prepaidOnly = (step: WizardStep): WizardStep => ({ ...step, skip: (values) => !isPrepaidMnp(values) });
  return attachSummaries([
    serviceAddressStep({
      mode: 'structured',
      identity: (values) => ({ idNumber: contactOf(values)?.idNumber, nationality: contactOf(values)?.moiResult?.nationality }),
    }),
    postpaidOnly(billingAccountStep()),
    simSerialStep(),
    { ...postpaidOnly(planSelectionStep({ kind: 'catalogue', planType: 'Postpaid Plan', billLimit: true })), summary: sums.planDetailSummary },
    { ...prepaidOnly(planSelectionStep({ kind: 'prepaid' })), summary: [...sums.planSummary(), { key: 'discount', label: 'Discount', type: 'select', optional: true, labelFrom: { kind: 'addons-discounts', idField: 'addonDiscountId', labelField: 'name' }, value: (v) => v.discountId }] },
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
    {
      // BRSD #8 Cart check-out: the validation gate (BR-MNP-009) and what is due today (BR-MNP-011). Continue stays off until every
      // mandatory customer, billing, SIM, MNP and product validation is done.
      key: 'checkout',
      label: 'Checkout',
      summary: [{ key: 'due', label: 'Total Payable Today', type: 'text', value: (v) => {
        const due = (v.checkoutTotals as { dueTodayQar?: number } | undefined)?.dueTodayQar;
        return typeof due === 'number' ? `QAR ${due.toLocaleString('en-GB')}` : undefined;
      } }],
      render: ({ values, setValue, goToStepKey }) => {
        const billing = values.billingAccount as BillingAccountValue | undefined;
        const donor = values.donorDetails as DonorDetailsValue | undefined;
        const fixStep: Record<string, string> = { customer: 'contact', eligibility: 'product', billing: 'billingAccount', plan: 'plan', sim: 'sim', mnp: 'donor-details' };
        return (
          <MnpCheckout
            customerName={contactOf(values)?.moiResult?.name}
            portInNumber={donor?.portInNumber}
            donorOperator={donor?.donorOperator}
            productId={values.productId as string | undefined}
            simSerial={values.simSerial as string | undefined}
            mnpType={isPrepaidMnp(values) ? 'prepaid' : 'postpaid'}
            billingLabel={billing?.selectedProfileId ? `Existing account ending ...${billing.selectedProfileId.slice(-4)}` : billing?.newAccount?.profileName}
            requiresHrnAdvance={Boolean((values.eligibility as EligibilityResult | undefined)?.requiresHrnAdvance)}
            gate={mnpValidationGate(values, 'checkout')}
            onTotalsComputed={(totals) => setValue('checkoutTotals', totals)}
            onFix={(id) => goToStepKey(fixStep[id] ?? 'contact')}
          />
        );
      },
      isValid: (values) => gatePasses(mnpValidationGate(values, 'checkout')),
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
    }),
    // BR-MNP-011: the port-in charges, deposit and advance payment are collected before submission; with nothing due, a zero-value receipt.
    paymentStep({ zeroValueReceipt: true }),
    activityStep(),
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
