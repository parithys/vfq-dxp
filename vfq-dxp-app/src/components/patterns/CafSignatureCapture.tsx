import { useEffect, useState } from 'react';
import { Icon } from '../primitives/Icon';
import { Button } from '../primitives/Button';
import { Drawer } from '../primitives/Drawer';
import { SignaturePad } from '../primitives/SignaturePad';
import { Badge } from '../primitives/Badge';
import { CafDocumentUpload } from '../domain/CafDocumentUpload';
import type { CafDocument } from '../domain/CafDocumentUpload';
import { AdditionalDocumentsUpload } from '../domain/AdditionalDocumentsUpload';
import type { AdditionalDocument } from '../domain/AdditionalDocumentsUpload';
import * as mockDataEngine from '../../engines/mockDataEngine';
import type { TncLegalFacts } from './CheckoutSummaryStep';

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

/**
 * Runtime touch-capability check (2026-09-28), standing in for the manual
 * CAF-Type picker on a call site that opts into `autoDetectDeviceType`. Real
 * hardware capability, not a persona/channel guess - a touch-capable device
 * (tablet) resolves to CAF-Touch Screen, everything else to CAF-Digital.
 *
 * CAF-Manual (paper) drops out of the reachable set entirely under
 * auto-detection: it was always an agent override for an edge case (e.g. a
 * system outage), not a device type, so there is nothing for a device check
 * to detect it FROM - per the 2026-09-28 direction confirming this reading.
 */
function detectCafType(): CafType {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'Digital';
  const touchCapable = navigator.maxTouchPoints > 0 || (window.matchMedia?.('(pointer: coarse)').matches ?? false);
  return touchCapable ? 'Touch Screen' : 'Digital';
}

interface TncBulletTemplate {
  scenarioKey: string;
  template: string;
}

/**
 * Fills the applicable business-maintained templates (tnc-summary-
 * bullets.json) from THIS order's own figures. Only a scenario the order
 * actually carries produces a bullet - a plan with no commitment does not
 * get a "no lock-in" line invented for it alongside real ones; that filler
 * only appears when NOTHING else applies, so the customer is never shown a
 * blank summary.
 */
function buildTncBullets(facts: TncLegalFacts | undefined, templates: TncBulletTemplate[]): string[] {
  if (!facts || templates.length === 0) return [];
  const byKey = (key: string) => templates.find((t) => t.scenarioKey === key)?.template;
  const fill = (template: string | undefined, vars: Record<string, string | number>) =>
    template ? Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, String(v)), template) : undefined;

  const bullets: string[] = [];
  if (facts.planCommitmentMonths) {
    const b = fill(byKey('plan-lockin'), { months: facts.planCommitmentMonths });
    if (b) bullets.push(b);
  }
  if (facts.starLockInMonths) {
    const b = fill(byKey('star-lockin'), { months: facts.starLockInMonths });
    if (b) bullets.push(b);
  }
  if (facts.discountName) {
    const b = facts.discountDurationMonths
      ? fill(byKey('discount-expiry'), { name: facts.discountName, months: facts.discountDurationMonths })
      : fill(byKey('discount-no-expiry'), { name: facts.discountName });
    if (b) bullets.push(b);
  }
  if (facts.hrnAdvanceQar > 0) {
    const b = fill(byKey('hrn-advance'), { amount: facts.hrnAdvanceQar });
    if (b) bullets.push(b);
  }
  if (bullets.length === 0) {
    const b = byKey('no-lockin');
    if (b) bullets.push(b);
  }
  return bullets;
}

interface CafSignatureCaptureProps {
  value: {
    cafType?: CafType;
    signatureDataUrl?: string;
    documents?: CafDocument[];
    /** Post-signature supporting documents - see AdditionalDocumentsUpload. */
    additionalDocuments?: AdditionalDocument[];
  };
  onChange: (value: CafSignatureCaptureProps['value']) => void;
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
  /**
   * Opt-in (2026-09-28, Postpaid only). When true:
   *  - the manual CAF-Type picker is replaced by detectCafType()'s real
   *    device-capability check, set once and never re-offered to the agent;
   *  - CAF-Touch Screen requires the SAME in-app signature CAF-Digital does
   *    (under the original three-way design only Digital did - Touch Screen
   *    meant signing on a separate off-screen terminal - but that no longer
   *    fits once a device check, not an agent, is choosing between them: both
   *    detectable outcomes now mean "sign on THIS screen", just with a
   *    finger instead of a mouse);
   *  - the legacy "Signed documents" upload (CafDocumentUpload) is dropped,
   *    since there is no more off-screen-signed paper to scan back once
   *    signing always happens in-app;
   *  - a concise, dynamic T&C bullet summary (tnc-summary-bullets.json +
   *    legalFacts) renders ahead of the commercial orderSummary, with a
   *    "View Full Terms & Conditions" link as the stated fallback;
   *  - the CAF preview stays on screen once signed (2026-09-28 "preview of
   *    the signed CAF"), and an AdditionalDocumentsUpload appears alongside
   *    it for whatever else needs attaching afterward - no signature
   *    required for any of those.
   * The other five journeys sharing this component (MNP, Passport-to-QID,
   * etc.) omit this prop and keep the original picker-led behaviour exactly
   * as it was.
   */
  autoDetectDeviceType?: boolean;
  /** Raw order figures for the dynamic T&C bullets - see TncLegalFacts. */
  legalFacts?: TncLegalFacts;
  /**
   * Advances the wizard past this step (2026-09-30). Only read once `signed`
   * - the wizard's own Back/Continue footer is hidden at that point (see
   * NewPostpaidWizard's `customerFacing` on the 'caf' step, now true AFTER
   * signing rather than before), so the Continue button below is the only
   * way forward and this is what it calls. Omitted by the other five
   * journeys sharing this component, none of which flip customerFacing this
   * way.
   */
  onContinue?: () => void;
}

// Pattern 6: CAF/Contract Signature Capture - CAF Type card selector (Digital/
// Manual/Touch Screen, styled like the ID Type picker), bilingual (AR/EN)
// document preview pre-populated from
// applicant/billing/plan data, then a "Please Sign" pad modal (drawn signature,
// Clear/Done) - reused identically for CAF, MNP application, Passport-to-QID
// forms (SCR-058, SCR-069/070, SCR-084, SCR-127/129, etc.).
export function CafSignatureCapture({
  value,
  onChange,
  customerName,
  idLabel,
  idValue,
  orderSummary,
  termsUrl,
  autoDetectDeviceType,
  legalFacts,
  onContinue,
}: CafSignatureCaptureProps) {
  const [padOpen, setPadOpen] = useState(false);
  const [bulletTemplates, setBulletTemplates] = useState<TncBulletTemplate[]>([]);

  useEffect(() => {
    if (!autoDetectDeviceType) return;
    mockDataEngine.list<TncBulletTemplate>('tnc-summary-bullets').then(setBulletTemplates);
  }, [autoDetectDeviceType]);

  // Auto-select ONCE, the moment this call site mounts with nothing chosen
  // yet - the same "derive a default without stomping an existing value"
  // shape Plan & Add-ons' Bill Limit default uses. Guarded on value.cafType
  // rather than re-running every render, so an agent who somehow lands back
  // here after signing does not have their recorded type silently replaced.
  useEffect(() => {
    if (!autoDetectDeviceType || value.cafType) return;
    onChange({ ...value, cafType: detectCafType() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDetectDeviceType]);

  if (autoDetectDeviceType) {
    // Both auto-detected outcomes sign in-app now - see the prop's own note
    // on why Touch Screen no longer means "signed off-screen" once a device
    // check, not the agent, is what chose it.
    const showsInAppSignature = value.cafType === 'Digital' || value.cafType === 'Touch Screen';
    const signed = showsInAppSignature && Boolean(value.signatureDataUrl);
    const bullets = buildTncBullets(legalFacts, bulletTemplates);

    return (
      <div className="space-y-4">
        {/* The wizard's own step heading is not rendered while this step is
            customer-facing (GuidedActivationWizard hides all of its chrome
            for that render, including <h2>{label}</h2>) - this stands in so
            the screen is not handed to a customer with no heading at all.
            Shown when `signed` now (2026-09-30, reversed along with
            customerFacing): the wizard's own "CAF & Signature" heading is
            present for the whole unsigned review, so repeating one here
            would say the same thing twice; once signed, that chrome - and
            its heading - disappears, and this is what fills the gap. */}
        {signed && <h2 className="text-[length:var(--fs-h4)] font-bold text-fg">Signed</h2>}

        {/* Concise, dynamic, business-maintained bullets (2026-09-28 request),
            read to the customer before signature. Moved above the CAF card
            (2026-09-30): the customer reads what they're agreeing to FIRST,
            then signs the form below it, rather than being asked to sign
            ahead of the terms that follow. The commercial recap
            (orderSummary) stays alongside rather than being replaced: what
            was bought and what terms bind the customer are complementary
            facts, not the same one restated. */}
        {!signed && (bullets.length > 0 || (orderSummary && orderSummary.length > 0)) && (
          <div className="rounded-[var(--radius-card)] border border-border-soft bg-surface p-4 space-y-3">
            {/* Renamed from "What the customer is agreeing to" (2026-09-28
                request) to match the heading BR-009's Key Information panel
                already uses elsewhere (NewMnpWizard, NewPrepaidWizard) -
                Postpaid-only; the other five journeys sharing this component
                keep their own heading below, unaffected. */}
            <h4 className="text-fg font-medium text-[length:var(--fs-body)]">Key Information</h4>
            {bullets.length > 0 && (
              <ul className="list-disc pl-5 space-y-1 text-[length:var(--fs-caption)] text-fg-2">
                {bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
            {orderSummary && orderSummary.length > 0 && (
              <dl className={bullets.length > 0 ? 'pt-2 border-t border-border-soft' : undefined}>
                {orderSummary.map((row) => (
                  <div key={row.label} className="flex justify-between gap-4 py-1.5 border-b border-border-soft last:border-0">
                    <dt className="text-fg-2 text-[length:var(--fs-caption)]">{row.label}</dt>
                    <dd className="text-fg text-[length:var(--fs-caption)] text-right">{row.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {/* Fallback, not the primary route (2026-09-28 request): the
                bullets above are the concise answer for the common cases;
                this is for anything they do not cover. */}
            {termsUrl && (
              <p className="text-[length:var(--fs-caption)] text-muted">
                For anything not covered above,{' '}
                <a href={termsUrl} target="_blank" rel="noreferrer" className="text-accent underline">
                  View Full Terms & Conditions
                </a>
                .
              </p>
            )}
          </div>
        )}

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

          {signed ? (
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

        {/* Post-signature, agent view: the signed CAF preview above stays on
            screen (2026-09-28 "preview of the signed CAF"), and whatever
            else this order needs attached - no signature required for any
            of it - goes here instead of the legacy "Signed documents"
            uploader, which had nothing left to collect once signing always
            happens in-app. */}
        {signed && (
          <AdditionalDocumentsUpload
            documents={value.additionalDocuments ?? []}
            onChange={(documents) => onChange({ ...value, additionalDocuments: documents })}
          />
        )}

        {/* The wizard's own Continue is gone along with the rest of its
            chrome once signed (customerFacing flips true) - this is the
            replacement, same reasoning as the "Please Sign" button above:
            the step's own content owns whatever action it needs. Additional
            documents are optional (isValid never required them), so nothing
            gates this beyond having signed at all. */}
        {signed && onContinue && (
          <Button variant="primary-rect" className="w-full" onClick={onContinue}>
            Continue
          </Button>
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

  // Unchanged for the five other journeys sharing this component (MNP,
  // Passport-to-QID, etc.), none of which asked for any of the above.
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

      {/* Upload of the signed paperwork. Gated on the CAF actually being
          signed: for CAF-Digital that is the in-app signature; for Manual and
          Touch Screen the signing happens off-screen, so choosing either type
          IS the point at which there is paper to scan back in - which is why
          those two do not wait for signatureDataUrl, which they never set. */}
      {value.cafType && (value.cafType !== 'Digital' || value.signatureDataUrl) && (
        <CafDocumentUpload
          documents={value.documents ?? []}
          onChange={(documents) => onChange({ ...value, documents })}
        />
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
