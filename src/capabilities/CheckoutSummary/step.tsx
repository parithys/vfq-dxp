import { CHECKOUT_LABEL, SUBSCRIPTIONS_LABEL } from '../../data/stepLabels';
import type { WizardStep } from '../../components/patterns/wizard/guidedWizardTypes';
import { CheckoutSummary, PrepaidCheckout } from './CheckoutSummary';
import { PrepaidCartBody } from './PrepaidCartBody';
import { allLines, isCartValid } from '../../components/patterns/prepaidCartModel';
import type { SummaryField } from '../../components/patterns/wizard/stepSummary';
import { at } from '../summaryKit';
import { checkoutSummary } from './summary';
import type { BillingAccountValue } from '../../components/patterns/billingAccountModel';
import type { EligibilityResult } from '../../components/domain/eligibilityTypes';
import type { SimTypeValue } from '../../components/domain/SimTypeStep';
import type { GuidedContactValue } from '../../components/patterns/guidedContactModel';

/**
 * Checkout summary: reads the order's facts from the standard value keys (contact, billingAccount, productId,
 * discountId, addonIds, msisdn, numberPriceQAR, eligibility, billLimit, simType) and stores what it computes
 * (checkoutTotals, cafSummary, legalFacts) for the CAF & Signature step. `editStepKey` says which step
 * the summary's Edit action returns to (the plan step, unless an accepted offer skipped it).
 */
export function checkoutSummaryStep(opts: { editStepKey?: (values: Record<string, unknown>) => string } = {}): WizardStep {
  return {
    key: 'checkout',
    label: CHECKOUT_LABEL,
    summary: checkoutSummary,
    render: ({ values, setValue, goToStepKey }) => {
      const contact = values.contact as GuidedContactValue | undefined;
      const billingAccount = values.billingAccount as BillingAccountValue | undefined;
      const billingMethod = billingAccount?.selectedProfileId
        ? `Existing account ending …${billingAccount.selectedProfileId.slice(-4)}`
        : billingAccount?.newAccount?.profileName
          ? `${billingAccount.newAccount.profileName} (${billingAccount.newAccount.billMedia ?? 'Email'})`
          : undefined;
      return (
        <CheckoutSummary
          layout="detailed"
          customerName={
            [contact?.firstName, contact?.middleName, contact?.lastName].filter(Boolean).join(', ') || contact?.moiResult?.name
 }
          altPhone={contact?.altPhone}
          billingMethod={billingMethod}
          productId={values.productId as string | undefined}
          discountId={values.discountId as string | undefined}
          addonIds={(values.addonIds as string[] | undefined) ?? []}
          msisdn={values.msisdn as string | undefined}
          numberPriceQar={values.numberPriceQAR as number | undefined}
          eligibility={values.eligibility as EligibilityResult | undefined}
          billLimit={values.billLimit as number | undefined}
          simType={values.simType as SimTypeValue | undefined}
          onTotalsComputed={(totals) => setValue('checkoutTotals', totals)}
          onSummaryComputed={(rows) => setValue('cafSummary', rows)}
          onLegalFactsComputed={(facts) => setValue('legalFacts', facts)}
          onEdit={() => goToStepKey(opts.editStepKey?.(values) ?? 'plan')}
        />
      );
 },
    isValid: () => true,
 };
}

/** The subscriptions on a prepaid order, for the running Summary panel. */
const subscriptionsSummary: SummaryField[] = [
  {
    key: 'subscriptions',
    label: 'Subscriptions',
    type: 'text',
    value: (v) => {
      const lines = allLines(v);
      return lines.length === 0 ? undefined : lines.map((l) => l.msisdn).join(', ');
    },
  },
];

/**
 * Prepaid "Add another subscription?" (process flow #8.1): lists the subscriptions so far; the footer's Continue is
 * the "No" branch (go on to checkout). Valid once there is a finished subscription and none repeats a number or SIM.
 */
export function prepaidCartStep(): WizardStep {
  return {
    key: 'cart',
    label: SUBSCRIPTIONS_LABEL,
    heading: 'Add another subscription?',
    subheading: 'Each subscription is one pack, one number and one SIM.',
    summary: subscriptionsSummary,
    render: ({ values, setValue, goToStepKey }) => <PrepaidCartBody values={values} setValue={setValue} goToStepKey={goToStepKey} />,
    isValid: isCartValid,
  };
}

/**
 * Prepaid checkout: the read-back of the whole cart. `idType` is the customer's ID type, which decides the SIM card
 * charge. Stores `checkoutTotals` (totalDueQar is what the Payment step collects).
 */
export function prepaidCheckoutStep(opts: { idType: (values: Record<string, unknown>) => string | undefined; customerName: (values: Record<string, unknown>) => string | undefined }): WizardStep {
  return {
    key: 'checkout',
    label: CHECKOUT_LABEL,
    summary: [{ key: 'due', label: 'Total Payable Today', type: 'text', value: (v) => {
      const due = at(v, 'checkoutTotals', 'totalDueQar');
      return typeof due === 'number' ? `QAR ${due.toLocaleString('en-GB')}` : undefined;
    } }],
    render: ({ values, setValue, goToStepKey }) => (
      <PrepaidCheckout
        customerName={opts.customerName(values)}
        idType={opts.idType(values)}
        lines={allLines(values)}
        onTotalsComputed={(totals) => setValue('checkoutTotals', totals)}
        onEdit={() => goToStepKey('cart')}
      />
    ),
    isValid: (values) => isCartValid(values),
  };
}
