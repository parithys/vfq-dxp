import { useNavigate } from 'react-router-dom';
import { GuidedActivationWizard } from '../../../components/patterns/GuidedActivationWizard';
import { IdLookupStep } from '../../../components/patterns/IdLookupStep';
import type { IdLookupValue } from '../../../components/patterns/idLookupModel';
import { ActivityCommentsStep } from '../../../components/patterns/ActivityCommentsStep';
import { BillLimitEditor } from '../../../components/domain/BillLimitEditor';
import { Input } from '../../../components/primitives/Input';
import { Select } from '../../../components/primitives/Select';
import { useEntityStore } from '../../../stores/entityStore';
import { useNotificationStore } from '../../../stores/notificationStore';
import { useWorkflowStore } from '../../../stores/workflowStore';

interface MigrationOffer {
  offerId: string;
  offerName: string;
  offerDescription?: string;
  monthlyRental: number;
  addOnMonthly?: number;
  promotionId: string;
  serviceIdentifier: string;
}

const WIZARD_ID = 'base-management';

// SCR-180: Base Management wizard - UJ-087 Autobase, 3-step accordion
// ("1. Contact", "2. Offer Summary", "3. Activity"). Offer Summary's Bill
// Limit follows the same evidenced "Default Smart Limit should be
// communicated to the customer" behaviour as Postpaid/MNP (BR-AGENT-MIN-THRESHOLD),
// so it's left unset rather than pre-filled with the walkthrough's illustrative
// value of 20, which would fail the Agent Minimum check on load.
export function BaseManagementWizard() {
  const navigate = useNavigate();
  const createRecord = useEntityStore((s) => s.createRecord);
  const pushToast = useNotificationStore((s) => s.pushToast);
  const offer = useWorkflowStore((s) => s.getDraft(WIZARD_ID).values.offer) as MigrationOffer | undefined;

  if (!offer) {
    return (
      <div className="p-8 text-fg-2">
        No migration offer accepted yet - go to the Migration Offer tab and Accept an offer first.
      </div>
    );
  }

  return (
    <div className="p-8">
      <GuidedActivationWizard
        wizardId={WIZARD_ID}
        title="Base Management"
        steps={[
          {
            key: 'contact',
            label: 'Contact',
            render: ({ values, setValue }) => (
              <div className="space-y-4">
                <IdLookupStep value={(values.qid as IdLookupValue) ?? {}} onChange={(v) => setValue('qid', v)} />
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Email" value={(values.email as string) ?? ''} onChange={(e) => setValue('email', e.target.value)} />
                  <Select
                    label="Language"
                    value={(values.language as string) ?? ''}
                    onChange={(e) => setValue('language', e.target.value)}
                    placeholder="Select language"
                    options={[{ value: 'English', label: 'English' }, { value: 'Arabic', label: 'Arabic' }]}
                  />
                </div>
              </div>
            ),
            isValid: (values) => Boolean((values.qid as IdLookupValue | undefined)?.moiResult),
          },
          {
            key: 'offer-summary',
            label: 'Offer Summary',
            render: ({ values, setValue }) => (
              <div className="space-y-4">
                <div className="rounded-[var(--radius-card)] border border-[var(--field-card-border)] p-4 bg-surface">
                  <p className="text-fg font-medium">{offer.offerName}</p>
                  <p className="text-fg-2 text-[length:var(--fs-body)] mt-1">{offer.offerDescription}</p>
                  <p className="text-fg text-[length:var(--fs-body)] mt-2">
                    Monthly Rental: QR {offer.monthlyRental} + Add-on QR {offer.addOnMonthly ?? 0}
                  </p>
                </div>
                <BillLimitEditor
                  product="Mobile"
                  value={values.billLimit as number | undefined}
                  onChange={(v, pass) => { setValue('billLimit', v); setValue('billLimitValid', pass); }}
                />
                <div className="rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg p-3">
                  <span className="text-fg">Credit Limit</span>
                  <div className="text-fg mt-1">QR 1000</div>
                </div>
              </div>
            ),
            isValid: (values) => Boolean(values.billLimit && values.billLimitValid),
          },
          {
            key: 'activity',
            label: 'Activity',
            render: ({ values, setValue }) => (
              <div className="space-y-4">
                <Select
                  label="Channel"
                  value={(values.channel as string) ?? 'Appointment'}
                  onChange={(e) => setValue('channel', e.target.value)}
                  options={['Appointment', 'Walk-in', 'Call Center'].map((c) => ({ value: c, label: c }))}
                />
                <ActivityCommentsStep value={(values.comments as string) ?? ''} onChange={(v) => setValue('comments', v)} />
              </div>
            ),
          },
        ]}
        onSubmit={async (values) => {
          const qid = values.qid as IdLookupValue;
          const orderId = `ORD-${Date.now().toString().slice(-6)}`;
          await createRecord('orders', {
            orderId,
            orderType: 'Plan Change',
            orderSubType: 'Pre2Post',
            customerName: qid.moiResult?.name,
            msisdn: offer.serviceIdentifier,
            productId: offer.promotionId,
            billLimit: values.billLimit,
            creditLimit: 1000,
            channel: values.channel ?? 'Appointment',
            comments: values.comments,
            status: 'Processing',
          });
          const bulkOrderId = `BLK-${Date.now().toString().slice(-6)}`;
          await createRecord('bulk-activation-orders', {
            bulkOrderId,
            jobType: 'PreToPost',
            msisdn: offer.serviceIdentifier,
            promotionId: offer.promotionId,
            billLimit: values.billLimit,
            overallStatus: 'Processed',
            updatedAt: new Date().toISOString(),
          });
          pushToast('success', `Order ${orderId} created - migration handed off to Bulk Job ${bulkOrderId} (PreToPost).`);
          navigate('/pre-to-post-migration/bulk-jobs-bulk-processing-screen-tm-bulk-batch-list-applet');
        }}
      />
    </div>
  );
}
