import { QRCodeSVG } from 'qrcode.react';

interface EsimActivationPanelProps {
  activationCode: string;
  /**
   * Whether the order details and eSIM details were sent to the customer's email. They are sent
   * automatically when the order is submitted (see ActivationCompleteScreen): to the Billing
   * Profile address for an existing customer, the NAS address for a new one. There is no manual
   * send here, and the address itself is not shown.
   */
  emailSent: boolean;
}

// The scannable half of eSIM issuance: QR, the LPA string to key in by hand, and the notice that
// the details were emailed. Rendered on the activation-complete screen rather than the SIM Type
// step, because by then the provisioning has happened, so the code shown is one that will work.
export function EsimActivationPanel({ activationCode, emailSent }: EsimActivationPanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col items-start gap-4 rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-surface p-4 sm:flex-row sm:items-center">
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

      {emailSent ? (
        <p className="text-success text-[length:var(--fs-body)]">Your order details and eSIM details have been sent to your email.</p>
      ) : (
        <p className="text-[var(--warn-text)] text-[length:var(--fs-caption)]">
          The order details and eSIM details could not be sent: there is no verified email address for this customer.
        </p>
      )}
    </div>
  );
}
