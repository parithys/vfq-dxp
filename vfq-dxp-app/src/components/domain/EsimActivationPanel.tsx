import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '../primitives/Button';
import { Input } from '../primitives/Input';
import { useNotificationStore } from '../../stores/notificationStore';

interface EsimActivationPanelProps {
  activationCode: string;
  /**
   * The account's own contact email - the address captured on the Contact
   * step, i.e. an "existing account contact email," not something typed
   * here. Read-only (2026-09-28 request): this panel no longer lets the
   * agent retype or substitute an address at send time - the whole point of
   * gating Send on `verified` below is that ONLY the address already on the
   * account, checked against the ID registry, is ever sent to.
   */
  customerEmail: string | undefined;
  /**
   * Same definition GuidedContactStep's own tick and the order-confirmation
   * email use (emailVerification: does `customerEmail` match the MOI
   * registry's email for this customer). Send to email is blocked whenever
   * this is false - an unverified address is shown, so the agent can see
   * why it's blocked, but never something eSIM details are sent to.
   */
  verified: boolean;
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
// `sentTo` is local and intentionally not lifted: "did the agent send it" is
// a UI affordance for this screen, not part of the order record, and nothing
// downstream reads it.
export function EsimActivationPanel({ activationCode, customerEmail, verified }: EsimActivationPanelProps) {
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const pushToast = useNotificationStore((s) => s.pushToast);
  const email = customerEmail ?? '';
  const canSend = Boolean(email) && verified;

  const sendEmail = async () => {
    if (!canSend) return;
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
        {/* Read-only (2026-09-28): this is the account's own contact email,
            not a field the agent fills in here - see the prop's own note. */}
        <Input
          label="Send eSIM details to email"
          type="email"
          value={email}
          readOnly
          placeholder="No contact email on file"
        />
        {/* Shown, not hidden - the agent should see WHY sending is blocked
            rather than find a dead button with no explanation. Only appears
            when there's actually an address to explain; no email at all
            already reads as nothing-to-send from the placeholder above. */}
        {email && !verified && (
          <p className="text-[var(--warn-text)] text-[length:var(--fs-caption)]">
            This email could not be verified against the customer's ID record, so eSIM details cannot be sent to it.
          </p>
        )}
        {sentTo && <p className="text-success text-[length:var(--fs-caption)]">eSIM details sent successfully to {sentTo}.</p>}
        {/* secondary-rect (2026-09-28): a real action, not a cancel/dismiss -
            see OrderConfirmationScreen's own note on the same distinction. */}
        <Button variant="secondary-rect" onClick={sendEmail} disabled={sending || !canSend}>
          {sending ? 'Sending…' : 'Send to email'}
        </Button>
      </div>
    </div>
  );
}
