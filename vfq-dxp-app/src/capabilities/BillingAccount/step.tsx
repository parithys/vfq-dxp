import type { GuidedContactValue } from '../../components/patterns/guidedContactModel';
import { billingAccountSummary } from './summary';
import { maskEmail } from '../../components/patterns/guidedContactModel';
import type { EligibilityResult } from '../../components/domain/eligibilityTypes';
import type { ZsbAddressValue } from '../../components/patterns/ZsbAddressStep';
import { BillingAccount } from './BillingAccount';
import { BillingAccountAutoResolver } from '../../components/patterns/BillingAccountAutoResolver';
import { BILLING_PROFILE_LABEL } from '../../data/stepLabels';
import { isBillingAccountValid } from '../../components/patterns/billingAccountModel';
import type { BillingAccountValue } from '../../components/patterns/billingAccountModel';
import type { WizardStep } from '../../components/patterns/wizard/guidedWizardTypes';

// "Billing Profile" (2026-09-28 request) - Step 3, immediately
// after Communication Address. NOT a revival of the old Billing
// step removed 2026-09-25 (Language/Payment Type/Payment Method/
// Bill Media, SCR-156) - that component is gone. This
// is a different, much larger step: pick one of the customer's
// existing billing accounts, or create one (contact, address,
// card-on-file tokenization, bill cycle, and the profile's own
// name/media/schedule) - see BillingAccountStep.tsx's own notes on
// which parts of this are evidenced business rule versus an
// app-level demo assumption (the "Gatan" gateway name and the
// "VIP" segment/7th-of-month default have no evidence anywhere in
// this corpus).
export function billingAccountStep(opts: { /** What the new profile is for, in its name ("... - Postpaid"). */ profileSuffix?: string } = {}): WizardStep {
  return {
    key: 'billingAccount',
    summary: billingAccountSummary,
    // Passed over on the way forward. An existing billing account is selected automatically, or one is created when there is none
    // (never reported as a problem): BillingAccountAutoResolver, mounted by the wizard for this step wherever the journey enters it
    // (a journey that skips Product Selection included). The step stays in the rail so the agent can go back and change either.
    autoPass: () => true,
    headless: ({ values, setValue }) => {
      const contact = values.contact as GuidedContactValue | undefined;
      if (!contact?.moiResult) return null;
      return (
        <BillingAccountAutoResolver
          customerId={(values.eligibility as EligibilityResult | undefined)?.customerId}
          customerName={contact.moiResult.name}
          profileSuffix={opts.profileSuffix}
          value={(values.billingAccount as BillingAccountValue) ?? {}}
          onChange={(v) => setValue('billingAccount', v)}
        />
      );
    },
    label: BILLING_PROFILE_LABEL,
    render: ({ values, setValue }) => {
      const eligibility = values.eligibility as EligibilityResult | undefined;
      const address = values.address as ZsbAddressValue | undefined;
      const defaultAddressLine =
        [address?.streetNo && `Street ${address.streetNo}`, address?.zone && `Zone ${address.zone}`, address?.area, address?.addressLine]
          .filter(Boolean)
          .join(', ') || undefined;
      return (
        <BillingAccount
          customerId={eligibility?.customerId}
          defaultAddressLine={defaultAddressLine}
          value={(values.billingAccount as BillingAccountValue) ?? {}}
          onChange={(v) => setValue('billingAccount', v)}
          customerName={(values.contact as GuidedContactValue | undefined)?.moiResult?.name}
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
