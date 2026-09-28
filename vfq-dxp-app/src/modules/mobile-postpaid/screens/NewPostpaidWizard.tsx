import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GuidedActivationWizard } from '../../../components/patterns/GuidedActivationWizard';
import { monthlyCharges } from '../../../engines/postpaidPricing';
import { GuidedContactStep, isValidAltPhone, isValidEmail, hasIdentityDetails } from '../../../components/patterns/GuidedContactStep';
import type { GuidedContactValue } from '../../../components/patterns/GuidedContactStep';
import { ZsbAddressStep } from '../../../components/patterns/ZsbAddressStep';
import type { ZsbAddressValue } from '../../../components/patterns/ZsbAddressStep';
import { PostpaidPlanAddonsStep } from '../../../components/patterns/PostpaidPlanAddonsStep';
import { MsisdnPicker } from '../../../components/domain/MsisdnPicker';
import { EligibilityGateStep } from '../../../components/domain/EligibilityGateStep';
import type { EligibilityResult } from '../../../components/domain/EligibilityGateStep';
import { SimTypeStep } from '../../../components/domain/SimTypeStep';
import type { SimTypeValue } from '../../../components/domain/SimTypeStep';
import { EsimActivationPanel } from '../../../components/domain/EsimActivationPanel';
import { CheckoutSummaryStep } from '../../../components/patterns/CheckoutSummaryStep';
import { WinCashPaymentStep } from '../../../components/patterns/WinCashPaymentStep';
import type { WinCashPaymentValue } from '../../../components/patterns/WinCashPaymentStep';
import { CafSignatureCapture } from '../../../components/patterns/CafSignatureCapture';
import type { CafType } from '../../../components/patterns/CafSignatureCapture';
import { OrderConfirmationScreen } from '../../../components/patterns/OrderConfirmationScreen';
import * as mockDataEngine from '../../../engines/mockDataEngine';
import { useEntityStore } from '../../../stores/entityStore';

const WIZARD_ID = 'new-postpaid';

interface Product {
  productId: string;
  name: string;
  mrcQAR: number;
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
  customerEmail?: string;
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
            { label: 'Start Another Activation', onClick: () => setConfirmedOrder(null) },
            { label: 'Back to Dashboard', onClick: () => navigate('/') },
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
        onAbandon={() => navigate('/')}
        steps={[
          {
            key: 'contact',
            label: 'Contact',
            render: ({ values, setValue }) => (
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
              {/* Headless: runs the eligibility checks as soon as MOI resolves,
                  so `values.eligibility` exists before the agent leaves this
                  step. That is what lets the Eligibility step be SKIPPED on a
                  clean run instead of flashing eight green rows and
                  auto-advancing (2026-09-27). */}
              <EligibilityGateStep
                headless
                idNumber={(values.contact as GuidedContactValue | undefined)?.idNumber}
                result={values.eligibility as EligibilityResult | undefined}
                onResult={(r) => setValue('eligibility', r)}
              />
              </>
            ),
            isValid: (values) => {
              const c = values.contact as GuidedContactValue | undefined;
              return Boolean(c?.moiResult && hasIdentityDetails(c ?? {}) && isValidEmail(c?.email) && isValidAltPhone(c?.altPhone));
            },
          },
          {
            key: 'eligibility',
            label: 'Eligibility',
            description: 'Blacklist, line cap & HRN',
            // Hidden entirely - not just auto-advanced past - when every check
            // passes (2026-09-27). `skip` removes it from activeSteps, so it
            // leaves the rail, stops consuming a step number, and Back from
            // Address returns to Contact.
            //
            // "Everything passed" means no check reported anything other than
            // 'pass'. Approval-routing counts as needing attention even though
            // it does not block: an order diverted for approval with nothing
            // said about it is worse than one extra screen.
            skip: (values) => {
              const r = values.eligibility as EligibilityResult | undefined;
              return Boolean(r) && r!.checks.every((c) => c.outcome === 'pass') && !r!.requiresHrnAdvance;
            },
            render: ({ values, setValue }) => {
              const contact = values.contact as GuidedContactValue | undefined;
              return (
                <EligibilityGateStep
                  idNumber={contact?.idNumber}
                  // Feeding the previous result back in is what makes this a
                  // one-time check across re-entries to the step.
                  result={values.eligibility as EligibilityResult | undefined}
                  onResult={(r) => setValue('eligibility', r)}
                />
              );
            },
            isValid: (values) => (values.eligibility as EligibilityResult | undefined)?.pass === true,
            // No hard stop (and no soft stop) means there is nothing for the
            // agent to do here, so the step reports and moves on rather than
            // asking them to acknowledge seven green rows with a click.
            //
            // Requires the result to EXIST first: while the checks are still
            // resolving `eligibility` is undefined, and advancing then would
            // skip the step before it had evaluated anything.
            //
            // A check that routes for approval still advances - the matrix
            // classes that as a diversion, not a stop.
            autoAdvanceWhen: (values) => {
              const result = values.eligibility as EligibilityResult | undefined;
              return Boolean(result) && result!.pass === true;
            },
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
          },
          // The Billing step (Language / Payment Type / Payment Method / Bill
          // Media) was removed on 2026-09-25 as not required. Nothing is
          // orphaned by it: the order record this wizard writes never carried
          // those fields, and Checkout's "Billing" row is now conditional
          // rather than rendering a permanent "-".
          {
            key: 'plan',
            label: 'Plan & Add-ons',
            render: ({ values, setValue }) => (
              <PostpaidPlanAddonsStep
                selectedProductId={values.productId as string | undefined}
                onSelectProduct={(id) => setValue('productId', id)}
                discountId={values.discountId as string | undefined}
                onSelectDiscount={(id) => setValue('discountId', id)}
                addonIds={(values.addonIds as string[] | undefined) ?? []}
                onAddonsChange={(ids) => setValue('addonIds', ids)}
              />
            ),
            // Was `&& values.billLimitPass !== false`. The Bill Limit editor
            // was removed from this step on 2026-09-25, so nothing sets that
            // flag any more and the clause could only ever pass - a gate that
            // cannot fail is worse than no gate, because it reads as one.
            isValid: (values) => Boolean(values.productId),
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
          },
          {
            key: 'checkout',
            label: 'Checkout',
            render: ({ values, setValue }) => {
              const contact = values.contact as GuidedContactValue | undefined;
              return (
                <CheckoutSummaryStep
                  customerName={contact?.moiResult?.name}
                  idNumber={contact?.idNumber}
                  productId={values.productId as string | undefined}
                  discountId={values.discountId as string | undefined}
                  addonIds={(values.addonIds as string[] | undefined) ?? []}
                  msisdn={values.msisdn as string | undefined}
                  numberPriceQar={values.numberPriceQAR as number | undefined}
                  eligibility={values.eligibility as EligibilityResult | undefined}
                  onTotalsComputed={(totals) => setValue('checkoutTotals', totals)}
                  onSummaryComputed={(rows) => setValue('cafSummary', rows)}
                />
              );
            },
            isValid: () => true,
          },
          {
            key: 'caf',
            label: 'CAF & Signature',
            render: ({ values, setValue }) => (
              <CafSignatureCapture
                value={(values.caf as { cafType?: CafType; signatureDataUrl?: string }) ?? {}}
                onChange={(v) => setValue('caf', v)}
                customerName={(values.contact as GuidedContactValue | undefined)?.moiResult?.name}
                // Built from the totals CHECKOUT computed (checkoutTotals) plus
                // the plan/number facts already on `values`, so the figures the
                // customer signs against are the same objects the previous step
                // displayed - not a second calculation that could drift.
                orderSummary={values.cafSummary as { label: string; value: string }[] | undefined}
                termsUrl="https://www.vodafone.qa/en/terms-and-conditions"
              />
            ),
            isValid: (values) => {
              const c = values.caf as { cafType?: CafType; signatureDataUrl?: string } | undefined;
              if (!c?.cafType) return false;
              return c.cafType !== 'Digital' || Boolean(c.signatureDataUrl);
            },
          },
          {
            key: 'payment',
            label: 'Payment',
            render: ({ values, setValue }) => {
              const eligibility = values.eligibility as EligibilityResult | undefined;
              const numberDelta = (values.numberPriceQAR as number | undefined) ?? 0;
              const dueTodayQar = numberDelta + (eligibility?.requiresHrnAdvance ? 100 : 0);
              return (
                <WinCashPaymentStep
                  amountDueQAR={dueTodayQar}
                  value={(values.payment as WinCashPaymentValue) ?? {}}
                  onChange={(v) => setValue('payment', v)}
                />
              );
            },
            isValid: (values) => Boolean((values.payment as WinCashPaymentValue | undefined)?.paid),
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
          const numberDelta = (values.numberPriceQAR as number | undefined) ?? 0;
          const dueTodayQar = numberDelta + (eligibility?.requiresHrnAdvance ? 100 : 0);

          const products = await mockDataEngine.list<Product>('products');
          const plan = products.find((p) => p.productId === values.productId);
          const addons = products.filter((p) => addonIds.includes(p.productId));
          const discounts = await mockDataEngine.list<{ addonDiscountId: string; price: number }>('addons-discounts');
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
          // approval routing (UJ-081).
          const pendingApproval = Boolean(contact.isB2B2C) || Boolean(eligibility?.requiresHrnAdvance);

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
            dueTodayQAR: dueTodayQar,
            monthlyRecurringQAR: monthlyRecurringQar,
            createdBy: 'AGENT-KARTHIKK',
            sourceChannel: 'Desktop',
          });

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
          });
        }}
      />
    </div>
  );
}
