import { useNavigate } from 'react-router-dom';
import * as sums from '../../../components/patterns/wizard/commonSummaries';
import { attachSummaries } from '../../../components/patterns/wizard/stepSummary';
import { GuidedActivationWizard } from '../../../capabilities';
import type { IdLookupValue } from '../../../components/patterns/idLookupModel';
import { activityStep, cafSignatureStep, idLookupStep, planSelectionStep } from '../../../capabilities';
import { useEntityStore } from '../../../stores/entityStore';
import { useNotificationStore } from '../../../stores/notificationStore';

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
    <div className="min-h-full flex flex-col">
      <GuidedActivationWizard
        wizardId={WIZARD_ID}
        title="Prepaid to Postpaid Conversion"
        steps={attachSummaries([
          idLookupStep({ key: 'contact', field: 'qid' }),
          planSelectionStep({ kind: 'catalogue', planType: 'Postpaid Plan' }),
          cafSignatureStep({ customerName: (values) => (values.qid as IdLookupValue | undefined)?.moiResult?.name }),
          activityStep({ required: false }),
        ], {
          contact: sums.identitySummary('qid'),
          plan: sums.planSummary(),
          caf: sums.cafSummary,
          activity: sums.commentsSummary,
        })}
        onSubmit={async (values) => {
          const qid = values.qid as IdLookupValue;
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
