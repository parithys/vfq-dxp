import { CustomerIdentification } from '../CustomerIdentification/CustomerIdentification';
import { contactSummary } from './summary';
import { idTypesFor } from '../../data/idTypes';
import { CUSTOMER_IDENTIFICATION_LABEL } from '../../data/stepLabels';
import { hasIdentityDetails, isValidAltPhone, isValidEmail } from '../../components/patterns/guidedContactModel';
import type { GuidedContactValue } from '../../components/patterns/guidedContactModel';
import { BillingAccountAutoResolver } from '../../components/patterns/BillingAccountAutoResolver';
import type { BillingAccountValue } from '../../components/patterns/billingAccountModel';
import { EligibilityGateStep } from '../EligibilityGate/EligibilityGateStep';
import type { EligibilityResult } from '../../components/domain/eligibilityTypes';
import type { WizardStep } from '../../components/patterns/wizard/guidedWizardTypes';
import { LAUNCH_CUSTOMER_KEY } from '../../components/patterns/wizard/useJourneyStartResume';
import { CustomerStatusBanner } from './JourneyBanners';
import { EligibilityOutcomePanel, OutcomeActions } from '../EligibilityGate/EligibilityOutcomes';
import { CustomerTypeStep } from '../CustomerType/CustomerTypeStep';
import { isCustomerTypeValid } from '../CustomerType/customerTypeModel';
import type { CustomerTypeValue } from '../CustomerType/customerTypeModel';
import type { JourneyFlow } from '../JourneyCustomerLock/journeyModel';
import type { useJourneyCustomerLock } from '../JourneyCustomerLock/useJourneyCustomerLock';

/** What the qualification step needs from its journey. */
export interface QualificationContext {
  flow: JourneyFlow;
  /** Existing flow: the customer the journey was opened for. */
  existingCustomerId: string | undefined;
  guardedContactChange: ReturnType<typeof useJourneyCustomerLock>['guardedContactChange'];
  /**
   * Postpaid (default) or prepaid. Prepaid (Mobile Prepaid Activation BRSD) offers the four prepaid ID types, runs
   * the prepaid eligibility rules, and has no Special Discounts / customer type and no billing account, since a
   * prepaid line has neither (MPRA_001_CAM_02, ECC_03, BAM_01).
   */
  journeyType?: 'postpaid' | 'prepaid';
  /** Typed ID entry from the start (a keyboard device); the scanner stays beside it. Off, the scanner leads. */
  manualEntry?: boolean;
  /**
   * The step is the shared Customer Identification of a journey that offers several products: the product is not
   * chosen yet, so eligibility reports only the checks common to every product (hard stops), the product-specific
   * ones are judged when the product is chosen, and nothing here is prepaid- or postpaid-only.
   */
  productAgnostic?: boolean;
  /**
   * The journey acts on a customer the business already has (Change Postpaid Plan, Change Prepaid Pack, Add Add-On, Prepaid to Postpaid): whoever
   * the scanned ID belongs to is looked up as the existing customer, not handled as a new one. The default (a New Customer journey) handles them as new.
   */
  knownCustomer?: boolean;
  /**
   * With `knownCustomer`: the customer the agent is acting for (opened from Customer 360 or Customer Search). The scan reads THAT customer's own document and eligibility is
   * judged for them - a scan never returns someone else. Absent, the agent identifies whoever is in front of them.
   */
  knownCustomerId?: string;
}

export function customerQualificationStep({ flow, existingCustomerId, guardedContactChange, journeyType = 'postpaid', manualEntry, productAgnostic = false, knownCustomer = false, knownCustomerId }: QualificationContext): WizardStep {
  const prepaid = journeyType === 'prepaid';
  return {
    key: 'contact',
    summary: prepaid ? contactSummary.filter((f) => f.key !== 'customerType') : contactSummary,
    label: CUSTOMER_IDENTIFICATION_LABEL,
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
      // The customer the journey was opened for (kept in the draft by the wizard), unless the shell names one.
      const actedForId = knownCustomer ? (knownCustomerId ?? (values[LAUNCH_CUSTOMER_KEY] as string | undefined)) : undefined;
      const contact = values.contact as GuidedContactValue | undefined;
      const eligibility = values.eligibility as EligibilityResult | undefined;
      return (
        <>
        <CustomerIdentification
          collectContact
          // New Customer journey: whoever the scanned ID belongs to is handled as a genuine new customer.
          asNewCustomer={flow === 'new' && !knownCustomer}
          // Customer 360 entry: the customer is the one the journey was opened for.
          asCustomerId={flow === 'existing' ? existingCustomerId : actedForId}
          // All four ID types are offered (2026-10-04). Passport, GCC ID and Diplomatic ID are exception
          // identification: the eligibility engine routes them to approval rather than blocking them here.
          allowedIdTypes={idTypesFor(prepaid ? 'prepaid' : 'new-connection')}
          manualEntry={manualEntry}
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
            asNewCustomer={flow === 'new' && !knownCustomer}
            asCustomerId={flow === 'existing' ? existingCustomerId : actedForId}
            announcePass={false}
            journeyType={journeyType}
            // The customer's full set of checks, as the single-product journeys always showed them at Customer Identification: ID type
            // approval, the active-line limit, collections and the rest. (Prepaid and MNP judge a few of them differently once the product
            // is chosen; Product Selection re-judges those.)
            scope="product"
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
        {!prepaid && contact?.moiResult && eligibility && !eligibility.hardStop && (productAgnostic || !eligibility.softStop) && (
          <div className="space-y-4">
            <h3 className="text-fg font-semibold text-[length:var(--fs-h5)]">Special Discounts</h3>
            {/* Headless: stands in for the skipped Billing Profile page. */}
            {/* Product-agnostic identification leaves the billing account to the product stage (not every product has one). */}
            {!productAgnostic && (
              <BillingAccountAutoResolver
                customerId={eligibility.customerId}
                customerName={contact.moiResult.name}
                value={(values.billingAccount as BillingAccountValue) ?? {}}
                onChange={(v) => setValue('billingAccount', v)}
              />
            )}
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
      // A soft stop (a postpaid collections block) belongs to the product chosen later, not to identification.
      if (e.hardStop || (!productAgnostic && e.softStop)) return false;
      // An approval-routing outcome no longer blocks Continue: the journey
      // goes on and the order is held for approval when it is SUBMITTED
      // (see pendingApproval at submit).
      return prepaid || isCustomerTypeValid(values.customerType as CustomerTypeValue | undefined);
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
        // With the product not chosen yet, a collections soft stop is not an end of the road (prepaid is still offered): Continue goes on to
        // Product Selection rather than offering the Postpaid-only "Proceed to Payment".
        eligibility={productAgnostic && (values.eligibility as EligibilityResult | undefined)?.softStop ? { ...(values.eligibility as EligibilityResult), softStop: false } : (values.eligibility as EligibilityResult | undefined)}
        defaultButton={defaultButton}
        // Hard stop: nothing to go back to, so the confirmation has no "Keep working".
        onAbandon={() => abandon({ hideKeepWorking: true })}
      />
    ),
  };
}
