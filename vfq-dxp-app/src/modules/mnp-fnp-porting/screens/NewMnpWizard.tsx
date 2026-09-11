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
// form + signature) -> CAF (signature) -> Activity -> Submit. UJ-069 itself
// (a Consumer/HRN case) ends with Status Pending, not auto-completed like a
// direct activation, since a real port request depends on the donor
// operator's response — that base case is unchanged below.
//
// B2B2C orders additionally route to manager approval, generalizing UJ-081/
// UJ-082 (New Postpaid B2B2C With/Without Approval) the same way the Fixed
// Line and FWA wizards already do — no MNP-specific "B2B2C With Approval"
// journey is evidenced in the source corpus, but the Contact step's B2B2C
// checkbox is itself evidenced here (guided-journeys-mnp-postpaid-open-ui-
// tablet-mnp-postpaid-hrn-10ba9743 shows a "Company Name/B2B2C" field on
// this exact step), so gating on it is consistent rather than invented from
// nothing. See order-management's OrderApprovalQueue / approval-matrix.json.
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
            orderType: 'MNP Postpaid Port-In',
            orderSubType: contact.isB2B2C ? 'B2B2C' : 'Port-In',
            // B2B2C orders route to manager approval per the generalized UJ-081/UJ-082
            // pattern (see comment above) — the base Consumer/HRN case keeps UJ-069's
            // evidenced Pending status (a real port request awaits the donor operator
            // regardless of approval).
            status: contact.isB2B2C ? 'Submitted for Approval' : 'Pending',
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
          pushToast(
            'success',
            contact.isB2B2C
              ? `MNP Port-In order ${orderId} submitted for manager approval (B2B2C) — porting ${donorDetails.portInNumber} from Ooredoo Qatar.`
              : `MNP Port-In order ${orderId} submitted — porting ${donorDetails.portInNumber} from Ooredoo Qatar (Status: Pending).`
          );
          navigate('/mnp-fnp-porting');
        }}
        onAbandon={() => navigate('/mnp-fnp-porting')}
      />
    </div>
  );
}
