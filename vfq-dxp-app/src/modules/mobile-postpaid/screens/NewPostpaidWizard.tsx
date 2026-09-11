import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GuidedActivationWizard } from '../../../components/patterns/GuidedActivationWizard';
import { GuidedContactStep, isValidAltPhone } from '../../../components/patterns/GuidedContactStep';
import type { GuidedContactValue } from '../../../components/patterns/GuidedContactStep';
import { ZsbAddressStep } from '../../../components/patterns/ZsbAddressStep';
import type { ZsbAddressValue } from '../../../components/patterns/ZsbAddressStep';
import { BillingProfileStep } from '../../../components/patterns/BillingProfileStep';
import type { BillingProfileValue } from '../../../components/patterns/BillingProfileStep';
import { PostpaidPlanAddonsStep } from '../../../components/patterns/PostpaidPlanAddonsStep';
import { MsisdnPicker } from '../../../components/domain/MsisdnPicker';
import { EligibilityGateStep } from '../../../components/domain/EligibilityGateStep';
import type { EligibilityResult } from '../../../components/domain/EligibilityGateStep';
import { DeviceInstallmentStep } from '../../../components/domain/DeviceInstallmentStep';
import type { DoiSelection } from '../../../components/domain/DeviceInstallmentStep';
import { SimTypeStep } from '../../../components/domain/SimTypeStep';
import type { SimTypeValue } from '../../../components/domain/SimTypeStep';
import { CheckoutSummaryStep } from '../../../components/patterns/CheckoutSummaryStep';
import { WinCashPaymentStep } from '../../../components/patterns/WinCashPaymentStep';
import type { WinCashPaymentValue } from '../../../components/patterns/WinCashPaymentStep';
import { CafSignatureCapture } from '../../../components/patterns/CafSignatureCapture';
import type { CafType } from '../../../components/patterns/CafSignatureCapture';
import { ActivityCommentsStep } from '../../../components/patterns/ActivityCommentsStep';
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
  deviceName?: string;
}

// SCR-154/155/156/159/157/158/160/161/162 — the New Postpaid guided wizard
// (UJ-042 "New Postpaid Connection," high confidence), aligned to the
// reference 12-step activation flow (Queue Token/ID Scan are pre-wizard;
// this covers ID Scan's MOI result onward): Contact -> Eligibility Gate ->
// Address -> Billing -> Plan & Add-ons (with Bill Limit Agent Minimum
// guardrail) -> Number Selection -> Device & DOI -> SIM Type -> Checkout ->
// CAF/Signature -> Payment (WinCash) -> Activity -> Confirmation.
// The Address step surfaces conflict-report.md Conflict 2 (ZSB-mandatory-for-
// mobile) rather than silently resolving it — see ZsbAddressStep/ruleEngine.ts.
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
          summaryLines={[
            { label: 'Customer', value: confirmedOrder.customerName },
            { label: 'MSISDN', value: confirmedOrder.msisdn },
            { label: 'Plan', value: confirmedOrder.planName },
            ...(confirmedOrder.deviceName ? [{ label: 'Device', value: confirmedOrder.deviceName }] : []),
            { label: 'SIM Type', value: confirmedOrder.simType ?? '—' },
            { label: 'Due today', value: `QR ${confirmedOrder.dueTodayQar}` },
            { label: 'Monthly recurring', value: `QR ${confirmedOrder.monthlyRecurringQar}/mo` },
            { label: 'Status', value: confirmedOrder.pendingApproval ? 'Submitted for Approval' : 'Complete' },
          ]}
          nextSteps={
            confirmedOrder.pendingApproval
              ? [
                  'A manager reviews this order in the Order Approval queue.',
                  'The customer is notified once a decision is made.',
                  'Track its status from Order Management at any time.',
                ]
              : [
                  'The SIM activates on the network within a few minutes.',
                  'A copy of the CAF has been stored against this account.',
                  confirmedOrder.simType === 'eSIM'
                    ? 'The customer can install the eSIM using the QR code sent to their email.'
                    : 'Hand the physical SIM to the customer.',
                ]
          }
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
        steps={[
          {
            key: 'contact',
            label: 'Contact',
            render: ({ values, setValue }) => (
              <GuidedContactStep
                value={(values.contact as GuidedContactValue) ?? {}}
                onChange={(v) => setValue('contact', v)}
                showIptvToggle={false}
              />
            ),
            isValid: (values) => {
              const c = values.contact as GuidedContactValue | undefined;
              return Boolean(c?.moiResult && c?.email && isValidAltPhone(c?.altPhone));
            },
          },
          {
            key: 'eligibility',
            label: 'Eligibility',
            description: 'Blacklist, line cap & HRN',
            render: ({ values, setValue }) => {
              const contact = values.contact as GuidedContactValue | undefined;
              return <EligibilityGateStep idNumber={contact?.idNumber} onResult={(r) => setValue('eligibility', r)} />;
            },
            isValid: (values) => (values.eligibility as EligibilityResult | undefined)?.pass === true,
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
            // Mandatory: No per FLD-523–526 — never gates progression, matching the evidenced Skip Address affordance.
            isValid: () => true,
          },
          {
            key: 'billing',
            label: 'Billing',
            render: ({ values, setValue }) => (
              <BillingProfileStep
                value={(values.billing as BillingProfileValue) ?? {}}
                onChange={(v) => setValue('billing', v)}
              />
            ),
            isValid: () => true,
          },
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
                billLimit={values.billLimit as number | undefined}
                onBillLimitChange={(amount, pass) => {
                  setValue('billLimit', amount);
                  setValue('billLimitPass', pass);
                }}
                defaultCreditLimitQar={(values.eligibility as EligibilityResult | undefined)?.defaultCreditLimitQar}
              />
            ),
            isValid: (values) => Boolean(values.productId) && values.billLimitPass !== false,
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
          {
            key: 'device',
            label: 'Device & DOI',
            render: ({ values, setValue }) => (
              <DeviceInstallmentStep
                value={values.doi as DoiSelection | undefined}
                defaultCreditLimitQar={(values.eligibility as EligibilityResult | undefined)?.defaultCreditLimitQar}
                onChange={(v) => setValue('doi', v)}
              />
            ),
            isValid: () => true,
          },
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
                  productId={values.productId as string | undefined}
                  addonIds={(values.addonIds as string[] | undefined) ?? []}
                  msisdn={values.msisdn as string | undefined}
                  numberPriceQar={values.numberPriceQAR as number | undefined}
                  doi={values.doi as DoiSelection | undefined}
                  simType={values.simType as SimTypeValue | undefined}
                  eligibility={values.eligibility as EligibilityResult | undefined}
                  onTotalsComputed={(totals) => setValue('checkoutTotals', totals)}
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
              const doi = values.doi as DoiSelection | undefined;
              const eligibility = values.eligibility as EligibilityResult | undefined;
              const numberDelta = (values.numberPriceQAR as number | undefined) ?? 0;
              const dueTodayQar = numberDelta + (doi?.downPaymentQar ?? 0) + (eligibility?.requiresHrnAdvance ? 100 : 0);
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
          {
            key: 'activity',
            label: 'Activity',
            render: ({ values, setValue }) => (
              <ActivityCommentsStep value={(values.comments as string) ?? ''} onChange={(v) => setValue('comments', v)} />
            ),
            isValid: (values) => Boolean((values.comments as string)?.trim()),
          },
        ]}
        onSubmit={async (values) => {
          const contact = values.contact as GuidedContactValue;
          const eligibility = values.eligibility as EligibilityResult | undefined;
          const doi = values.doi as DoiSelection | undefined;
          const simType = values.simType as SimTypeValue | undefined;
          const addonIds = (values.addonIds as string[] | undefined) ?? [];
          const numberDelta = (values.numberPriceQAR as number | undefined) ?? 0;
          const dueTodayQar = numberDelta + (doi?.downPaymentQar ?? 0) + (eligibility?.requiresHrnAdvance ? 100 : 0);

          const products = await mockDataEngine.list<Product>('products');
          const plan = products.find((p) => p.productId === values.productId);
          const addons = products.filter((p) => addonIds.includes(p.productId));
          const discounts = await mockDataEngine.list<{ addonDiscountId: string; price: number }>('addons-discounts');
          const discount = discounts.find((d) => d.addonDiscountId === values.discountId);
          const discountedPlanQar = (plan?.mrcQAR ?? 0) * (1 + (discount?.price ?? 0));
          const monthlyRecurringQar = discountedPlanQar + addons.reduce((sum, a) => sum + a.mrcQAR, 0) + (doi?.monthlyInstallmentQar ?? 0);

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
            billLimitQAR: values.billLimit,
            msisdn: values.msisdn,
            numberPriceQAR: numberDelta,
            deviceName: doi?.deviceName,
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
            customerName: contact.moiResult?.name ?? '—',
            msisdn: (values.msisdn as string) ?? '—',
            planName: plan?.name ?? '—',
            dueTodayQar,
            monthlyRecurringQar,
            simType: simType?.simType,
            deviceName: doi?.deviceName,
          });
        }}
        onAbandon={() => navigate('/mobile-postpaid')}
      />
    </div>
  );
}
