import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GuidedActivationWizard } from '../../../components/patterns/GuidedActivationWizard';
import { monthlyCharges } from '../../../engines/postpaidPricing';
import { GuidedContactStep, isValidAltPhone, isValidEmail, hasIdentityDetails, emailVerification } from '../../../components/patterns/GuidedContactStep';
import type { GuidedContactValue } from '../../../components/patterns/GuidedContactStep';
import { ZsbAddressStep } from '../../../components/patterns/ZsbAddressStep';
import type { ZsbAddressValue } from '../../../components/patterns/ZsbAddressStep';
import { BillingAccountStep, isBillingAccountValid } from '../../../components/patterns/BillingAccountStep';
import type { BillingAccountValue } from '../../../components/patterns/BillingAccountStep';
import { PostpaidPlanAddonsStep, SUPPORTING_ID_DISCOUNT_TYPES } from '../../../components/patterns/PostpaidPlanAddonsStep';
import { MsisdnPicker } from '../../../components/domain/MsisdnPicker';
import { EligibilityGateStep, EligibilityChecksLink } from '../../../components/domain/EligibilityGateStep';
import type { EligibilityResult } from '../../../components/domain/EligibilityGateStep';
import { SimTypeStep } from '../../../components/domain/SimTypeStep';
import type { SimTypeValue } from '../../../components/domain/SimTypeStep';
import { EsimActivationPanel } from '../../../components/domain/EsimActivationPanel';
import { CheckoutSummaryStep } from '../../../components/patterns/CheckoutSummaryStep';
import type { TncLegalFacts, CheckoutTotals } from '../../../components/patterns/CheckoutSummaryStep';
import { WinCashPaymentStep } from '../../../components/patterns/WinCashPaymentStep';
import type { WinCashPaymentValue } from '../../../components/patterns/WinCashPaymentStep';
import { CafSignatureCapture } from '../../../components/patterns/CafSignatureCapture';
import type { CafType } from '../../../components/patterns/CafSignatureCapture';
import type { AdditionalDocument } from '../../../components/domain/AdditionalDocumentsUpload';
import { OrderConfirmationScreen } from '../../../components/patterns/OrderConfirmationScreen';
import * as mockDataEngine from '../../../engines/mockDataEngine';
import { useEntityStore } from '../../../stores/entityStore';

const WIZARD_ID = 'new-postpaid';

// Placeholder pending business confirmation (2026-09-28: "Do not assume
// Agent 360 as the destination, as this has not been finalised. Keep the
// post-exit destination configurable until confirmed"). A single named
// constant rather than a config-engine entry: the value itself is explicitly
// unconfirmed, so a whole schema/file for it would be structure built for a
// requirement that does not exist yet. Change this one line - used by both
// Save & Exit and Abandon - once the real destination is decided.
const POST_EXIT_DESTINATION = '/';

/**
 * "Start Fibre Activation" on the confirmation screen (2026-09-30) - a
 * cross-sell into the Fixed Line/Fibre wizard for the same counter visit,
 * replacing the previous same-wizard "Start Another Activation" reset.
 * SCR-043, the same registered New Fibre Connection entry point
 * journeyCatalogue.ts and FibreHomeSection's own product action use.
 */
const FIBRE_ACTIVATION_ROUTE = '/fixed-line-fibre/new-fixed-line-wizard-contact-step';

interface Product {
  productId: string;
  name: string;
  mrcQAR: number;
  /** See PostpaidPlanAddonsStep's PostpaidPlan.preBundledOffer for what this
   * drives - the 'plan' step's autoAdvanceWhen below is the other half. */
  preBundledOffer?: boolean;
}

interface ConfirmedOrder {
  orderId: string;
  pendingApproval: boolean;
  customerName: string;
  msisdn: string;
  planName: string;
  dueTodayQar: number;
  monthlyRecurringQar: number;
  simType?: string;
  /** Set only for eSIM orders - drives the QR handover panel below. */
  esimActivationCode?: string;
  /**
   * The account's own contact email, whatever it is - no longer gated on
   * verification (2026-09-28: "populate it only from existing account
   * contact emails," shown even when unverified so the agent can see why
   * sending is blocked). See customerEmailVerified for the gate itself.
   */
  customerEmail?: string;
  /** Same definition as GuidedContactStep's own emailVerification tick. */
  customerEmailVerified: boolean;
}

// SCR-154/155/156/159/157/158/160/161/162 - the New Postpaid guided wizard
// (UJ-042 "New Postpaid Connection," high confidence), aligned to the
// reference 12-step activation flow (Queue Token/ID Scan are pre-wizard;
// this covers ID Scan's MOI result onward): Contact -> Eligibility Gate ->
// Address -> Plan & Add-ons -> Number Selection -> SIM Type -> Checkout ->
// CAF/Signature -> Payment (WinCash) -> Confirmation. Billing, Device & DOI
// and Activity have each been removed since that reference flow was written
// (2026-09-25 and -27); the nine steps above are what the wizard renders.
// The Address step surfaces conflict-report.md Conflict 2 (ZSB-mandatory-for-
// mobile) rather than silently resolving it - see ZsbAddressStep/ruleEngine.ts.
export function NewPostpaidWizard() {
  const navigate = useNavigate();
  const createRecord = useEntityStore((s) => s.createRecord);
  const [confirmedOrder, setConfirmedOrder] = useState<ConfirmedOrder | null>(null);
  // Fetched once at the wizard level (2026-09-28) rather than inside a single
  // step, so Number Selection can resolve the selected plan's MRC for BR-115's
  // star-number entitlement without re-fetching the same catalogue
  // PostpaidPlanAddonsStep already reads for itself.
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => {
    mockDataEngine.list<Product>('products').then(setProducts);
  }, []);

  if (confirmedOrder) {
    return (
      <div className="p-8">
        <OrderConfirmationScreen
          heading={confirmedOrder.pendingApproval ? 'Order submitted for approval' : 'Postpaid activation complete'}
          orderId={confirmedOrder.orderId}
          // Shown here rather than on the SIM Type step: by this point the
          // order is submitted, so the code the customer scans belongs to an
          // activation that actually exists.
          handoverPanel={
            confirmedOrder.esimActivationCode ? (
              <EsimActivationPanel
                activationCode={confirmedOrder.esimActivationCode}
                customerEmail={confirmedOrder.customerEmail}
                verified={confirmedOrder.customerEmailVerified}
              />
            ) : undefined
          }
          summaryLines={[
            { label: 'Customer', value: confirmedOrder.customerName },
            { label: 'MSISDN', value: confirmedOrder.msisdn },
            { label: 'Plan', value: confirmedOrder.planName },
            { label: 'SIM Type', value: confirmedOrder.simType ?? '-' },
            { label: 'Due today', value: `QR ${confirmedOrder.dueTodayQar}` },
            { label: 'Monthly recurring', value: `QR ${confirmedOrder.monthlyRecurringQar}/mo` },
            { label: 'Status', value: confirmedOrder.pendingApproval ? 'Submitted for Approval' : 'Complete' },
          ]}
          actions={[
            {
              label: 'View Order',
              variant: 'primary-rect',
              onClick: () => navigate(`/order-management/order-approval-detail-attachments-order-details-activities-a?id=${confirmedOrder.orderId}`),
            },
            { label: 'Start Fibre Activation', onClick: () => navigate(FIBRE_ACTIVATION_ROUTE) },
          ]}
        />
      </div>
    );
  }

  return (
    <div className="p-8">
      <GuidedActivationWizard
        wizardId={WIZARD_ID}
        title="New Postpaid Activation"
        // Abandoning drops the draft and returns the agent to the dashboard,
        // ready for the next customer. Matters most on a hard-stopped
        // Eligibility: the order cannot advance, so without this the agent is
        // left holding a draft with nothing to do about it.
        onAbandon={() => navigate(POST_EXIT_DESTINATION)}
        // "Keep Cancel available after CAF signing and until payment starts"
        // (2026-09-28) - Abandon disappears once the agent reaches Payment,
        // where WinCash may already hold the transaction outside this app's
        // own reach. See WinCashPaymentStep's own note on this.
        hideAbandonFrom="payment"
        // Save & Exit (2026-09-28), distinct from Abandon: keeps the draft
        // for later resumption. GuidedActivationWizard does the actual save;
        // this only says where to go afterward.
        onSaveExit={() => navigate(POST_EXIT_DESTINATION)}
        steps={[
          {
            key: 'contact',
            label: 'Contact',
            // 2026-09-28: the separate 'eligibility' step is GONE - no more
            // rail entry, no more skip()/autoAdvanceWhen() dance to hide it on
            // a clean run. Eligibility now lives permanently as a stacked
            // panel at the foot of THIS step, still driven by the same
            // MOI-resolved idNumber, still evaluated the moment MOI resolves
            // (not gated on a Continue click - see the note above isValid).
            // Passing checks render nothing at all (EligibilityGateStep
            // returns null); only what needs the agent's attention appears.
            render: ({ values, setValue, goNext }) => {
              const contact = values.contact as GuidedContactValue | undefined;
              const eligibility = values.eligibility as EligibilityResult | undefined;
              return (
                <>
                <GuidedContactStep
                  // Direct postpaid sale is limited to a valid QID or
                  // Diplomatic ID (2026-09-25). Passport, GCC ID and other
                  // exception identification go through CBM approval, so they
                  // are not offered here at all - the eligibility engine still
                  // routes them if one reaches it via another journey.
                  allowedIdTypes={['QID', 'Diplomatic ID']}
                  // Shown greyed rather than omitted (2026-09-27): an agent
                  // holding a passport needs to see the option exists and why it
                  // is closed. Selecting one stays impossible until the exception
                  // approval workflow behind it is designed.
                  unavailableIdTypes={['Passport', 'GCC ID']}
                  unavailableIdTypesHint="Passport and GCC ID are available through the exception approval flow."
                  // Scan-first: the reader identifies the document, so no type is
                  // chosen up front. Opt-in, so the eight other journeys sharing
                  // this step keep their selector-led flow (2026-09-28).
                  autoDetectIdType
                  value={(values.contact as GuidedContactValue) ?? {}}
                  onChange={(v) => setValue('contact', v)}
                  showIptvToggle={false}
                />
                <div className="mt-6 pt-6 border-t border-border-soft">
                  <EligibilityGateStep
                    idNumber={contact?.idNumber}
                    // Feeding the previous result back in is what makes this a
                    // one-time check across re-entries to the step.
                    result={eligibility}
                    onResult={(r) => setValue('eligibility', r)}
                    // Pattern 2 (Approval Workflow): this step's own isValid
                    // blocks the ordinary Continue whenever an approval-routing
                    // check applies, so this button is the only forward path in
                    // that state - it goes to the exact same next step Continue
                    // would have, `goNext` unguarded by isValid deliberately.
                    onProceedToApproval={goNext}
                    // Pattern 3 (Alternative Product): a collections soft-stop
                    // has no forward path within this wizard at all - Postpaid
                    // cannot be issued for this customer - so this leaves the
                    // journey entirely rather than advancing it.
                    onSwitchToPrepaid={() => navigate('/mobile-prepaid/new-prepaid-tablet-step-1-contact-id-capture')}
                  />
                </div>
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
                c?.moiResult && hasIdentityDetails(c ?? {}) && isValidEmail(c?.email) && isValidAltPhone(c?.altPhone)
              );
              if (!identityOk || !e) return false;
              if (e.hardStop || e.softStop) return false;
              return !e.checks.some((check) => check.outcome === 'approval-routing');
            },
            // "Add a text link on the left side. On click, open a popup
            // showing all eligibility checks performed and their results"
            // (2026-09-28) - the inline panel above goes silent the moment
            // every check clears, so this is the only way back to the full
            // seven-check report once that happens. Renders nothing until
            // eligibility has actually run (EligibilityChecksLink's own
            // guard on `eligibility` being set).
            footerLeft: ({ values }) => (
              <EligibilityChecksLink eligibility={values.eligibility as EligibilityResult | undefined} />
            ),
          },
          {
            key: 'address',
            label: 'Address',
            render: ({ values, setValue }) => {
              const contact = values.contact as GuidedContactValue | undefined;
              return (
                <ZsbAddressStep
                  value={(values.address as ZsbAddressValue) ?? {}}
                  onChange={(v) => setValue('address', v)}
                  idNumber={contact?.idNumber}
                  nationality={contact?.moiResult?.nationality}
                />
              );
            },
            // Mandatory: No per FLD-523–526 - never gates progression, matching the evidenced Skip Address affordance.
            isValid: () => true,
            // Auto-skipped for every Mobile Postpaid activation (2026-09-28):
            // a mobile line needs no serviceable premises (see
            // ZsbAddressStep's own notes on why every field here is already
            // optional), so the agent now lands straight on Plan & Add-ons
            // rather than walking through a step that never blocked them
            // anyway. "Return and complete it later" is the SAME mechanism
            // Eligibility's own auto-advance already relies on: this only
            // fires once per step per mount (autoAdvancedRef) and never
            // refires once maxReached has passed it, so clicking
            // "Communication Address" in the rail afterward opens the real
            // form - unfilled, exactly as if the agent had walked through it
            // normally - rather than skipping a second time.
            autoAdvanceWhen: () => true,
          },
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
          {
            key: 'billingAccount',
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
                />
              );
            },
            isValid: (values) => isBillingAccountValid((values.billingAccount as BillingAccountValue) ?? {}),
          },
          {
            key: 'plan',
            label: 'Plan & Add-ons',
            render: ({ values, setValue }) => {
              const eligibility = values.eligibility as EligibilityResult | undefined;
              return (
                <PostpaidPlanAddonsStep
                  selectedProductId={values.productId as string | undefined}
                  onSelectProduct={(id) => setValue('productId', id)}
                  discountId={values.discountId as string | undefined}
                  onSelectDiscount={(id) => setValue('discountId', id)}
                  addonIds={(values.addonIds as string[] | undefined) ?? []}
                  onAddonsChange={(ids) => setValue('addonIds', ids)}
                  discountSupportingId={values.discountSupportingId as string | undefined}
                  onDiscountSupportingIdChange={(id) => setValue('discountSupportingId', id)}
                  billLimit={values.billLimit as number | undefined}
                  onBillLimitChange={(amount, pass) => {
                    setValue('billLimit', amount);
                    setValue('billLimitPass', pass);
                  }}
                  requiresHrnAdvance={Boolean(eligibility?.requiresHrnAdvance)}
                  discountProofDocument={values.discountProofDocument as { fileName: string; sizeBytes: number } | undefined}
                  onDiscountProofDocumentChange={(doc) => setValue('discountProofDocument', doc)}
                />
              );
            },
            // Restored 2026-09-28: Bill Limit is back in this step (see the
            // component's own note), so billLimitPass is a real flag again
            // rather than the dead one this comment used to explain away.
            isValid: (values) => Boolean(values.productId) && values.billLimitPass !== false,
            // "For pre-bundled eligible offers, skip Plan/Add-on Selection
            // and proceed to Number Selection" (2026-09-28) - re-evaluates on
            // every value change (see GuidedActivationWizard's own note on
            // autoAdvanceWhen), so it fires the moment such a plan is picked,
            // not only on arrival at this step.
            autoAdvanceWhen: (values) =>
              Boolean(products.find((p) => p.productId === values.productId)?.preBundledOffer),
          },
          {
            key: 'number',
            label: 'Number Selection',
            render: ({ values, setValue }) => (
              <MsisdnPicker
                selected={values.msisdn as string | undefined}
                onSelect={(msisdn, priceQAR) => {
                  setValue('msisdn', msisdn);
                  setValue('numberPriceQAR', priceQAR);
                }}
                planMrcQar={products.find((p) => p.productId === values.productId)?.mrcQAR}
                // "This section is not required" (2026-09-28) - Postpaid only;
                // the other four journeys sharing MsisdnPicker keep Manual
                // MSISDN Entry, since nothing was said about them.
                allowManualEntry={false}
              />
            ),
            isValid: (values) => Boolean(values.msisdn),
          },
          // Device & DOI was removed from this journey on 2026-09-27 per the
          // annotated walkthrough ("Remove this screen completed"). Device
          // bundling and the BR-114 DOI declaration are therefore out of scope
          // for a new postpaid activation; nothing else set `values.doi`, so
          // the down-payment term of Due Today, the monthly installment term of
          // the recurring charge, and the five device_* fields on the order
          // record all went with it rather than being left to read as
          // permanently absent.
          {
            key: 'simType',
            label: 'SIM Type',
            render: ({ values, setValue }) => {
              const contact = values.contact as GuidedContactValue | undefined;
              return (
                <SimTypeStep
                  value={(values.simType as SimTypeValue) ?? {}}
                  customerEmail={contact?.email}
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
            // "On a successful complete scan ... automatically continue"
            // (2026-09-28) - Physical only. eSIM's "Select eSIM" is a choice
            // to review (QR-after-payment messaging, customer email), not a
            // validation result to act on immediately, so it stays a manual
            // Continue like every other non-scan step.
            autoAdvanceWhen: (values) => {
              const s = values.simType as SimTypeValue | undefined;
              return s?.simType === 'Physical' && s.simValid === true;
            },
          },
          {
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
                  customerName={contact?.moiResult?.name}
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
                  onEdit={() => goToStepKey('plan')}
                />
              );
            },
            isValid: () => true,
          },
          {
            key: 'caf',
            label: 'CAF & Signature',
            render: ({ values, setValue, goNext }) => (
              <CafSignatureCapture
                value={
                  (values.caf as {
                    cafType?: CafType;
                    signatureDataUrl?: string;
                    additionalDocuments?: AdditionalDocument[];
                  }) ?? {}
                }
                onChange={(v) => setValue('caf', v)}
                customerName={(values.contact as GuidedContactValue | undefined)?.moiResult?.name}
                // Built from the totals CHECKOUT computed (checkoutTotals) plus
                // the plan/number facts already on `values`, so the figures the
                // customer signs against are the same objects the previous step
                // displayed - not a second calculation that could drift.
                orderSummary={values.cafSummary as { label: string; value: string }[] | undefined}
                termsUrl="https://www.vodafone.qa/en/terms-and-conditions"
                // Auto device detection + customer-facing signing + dynamic
                // T&C bullets + locked-after-signing behaviour, all opted
                // into here only (2026-09-28) - the other five journeys
                // sharing this component keep the original manual picker.
                autoDetectDeviceType
                legalFacts={values.legalFacts as TncLegalFacts | undefined}
                // Wizard chrome (rail, Back/Continue footer) is hidden AFTER
                // signing now, not before (2026-09-30 - see customerFacing
                // below) - so once signed, this step's own content is the
                // only way forward, and it needs the same goNext the wizard
                // footer would otherwise have called.
                onContinue={goNext}
              />
            ),
            isValid: (values) => {
              const c = values.caf as { cafType?: CafType; signatureDataUrl?: string } | undefined;
              if (!c?.cafType) return false;
              return c.cafType !== 'Digital' || Boolean(c.signatureDataUrl);
            },
            // "The first and only step where the customer-facing view is
            // presented" - reversed 2026-09-30: the rail/footer now stay up
            // WHILE awaiting signature (the agent is still driving; Continue
            // is simply disabled by isValid until signed) and disappear only
            // once signed, the instant this same "signed" predicate flips
            // true - the same one isValid/locksAfter already use, so the
            // three cannot disagree about what "signed" means. The signed
            // customer-facing view supplies its own way forward (the
            // Continue button CafSignatureCapture renders when `signed`,
            // calling the `onContinue` this step wires to goNext) since the
            // wizard's own footer is gone at that point.
            customerFacing: (values) => {
              const c = values.caf as { cafType?: CafType; signatureDataUrl?: string } | undefined;
              return Boolean(c?.cafType) && (c?.cafType !== 'Digital' || Boolean(c?.signatureDataUrl));
            },
            // "Once CAF is signed, disable/remove Back navigation and prevent
            // all edits" (2026-09-28) - the SAME signed predicate as isValid
            // above, reused rather than restated.
            locksAfter: (values) => {
              const c = values.caf as { cafType?: CafType; signatureDataUrl?: string } | undefined;
              return Boolean(c?.cafType) && (c?.cafType !== 'Digital' || Boolean(c?.signatureDataUrl));
            },
          },
          {
            key: 'payment',
            label: 'Payment',
            render: ({ values, setValue }) => {
              // Reads the SAME figure Checkout already computed and read back
              // to the customer (values.checkoutTotals, published by its
              // onTotalsComputed) rather than re-deriving it from the
              // number's raw sticker price - that second derivation is what
              // used to skip BR-115's entitlement/overage logic entirely,
              // since it never had the selected plan's MRC to apply it with.
              const checkoutTotals = values.checkoutTotals as CheckoutTotals | undefined;
              const dueTodayQar = checkoutTotals?.dueTodayQar ?? 0;
              return (
                <WinCashPaymentStep
                  amountDueQAR={dueTodayQar}
                  value={(values.payment as WinCashPaymentValue) ?? {}}
                  onChange={(v) => setValue('payment', v)}
                />
              );
            },
            isValid: (values) => Boolean((values.payment as WinCashPaymentValue | undefined)?.paid),
            // "On successful WinCash confirmation, return to DXP, submit the
            // order, and create the interaction activity" (2026-09-28) - the
            // Return moment (WinCashPaymentStep setting `paid: true`) submits
            // immediately rather than waiting for a separate Continue click,
            // since Payment is the wizard's last step and Continue here would
            // only ever mean "submit" anyway.
            autoAdvanceWhen: (values) => Boolean((values.payment as WinCashPaymentValue | undefined)?.paid),
          },
          // Activity (a free-text comment box) was removed from this journey
          // on 2026-09-26. Payment is now the last step, so it carries the
          // "Save & Finish" label - that label follows currentIndex ===
          // activeSteps.length - 1 in GuidedActivationWizard, not a step key,
          // so nothing there needed to change. `comments` was never written
          // onto the order payload below - it existed only for this step - so
          // removing the step drops the field cleanly with nothing left over
          // to clean out of onSubmit.
        ]}
        onSubmit={async (values) => {
          const contact = values.contact as GuidedContactValue;
          const eligibility = values.eligibility as EligibilityResult | undefined;
          const simType = values.simType as SimTypeValue | undefined;
          const addonIds = (values.addonIds as string[] | undefined) ?? [];
          // numberDelta stays the number's raw sticker price (recorded on the
          // order for reference); dueTodayQar reuses Checkout's own figure,
          // which already applied BR-115's entitlement/overage - see the
          // Payment step's render just above for the fuller note.
          const numberDelta = (values.numberPriceQAR as number | undefined) ?? 0;
          const checkoutTotals = values.checkoutTotals as CheckoutTotals | undefined;
          const dueTodayQar = checkoutTotals?.dueTodayQar ?? 0;

          const products = await mockDataEngine.list<Product>('products');
          const plan = products.find((p) => p.productId === values.productId);
          const addons = products.filter((p) => addonIds.includes(p.productId));
          const discounts = await mockDataEngine.list<{ addonDiscountId: string; addonType: string; price: number }>(
            'addons-discounts'
          );
          const discount = discounts.find((d) => d.addonDiscountId === values.discountId);
          // The same itemisation the two display surfaces render, so what the
          // order records is by construction what the agent quoted. See
          // engines/postpaidPricing.ts.
          const charges = monthlyCharges({
            planQar: plan?.mrcQAR ?? 0,
            discountRate: discount?.price,
            addonsQar: addons.reduce((sum, a) => sum + a.mrcQAR, 0),
          });
          const monthlyRecurringQar = charges.totalQar;

          // BR-268: HRN/credit-limit variant routes to manager approval rather
          // than auto-completing, same mechanism as the pre-existing B2B2C
          // approval routing (UJ-081). Extended 2026-09-28 to cover the
          // eligibility matrix's OWN approval-routing outcomes (under-18,
          // active-line cap exceeded, exception ID type) - reaching this point
          // with one of those set means the agent used "Proceed to Approval"
          // rather than Continue (see the Contact step's isValid), and the
          // order this submits has to carry that through to its final status,
          // not silently complete as if nothing had been diverted.
          // "For MADA/special offers, require proof-document upload before
          // finalisation; approval workflow remains pending" (2026-09-28) -
          // added as a fourth trigger alongside the three above. The agent
          // is NOT blocked from submitting without the ID/document (no
          // isValid gate was requested), but the order always lands in
          // Submitted for Approval when one of these discounts was chosen,
          // same as the other three approval-routing reasons - reusing
          // SUPPORTING_ID_DISCOUNT_TYPES rather than repeating the two
          // literal discount-type strings here.
          const pendingApproval =
            Boolean(contact.isB2B2C) ||
            Boolean(eligibility?.requiresHrnAdvance) ||
            Boolean(eligibility?.checks.some((c) => c.outcome === 'approval-routing')) ||
            Boolean(discount && SUPPORTING_ID_DISCOUNT_TYPES.has(discount.addonType));

          // Attachments (2026-09-28) - built from data this wizard already
          // collected but, until now, discarded at submission: the CAF
          // signature, any agent-defined Additional Documents, the MADA/
          // B2B2C proof document, and the QID scans from Contact. Each entry
          // only appears when the fact it names is actually true - an order
          // with no discount proof document gets no row claiming one exists.
          const caf = values.caf as
            | { cafType?: CafType; signatureDataUrl?: string; additionalDocuments?: AdditionalDocument[] }
            | undefined;
          const discountProofDocument = values.discountProofDocument as
            | { fileName: string; sizeBytes: number }
            | undefined;
          const attachments: { label: string; detail?: string }[] = [
            ...(contact.qidScans?.frontScanned ? [{ label: 'Qatar ID (QID) - Front', detail: 'Scanned during Contact' }] : []),
            ...(contact.qidScans?.backScanned ? [{ label: 'Qatar ID (QID) - Back', detail: 'Scanned during Contact' }] : []),
            ...(caf?.signatureDataUrl ? [{ label: 'Signed CAF', detail: `${caf.cafType ?? 'Digital'} signature` }] : []),
            ...(discountProofDocument
              ? [{ label: `${discount?.addonType ?? 'Discount'} supporting document`, detail: discountProofDocument.fileName }]
              : []),
            ...(caf?.additionalDocuments ?? []).map((d) => ({ label: d.label, detail: d.fileName })),
          ];

          // Billing Profile (2026-09-28) - whichever of the two mutually
          // exclusive paths the agent took, recorded the same way `attachments`
          // above is: only the fact that applies, nothing invented for the
          // other branch.
          const billingAccount = values.billingAccount as BillingAccountValue | undefined;
          const billingProfileId = billingAccount?.selectedProfileId;
          const newBillingAccount = billingAccount?.newAccount;

          const orderId = `ORD-${Date.now().toString().slice(-6)}`;
          await createRecord('orders', {
            orderId,
            orderType: 'New Postpaid Activation',
            orderSubType: contact.isB2B2C ? 'B2B2C' : eligibility?.requiresHrnAdvance ? 'HRN' : 'Consumer',
            status: pendingApproval ? 'Submitted for Approval' : 'Complete',
            customerName: contact.moiResult?.name,
            productId: values.productId,
            discountId: values.discountId,
            addonIds,
            msisdn: values.msisdn,
            numberPriceQAR: numberDelta,
            simType: simType?.simType,
            simSerial: simType?.simSerial,
            billingProfileId,
            newBillingProfileName: newBillingAccount?.profileName,
            billCardLast4: newBillingAccount?.cardLast4,
            dueTodayQAR: dueTodayQar,
            monthlyRecurringQAR: monthlyRecurringQar,
            createdBy: 'AGENT-KARTHIKK',
            sourceChannel: 'Desktop',
            attachments,
          });

          // "On successful WinCash confirmation ... create the interaction
          // activity" (2026-09-28) - same shape OrderApprovalDetail.tsx's own
          // logActivity already writes (activityNumber/orderId/actionTaken/
          // notes/transactionDate), so this order's history reads consistently
          // with one that picked up an activity later during approval.
          const payment = values.payment as WinCashPaymentValue | undefined;
          await createRecord('customer-activities', {
            activityNumber: `ACT-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            orderId,
            actionTaken: 'New Postpaid Activation Submitted',
            notes: `Order ${orderId} submitted via WinCash${payment?.reference ? ` (ref ${payment.reference})` : ''}.`,
            transactionDate: new Date().toISOString(),
          });

          // Verified per the SAME definition the Contact step's own tick uses
          // (emailVerification: does the account's contact email match the
          // MOI registry value), not merely "well-formed". This still gates
          // the ONLY email-sending action this screen has (eSIM details, via
          // EsimActivationPanel's `verified` prop) - it no longer also hides
          // the address itself (2026-09-28 "populate it only from existing
          // account contact emails"): the agent sees the real on-file email
          // and why sending is blocked, rather than a blank field.
          const emailVerified = emailVerification(contact.email, contact.moiResult?.email).verified;

          setConfirmedOrder({
            orderId,
            pendingApproval,
            customerName: contact.moiResult?.name ?? '-',
            msisdn: (values.msisdn as string) ?? '-',
            planName: plan?.name ?? '-',
            dueTodayQar,
            monthlyRecurringQar,
            simType: simType?.simType,
            esimActivationCode: simType?.esimActivationCode,
            customerEmail: contact.email,
            customerEmailVerified: emailVerified,
          });
        }}
      />
    </div>
  );
}
