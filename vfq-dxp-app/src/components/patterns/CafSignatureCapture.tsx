import { useState } from 'react';
import { Icon } from '../primitives/Icon';
import { Button } from '../primitives/Button';
import { Drawer } from '../primitives/Drawer';
import { SignaturePad } from '../primitives/SignaturePad';
import { Badge } from '../primitives/Badge';

export type CafType = 'Digital' | 'Manual' | 'Touch Screen';

const CHECK_ICON = 'M20 6L9 17l-5-5';
const MONITOR_ICON = 'M3 4h18v12H3z M9 20h6 M12 16v4';
const PEN_ICON = 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z';
const TOUCH_ICON = 'M17 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z M12 18h.01';

const CAF_TYPES: { type: CafType; label: string; icon: string }[] = [
  { type: 'Digital', label: 'CAF-Digital', icon: MONITOR_ICON },
  { type: 'Manual', label: 'CAF-Manual', icon: PEN_ICON },
  { type: 'Touch Screen', label: 'CAF-Touch Screen', icon: TOUCH_ICON },
];

interface CafSignatureCaptureProps {
  value: { cafType?: CafType; signatureDataUrl?: string };
  onChange: (value: { cafType?: CafType; signatureDataUrl?: string }) => void;
  customerName?: string;
  /** Binds an ID Number line onto the CAF preview - module-hierarchy.json's
   * "CAF form dynamically binds Qatari ID/Passport number field for prepaid
   * subscribers." Omit for flows where this binding isn't evidenced. */
  idLabel?: string;
  idValue?: string;
  /**
   * Customer-facing order summary, rendered under the signature block
   * (2026-09-27 walkthrough). The agent reads this to the customer BEFORE
   * they sign, so it is the same set of facts Checkout showed - passed in
   * already derived, so the two surfaces cannot disagree about what was sold.
   * Omitted by the other five journeys that share this component, which
   * render the CAF without a commercial summary exactly as before.
   */
  orderSummary?: { label: string; value: string }[];
  /** Link target for "the complete terms", shown beneath the summary. */
  termsUrl?: string;
}

// Pattern 6: CAF/Contract Signature Capture - CAF Type card selector (Digital/
// Manual/Touch Screen, styled like the ID Type picker), bilingual (AR/EN)
// document preview pre-populated from
// applicant/billing/plan data, then a "Please Sign" pad modal (drawn signature,
// Clear/Done) - reused identically for CAF, MNP application, Passport-to-QID
// forms (SCR-058, SCR-069/070, SCR-084, SCR-127/129, etc.).
export function CafSignatureCapture({ value, onChange, customerName, idLabel, idValue, orderSummary, termsUrl }: CafSignatureCaptureProps) {
  const [padOpen, setPadOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[length:var(--fs-label)] text-fg-2 mb-2">CAF Type</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {CAF_TYPES.map((t) => {
            const selected = t.type === value.cafType;
            return (
              <button
                key={t.type}
                type="button"
                onClick={() => onChange({ ...value, cafType: t.type })}
                className={`relative flex flex-col items-center gap-2 rounded-[var(--radius-card)] border p-4 ${
                  selected ? 'border-[var(--field-card-selected)] bg-[var(--field-card-selected-bg)] text-[var(--field-card-selected)]' : 'border-border-soft text-fg-2 enabled:hover:border-[var(--field-card-selected)]/50'
                }`}
              >
                {selected && (
                  <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[var(--field-card-selected)] text-white flex items-center justify-center">
                    <Icon path={CHECK_ICON} className="w-2.5 h-2.5" />
                  </span>
                )}
                <Icon path={t.icon} className="w-6 h-6" />
                <span className="text-[length:var(--fs-caption)] font-medium">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {value.cafType === 'Digital' && (
        <div className="rounded-[var(--radius-card)] border border-border-soft p-4 bg-surface">
          <div className="flex justify-between text-[length:var(--fs-caption)] text-muted mb-2">
            <span>Vodafone Customer Application Form</span>
            <span dir="rtl">نموذج طلب عميل فودافون</span>
          </div>
          <p className="text-fg text-[length:var(--fs-body)]">
            Applicant: <span className="font-medium">{customerName ?? '-'}</span>
          </p>
          {idLabel && (
            <p className="text-fg text-[length:var(--fs-body)]">
              {idLabel}: <span className="font-medium">{idValue ?? '-'}</span>
            </p>
          )}
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

      {/* Read to the customer before signature. Deliberately BELOW the CAF
          preview and above the pad: it is the plain-language version of what
          the form commits them to, and it is the last thing on screen before
          they sign. */}
      {orderSummary && orderSummary.length > 0 && (
        <div className="rounded-[var(--radius-card)] border border-border-soft bg-surface p-4 space-y-2">
          <h4 className="text-fg font-medium text-[length:var(--fs-body)]">What the customer is agreeing to</h4>
          <dl className="text-[length:var(--fs-caption)]">
            {orderSummary.map((row) => (
              <div key={row.label} className="flex justify-between gap-4 py-1.5 border-b border-border-soft last:border-0">
                <dt className="text-fg-2">{row.label}</dt>
                <dd className="text-fg text-right">{row.value}</dd>
              </div>
            ))}
          </dl>
          {termsUrl && (
            <a
              href={termsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-[length:var(--fs-caption)] text-accent underline"
            >
              Read the full terms and conditions
            </a>
          )}
        </div>
      )}

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
