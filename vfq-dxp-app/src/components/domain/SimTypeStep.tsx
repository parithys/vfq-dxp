import { useState } from 'react';
import { Button } from '../primitives/Button';
import { Badge } from '../primitives/Badge';
import { SimSerialScanner } from './SimSerialScanner';

export type SimType = 'Physical' | 'eSIM';

export interface SimTypeValue {
  simType?: SimType;
  simSerial?: string;
  simValid?: boolean;
  esimIssued?: boolean;
}

interface SimTypeStepProps {
  value: SimTypeValue;
  customerEmail: string | undefined;
  onChange: (value: SimTypeValue) => void;
}

// "SIM Type" (reference flow step 8) — Physical issuance keeps the existing,
// evidenced real-time-inventory serial scan (Pattern 11). eSIM has no
// evidenced inventory/serial check in this corpus — a QR/activation-code
// issuance step to the customer's email is the standard telco pattern, kept
// deliberately lightweight (no fabricated eSIM provisioning API).
export function SimTypeStep({ value, customerEmail, onChange }: SimTypeStepProps) {
  const [issuing, setIssuing] = useState(false);

  const issueEsim = async () => {
    setIssuing(true);
    await new Promise((r) => setTimeout(r, 500));
    setIssuing(false);
    onChange({ ...value, esimIssued: true });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-border-soft">
        {(['Physical', 'eSIM'] as const).map((t) => (
          <button
            key={t}
            onClick={() => onChange({ simType: t })}
            className={`px-3 py-1.5 text-[length:var(--fs-body)] border-b-2 -mb-px ${
              value.simType === t ? 'border-[var(--field-selected)] text-[var(--field-selected)] font-medium' : 'border-transparent text-fg-2'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {value.simType === 'Physical' && (
        <SimSerialScanner
          value={value.simSerial ?? ''}
          onChange={(serial, valid) => onChange({ ...value, simSerial: serial, simValid: valid })}
        />
      )}

      {value.simType === 'eSIM' && (
        <div className="space-y-3">
          {value.esimIssued ? (
            <div className="flex items-center gap-2">
              <Badge variant="success">eSIM issued</Badge>
              <span className="text-[length:var(--fs-caption)] text-fg-2">
                Activation QR code and setup instructions sent to {customerEmail ?? 'the customer\'s email on file'}.
              </span>
            </div>
          ) : (
            <>
              <p className="text-fg-2 text-[length:var(--fs-body)]">
                Issue an eSIM activation QR code and setup instructions to {customerEmail ?? 'the customer\'s email on file'}.
              </p>
              <Button variant="primary-rect" onClick={issueEsim} disabled={issuing}>
                {issuing ? 'Issuing eSIM…' : 'Issue eSIM'}
              </Button>
            </>
          )}
        </div>
      )}

      {!value.simType && <p className="text-muted text-[length:var(--fs-body)]">Choose Physical or eSIM to continue.</p>}
    </div>
  );
}
