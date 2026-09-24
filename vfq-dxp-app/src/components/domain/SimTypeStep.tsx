import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '../primitives/Button';
import { Badge } from '../primitives/Badge';
import { Input } from '../primitives/Input';
import { SimSerialScanner } from './SimSerialScanner';
import { useNotificationStore } from '../../stores/notificationStore';

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

// Mock GSMA SGP.22-style activation string (LPA:1$smdp-address$matching-id) —
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

// "SIM Type" (reference flow step 8) — Physical issuance keeps the existing,
// evidenced real-time-inventory serial scan (Pattern 11). eSIM has no
// evidenced inventory/serial check in this corpus — generating a QR/activation
// code and optionally emailing it is the standard telco pattern, kept
// deliberately lightweight (no fabricated eSIM provisioning API).
export function SimTypeStep({ value, customerEmail, onChange }: SimTypeStepProps) {
  const [issuing, setIssuing] = useState(false);
  const [sending, setSending] = useState(false);
  const [email, setEmail] = useState(customerEmail ?? '');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const pushToast = useNotificationStore((s) => s.pushToast);

  const generateEsim = async () => {
    setIssuing(true);
    await new Promise((r) => setTimeout(r, 500));
    setIssuing(false);
    onChange({ ...value, esimIssued: true, esimActivationCode: generateActivationCode() });
  };

  const sendEmail = async () => {
    if (!email) return;
    setSending(true);
    await new Promise((r) => setTimeout(r, 500));
    setSending(false);
    setSentTo(email);
    pushToast('success', `eSIM activation details sent to ${email}.`);
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
          {value.esimIssued && value.esimActivationCode ? (
            <div className="space-y-4">
              <Badge variant="success">eSIM issued</Badge>

              <div className="flex flex-col items-start gap-4 rounded-[var(--radius-card)] border border-border-soft bg-surface p-4 sm:flex-row sm:items-center">
                <div className="rounded-[var(--radius-card)] bg-white p-2 shrink-0">
                  <QRCodeSVG value={value.esimActivationCode} size={160} />
                </div>
                <div className="space-y-1.5 min-w-0">
                  <p className="text-fg-2 text-[length:var(--fs-body)]">
                    Scan this QR code on the customer's device to install the eSIM, or enter the activation code manually.
                  </p>
                  <code className="block break-all rounded-[var(--radius-button)] bg-surface-warm px-2 py-1 text-[length:var(--fs-caption)] text-fg">
                    {value.esimActivationCode}
                  </code>
                </div>
              </div>

              <div className="space-y-2">
                <Input
                  label="Send eSIM details to email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setSentTo(null);
                  }}
                  placeholder="customer@example.com"
                />
                {sentTo && (
                  <p className="text-success text-[length:var(--fs-caption)]">eSIM details sent successfully to {sentTo}.</p>
                )}
                <Button variant="ghost-rect" onClick={sendEmail} disabled={sending || !email}>
                  {sending ? 'Sending…' : 'Send to email'}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-fg-2 text-[length:var(--fs-body)]">
                Generate an eSIM activation QR code for {customerEmail ?? 'the customer'}.
              </p>
              <Button variant="primary-rect" onClick={generateEsim} disabled={issuing}>
                {issuing ? 'Generating eSIM…' : 'Generate eSIM'}
              </Button>
            </>
          )}
        </div>
      )}

      {!value.simType && <p className="text-muted text-[length:var(--fs-body)]">Choose Physical or eSIM to continue.</p>}
    </div>
  );
}
