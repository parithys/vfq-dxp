import { useNavigate } from 'react-router-dom';
import { GuidedActivationWizard } from '../../../components/patterns/GuidedActivationWizard';
import { GuidedContactStep } from '../../../components/patterns/GuidedContactStep';
import type { GuidedContactValue } from '../../../components/patterns/GuidedContactStep';
import { ZsbAddressStep } from '../../../components/patterns/ZsbAddressStep';
import type { ZsbAddressValue } from '../../../components/patterns/ZsbAddressStep';
import { BillingProfileStep } from '../../../components/patterns/BillingProfileStep';
import type { BillingProfileValue } from '../../../components/patterns/BillingProfileStep';
import { ProductPlanStep } from '../../../components/patterns/ProductPlanStep';
import { BillLimitEditor } from '../../../components/domain/BillLimitEditor';
import { MsisdnPicker } from '../../../components/domain/MsisdnPicker';
import { SimSerialScanner } from '../../../components/domain/SimSerialScanner';
import { WinCashPaymentStep } from '../../../components/patterns/WinCashPaymentStep';
import type { WinCashPaymentValue } from '../../../components/patterns/WinCashPaymentStep';
import { CafSignatureCapture } from '../../../components/patterns/CafSignatureCapture';
import type { CafType } from '../../../components/patterns/CafSignatureCapture';
import { ActivityCommentsStep } from '../../../components/patterns/ActivityCommentsStep';
import { useEntityStore } from '../../../stores/entityStore';
import { useNotificationStore } from '../../../stores/notificationStore';

const WIZARD_ID = 'new-postpaid';

// SCR-154/155/156/159/157/158/160/161/162 — the New Postpaid guided wizard
// (UJ-042 "New Postpaid Connection," high confidence): Contact -> Address ->
// Billing -> Plan (with Bill Limit Agent Minimum guardrail) -> Number Selection
// -> SIM Serial -> Payment (WinCash) -> CAF/Signature -> Activity -> Submit.
// The Address step surfaces conflict-report.md Conflict 2 (ZSB-mandatory-for-
// mobile) rather than silently resolving it — see ZsbAddressStep/ruleEngine.ts.
export function NewPostpaidWizard() {
  const navigate = useNavigate();
  const createRecord = useEntityStore((s) => s.createRecord);
  const pushToast = useNotificationStore((s) => s.pushToast);

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
              return Boolean(c?.moiResult && c?.email && c?.altPhone && /^974\d{8}$/.test(c.altPhone));
            },
          },
          {
            key: 'address',
            label: 'Address',
            render: ({ values, setValue }) => (
              <ZsbAddressStep value={(values.address as ZsbAddressValue) ?? {}} onChange={(v) => setValue('address', v)} />
            ),
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
            label: 'Plan',
            render: ({ values, setValue }) => (
              <div className="space-y-4">
                <ProductPlanStep
                  planType="Postpaid Plan"
                  selectedProductId={values.productId as string | undefined}
                  onSelect={(id) => setValue('productId', id)}
                />
                {Boolean(values.productId) && (
                  <BillLimitEditor
                    product="Mobile"
                    value={values.billLimit as number | undefined}
                    onChange={(amount, pass) => {
                      setValue('billLimit', amount);
                      setValue('billLimitPass', pass);
                    }}
                  />
                )}
              </div>
            ),
            isValid: (values) => Boolean(values.productId) && values.billLimitPass !== false,
          },
          {
            key: 'number',
            label: 'Number Selection',
            render: ({ values, setValue }) => (
              <MsisdnPicker selected={values.msisdn as string | undefined} onSelect={(msisdn) => setValue('msisdn', msisdn)} />
            ),
            isValid: (values) => Boolean(values.msisdn),
          },
          {
            key: 'sim',
            label: 'SIM Serial',
            render: ({ values, setValue }) => (
              <SimSerialScanner
                value={(values.simSerial as string) ?? ''}
                onChange={(v, valid) => {
                  setValue('simSerial', v);
                  setValue('simValid', valid);
                }}
              />
            ),
            isValid: (values) => values.simValid === true,
          },
          {
            key: 'payment',
            label: 'Payment',
            render: ({ values, setValue }) => (
              <WinCashPaymentStep
                amountDueQAR={500}
                value={(values.payment as WinCashPaymentValue) ?? {}}
                onChange={(v) => setValue('payment', v)}
              />
            ),
            isValid: (values) => Boolean((values.payment as WinCashPaymentValue | undefined)?.paid),
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
          const orderId = `ORD-${Date.now().toString().slice(-6)}`;
          await createRecord('orders', {
            orderId,
            orderType: 'New Postpaid Activation',
            orderSubType: contact.isB2B2C ? 'B2B2C' : 'Consumer',
            status: 'Complete',
            customerName: contact.moiResult?.name,
            productId: values.productId,
            billLimitQAR: values.billLimit,
            msisdn: values.msisdn,
            simSerial: values.simSerial,
            createdBy: 'AGENT-KARTHIKK',
            sourceChannel: 'Desktop',
          });
          pushToast('success', `Postpaid order ${orderId} submitted — MSISDN ${values.msisdn}, payment confirmed via WinCash.`);
          navigate('/mobile-postpaid');
        }}
        onAbandon={() => navigate('/mobile-postpaid')}
      />
    </div>
  );
}
