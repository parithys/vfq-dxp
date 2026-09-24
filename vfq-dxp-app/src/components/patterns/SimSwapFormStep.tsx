import { useState } from 'react';
import { Button } from '../primitives/Button';
import { Drawer } from '../primitives/Drawer';
import { SignaturePad } from '../primitives/SignaturePad';
import { Badge } from '../primitives/Badge';

export interface SimSwapFormValue {
  signatureDataUrl?: string;
}

interface SimSwapFormStepProps {
  value: SimSwapFormValue;
  onChange: (value: SimSwapFormValue) => void;
}

// UJ-090 (tablet variant): "Sign Contract -> capture signature -> Done ->
// SIM Swap Request Form attached." Only one document type is evidenced here
// (unlike CAF's 3 or MNP's 2 form-type options), so no Select dropdown -
// just the attach-and-sign shape shared with DonorAttachmentStep/CafSignatureCapture.
export function SimSwapFormStep({ value, onChange }: SimSwapFormStepProps) {
  const [padOpen, setPadOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="rounded-[var(--radius-card)] border border-border-soft p-4 bg-surface">
        <p className="text-fg text-[length:var(--fs-body)] font-medium">SIM Swap Request Form</p>
        <p className="text-fg-2 text-[length:var(--fs-caption)] mt-1">
          By signing below, the subscriber authorizes the SIM Swap request on this account.
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

      <Drawer open={padOpen} onClose={() => setPadOpen(false)} title="Please Sign">
        <SignaturePad
          onDone={(dataUrl) => {
            onChange({ ...value, signatureDataUrl: dataUrl });
            setPadOpen(false);
          }}
        />
      </Drawer>
    </div>
  );
}
