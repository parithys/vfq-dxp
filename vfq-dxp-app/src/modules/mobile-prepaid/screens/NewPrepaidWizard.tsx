import { useNavigate } from 'react-router-dom';
import { GuidedActivationWizard } from '../../../components/patterns/GuidedActivationWizard';
import { IdLookupStep } from '../../../components/patterns/IdLookupStep';
import { MsisdnPicker } from '../../../components/domain/MsisdnPicker';
import { SimSerialScanner } from '../../../components/domain/SimSerialScanner';
import { useEntityStore } from '../../../stores/entityStore';
import { useNotificationStore } from '../../../stores/notificationStore';

const WIZARD_ID = 'new-prepaid-tablet';

// SCR-190/191/192: New Prepaid Tablet — Step 1 Contact (ID capture), Step 3
// Number Selection, Step 4 SIM Serial (guided-journeys-prepaid-open-ui-tablet-new-prepaid-0202dd13,
// confidence: medium). Correctly re-bucketed here under Mobile Prepaid — routes.json's
// keyword matcher mis-scattered these three across Fixed Line/Fibre and
// Pre-to-Post Migration (see ai-coding-agent-implementation-guide.md §8's
// documented route-to-module coarseness caveat).
export function NewPrepaidWizard() {
  const navigate = useNavigate();
  const createRecord = useEntityStore((s) => s.createRecord);
  const pushToast = useNotificationStore((s) => s.pushToast);

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
              <IdLookupStep
                value={(values.contact as { idNumber?: string; moiResult?: { name: string; dob: string; nationality: string } }) ?? {}}
                onChange={(v) => setValue('contact', v)}
              />
            ),
            isValid: (values) => Boolean((values.contact as { moiResult?: unknown } | undefined)?.moiResult),
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
            key: 'sim',
            label: 'SIM Serial',
            render: ({ values, setValue }) => (
              <SimSerialScanner
                value={(values.simSerial as string) ?? ''}
                onChange={(simSerial, valid) => {
                  setValue('simSerial', simSerial);
                  setValue('simValid', valid);
                }}
              />
            ),
            isValid: (values) => values.simValid === true,
          },
        ]}
        onSubmit={async (values) => {
          const contact = values.contact as { moiResult?: { name: string } } | undefined;
          await createRecord('orders', {
            orderId: `ORD-${Date.now().toString().slice(-6)}`,
            orderType: 'New Prepaid Activation',
            orderSubType: 'Consumer',
            status: 'Complete',
            customerName: contact?.moiResult?.name,
            msisdn: values.msisdn,
            simSerial: values.simSerial,
            totalQAR: values.priceQAR ?? 0,
            createdBy: 'AGENT-VINODHINIR',
            sourceChannel: 'Tablet',
          });
          pushToast('success', `Prepaid activation complete — MSISDN ${values.msisdn}`);
          navigate('/mobile-prepaid');
        }}
        onAbandon={() => navigate('/mobile-prepaid')}
      />
    </div>
  );
}
