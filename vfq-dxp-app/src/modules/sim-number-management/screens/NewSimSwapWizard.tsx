import { useState } from 'react';
import { GuidedActivationWizard } from '../../../components/patterns/GuidedActivationWizard';
import { IdLookupStep } from '../../../components/patterns/IdLookupStep';
import { QidImageUpload } from '../../../components/domain/QidImageUpload';
import type { QidImageUploadValue } from '../../../components/domain/QidImageUpload';
import { SimSerialScanner } from '../../../components/domain/SimSerialScanner';
import { SimSwapFormStep } from '../../../components/patterns/SimSwapFormStep';
import type { SimSwapFormValue } from '../../../components/patterns/SimSwapFormStep';
import { ActivityCommentsStep } from '../../../components/patterns/ActivityCommentsStep';
import { Select } from '../../../components/primitives/Select';
import { Button } from '../../../components/primitives/Button';
import { Badge } from '../../../components/primitives/Badge';
import { useEntityStore } from '../../../stores/entityStore';
import { useNotificationStore } from '../../../stores/notificationStore';
import { evaluateRule } from '../../../engines/ruleEngine';

interface MoiResult {
  name: string;
  dob: string;
  nationality: string;
}
interface QidValue {
  idNumber?: string;
  moiResult?: MoiResult;
}

const SWAP_REASONS = ['Lost SIM', 'Damaged SIM', 'eSIM to eSIM', 'eSIM to Physical'];

interface NewSimSwapWizardProps {
  msisdn: string;
  onDone: () => void;
}

// UJ-090 (Global Search / Desktop variant): "Verify contact details, upload
// QID front & Bank statement -> Enter SIM Serial Number, select SIM Swap
// Reason -> Attach SIM Swap Form -> Order routed to Approval -> Add comments,
// Save and Finish." Reached from the Global Search screen (SCR-195) after
// entering an MSISDN and clicking "SIM Swap" - that screen doesn't have its
// own separate evidenced screenId, so it's rendered inline here rather than
// as a synthetic route.
export function NewSimSwapWizard({ msisdn, onDone }: NewSimSwapWizardProps) {
  const createRecord = useEntityStore((s) => s.createRecord);
  const pushToast = useNotificationStore((s) => s.pushToast);
  const [bankStatementAttached, setBankStatementAttached] = useState(false);

  return (
    <div>
      <p className="text-fg-2 mb-4">
        MSISDN: <span className="text-fg font-medium">{msisdn}</span>
      </p>
      <GuidedActivationWizard
        wizardId={`sim-swap-${msisdn}`}
        title="SIM Swap Request"
        steps={[
          {
            key: 'contact-verification',
            label: 'Verify Contact',
            render: ({ values, setValue }) => (
              <IdLookupStep value={(values.qid as QidValue) ?? {}} onChange={(v) => setValue('qid', v)} />
            ),
            isValid: (values) => Boolean((values.qid as QidValue | undefined)?.moiResult),
          },
          {
            key: 'documents',
            label: 'QID & Bank Statement',
            render: ({ values, setValue }) => (
              <div className="space-y-4">
                <QidImageUpload
                  value={(values.qidImages as QidImageUploadValue) ?? {}}
                  onChange={(v) => setValue('qidImages', v)}
                />
                <div className="rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg p-4 flex items-center justify-between">
                  <span className="text-fg-2 text-[length:var(--fs-body)]">Bank Statement</span>
                  {bankStatementAttached ? (
                    <Badge variant="success">Attached</Badge>
                  ) : (
                    <Button variant="ghost-rect" compact onClick={() => setBankStatementAttached(true)}>
                      Attach
                    </Button>
                  )}
                </div>
              </div>
            ),
            isValid: (values) => {
              const v = values.qidImages as QidImageUploadValue | undefined;
              return Boolean(v?.frontScanned && v?.backScanned) && bankStatementAttached;
            },
          },
          {
            key: 'sim-serial-reason',
            label: 'SIM Serial & Reason',
            render: ({ values, setValue }) => {
              const reason = (values.simSwapReason as string) ?? '';
              const charge = reason ? evaluateRule('BR-056', { reason }) : null;
              return (
                <div className="space-y-4">
                  <SimSerialScanner
                    value={(values.newSimSerial as string) ?? ''}
                    onChange={(v, valid) => {
                      setValue('newSimSerial', v);
                      setValue('newSimSerialValid', valid);
                    }}
                  />
                  <Select
                    label="SIM Swap Reason"
                    value={reason}
                    onChange={(e) => setValue('simSwapReason', e.target.value)}
                    placeholder="Select a reason"
                    options={SWAP_REASONS.map((r) => ({ value: r, label: r }))}
                  />
                  {charge && <p className="text-[length:var(--fs-caption)] text-fg-2">{charge.message}</p>}
                </div>
              );
            },
            isValid: (values) => Boolean(values.newSimSerialValid && values.simSwapReason),
          },
          {
            key: 'sim-swap-form',
            label: 'SIM Swap Form',
            render: ({ values, setValue }) => (
              <SimSwapFormStep value={(values.simSwapForm as SimSwapFormValue) ?? {}} onChange={(v) => setValue('simSwapForm', v)} />
            ),
            isValid: (values) => Boolean((values.simSwapForm as SimSwapFormValue | undefined)?.signatureDataUrl),
          },
          {
            key: 'comments',
            label: 'Comments',
            render: ({ values, setValue }) => (
              <ActivityCommentsStep value={(values.comments as string) ?? ''} onChange={(v) => setValue('comments', v)} />
            ),
          },
        ]}
        onSubmit={async (values) => {
          const simSwapOrderId = `SSW-${Date.now().toString().slice(-6)}`;
          const reason = values.simSwapReason as string;
          const charge = evaluateRule('BR-056', { reason });
          await createRecord('sim-swap-orders', {
            simSwapOrderId,
            msisdn,
            newSimSerialNumber: values.newSimSerial,
            simSwapReason: reason,
            chargeStatus: charge.message,
            comments: values.comments,
            status: 'Submitted for Approval',
          });
          pushToast('success', `SIM Swap request ${simSwapOrderId} submitted for approval.`);
          onDone();
        }}
      />
    </div>
  );
}
