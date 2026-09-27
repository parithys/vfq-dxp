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
  esimActivationCode?: string;
}

interface SimTypeStepProps {
  value: SimTypeValue;
  customerEmail: string | undefined;
  onChange: (value: SimTypeValue) => void;
}

// Mock GSMA SGP.22-style activation string (LPA:1$smdp-address$matching-id) -
// not a real SM-DP+ call, see the note below on not fabricating an eSIM
// provisioning API. Random per issuance so the QR code is distinct each time.
function generateActivationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let matchingId = '';
  for (let i = 0; i < 16; i++) {
    matchingId += chars[Math.floor(Math.random() * chars.length)];
  }
  return `LPA:1$smdp.vodafone.qa$${matchingId}`;
}

// "SIM Type" (reference flow step 8) - Physical issuance keeps the existing,
// evidenced real-time-inventory serial scan (Pattern 11). eSIM has no
// evidenced inventory/serial check in this corpus - generating a QR/activation
// code and optionally emailing it is the standard telco pattern, kept
// deliberately lightweight (no fabricated eSIM provisioning API).
export function SimTypeStep({ value, customerEmail, onChange }: SimTypeStepProps) {
  const [issuing, setIssuing] = useState(false);

  const generateEsim = async () => {
    setIssuing(true);
    await new Promise((r) => setTimeout(r, 500));
    setIssuing(false);
    onChange({ ...value, esimIssued: true, esimActivationCode: generateActivationCode() });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-border-soft">
        {(['Physical', 'eSIM'] as const).map((t) => (
          <button
            key={t}
            onClick={() => onChange({ simType: t })}
            className={`px-3 py-1.5 text-[length:var(--fs-body)] border-b-2 -mb-px ${
              value.simType === t ? 'border-[var(--field-card-selected)] text-[var(--field-card-selected)] font-medium' : 'border-transparent text-fg-2'
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
          {/* The QR code and send-to-email controls have moved to the
              activation-complete screen (EsimActivationPanel). This step only
              issues the code; showing a scannable QR here meant the customer
              could install an eSIM for an order still four steps from being
              submitted. What stays is the confirmation that it was issued. */}
          {value.esimIssued && value.esimActivationCode ? (
            <>
              {/* "eSIM selected", not "eSIM issued" (2026-09-27). Nothing has
                  been handed over at this point and the profile is not live -
                  the walkthrough is explicit that an eSIM must not reach the
                  customer before payment. Calling it "issued" four steps early
                  described a handover that has not happened. */}
              <Badge variant="success">eSIM selected</Badge>
              <p className="text-fg-2 text-[length:var(--fs-body)]">
                An eSIM activation QR code will be generated and sent to {customerEmail ?? 'the customer'}.
              </p>
              <p className="text-muted text-[length:var(--fs-caption)]">
                The eSIM QR code will be available after successful payment and order submission.
              </p>
            </>
          ) : (
            <Button variant="primary-rect" onClick={generateEsim} disabled={issuing}>
              {issuing ? 'Selecting eSIM…' : 'Select eSIM'}
            </Button>
          )}
        </div>
      )}

      {!value.simType && <p className="text-muted text-[length:var(--fs-body)]">Choose Physical or eSIM to continue.</p>}
    </div>
  );
}
