import type { GuidedContactValue } from '../../../components/patterns/guidedContactModel';
import { maskEmail } from '../../../components/patterns/guidedContactModel';
import type { EligibilityResult } from '../../../components/domain/eligibilityTypes';
import type { ZsbAddressValue } from '../../../components/patterns/ZsbAddressStep';
import { BillingAccountStep } from '../../../components/patterns/BillingAccountStep';
import { isBillingAccountValid } from '../../../components/patterns/billingAccountModel';
import type { BillingAccountValue } from '../../../components/patterns/billingAccountModel';
import type { WizardStep } from '../../../components/patterns/wizard/guidedWizardTypes';

// "Billing Profile" (2026-09-28 request) - Step 3, immediately
// after Communication Address. NOT a revival of the old Billing
// step removed 2026-09-25 (Language/Payment Type/Payment Method/
// Bill Media, SCR-156) - that component (BillingProfileStep.tsx)
// still exists and is still used by NewMnpWizard, untouched. This
// is a different, much larger step: pick one of the customer's
// existing billing accounts, or create one (contact, address,
// card-on-file tokenization, bill cycle, and the profile's own
// name/media/schedule) - see BillingAccountStep.tsx's own notes on
// which parts of this are evidenced business rule versus an
// app-level demo assumption (the "Gatan" gateway name and the
// "VIP" segment/7th-of-month default have no evidence anywhere in
// this corpus).
export function billingAccountStep(): WizardStep {
  return {
    key: 'billingAccount',
    // 2026-10-01: passed over on the way forward. An existing billing
    // account is selected automatically, or one is created when there
    // is none, by BillingAccountAutoResolver (mounted on the Customer
    // Type step). The step stays in the rail so the agent can go back
    // and change either.
    autoPass: () => true,
    label: 'Billing Profile',
    render: ({ values, setValue }) => {
      const eligibility = values.eligibility as EligibilityResult | undefined;
      const address = values.address as ZsbAddressValue | undefined;
      const defaultAddressLine =
        [address?.streetNo && `Street ${address.streetNo}`, address?.zone && `Zone ${address.zone}`, address?.area, address?.addressLine]
          .filter(Boolean)
          .join(', ') || undefined;
      return (
        <BillingAccountStep
          customerId={eligibility?.customerId}
          defaultAddressLine={defaultAddressLine}
          value={(values.billingAccount as BillingAccountValue) ?? {}}
          onChange={(v) => setValue('billingAccount', v)}
          customerEmail={(() => {
            const c = values.contact as GuidedContactValue | undefined;
            return c?.moiResult?.isNewCustomer && c.email ? maskEmail(c.email) : c?.email;
          })()}
        />
      );
    },
    isValid: (values) => isBillingAccountValid((values.billingAccount as BillingAccountValue) ?? {}),
  };
}
