import { useState } from 'react';
import { Select } from '../primitives/Select';
import { Button } from '../primitives/Button';
import { Modal } from '../primitives/Modal';
import { SignaturePad } from '../primitives/SignaturePad';
import { Badge } from '../primitives/Badge';

export type MnpFormType = 'MNP-Digital' | 'MNP-Touch Screen';

export interface DonorAttachmentValue {
  mnpFormType?: MnpFormType;
  signatureDataUrl?: string;
}

interface DonorAttachmentStepProps {
  value: DonorAttachmentValue;
  onChange: (value: DonorAttachmentValue) => void;
}

// SCR-127: MNP wizard step: Donor Attachment (FLD-986, Stage K recovered,
// medium confidence) — empty Attachments grid ("No Records"), New File/
// Continue/MNP Form/Abandon Order/Go Back buttons; clicking "MNP Form" opens a
// dropdown with two options (MNP-Digital / MNP-Touch Screen) that, once
// completed, populates the attachments grid with the signed Mobile Number
// Portability Application Form. Same signature-capture shape as
// CafSignatureCapture (Pattern 6) but for the MNP contract document
// specifically, not the CAF — kept separate since the evidenced dropdown
// options and document differ (2 options here vs. CAF's 3).
export function DonorAttachmentStep({ value, onChange }: DonorAttachmentStepProps) {
  const [padOpen, setPadOpen] = useState(false);

  return (
    <div className="space-y-4">
      <Select
        label="MNP Form"
        value={value.mnpFormType ?? ''}
        onChange={(e) => onChange({ ...value, mnpFormType: e.target.value as MnpFormType })}
        placeholder="Select MNP form type"
        options={[
          { value: 'MNP-Digital', label: 'MNP-Digital' },
          { value: 'MNP-Touch Screen', label: 'MNP-Touch Screen' },
        ]}
      />

      {value.mnpFormType && (
        <div className="rounded-[var(--radius-card)] border border-border-soft p-4 bg-surface">
          <p className="text-fg text-[length:var(--fs-body)] font-medium">Mobile Number Portability Application Form</p>
          <p className="text-fg-2 text-[length:var(--fs-caption)] mt-1">
            By signing below, the subscriber authorizes the port-in request to Vodafone Qatar.
          </p>
          {value.signatureDataUrl ? (
            <div className="mt-3 flex items-center gap-3">
              <Badge variant="success">Signed</Badge>
              <img src={value.signatureDataUrl} alt="Signature" className="h-10 border border-border-soft rounded" />
            </div>
          ) : (
            <Button variant="primary-rect" className="mt-3" onClick={() => setPadOpen(true)}>
              Please Sign
            </Button>
          )}
        </div>
      )}

      <Modal open={padOpen} onClose={() => setPadOpen(false)} title="Please Sign">
        <SignaturePad
          onDone={(dataUrl) => {
            onChange({ ...value, signatureDataUrl: dataUrl });
            setPadOpen(false);
          }}
        />
      </Modal>
    </div>
  );
}
