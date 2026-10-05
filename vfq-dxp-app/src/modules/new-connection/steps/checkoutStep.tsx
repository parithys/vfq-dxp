import type { GuidedContactValue } from '../../../components/patterns/guidedContactModel';
import type { EligibilityResult } from '../../../components/domain/eligibilityTypes';
import type { BillingAccountValue } from '../../../components/patterns/billingAccountModel';
import type { SimTypeValue } from '../../../components/domain/SimTypeStep';
import { CheckoutSummaryStep } from '../../../components/patterns/CheckoutSummaryStep';
import type { WizardStep } from '../../../components/patterns/wizard/guidedWizardTypes';
import type { CrossSalesValue } from './crossSalesModel';

export function checkoutStep(): WizardStep {
  return {
    key: 'checkout',
    label: 'Checkout',
    render: ({ values, setValue, goToStepKey }) => {
      const contact = values.contact as GuidedContactValue | undefined;
      const billingAccount = values.billingAccount as BillingAccountValue | undefined;
      // Feeds CheckoutSummaryStep's own `billingMethod` prop, dormant
      // since the old Billing step was removed 2026-09-25 - this
      // step's replacement (Billing Profile) is what gives it
      // something to report again.
      const billingMethod = billingAccount?.selectedProfileId
        ? `Existing account ending …${billingAccount.selectedProfileId.slice(-4)}`
        : billingAccount?.newAccount?.profileName
          ? `${billingAccount.newAccount.profileName} (${billingAccount.newAccount.billMedia ?? 'Email'})`
          : undefined;
      return (
        <CheckoutSummaryStep
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
          onTablesComputed={(t) => setValue('cafTables', t)}
          onLegalFactsComputed={(facts) => setValue('legalFacts', facts)}
          // An accepted offer fixes the plan, so the Plan & Add-ons step is
          // skipped and 'plan' is not a reachable key - jump to Number
          // Selection (the first step still editable) instead of doing nothing.
          onEdit={() =>
            goToStepKey((values.crossSales as CrossSalesValue | undefined)?.decision === 'accepted' ? 'number' : 'plan')
          }
        />
      );
    },
    isValid: () => true,
  };
}
