import { useState } from 'react';
import { Select } from '../primitives/Select';
import { Button } from '../primitives/Button';
import { Modal } from '../primitives/Modal';
import { SignaturePad } from '../primitives/SignaturePad';
import { Badge } from '../primitives/Badge';

export type CafType = 'Digital' | 'Manual' | 'Touch Screen';

interface CafSignatureCaptureProps {
  value: { cafType?: CafType; signatureDataUrl?: string };
  onChange: (value: { cafType?: CafType; signatureDataUrl?: string }) => void;
  customerName?: string;
}

// Pattern 6: CAF/Contract Signature Capture — CAF-type dropdown (Digital/Manual/
// Touch Screen), bilingual (AR/EN) document preview pre-populated from
// applicant/billing/plan data, then a "Please Sign" pad modal (drawn signature,
// Clear/Done) — reused identically for CAF, MNP application, Passport-to-QID
// forms (SCR-058, SCR-069/070, SCR-084, SCR-127/129, etc.).
export function CafSignatureCapture({ value, onChange, customerName }: CafSignatureCaptureProps) {
  const [padOpen, setPadOpen] = useState(false);

  return (
    <div className="space-y-4">
      <Select
        label="CAF Type"
        value={value.cafType ?? ''}
        onChange={(e) => onChange({ ...value, cafType: e.target.value as CafType })}
        placeholder="Select CAF type"
        options={[
          { value: 'Digital', label: 'CAF-Digital' },
          { value: 'Manual', label: 'CAF-Manual' },
          { value: 'Touch Screen', label: 'CAF-Touch Screen' },
        ]}
      />

      {value.cafType === 'Digital' && (
        <div className="rounded-[var(--radius-card)] border border-border-soft p-4 bg-surface">
          <div className="flex justify-between text-[length:var(--fs-caption)] text-muted mb-2">
            <span>Vodafone Customer Application Form</span>
            <span dir="rtl">نموذج طلب عميل فودافون</span>
          </div>
          <p className="text-fg text-[length:var(--fs-body)]">
            Applicant: <span className="font-medium">{customerName ?? '—'}</span>
          </p>
          <p className="text-fg-2 text-[length:var(--fs-caption)] mt-1">
            By signing below, the applicant accepts the General Terms and Conditions of Vodafone Qatar.
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
