import { useNavigate } from 'react-router-dom';
import { GuidedActivationWizard } from '../../../components/patterns/GuidedActivationWizard';
import { GuidedContactStep, isValidAltPhone } from '../../../components/patterns/GuidedContactStep';
import type { GuidedContactValue } from '../../../components/patterns/GuidedContactStep';
import { ZsbAddressStep } from '../../../components/patterns/ZsbAddressStep';
import type { ZsbAddressValue } from '../../../components/patterns/ZsbAddressStep';
import { BillingProfileStep } from '../../../components/patterns/BillingProfileStep';
import type { BillingProfileValue } from '../../../components/patterns/BillingProfileStep';
import { SimSerialScanner } from '../../../components/domain/SimSerialScanner';
import { ProductPlanStep } from '../../../components/patterns/ProductPlanStep';
import { BillLimitEditor } from '../../../components/domain/BillLimitEditor';
import { DonorDetailsStep } from '../../../components/patterns/DonorDetailsStep';
import type { DonorDetailsValue } from '../../../components/patterns/DonorDetailsStep';
import { DonorAttachmentStep } from '../../../components/patterns/DonorAttachmentStep';
import type { DonorAttachmentValue } from '../../../components/patterns/DonorAttachmentStep';
import { CafSignatureCapture } from '../../../components/patterns/CafSignatureCapture';
import type { CafType } from '../../../components/patterns/CafSignatureCapture';
import { ActivityCommentsStep } from '../../../components/patterns/ActivityCommentsStep';
import { useEntityStore } from '../../../stores/entityStore';
import { useNotificationStore } from '../../../stores/notificationStore';

const WIZARD_ID = 'new-mnp';

// SCR-121–134 — the MNP guided wizard (UJ-069 "MNP Postpaid Port-In (Desktop,
// Ooredoo to Vodafone)," high confidence): Contact -> Address -> Billing ->
// SIM Serial -> Plan (Bill Limit) -> Donor Details -> Donor Attachment (MNP
// form + signature) -> CAF (signature) -> Activity -> Submit. Order Type
// Activation, Sub Type Port-In, Status Pending per the evidenced success
// condition — not auto-completed like a direct activation, since a real port
// request depends on the donor operator's response.
export function NewMnpWizard() {
  const navigate = useNavigate();
  const createRecord = useEntityStore((s) => s.createRecord);
  const pushToast = useNotificationStore((s) => s.pushToast);

  return (
    <div className="p-8">
      <GuidedActivationWizard
        wizardId={WIZARD_ID}
        title="MNP Postpaid Port-In"
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
            key: 'address',
            label: 'Address',
            render: ({ values, setValue }) => (
              <ZsbAddressStep value={(values.address as ZsbAddressValue) ?? {}} onChange={(v) => setValue('address', v)} />
            ),
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
            key: 'donor-details',
            label: 'Donor Details',
            render: ({ values, setValue }) => (
              <DonorDetailsStep
                value={(values.donorDetails as DonorDetailsValue) ?? {}}
                onChange={(v) => setValue('donorDetails', v)}
              />
            ),
            isValid: (values) => {
              const d = values.donorDetails as DonorDetailsValue | undefined;
              return Boolean(d?.portInNumber && d?.donorId);
            },
          },
          {
            key: 'donor-attachment',
            label: 'Donor Attachment',
            render: ({ values, setValue }) => (
              <DonorAttachmentStep
                value={(values.donorAttachment as DonorAttachmentValue) ?? {}}
                onChange={(v) => setValue('donorAttachment', v)}
              />
            ),
            isValid: (values) => {
              const d = values.donorAttachment as DonorAttachmentValue | undefined;
              return Boolean(d?.mnpFormType && d?.signatureDataUrl);
            },
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
          const donorDetails = values.donorDetails as DonorDetailsValue;
          const orderId = `ORD-${Date.now().toString().slice(-6)}`;
          await createRecord('orders', {
            orderId,
            orderType: 'Activation',
            orderSubType: 'Port-In',
            status: 'Pending',
            customerName: contact.moiResult?.name,
            productId: values.productId,
            billLimitQAR: values.billLimit,
            simSerial: values.simSerial,
            createdBy: 'AGENT-HEMANTHKUMAR',
            sourceChannel: 'Desktop',
          });
          await createRecord('mnp-portin-orders', {
            portInOrderId: `MNP-${Date.now().toString().slice(-6)}`,
            orderId,
            portInNumber: donorDetails.portInNumber,
            donorId: donorDetails.donorId,
            donorIdType: donorDetails.donorIdType,
            donorOperator: 'Ooredoo Qatar',
            status: 'Pending',
          });
          pushToast('success', `MNP Port-In order ${orderId} submitted — porting ${donorDetails.portInNumber} from Ooredoo Qatar (Status: Pending).`);
          navigate('/mnp-fnp-porting');
        }}
        onAbandon={() => navigate('/mnp-fnp-porting')}
      />
    </div>
  );
}
