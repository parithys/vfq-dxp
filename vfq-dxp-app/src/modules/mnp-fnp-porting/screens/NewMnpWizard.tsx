import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getAllRoutes } from '../../../engines/configEngine';
import { GuidedActivationWizard } from '../../../components/patterns/GuidedActivationWizard';
import type { WizardStep } from '../../../components/patterns/guidedWizardTypes';
import { GuidedContactStep } from '../../../components/patterns/GuidedContactStep';
import { isValidAltPhone, isValidEmail, hasIdentityDetails } from '../../../components/patterns/guidedContactModel';
import type { GuidedContactValue } from '../../../components/patterns/guidedContactModel';
import { ZsbAddressStep } from '../../../components/patterns/ZsbAddressStep';
import type { ZsbAddressValue } from '../../../components/patterns/ZsbAddressStep';
import { BillingProfileStep } from '../../../components/patterns/BillingProfileStep';
import type { BillingProfileValue } from '../../../components/patterns/BillingProfileStep';
import { SimSerialScanner } from '../../../components/domain/SimSerialScanner';
import { ProductPlanStep } from '../../../components/patterns/ProductPlanStep';
import { PrepaidPlanStep } from '../../../components/patterns/PrepaidPlanStep';
import { BillLimitEditor } from '../../../components/domain/BillLimitEditor';
import { DonorDetailsStep } from '../../../components/patterns/DonorDetailsStep';
import type { DonorDetailsValue } from '../../../components/patterns/DonorDetailsStep';
import { DonorAttachmentStep } from '../../../components/patterns/DonorAttachmentStep';
import type { DonorAttachmentValue } from '../../../components/patterns/DonorAttachmentStep';
import { CafSignatureCapture } from '../../../components/patterns/CafSignatureCapture';
import type { CafType } from '../../../components/patterns/cafTypes';
import { ActivityCommentsStep } from '../../../components/patterns/ActivityCommentsStep';
import { useEntityStore } from '../../../stores/entityStore';
import { useNotificationStore } from '../../../stores/notificationStore';

type ProcessType = 'postpaid' | 'prepaid';

// SCR-121–134 - the MNP guided wizard, entered only after SCR-120's Postpaid/
// Prepaid choice gate (MnpProcessChoiceScreen) sets the `type` query param -
// module-hierarchy.json: "MNP guided process presents Postpaid/Prepaid
// choice before data entry." Both variants share this one wizard component
// rather than forking into two, since VAL-332–335's Donor Details fields are
// explicitly evidenced as shared across "Postpaid/Prepaid MNP journeys."
//
// Postpaid (UJ-069 "MNP Postpaid Port-In (Desktop, Ooredoo to Vodafone),"
// high confidence): Contact -> Address -> Billing -> SIM Serial -> Plan (Bill
// Limit) -> Donor Details -> Donor Attachment -> CAF -> Activity -> Submit.
//
// Prepaid (UJ-010 "MNP Prepaid," module-hierarchy's "MNP prepaid port-in
// (tablet)"): Contact -> Address -> SIM Serial -> Plan (prepaid pack +
// discount, VAL-337) -> Donor Details -> Donor Attachment -> CAF (BR-233
// balance-forfeiture declaration + module-hierarchy's "CAF form dynamically
// binds Qatari ID/Passport number field for prepaid subscribers") -> Activity.
// No Billing/Bill Limit step - prepaid carries no credit limit or bill cycle,
// same reasoning NewPrepaidWizard already applies (BR-002/BR-005).
//
// UJ-069 itself (a Consumer/HRN case) ends with Status Pending, not
// auto-completed like a direct activation, since a real port request depends
// on the donor operator's response - unchanged for both variants below.
//
// Postpaid B2B2C orders additionally route to manager approval, generalizing
// UJ-081/UJ-082 the same way the Fixed Line and FWA wizards already do - no
// MNP-specific "B2B2C With Approval" journey is evidenced, but the Contact
// step's B2B2C checkbox is itself evidenced here (guided-journeys-mnp-postpaid-
// open-ui-tablet-mnp-postpaid-hrn-10ba9743 shows a "Company Name/B2B2C" field
// on this exact step). No B2B2C concept is evidenced for MNP prepaid, so the
// prepaid path ignores isB2B2C rather than inventing an approval route for it.
export function NewMnpWizard() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const createRecord = useEntityStore((s) => s.createRecord);
  const pushToast = useNotificationStore((s) => s.pushToast);

  const rawType = params.get('type');
  const processType: ProcessType | undefined = rawType === 'postpaid' || rawType === 'prepaid' ? rawType : undefined;

  useEffect(() => {
    if (processType) return;
    const choiceRoute = getAllRoutes().find((r) => r.screenId === 'SCR-120');
    navigate(choiceRoute?.path ?? '/mnp-fnp-porting', { replace: true });
  }, [processType, navigate]);

  if (!processType) return null;

  const isPrepaid = processType === 'prepaid';

  const steps: WizardStep[] = [
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
        return Boolean(c?.moiResult && hasIdentityDetails(c ?? {}) && isValidEmail(c?.email) && isValidAltPhone(c?.altPhone));
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
    ...(isPrepaid
      ? []
      : [
          {
            key: 'billing',
            label: 'Billing',
            render: ({ values, setValue }: Parameters<WizardStep['render']>[0]) => (
              <BillingProfileStep
                value={(values.billing as BillingProfileValue) ?? {}}
                onChange={(v) => setValue('billing', v)}
              />
            ),
            isValid: () => true,
          },
        ]),
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
      render: ({ values, setValue }) =>
        isPrepaid ? (
          <PrepaidPlanStep
            selectedProductId={values.productId as string | undefined}
            onSelectProduct={(id) => setValue('productId', id)}
            discountId={values.discountId as string | undefined}
            onSelectDiscount={(id) => setValue('discountId', id)}
          />
        ) : (
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
      isValid: (values) =>
        isPrepaid ? Boolean(values.productId) : Boolean(values.productId) && values.billLimitPass !== false,
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
      render: ({ values, setValue }) => {
        const contact = values.contact as GuidedContactValue | undefined;
        const caf = (values.caf as { cafType?: CafType; signatureDataUrl?: string }) ?? {};
        if (!isPrepaid) {
          return <CafSignatureCapture value={caf} onChange={(v) => setValue('caf', v)} customerName={contact?.moiResult?.name} />;
        }
        return (
          <div className="space-y-6">
            {/* BR-233: prepaid MNP declaration - unused balance is forfeited on
                switching, shown before signature the same way NewPrepaidWizard
                surfaces its own Key Information panel at this stage. */}
            <div className="rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-surface p-4">
              <h3 className="text-fg font-semibold text-[length:var(--fs-body-lg)] mb-2">Key Information</h3>
              <ul className="list-disc list-inside space-y-1 text-fg-2 text-[length:var(--fs-body)]">
                <li>Any unused prepaid balance must be used before the number is switched - remaining balance is forfeited once porting completes.</li>
                <li>Porting is a request, not an instant switch - the donor operator's response determines the final port date.</li>
              </ul>
            </div>
            <CafSignatureCapture
              value={caf}
              onChange={(v) => setValue('caf', v)}
              customerName={contact?.moiResult?.name}
              idLabel={contact?.idType ?? 'ID Number'}
              idValue={contact?.idNumber}
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
      key: 'activity',
      label: 'Activity',
      render: ({ values, setValue }) => (
        <ActivityCommentsStep value={(values.comments as string) ?? ''} onChange={(v) => setValue('comments', v)} />
      ),
      isValid: (values) => Boolean((values.comments as string)?.trim()),
    },
  ];

  return (
    <div className="p-8">
      <GuidedActivationWizard
        wizardId={`new-mnp-${processType}`}
        title={isPrepaid ? 'MNP Prepaid Port-In' : 'MNP Postpaid Port-In'}
        steps={steps}
        onSubmit={async (values) => {
          const contact = values.contact as GuidedContactValue;
          const donorDetails = values.donorDetails as DonorDetailsValue;
          const orderId = `ORD-${Date.now().toString().slice(-6)}`;
          const isB2B2C = !isPrepaid && contact.isB2B2C;

          await createRecord('orders', {
            orderId,
            orderType: isPrepaid ? 'MNP Prepaid Port-In' : 'MNP Postpaid Port-In',
            orderSubType: isB2B2C ? 'B2B2C' : 'Port-In',
            // B2B2C orders route to manager approval per the generalized UJ-081/UJ-082
            // pattern (see file-level comment) - every other case, prepaid included,
            // keeps UJ-069's evidenced Pending status (a real port request awaits the
            // donor operator regardless of approval).
            status: isB2B2C ? 'Submitted for Approval' : 'Pending',
            customerName: contact.moiResult?.name,
            productId: values.productId,
            ...(isPrepaid ? { discountId: values.discountId } : { billLimitQAR: values.billLimit }),
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
            isB2B2C
              ? `MNP Port-In order ${orderId} submitted for manager approval (B2B2C) - porting ${donorDetails.portInNumber} from Ooredoo Qatar.`
              : `MNP ${isPrepaid ? 'Prepaid' : 'Postpaid'} Port-In order ${orderId} submitted - porting ${donorDetails.portInNumber} from Ooredoo Qatar (Status: Pending).`
          );
          navigate('/mnp-fnp-porting');
        }}
      />
    </div>
  );
}
