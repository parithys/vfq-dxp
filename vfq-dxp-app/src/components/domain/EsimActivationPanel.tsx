import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '../primitives/Button';
import { Input } from '../primitives/Input';
import { useNotificationStore } from '../../stores/notificationStore';

interface EsimActivationPanelProps {
  activationCode: string;
  /** Prefills the send-to field - the address captured on the Contact step. */
  customerEmail: string | undefined;
}

// The scannable half of eSIM issuance: QR, the LPA string to key in by hand,
// and a send-to-email fallback.
//
// Extracted from SimTypeStep so it can render on the activation-complete
// screen instead. It sat on the SIM Type step, which is four steps before the
// order is actually submitted - the customer could have scanned a code for an
// order that was then abandoned at Payment. On the confirmation screen the
// provisioning has happened, so the code it shows is one that will work.
//
// The email state is local and intentionally not lifted: "did the agent send
// it" is a UI affordance for this screen, not part of the order record, and
// nothing downstream reads it.
export function EsimActivationPanel({ activationCode, customerEmail }: EsimActivationPanelProps) {
  const [sending, setSending] = useState(false);
  const [email, setEmail] = useState(customerEmail ?? '');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const pushToast = useNotificationStore((s) => s.pushToast);

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
      <div className="flex flex-col items-start gap-4 rounded-[var(--radius-card)] border border-border-soft bg-surface p-4 sm:flex-row sm:items-center">
        {/* bg-white, not --bg: a QR has to stay dark-on-light to scan, so this
            one surface does not follow the theme. */}
        <div className="rounded-[var(--radius-card)] bg-white p-2 shrink-0">
          <QRCodeSVG value={activationCode} size={160} />
        </div>
        <div className="space-y-1.5 min-w-0">
          <p className="text-fg-2 text-[length:var(--fs-body)]">
            Scan this QR code on the customer's device to install the eSIM, or enter the activation code manually.
          </p>
          <code className="block break-all rounded-[var(--radius-button)] bg-surface-warm px-2 py-1 text-[length:var(--fs-caption)] text-fg">
            {activationCode}
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
        {sentTo && <p className="text-success text-[length:var(--fs-caption)]">eSIM details sent successfully to {sentTo}.</p>}
        <Button variant="ghost-rect" onClick={sendEmail} disabled={sending || !email}>
          {sending ? 'Sending…' : 'Send to email'}
        </Button>
      </div>
    </div>
  );
}
