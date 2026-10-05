import { GuidedContactStep } from '../../../components/patterns/GuidedContactStep';
import { contactSummary } from './stepSummaries';
import { idTypesFor } from '../../../data/idTypes';
import { hasIdentityDetails, isValidAltPhone, isValidEmail } from '../../../components/patterns/guidedContactModel';
import type { GuidedContactValue } from '../../../components/patterns/guidedContactModel';
import { BillingAccountAutoResolver } from '../../../components/patterns/BillingAccountAutoResolver';
import type { BillingAccountValue } from '../../../components/patterns/billingAccountModel';
import { EligibilityGateStep } from '../../../components/domain/EligibilityGateStep';
import type { EligibilityResult } from '../../../components/domain/eligibilityTypes';
import type { WizardStep } from '../../../components/patterns/wizard/guidedWizardTypes';
import { CustomerStatusBanner } from './JourneyBanners';
import { EligibilityOutcomePanel, OutcomeActions } from './EligibilityOutcomes';
import { CustomerTypeStep } from './CustomerTypeStep';
import { isCustomerTypeValid } from './customerTypeModel';
import type { CustomerTypeValue } from './customerTypeModel';
import type { NewConnectionStepContext } from './stepContext';

export function contactStep({ flow, existingCustomerId, guardedContactChange }: NewConnectionStepContext): WizardStep {
  return {
    key: 'contact',
    summary: contactSummary,
    label: 'Customer Identification',
    hideCustomerView: true,
    // 2026-09-28: the separate 'eligibility' step is GONE - no more
    // rail entry, no more skip()/autoAdvanceWhen() dance to hide it on
    // a clean run. Eligibility now lives permanently as a stacked
    // panel at the foot of THIS step, still driven by the same
    // MOI-resolved idNumber, still evaluated the moment MOI resolves
    // (not gated on a Continue click - see the note above isValid).
    // Passing checks render nothing at all (EligibilityGateStep
    // returns null); only what needs the agent's attention appears.
    render: ({ values, setValue }) => {
      const contact = values.contact as GuidedContactValue | undefined;
      const eligibility = values.eligibility as EligibilityResult | undefined;
      return (
        <>
        <GuidedContactStep
          // New Customer journey: whoever the scanned ID belongs to is handled as a genuine new customer.
          asNewCustomer={flow === 'new'}
          // Customer 360 entry: the customer is the one the journey was opened for.
          asCustomerId={flow === 'existing' ? existingCustomerId : undefined}
          // All four ID types are offered (2026-10-04). Passport, GCC ID and Diplomatic ID are exception
          // identification: the eligibility engine routes them to approval rather than blocking them here.
          allowedIdTypes={idTypesFor('new-connection')}
          unavailableIdTypes={[]}
          // ID type chosen first, then scan -> agent verifies number + expiry against the card -> Fetch (MOI).
          verifyThenFetch
          value={(values.contact as GuidedContactValue) ?? {}}
          onChange={(v) => guardedContactChange(v, setValue)}
          showIptvToggle={false}
        />
        {(
        <div className="mt-6 pt-6 border-t border-border-soft space-y-4">
          <CustomerStatusBanner customerId={eligibility?.customerId} />
          <EligibilityOutcomePanel />
          <EligibilityGateStep
            asNewCustomer={flow === 'new'}
            asCustomerId={flow === 'existing' ? existingCustomerId : undefined}
            announcePass={false}
            // Only once MOI has validated the ID (after Fetch) - an unfetched or
            // OCR-misread number must not be run through eligibility.
            idNumber={contact?.moiResult ? contact.idNumber : undefined}
            // Feeding the previous result back in is what makes this a
            // one-time check across re-entries to the step.
            result={eligibility}
            onResult={(r) => setValue('eligibility', r)}
            // No in-panel buttons here: the footer's primary action
            // carries the outcome (see primaryAction below).
          />
        {/* Customer Type used to be its own step; it now follows the
            eligibility panel here, once identity is fetched and
            eligibility has cleared (no hard/soft stop). Same container
            as the eligibility panel so there is a single divider. */}
        {contact?.moiResult && eligibility && !eligibility.hardStop && !eligibility.softStop && (
          <div className="space-y-4">
            <h3 className="text-fg font-semibold text-[length:var(--fs-h5)]">Additional Discounts</h3>
            {/* Headless: stands in for the skipped Billing Profile page. */}
            <BillingAccountAutoResolver
              customerId={eligibility.customerId}
              customerName={contact.moiResult.name}
              value={(values.billingAccount as BillingAccountValue) ?? {}}
              onChange={(v) => setValue('billingAccount', v)}
            />
            <CustomerTypeStep
              value={(values.customerType as CustomerTypeValue) ?? {}}
              onChange={(v) => setValue('customerType', v)}
              idNumber={contact.idNumber}
              onReject={() => {
                // Decline the benefit: stay on this page with every Customer Type selection
                // cleared (company, office ID scan, acceptance) back to Standard, no discount carried.
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
        )}
        </>
      );
    },
    // Continue is the MOI-driven gate, unchanged in kind (2026-09-28):
    // it was always contingent on MOI resolving; it now ALSO requires
    // eligibility to have resolved and cleared. "Cleared" excludes a
    // hard stop (no path exists), a soft stop (Switch to Prepaid is
    // the only path, and that button leaves this wizard rather than
    // calling Continue), and approval-routing (Proceed to Approval is
    // the only path - see onProceedToApproval above). Advisory-only
    // (HRN with no other issue) is NOT excluded: it never sets
    // hardStop/softStop and contributes no 'approval-routing' check,
    // so Continue stays available exactly as a clean pass would.
    isValid: (values) => {
      const c = values.contact as GuidedContactValue | undefined;
      const e = values.eligibility as EligibilityResult | undefined;
      const identityOk = Boolean(
        c?.moiResult && hasIdentityDetails(c ?? {}) && isValidEmail(c?.email) && (!c?.altPhone || isValidAltPhone(c.altPhone))
      );
      if (!identityOk || !e) return false;
      if (e.hardStop || e.softStop) return false;
      // An approval-routing outcome no longer blocks Continue: the journey
      // goes on and the order is held for approval when it is SUBMITTED
      // (see pendingApproval at submit).
      return isCustomerTypeValid(values.customerType as CustomerTypeValue | undefined);
    },
    // "Add a text link on the left side. On click, open a popup
    // showing all eligibility checks performed and their results"
    // (2026-09-28) - the inline panel above goes silent the moment
    // every check clears, so this is the only way back to the full
    // seven-check report once that happens. Renders nothing until
    // eligibility has actually run (EligibilityChecksLink's own
    // guard on `eligibility` being set).
    // Hard stop -> Abandon Order; soft stop -> Proceed to Payment /
    // Continue Prepaid; approval routing -> Request Approval (the same
    // forward path Continue would take, unguarded by isValid, with the
    // order held for approval on submit); advisory / clean -> Continue.
    primaryAction: ({ values, abandon, defaultButton }) => (
      <OutcomeActions
        eligibility={values.eligibility as EligibilityResult | undefined}
        defaultButton={defaultButton}
        // Hard stop: nothing to go back to, so the confirmation has no "Keep working".
        onAbandon={() => abandon({ hideKeepWorking: true })}
      />
    ),
  };
}
