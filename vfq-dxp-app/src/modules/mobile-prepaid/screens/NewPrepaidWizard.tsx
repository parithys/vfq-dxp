import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GuidedActivationWizard } from '../../../components/patterns/GuidedActivationWizard';
import { IdLookupStep } from '../../../components/patterns/IdLookupStep';
import type { QidType } from '../../../components/domain/QidInput';
import { MsisdnPicker } from '../../../components/domain/MsisdnPicker';
import { EligibilityGateStep } from '../../../components/domain/EligibilityGateStep';
import type { EligibilityResult } from '../../../components/domain/EligibilityGateStep';
import { ZsbAddressStep } from '../../../components/patterns/ZsbAddressStep';
import type { ZsbAddressValue } from '../../../components/patterns/ZsbAddressStep';
import { PrepaidPlanStep } from '../../../components/patterns/PrepaidPlanStep';
import { SimTypeStep } from '../../../components/domain/SimTypeStep';
import type { SimTypeValue } from '../../../components/domain/SimTypeStep';
import { PrepaidCheckoutStep } from '../../../components/patterns/PrepaidCheckoutStep';
import type { PrepaidCheckoutTotals } from '../../../components/patterns/PrepaidCheckoutStep';
import { CafSignatureCapture } from '../../../components/patterns/CafSignatureCapture';
import type { CafType } from '../../../components/patterns/CafSignatureCapture';
import { WinCashPaymentStep } from '../../../components/patterns/WinCashPaymentStep';
import type { WinCashPaymentValue } from '../../../components/patterns/WinCashPaymentStep';
import { OrderConfirmationScreen } from '../../../components/patterns/OrderConfirmationScreen';
import * as mockDataEngine from '../../../engines/mockDataEngine';
import { useEntityStore } from '../../../stores/entityStore';

const WIZARD_ID = 'new-prepaid-tablet';

interface ContactValue {
  idType?: QidType;
  idNumber?: string;
  moiResult?: { name: string; dob: string; nationality: string; email?: string };
}

interface AccountRecord {
  accountId: string;
  customerId: string;
  accountType: string;
}

interface ConfirmedOrder {
  orderId: string;
  pendingApproval: boolean;
  customerName: string;
  msisdn: string;
  packName: string;
  totalQar: number;
  simType?: string;
  status: string;
}

// SCR-190/191/192: New Prepaid Tablet - the reference walkthrough only
// evidenced Contact (ID capture), Number Selection and SIM Serial
// (guided-journeys-prepaid-open-ui-tablet-new-prepaid-0202dd13, confidence:
// medium). The steps below extend that reference flow with every remaining
// capability the Mobile Prepaid Activation BRSD (VFQ_Mobile_Prepaid_Activation
// _BRSD_V0.1.xlsx) and its 38-node process flow describe for this journey,
// per the 2026-09-11 forensic gap analysis and its 2026-09-11 P1 follow-up
// (which closed customer/account creation, eligibility screening, and
// payment gating). Full step-to-requirement map:
//   Contact          -> MPRA_001_KYC_01
//   Eligibility       -> MPRA_001_ECC_01/02 (BR-113 blacklist, BR-347/BR-003 line cap)
//   Address & Contact -> MPRA_001_CAM_05 (reuses ZsbAddressStep, non-blocking per FLD-523-526)
//   Plan & Discount   -> MPRA_001_QPC_01-04
//   Number Selection  -> MPRA_001_NUM_01
//   SIM Type          -> MPRA_001_SIM_01 (Physical/eSIM - see SimTypeStep for why
//                        "Printed eSIM"/"Virtual eSIM" aren't modelled as distinct options)
//   Checkout          -> MPRA_001_CVC_01-03 (BR-011 starter pack charge, BR-348/BR-013 SIM card charge)
//   CAF & Key Info    -> MPRA_001_CAF_01-03 (BR-009 Key Information, reuses CafSignatureCapture)
//   Payment           -> MPRA_001_PAY_01/02 (BR-014 submission precondition)
// onSubmit then covers: MPRA_001_CAM_01 (account creation), MPRA_001_PAY_03
// (physical SIM inventory depletion), MPRA_001_ORD_01/02 + BR-004 (HRN
// customers route to approval via the new "New Prepaid Activation"
// approval-matrix entry, same mechanism as postpaid's BR-268), MPRA_001_NET_02-06
// (a simulated fulfilment delay progressing the order from Open to Complete
// - this app's status model previously jumped straight to a terminal state
// with none of the intermediate states ever reachable), and MPRA_001_NOT_01
// (an osb-notifications record, not just a toast).
//
// Deliberately NOT built here, and why: MPRA_001_JSM_01's Qnomy queue
// ticketing has zero implementation anywhere else in this app (no journey
// creates a Q-ticket), so building it only for prepaid would be a fabricated
// one-off, not a real reused capability. DF-01's Tracking Record entity is
// the same systemic gap. INT-04 email verification is likewise unimplemented
// for every journey, including postpaid, so email is captured/displayed but
// not "verified" here either, for consistency. The BRSD's "Recipient List:
// all active MSISDNs on the QID" for the activation notification isn't
// modelled - this schema has no cross-line directory to resolve that from,
// so the notification below targets only the just-activated MSISDN.
export function NewPrepaidWizard() {
  const navigate = useNavigate();
  const createRecord = useEntityStore((s) => s.createRecord);
  const updateRecord = useEntityStore((s) => s.updateRecord);
  const [confirmedOrder, setConfirmedOrder] = useState<ConfirmedOrder | null>(null);

  if (confirmedOrder) {
    return (
      <div className="p-8">
        <OrderConfirmationScreen
          heading={confirmedOrder.pendingApproval ? 'Order submitted for approval' : 'Prepaid activation complete'}
          orderId={confirmedOrder.orderId}
          summaryLines={[
            { label: 'Customer', value: confirmedOrder.customerName },
            { label: 'MSISDN', value: confirmedOrder.msisdn },
            { label: 'Pack', value: confirmedOrder.packName },
            { label: 'SIM Type', value: confirmedOrder.simType ?? '-' },
            { label: 'Total charged', value: `QR ${confirmedOrder.totalQar}` },
            { label: 'Status', value: confirmedOrder.status },
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
        title="New Prepaid Activation (Tablet)"
        steps={[
          {
            key: 'contact',
            label: 'Contact (ID capture)',
            render: ({ values, setValue }) => (
              <IdLookupStep value={(values.contact as ContactValue) ?? {}} onChange={(v) => setValue('contact', v)} />
            ),
            isValid: (values) => Boolean((values.contact as ContactValue | undefined)?.moiResult),
          },
          {
            key: 'eligibility',
            label: 'Eligibility',
            description: 'Blacklist & line cap',
            render: ({ values, setValue }) => {
              const contact = values.contact as ContactValue | undefined;
              return (
                <EligibilityGateStep
                  idNumber={contact?.idNumber}
                  journeyType="prepaid"
                  result={values.eligibility as EligibilityResult | undefined}
                  onResult={(r) => setValue('eligibility', r)}
                />
              );
            },
            isValid: (values) => (values.eligibility as EligibilityResult | undefined)?.pass === true,
          },
          {
            key: 'address',
            label: 'Address & Contact Details',
            render: ({ values, setValue }) => {
              const contact = values.contact as ContactValue | undefined;
              return (
                <ZsbAddressStep
                  value={(values.address as ZsbAddressValue) ?? {}}
                  onChange={(v) => setValue('address', v)}
                  idNumber={contact?.idNumber}
                  nationality={contact?.moiResult?.nationality}
                />
              );
            },
            // Mandatory: No per FLD-523-526, same as the postpaid wizard's Address step.
            isValid: () => true,
          },
          {
            key: 'plan',
            label: 'Plan & Discount',
            render: ({ values, setValue }) => (
              <PrepaidPlanStep
                selectedProductId={values.productId as string | undefined}
                onSelectProduct={(id) => setValue('productId', id)}
                discountId={values.discountId as string | undefined}
                onSelectDiscount={(id) => setValue('discountId', id)}
              />
            ),
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
                  setValue('priceQAR', priceQAR);
                }}
              />
            ),
            isValid: (values) => Boolean(values.msisdn),
          },
          {
            key: 'simType',
            label: 'SIM Type',
            render: ({ values, setValue }) => {
              const contact = values.contact as ContactValue | undefined;
              return (
                <SimTypeStep
                  value={(values.simType as SimTypeValue) ?? {}}
                  customerEmail={contact?.moiResult?.email}
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
              const contact = values.contact as ContactValue | undefined;
              return (
                <PrepaidCheckoutStep
                  customerName={contact?.moiResult?.name}
                  idType={contact?.idType ?? 'QID'}
                  planProductId={values.productId as string | undefined}
                  discountId={values.discountId as string | undefined}
                  msisdn={values.msisdn as string | undefined}
                  numberPriceQar={values.priceQAR as number | undefined}
                  simType={values.simType as SimTypeValue | undefined}
                  onTotalsComputed={(totals) => setValue('checkoutTotals', totals)}
                />
              );
            },
            isValid: () => true,
          },
          {
            key: 'caf',
            label: 'CAF & Key Information',
            render: ({ values, setValue }) => {
              const contact = values.contact as ContactValue | undefined;
              return (
                <div className="space-y-6">
                  {/* MPRA_001_CAF_02 (BR-009): displayed before CAF submission, refreshed
                      on any cart amendment since it's derived live from the selected pack. */}
                  <div className="rounded-[var(--radius-card)] border border-border-soft bg-surface p-4">
                    <h3 className="text-fg font-semibold text-[length:var(--fs-body-lg)] mb-2">Key Information</h3>
                    <ul className="list-disc list-inside space-y-1 text-fg-2 text-[length:var(--fs-body)]">
                      <li>No plan lock-in period applies to prepaid packs.</li>
                      <li>No Device on Installment applies - this is a SIM/number activation only.</li>
                      <li>Pack validity and balance terms apply per the selected pack (see Plan &amp; Discount step).</li>
                    </ul>
                  </div>
                  <CafSignatureCapture
                    value={(values.caf as { cafType?: CafType; signatureDataUrl?: string }) ?? {}}
                    onChange={(v) => setValue('caf', v)}
                    customerName={contact?.moiResult?.name}
                  />
                </div>
              );
            },
            isValid: (values) => {
              const c = values.caf as { cafType?: CafType; signatureDataUrl?: string } | undefined;
              if (!c?.cafType) return false;
              return c.cafType !== 'Digital' || Boolean(c.signatureDataUrl);
            },
          },
          {
            key: 'payment',
            label: 'Payment',
            render: ({ values, setValue }) => (
              <WinCashPaymentStep
                amountDueQAR={(values.checkoutTotals as PrepaidCheckoutTotals | undefined)?.totalDueQar ?? 0}
                value={(values.payment as WinCashPaymentValue) ?? {}}
                onChange={(v) => setValue('payment', v)}
              />
            ),
            isValid: (values) => Boolean((values.payment as WinCashPaymentValue | undefined)?.paid),
          },
        ]}
        onSubmit={async (values) => {
          const contact = values.contact as ContactValue | undefined;
          const eligibility = values.eligibility as EligibilityResult | undefined;
          const simType = values.simType as SimTypeValue | undefined;
          const checkoutTotals = values.checkoutTotals as PrepaidCheckoutTotals | undefined;
          const customerId = eligibility?.customerId;

          // MPRA_001_CAM_01: find-or-create the prepaid account for this
          // customer. No billingProfileId/credit-limit field is set -
          // MPRA_001_CAM_02/BR-002/BR-005 require Prepaid Activation to
          // leave credit limit and bill cycle unpopulated.
          let accountId: string | undefined;
          if (customerId) {
            const [accounts, customerRecord] = await Promise.all([
              mockDataEngine.list<AccountRecord>('accounts'),
              mockDataEngine.get<{ activePrepaidLines?: number }>('customers', customerId),
            ]);
            const existing = accounts.find((a) => a.customerId === customerId && a.accountType === 'Consumer Mobile Prepaid');
            if (existing) {
              accountId = existing.accountId;
            } else {
              accountId = `ACC-${Date.now().toString().slice(-6)}`;
              await createRecord('accounts', {
                accountId,
                customerId,
                accountType: 'Consumer Mobile Prepaid',
                status: 'Active',
              });
            }
            // Without this, the BR-347 line cap tested by CUST-1005/1002
            // would never actually tighten after a successful order - the
            // cap would only ever reflect seed data, not real usage.
            await updateRecord('customers', 'customerId', customerId, {
              activePrepaidLines: (customerRecord?.activePrepaidLines ?? 0) + 1,
            });
          }

          // MPRA_001_PAY_03: physical SIM stock is depleted on payment
          // completion. eSIM issuance has no backing inventory record to
          // deplete (see SimTypeStep) - nothing fabricated for that path.
          if (simType?.simType === 'Physical' && simType.simSerial) {
            await updateRecord('sims', 'simSerial', simType.simSerial, { stockStatus: 'Issued' });
          }

          // BR-004/BR-268-equivalent: HRN customers route to approval rather
          // than auto-completing, same mechanism already established for
          // postpaid - see the new "New Prepaid Activation" approval-matrix entry.
          const pendingApproval = Boolean(eligibility?.requiresHrnAdvance);
          const orderId = `ORD-${Date.now().toString().slice(-6)}`;
          const totalQar = checkoutTotals?.totalDueQar ?? 0;

          await createRecord('orders', {
            orderId,
            orderType: 'New Prepaid Activation',
            orderSubType: pendingApproval ? 'HRN' : 'Consumer',
            status: pendingApproval ? 'Submitted for Approval' : 'Open',
            customerId,
            accountId,
            customerName: contact?.moiResult?.name,
            productId: values.productId,
            discountId: values.discountId,
            msisdn: values.msisdn,
            numberPriceQAR: checkoutTotals?.numberPriceQar ?? 0,
            starterPackChargeQAR: checkoutTotals?.starterPackChargeQar ?? 0,
            simCardChargeQAR: checkoutTotals?.simCardChargeQar ?? 0,
            totalQAR: totalQar,
            simType: simType?.simType,
            simSerial: simType?.simSerial,
            cafType: (values.caf as { cafType?: CafType } | undefined)?.cafType,
            createdBy: 'AGENT-VINODHINIR',
            sourceChannel: 'Tablet',
          });

          let finalStatus = pendingApproval ? 'Submitted for Approval' : 'Open';
          if (!pendingApproval) {
            // MPRA_001_NET_02-06: simulated downstream fulfilment (service
            // creation, charging-system account, plan/benefit activation,
            // outcome sync to CRM order status) - the first place in this
            // codebase an order actually progresses through an intermediate
            // status rather than jumping straight to a terminal one.
            await new Promise((r) => setTimeout(r, 900));
            await updateRecord('orders', 'orderId', orderId, { status: 'Complete' });
            finalStatus = 'Complete';
          }

          // MPRA_001_NOT_01 - a real notification record, not just a toast.
          // Only the just-activated MSISDN is notified; see the file-level
          // comment for why "all active MSISDNs on the QID" isn't modelled.
          await createRecord('osb-notifications', {
            messageId: `MSG-${Date.now().toString().slice(-6)}`,
            orderId,
            dbTimestamp: new Date().toISOString(),
            server: 'OSB-PRD-NODE1',
            state: 'COMPLETED',
            node: 'Node1',
            pipeline: 'PS_VFQA_Communication_Pipeline',
            stage: 'SendSMS',
            inboundService: 'PS_VFQA_Communication',
            operation: 'CreateCommunication',
            smsText: pendingApproval
              ? `Dear customer, your prepaid activation order ${orderId} has been submitted and is pending manager approval.`
              : `Dear customer, your prepaid activation order ${orderId} is complete. Welcome to Vodafone Qatar prepaid - MSISDN ${values.msisdn}.`,
          });

          const products = await mockDataEngine.list<{ productId: string; name: string }>('products');
          const pack = products.find((p) => p.productId === values.productId);

          setConfirmedOrder({
            orderId,
            pendingApproval,
            customerName: contact?.moiResult?.name ?? '-',
            msisdn: (values.msisdn as string) ?? '-',
            packName: pack?.name ?? 'SIM only',
            totalQar,
            simType: simType?.simType,
            status: finalStatus,
          });
        }}
        onAbandon={() => navigate('/mobile-prepaid')}
      />
    </div>
  );
}
