import { useNavigate } from 'react-router-dom';
import { GuidedActivationWizard } from '../../../components/patterns/GuidedActivationWizard';
import { Input } from '../../../components/primitives/Input';
import { PhoneNumberInput } from '../../../components/primitives/PhoneNumberInput';
import { IdLookupStep } from '../../../components/patterns/IdLookupStep';
import { QidImageUpload } from '../../../components/domain/QidImageUpload';
import type { QidImageUploadValue } from '../../../components/domain/QidImageUpload';
import { SignaturePad } from '../../../components/primitives/SignaturePad';
import { Drawer } from '../../../components/primitives/Drawer';
import { Button } from '../../../components/primitives/Button';
import { Badge } from '../../../components/primitives/Badge';
import { useState } from 'react';
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

const WIZARD_ID = 'passport-to-qid';

// SCR-151: Passport to QID Update wizard (UJ-076, high confidence): enter
// MSISDN & Passport Number -> enter QID Number, Update ID (MOI validation
// fetches customer details) -> scan/upload QID Front & Back -> Identification
// number change form generated, customer signs -> Finish (form attached).
export function PassportToQidWizard() {
  const navigate = useNavigate();
  const createRecord = useEntityStore((s) => s.createRecord);
  const pushToast = useNotificationStore((s) => s.pushToast);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | undefined>();
  const [padOpen, setPadOpen] = useState(false);

  return (
    <div className="p-8">
      <GuidedActivationWizard
        wizardId={WIZARD_ID}
        title="Passport to QID Update"
        steps={[
          {
            key: 'msisdn-passport',
            label: 'MSISDN & Passport',
            render: ({ values, setValue }) => (
              <div className="grid grid-cols-2 gap-4">
                <PhoneNumberInput
                  label="MSISDN"
                  value={(values.msisdn as string) ?? ''}
                  placeholder="+974 3300 1001"
                  onChange={(e) => setValue('msisdn', e.target.value)}
                />
                <Input
                  label="Passport Number"
                  value={(values.passportNumber as string) ?? ''}
                  placeholder="P1234567"
                  onChange={(e) => setValue('passportNumber', e.target.value)}
                />
              </div>
            ),
            isValid: (values) => Boolean(values.msisdn && values.passportNumber),
          },
          {
            key: 'qid-entry',
            label: 'QID Number',
            render: ({ values, setValue }) => (
              <IdLookupStep value={(values.qid as QidValue) ?? {}} onChange={(v) => setValue('qid', v)} />
            ),
            isValid: (values) => Boolean((values.qid as QidValue | undefined)?.moiResult),
          },
          {
            key: 'qid-images',
            label: 'QID Front & Back',
            render: ({ values, setValue }) => (
              <QidImageUpload
                value={(values.qidImages as QidImageUploadValue) ?? {}}
                onChange={(v) => setValue('qidImages', v)}
              />
            ),
            isValid: (values) => {
              const v = values.qidImages as QidImageUploadValue | undefined;
              return Boolean(v?.frontScanned && v?.backScanned);
            },
          },
          {
            key: 'change-form',
            label: 'Identification Number Change Form',
            render: ({ values }) => (
              <div className="space-y-4">
                <div className="rounded-[var(--radius-card)] border border-border-soft p-4 bg-surface">
                  <p className="text-fg font-medium">Identification Number Change Form</p>
                  <p className="text-fg-2 text-[length:var(--fs-caption)] mt-1">
                    Customer: {(values.qid as QidValue | undefined)?.moiResult?.name ?? '-'} - updating identification
                    from Passport {(values.passportNumber as string) ?? '-'} to QID{' '}
                    {(values.qid as QidValue | undefined)?.idNumber ?? '-'}.
                  </p>
                  {signatureDataUrl ? (
                    <div className="mt-3 flex items-center gap-3">
                      <Badge variant="success">Signed</Badge>
                      <img src={signatureDataUrl} alt="Signature" className="h-10 border border-border-soft rounded" />
                    </div>
                  ) : (
                    <Button variant="primary-rect" className="mt-3" onClick={() => setPadOpen(true)}>
                      Please Sign
                    </Button>
                  )}
                </div>
              </div>
            ),
            isValid: () => Boolean(signatureDataUrl),
          },
        ]}
        onSubmit={async (values) => {
          const qid = values.qid as QidValue;
          const updateId = `PQU-${Date.now().toString().slice(-6)}`;
          await createRecord('passport-to-qid-updates', {
            updateId,
            msisdn: values.msisdn,
            passportNumber: values.passportNumber,
            qidNumber: qid.idNumber,
            eSignature: qid.moiResult?.name,
            status: 'Attached/Finished',
          });
          pushToast('success', `Passport to QID update ${updateId} finished - identification change form attached.`);
          navigate('/identity-customer-management');
        }}
        onAbandon={() => navigate('/identity-customer-management')}
      />
      <Drawer open={padOpen} onClose={() => setPadOpen(false)} title="Please Sign">
        <SignaturePad
          onDone={(dataUrl) => {
            setSignatureDataUrl(dataUrl);
            setPadOpen(false);
          }}
        />
      </Drawer>
    </div>
  );
}
