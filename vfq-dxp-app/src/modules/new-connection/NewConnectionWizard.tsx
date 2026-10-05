import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useJourneyCustomerLock } from './hooks/useJourneyCustomerLock';
import { useCustomerContext } from '../../stores/customerContextStore';
import { useCustomerBenefits } from './hooks/useCustomerBenefits';
import { GuidedActivationWizard } from '../../components/patterns/wizard/GuidedActivationWizard';
import { monthlyCharges, starEntitlementQar } from '../../engines/postpaidPricing';
import { GuidedContactStep } from '../../components/patterns/GuidedContactStep';
import { isValidAltPhone, isValidEmail, hasIdentityDetails, emailVerification, maskEmail } from '../../components/patterns/guidedContactModel';
import type { GuidedContactValue } from '../../components/patterns/guidedContactModel';
import { ZsbAddressStep } from '../../components/patterns/ZsbAddressStep';
import type { ZsbAddressValue } from '../../components/patterns/ZsbAddressStep';
import { BillingAccountAutoResolver } from '../../components/patterns/BillingAccountAutoResolver';
import { BillingAccountStep } from '../../components/patterns/BillingAccountStep';
import { isBillingAccountValid } from '../../components/patterns/billingAccountModel';
import type { BillingAccountValue } from '../../components/patterns/billingAccountModel';
import { PostpaidPlanAddonsStep } from '../../components/patterns/PostpaidPlanAddonsStep';
import { SUPPORTING_ID_DISCOUNT_TYPES } from '../../components/patterns/postpaidPlanModel';
import { MsisdnPicker } from '../../components/domain/MsisdnPicker';
import { EligibilityGateStep } from '../../components/domain/EligibilityGateStep';
import type { EligibilityResult } from '../../components/domain/eligibilityTypes';
import { SimTypeStep } from '../../components/domain/SimTypeStep';
import type { SimTypeValue } from '../../components/domain/SimTypeStep';
import { CheckoutSummaryStep } from '../../components/patterns/CheckoutSummaryStep';
import type { TncLegalFacts, CheckoutTotals } from '../../components/patterns/checkoutSummaryModel';
import type { SummaryTable } from '../../components/patterns/CheckoutSummaryTables';
import { WinCashPaymentStep } from '../../components/patterns/WinCashPaymentStep';
import type { WinCashPaymentValue } from '../../components/patterns/WinCashPaymentStep';
import { CafSignatureCapture } from '../../components/patterns/CafSignatureCapture';
import type { CafType } from '../../components/patterns/cafTypes';
import type { AdditionalDocument } from '../../components/domain/AdditionalDocumentsUpload';
import { ActivationCompleteScreen } from '../../components/patterns/ActivationCompleteScreen';
import { EligibilityOutcomePanel, OutcomeActions } from './steps/EligibilityOutcomes';
import { OfferDecisionActions } from './steps/JourneyActions';
import { journeyLabel } from './steps/serviceJourneys';
import { CustomerStatusBanner, PlanSourceBanner } from './steps/JourneyBanners';
import { CustomerTypeStep } from './steps/CustomerTypeStep';
import { isCustomerTypeValid } from './steps/customerTypeModel';
import { CrossSalesStep } from './steps/CrossSalesStep';
import { isCrossSalesValid } from './steps/crossSalesModel';
import type { CustomerTypeValue } from './steps/customerTypeModel';
import type { CrossSalesValue } from './steps/crossSalesModel';
import { STORE_MANAGER_ROLE, COLLECTION_TEAM_ROLE } from './steps/customerTypeModel';
import * as mockDataEngine from '../../engines/mockDataEngine';
import { logActivity } from '../../engines/activityEngine';
import { useEntityStore } from '../../stores/entityStore';
import { useAuthStore } from '../../stores/authStore';
import { useWorkflowStore } from '../../stores/workflowStore';
import { Modal } from '../../components/primitives/Modal';
import { DemoFaultPanel } from '../../components/patterns/DemoFaultPanel';
import { Button } from '../../components/primitives/Button';
import { WIZARD_ID_BY_FLOW, POST_EXIT_DESTINATION, DRAFT_ORDERS_PATH } from './newConnectionModel';
import type { NewConnectionFlow, Product, ConfirmedOrder } from './newConnectionModel';


// New Connection: the end-to-end activation journey - Customer Identification
// and Eligibility, special customer type, cross-sales offers with the standard
// catalogue as fallback, Plan & Add-ons, then the regular fulfilment sequence
// through to Payment. New Postpaid is fulfilled in this wizard; the other
// service journeys continue in their own existing wizards (see steps/).
export function NewConnectionWizard({ flow = 'new' }: { flow?: NewConnectionFlow }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { customerId: existingCustomerId } = useParams<{ customerId: string }>();
  // The Existing flow's draft belongs to ONE customer: keyed by the customer id, so a draft left
  // by another customer's journey (same browser session) can never carry its applicant name,
  // identity or eligibility into this one.
  const WIZARD_ID = flow === 'existing' && existingCustomerId ? `${WIZARD_ID_BY_FLOW.existing}-${existingCustomerId}` : WIZARD_ID_BY_FLOW[flow];
  // Existing flow: the route names the customer the journey was started for. The
  // identification is NOT pre-filled - the agent scans again - but, as the demo
  // scanner returns the same ID for everyone, the customer IS the one named here.
  const createRecord = useEntityStore((s) => s.createRecord);
  // Reloaded or revisited after submit but before Close Activity: the Activity Final page comes back.
  const [confirmedOrder, setConfirmedOrder] = useState<ConfirmedOrder | null>(() => {
    const a = useCustomerContext.getState().journey;
    return a?.wizardId === WIZARD_ID && a.finalOrder ? (a.finalOrder as unknown as ConfirmedOrder) : null;
  });

  // ---- Active customer context -------------------------------------------------------------
  // Once the customer is identified, the journey is bound to them until it is explicitly ended
  // (Close Activity, Save & Exit, Abandon Order, session end). See customerContextStore.
  const isMirrorWindow = new URLSearchParams(location.search).get('mirror') === '1';
  const draftValues = useWorkflowStore((s) => s.drafts[WIZARD_ID]?.values);
  const draftStep = useWorkflowStore((s) => s.drafts[WIZARD_ID]?.currentStep);
  const draftContact = draftValues?.contact as GuidedContactValue | undefined;
  const draftCustomerId = (draftValues?.eligibility as EligibilityResult | undefined)?.customerId;
  const { active, heldByAnotherJourney, guardedContactChange } = useJourneyCustomerLock({
    flow,
    wizardId: WIZARD_ID,
    existingCustomerId,
    isMirrorWindow,
    draftContact,
    draftCustomerId,
    draftStep,
  });
  // Discounts follow the customer this journey is for: the route's customer, or the one the identity check resolved.
  const customerBenefits = useCustomerBenefits(flow === 'existing' ? existingCustomerId : draftCustomerId);
  // Set when the agent records an Interested outcome: shows the "Lead Created"
  // confirmation: Go to Leads leaves for the Leads page, Close just dismisses it.
  const [createdLead, setCreatedLead] = useState<{ leadId: string; offerName?: string } | null>(null);
  const goToLeads = () => {
    useWorkflowStore.getState().clearDraft(WIZARD_ID);
    useCustomerContext.getState().endJourney(WIZARD_ID);
    setCreatedLead(null);
    navigate('/leads');
  };
  // Fetched once at the wizard level (2026-09-28) rather than inside a single
  // step, so Number Selection can resolve the selected plan's MRC for BR-115's
  // star-number entitlement without re-fetching the same catalogue
  // PostpaidPlanAddonsStep already reads for itself.
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => {
    mockDataEngine.list<Product>('products').then(setProducts);
  }, []);

  // Accepting an offer makes its journey and plan the basis for what follows;
  // anything else (declining, skipping) clears a previous acceptance.
  const applyCrossSales = (setValue: (field: string, value: unknown) => void, v: CrossSalesValue) => {
    setValue('crossSales', v);
    setValue('serviceJourney', v.decision === 'accepted' ? v.journey : undefined);
    const basis =
      v.decision === 'accepted' ? v.linkedProductIds?.find((id) => products.some((p) => p.productId === id)) : undefined;
    setValue('productId', basis);
    setValue('discountId', undefined);
    setValue('addonIds', []);
  };

  if (heldByAnotherJourney && !isMirrorWindow) return null; // redirecting to the journey that holds the customer

  if (confirmedOrder) {
    return <ActivationCompleteScreen order={confirmedOrder} />;
  }

  return (
    <div className="p-8">
      <GuidedActivationWizard
        wizardId={WIZARD_ID}
        allowCustomerView
        title={flow === 'existing' ? 'New Connection - Existing Customer' : 'New Connection - New Customer'}
        draftActionLabel="Postpaid Activation"
        titleAside={
          active?.wizardId === WIZARD_ID ? (
            <span className="text-[length:var(--fs-body)] text-fg-2" title="The customer is fixed for this journey">
              <span className="font-medium text-fg">{active.customerName}</span> - QID {active.idNumber}
            </span>
          ) : undefined
        }
        onAbandon={() => navigate(POST_EXIT_DESTINATION)}
        hideAbandonFrom="payment"
        onSaveExit={() => navigate(DRAFT_ORDERS_PATH)}
        steps={[
          {
            key: 'contact',
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
                  allowedIdTypes={['QID', 'Passport', 'GCC ID', 'Diplomatic ID']}
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
          },
          {
            key: 'crossSales',
            label: 'Offers',
            heading: 'Recommended offers',
            subheading: 'Personalised using the customer\u2019s profile and eligibility.',
            render: ({ values, setValue }) => (
              <CrossSalesStep
                customerId={(values.eligibility as EligibilityResult | undefined)?.customerId}
                value={(values.crossSales as CrossSalesValue) ?? {}}
                onChange={(v) => applyCrossSales(setValue, v)}
                onHandOff={(route) => navigate(route)}
              />
            ),
            isValid: (values) => isCrossSalesValid(values.crossSales as CrossSalesValue | undefined),
            // Reject = take no offer and go on to the standard catalogue (what Skip
            // was). Interested = create a lead for the selected offer, then the same.
            // Accept = continue with the selected offer.
            primaryAction: ({ values, setValue, goNext }) => {
              const cs = (values.crossSales as CrossSalesValue | undefined) ?? {};
              const contact = values.contact as GuidedContactValue | undefined;
              return (
                <OfferDecisionActions
                  canAccept={cs.decision === 'accepted' && isCrossSalesValid(cs)}
                  canExpressInterest={Boolean(cs.offerId)}
                  goNext={goNext}
                  onHandOff={(route) => navigate(route)}
                  onReject={() => applyCrossSales(setValue, { decision: 'declined' })}
                  onInterested={async () => {
                    const leadId = `LEAD-${Date.now().toString().slice(-6)}`;
                    await createRecord('leads', {
                      leadId,
                      serviceNeeded: journeyLabel(cs.journey) ?? 'Mobile',
                      status: 'New',
                      ownerId: useAuthStore.getState().profile?.userId ?? null,
                      createdVia: 'New Connection - Cross Sales Offer',
                      offerId: cs.offerId,
                      offerName: cs.offerName,
                      customerId: (values.eligibility as EligibilityResult | undefined)?.customerId,
                      mobileNumber: contact?.moiResult?.phone,
                    });
                    // Confirmation modal (Go to Leads / Close - see goToLeads).
                    setCreatedLead({ leadId, offerName: cs.offerName });
                  }}
                />
              );
            },
          },
          {
            key: 'plan',
            // An accepted offer already fixes the plan, so the agent goes straight
            // from Offers to Number Selection; Skip (no offer) runs the full path.
            skip: (values) => (values.crossSales as CrossSalesValue | undefined)?.decision === 'accepted',
            label: 'Plan & Add-ons',
            render: ({ values, setValue }) => {
              const eligibility = values.eligibility as EligibilityResult | undefined;
              return (
                <>
                <PlanSourceBanner
                  offerName={(values.crossSales as CrossSalesValue | undefined)?.offerName}
                  customerType={(values.customerType as CustomerTypeValue | undefined)?.type}
                />
                <PostpaidPlanAddonsStep
                  customerContext={{
                    nationality: eligibility?.nationality,
                    customerType: (values.customerType as CustomerTypeValue | undefined)?.type,
                    idType: (values.contact as GuidedContactValue | undefined)?.idType,
                  }}
                  customerBenefits={customerBenefits}
                  customerBenefit={(values.customerType as CustomerTypeValue | undefined)?.officeAccepted ? (values.customerType as CustomerTypeValue).type : undefined}
                  selectedProductId={values.productId as string | undefined}
                  onSelectProduct={(id) => setValue('productId', id)}
                  onDeselectProduct={() => setValue('productId', undefined)}
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
                </>
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
            key: 'address',
            // 2026-10-01: the address is not fetched from NAS and starts blank.
            // The step stays in the rail but Continue passes over it
            // (autoPass), so Plan & Add-ons goes on to Number Selection; the
            // agent can still come back and fill it in.
            autoPass: () => true,
            label: 'Address',
            render: ({ values, setValue }) => {
              return (
                <ZsbAddressStep
                  value={(values.address as ZsbAddressValue) ?? {}}
                  onChange={(v) => setValue('address', v)}
                />
              );
            },
            // Mandatory: No per FLD-523–526 - never gates progression, matching the evidenced Skip Address affordance.
            isValid: () => true,
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
          },
          {
            key: 'number',
            label: 'Number Selection',
            hideCustomerView: true,
            render: ({ values, setValue }) => (
              <MsisdnPicker
                selected={values.msisdn as string | undefined}
                onSelect={(msisdn, priceQAR) => {
                  setValue('msisdn', msisdn);
                  setValue('numberPriceQAR', priceQAR);
                }}
                // Clicking the chosen number again clears it (toggle).
                onDeselect={() => {
                  setValue('msisdn', undefined);
                  setValue('numberPriceQAR', undefined);
                }}
                planMrcQar={products.find((p) => p.productId === values.productId)?.mrcQAR}
                starEntitlementQar={(() => {
                  const plan = products.find((p) => p.productId === values.productId);
                  return plan ? starEntitlementQar(plan) : undefined;
                })()}
                // "This section is not required" (2026-09-28) - Postpaid only;
                // the other four journeys sharing MsisdnPicker keep Manual
                // MSISDN Entry, since nothing was said about them.
                allowManualEntry={false}
                inlineToolbar
                hideReservedBadge
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
                  customerEmail={contact?.moiResult?.isNewCustomer && contact.email ? maskEmail(contact.email) : contact?.email}
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
                summaryTables={values.cafTables as SummaryTable[] | undefined}
                inlineSignaturePad
                maxAdditionalDocuments={5}
                documentLabelOptions={['Employer Letter', 'Utility Bill', 'Proof of Address', 'Office ID Card', 'Other']}
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
                requireTermsAgreement
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
            hideRail: true,
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
          const products = await mockDataEngine.list<{ productId: string; name: string; mrcQAR: number }>('products');
          const plan = products.find((p) => p.productId === values.productId);
          const addons = products.filter((p) => addonIds.includes(p.productId));
          const discounts = await mockDataEngine.list<{ addonDiscountId: string; price?: number; addonType?: string }>('addons-discounts');
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
          const customerType = values.customerType as CustomerTypeValue | undefined;
          const crossSales = values.crossSales as CrossSalesValue | undefined;
          // Manually entered identity (scan failed) always needs Store Manager approval.
          const manualIdEntry = Boolean(contact.manualEntry);
          const activeLinesCheck = eligibility?.checks.find((c) => c.id === 'active-lines');
          const lineLimitApproval = activeLinesCheck?.outcome === 'approval-routing';
          const idTypeRouting = eligibility?.checks.some((c) => c.id === 'id-type-routing' && c.outcome === 'approval-routing') ?? false;
          const pendingApproval =
            manualIdEntry ||
            (Boolean(contact.isB2B2C) && !customerType?.rejected) ||
            customerType?.type === 'b2b2c' ||
            Boolean(eligibility?.requiresHrnAdvance) ||
            Boolean(eligibility?.checks.some((c) => c.outcome === 'approval-routing')) ||
            Boolean(discount && SUPPORTING_ID_DISCOUNT_TYPES.has(discount.addonType ?? ''));

          // Attachments (2026-09-28) - built from data this wizard already
          // collected but, until now, discarded at submission: the CAF
          // signature, any agent-defined Additional Documents, the MADA/
          // B2B2C proof document, and the QID scans from Contact. Each entry
          // only appears when the fact it names is actually true - an order
          // with no discount proof document gets no row claiming one exists.
          const caf = values.caf as
            | { cafType?: CafType; signatureDataUrl?: string; additionalDocuments?: AdditionalDocument[] }
            | undefined;
          const discountProofDocument = values.discountProofDocument as { fileName: string } | undefined;
          const attachments = [
            ...(contact.qidScans?.frontScanned ? [{ label: 'Qatar ID (QID) - Front', detail: 'Scanned during Contact' }] : []),
            ...(contact.qidScans?.backScanned ? [{ label: 'Qatar ID (QID) - Back', detail: 'Scanned during Contact' }] : []),
            ...(customerType?.evidenceUpload
              ? [
                  {
                    label: 'Supporting document',
                    detail: `Uploaded for ${customerType.type === 'b2b2c' ? 'B2B2C' : customerType.type === 'retired' ? 'Retired' : 'MADA'}: ${customerType.evidenceUpload.fileName}`,
                  },
                ]
              : []),
            ...(customerType?.officeId?.frontScanned && customerType.officeId.backScanned
              ? [
                  {
                    label: 'Office ID card',
                    detail: `Scanned for ${customerType.type === 'b2b2c' ? 'B2B2C' : customerType.type === 'retired' ? 'Retired' : 'MADA'}`,
                  },
                ]
              : []),
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
            // The email captured on Customer Identification, carried unchanged.
            customerEmail: contact.email,
            orderType: 'New Postpaid Activation',
            createdAt: new Date().toISOString(),
            orderSubType: (contact.isB2B2C && !customerType?.rejected) || customerType?.type === 'b2b2c' ? 'B2B2C' : eligibility?.requiresHrnAdvance ? 'HRN' : 'Consumer',
            status: pendingApproval ? 'Submitted for Approval' : 'Complete',
            ...(lineLimitApproval || manualIdEntry || idTypeRouting
              ? {
                  manualIdEntry: manualIdEntry || undefined,
                  approvalReason: [
                    lineLimitApproval ? `Active postpaid line limit reached - ${activeLinesCheck?.message?.split('\nApproval Routing')[0]}` : '',
                    manualIdEntry ? 'Identity manually entered - Store Manager approval required' : '',
                    idTypeRouting ? 'ID type cannot be sold directly - routed to CBM approval workflow' : '',
                  ].filter(Boolean).join(' | '),
                  // Line-limit cases go to the Collection Team; a manual-entry-only order to the Store Manager.
                  // A CBM-only order (ID-type routing) names no approver here: the app has no CBM role to assign.
                  approverRole: lineLimitApproval ? COLLECTION_TEAM_ROLE : manualIdEntry ? STORE_MANAGER_ROLE : undefined,
                }
              : {}),
            customerName: contact.moiResult?.name,
            customerId: eligibility?.customerId,
            idNumber: contact.idNumber,
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
            customerType: customerType?.type,
            companyName: customerType?.type === 'b2b2c' ? customerType.company?.companyName : undefined,
            planSource: crossSales?.decision === 'accepted' || (customerType?.type && customerType.type !== 'none') ? 'Sales Offer' : 'General Plan',
            crossSalesOfferId: crossSales?.decision === 'accepted' ? crossSales.offerId : undefined,
          });

          // Activities are created automatically (activityEngine): Completed, plus a workflow
          // event when the order is routed for approval.
          const journeyTitle = flow === 'existing' ? 'New Connection - Existing Customer' : 'New Connection - New Customer';
          const activityCtx = {
            journey: journeyTitle,
            orderId,
            customerId: eligibility?.customerId,
            customerName: contact.moiResult?.name,
            idNumber: contact.idNumber,
          };
          const payment = values.payment as WinCashPaymentValue | undefined;
          const activityId = await logActivity({
            ...activityCtx,
            trigger: 'completed',
            reason: pendingApproval
              ? `Order ${orderId} submitted and is awaiting approval.`
              : `Order ${orderId} submitted and activated${payment?.reference ? ` (WinCash ref ${payment.reference})` : ''}.`,
          });
          if (pendingApproval) {
            await logActivity({
              ...activityCtx,
              trigger: 'workflow-event',
              name: 'Order Routed for Approval',
              reason:
                [
                  lineLimitApproval ? 'Active postpaid line limit reached' : '',
                  manualIdEntry ? 'Identity entered manually' : '',
                  idTypeRouting ? 'ID type routed to CBM approval' : '',
                  eligibility?.requiresHrnAdvance ? 'Upfront payment required' : '',
                  customerType?.type === 'b2b2c' || contact.isB2B2C ? 'B2B2C order' : '',
                ]
                  .filter(Boolean)
                  .join('; ') || 'Order requires approval before it can complete.',
            });
          }

          // Verified per the SAME definition the Contact step's own tick uses
          // (emailVerification: does the account's contact email match the
          // MOI registry value), not merely "well-formed". This still gates
          // the ONLY email-sending action this screen has (eSIM details, via
          // EsimActivationPanel's `verified` prop) - it no longer also hides
          // the address itself (2026-09-28 "populate it only from existing
          // account contact emails"): the agent sees the real on-file email
          // and why sending is blocked, rather than a blank field.
          const emailVerified = emailVerification(contact.email, contact.moiResult?.email).verified;

          const confirmed: ConfirmedOrder = {
            orderId,
            activityId,
            pendingApproval,
            customerName: contact.moiResult?.name ?? '-',
            msisdn: (values.msisdn as string) ?? '-',
            planName: plan?.name ?? '-',
            dueTodayQar,
            monthlyRecurringQar,
            simType: simType?.simType,
            esimActivationCode: simType?.esimActivationCode,
            customerEmail: contact.email,
            // Shown exactly as on Customer Identification: masked for a new customer (NAS email),
            // the Billing Profile / customer address for an existing one. The message itself is
            // addressed to the real address.
            customerEmailDisplay: contact.moiResult?.isNewCustomer && contact.email ? maskEmail(contact.email) : contact.email,
            customerEmailVerified: emailVerified,
          };
          setConfirmedOrder(confirmed);
          // Kept with the customer context so the Activity Final page returns until Close Activity.
          useCustomerContext.getState().patchJourney(WIZARD_ID, { finalOrder: confirmed as unknown as Record<string, unknown> });
        }}
      />
      {/* Demo-only failure simulator: outside the wizard card, and only on Customer Identification,
          where the lookups it affects run. */}
      {(draftStep ?? 0) === 0 && !isMirrorWindow && (
        <div className="mt-6">
          <DemoFaultPanel />
        </div>
      )}
      <Modal
        open={createdLead !== null}
        onClose={() => setCreatedLead(null)}
        title="Lead Created"
        footer={
          <>
            <Button variant="ghost-rect" onClick={() => setCreatedLead(null)}>
              Close
            </Button>
            <Button variant="primary-rect" onClick={goToLeads}>
              Go to Leads
            </Button>
          </>
        }
      >
        <p className="text-fg-2 text-[length:var(--fs-body)]">
          Lead <strong className="font-bold">{createdLead?.leadId}</strong> has been created
          {createdLead?.offerName ? ` for ${createdLead.offerName}` : ''}.
        </p>
      </Modal>
    </div>
  );
}
