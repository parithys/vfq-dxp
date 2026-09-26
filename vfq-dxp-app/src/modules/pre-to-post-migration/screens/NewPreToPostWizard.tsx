import { useNavigate } from 'react-router-dom';
import { GuidedActivationWizard } from '../../../components/patterns/GuidedActivationWizard';
import { IdLookupStep } from '../../../components/patterns/IdLookupStep';
import { ProductPlanStep } from '../../../components/patterns/ProductPlanStep';
import { CafSignatureCapture } from '../../../components/patterns/CafSignatureCapture';
import type { CafType } from '../../../components/patterns/CafSignatureCapture';
import { ActivityCommentsStep } from '../../../components/patterns/ActivityCommentsStep';
import { useEntityStore } from '../../../stores/entityStore';
import { useNotificationStore } from '../../../stores/notificationStore';

interface MoiResult {
  name: string;
  dob: string;
  nationality: string;
}
interface QidValue {
  idNumber?: string;
  moiResult?: MoiResult;
}
interface CafValue {
  cafType?: CafType;
  signatureDataUrl?: string;
}

const WIZARD_ID = 'pre-to-post-manual';

// SCR-177: Postpaid - Contact wizard step (Pre-to-Post) - UJ-086 manual
// conversion (agent-initiated, not system-recommended): "enter prepaid number,
// confirm identity -> Plan step (manually search/apply postpaid promotion) ->
// CAF auto-generated bilingual form, e-signature -> Sales Order created
// (Plan Change/Pre2Post)." No approval step is evidenced, so the order
// completes directly, unlike the B2B2C-with-approval wizards.
export function NewPreToPostWizard() {
  const navigate = useNavigate();
  const createRecord = useEntityStore((s) => s.createRecord);
  const pushToast = useNotificationStore((s) => s.pushToast);

  return (
    <div className="p-8">
      <GuidedActivationWizard
        wizardId={WIZARD_ID}
        title="Prepaid to Postpaid Conversion"
        steps={[
          {
            key: 'contact',
            label: 'Contact',
            render: ({ values, setValue }) => (
              <IdLookupStep value={(values.qid as QidValue) ?? {}} onChange={(v) => setValue('qid', v)} />
            ),
            isValid: (values) => Boolean((values.qid as QidValue | undefined)?.moiResult),
          },
          {
            key: 'plan',
            label: 'Plan',
            render: ({ values, setValue }) => (
              <ProductPlanStep
                planType="Postpaid Plan"
                selectedProductId={values.productId as string | undefined}
                onSelect={(id) => setValue('productId', id)}
              />
            ),
            isValid: (values) => Boolean(values.productId),
          },
          {
            key: 'caf',
            label: 'CAF',
            render: ({ values, setValue }) => (
              <CafSignatureCapture
                value={(values.caf as CafValue) ?? {}}
                onChange={(v) => setValue('caf', v)}
                customerName={(values.qid as QidValue | undefined)?.moiResult?.name}
              />
            ),
            isValid: (values) => {
              const c = values.caf as CafValue | undefined;
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
          },
        ]}
        onSubmit={async (values) => {
          const qid = values.qid as QidValue;
          const orderId = `ORD-${Date.now().toString().slice(-6)}`;
          await createRecord('orders', {
            orderId,
            orderType: 'Plan Change',
            orderSubType: 'Pre2Post',
            customerName: qid.moiResult?.name,
            productId: values.productId,
            comments: values.comments,
            status: 'Complete',
          });
          pushToast('success', `Order ${orderId} created - prepaid to postpaid conversion complete.`);
          navigate('/pre-to-post-migration');
        }}
      />
    </div>
  );
}
