import type { WizardStep } from '../../../components/patterns/guidedWizardTypes';
import type { GuidedContactValue } from '../../../components/patterns/guidedContactModel';
import { activityStep, contactStep, isCafValid, type CafValue } from '../../../components/patterns/wizardSteps';
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

// The MNP port-in steps. Postpaid: Contact -> Address -> Billing -> SIM Serial -> Plan (Bill Limit) -> Donor
// Details -> Donor Attachment -> CAF -> Activity. Prepaid drops Billing, swaps the plan step for the prepaid
// pack + discount, and adds the BR-233 balance-forfeiture declaration to the CAF step (see NewMnpWizard.tsx
// for the evidence behind each).
export function buildMnpSteps(isPrepaid: boolean): WizardStep[] {
  return [
    contactStep({ hideIptvToggle: true }),
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
        const caf = (values.caf as CafValue) ?? {};
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
      isValid: (values) => isCafValid(values.caf as CafValue | undefined),
    },
    activityStep(),
  ];
}
