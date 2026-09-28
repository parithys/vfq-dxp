import { useState } from 'react';
import { Button } from '../primitives/Button';
import { Badge } from '../primitives/Badge';
import { SimSerialScanner } from './SimSerialScanner';

export type SimType = 'Physical' | 'eSIM';

export interface SimTypeValue {
  simType?: SimType;
  simSerial?: string;
  simValid?: boolean;
  /** Captured alongside simValid (2026-09-28 request: display ICCID and
   * Stock Status after validation) - see SimSerialScanner's onChange. */
  simIccid?: string;
  simStockStatus?: string;
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

// "SIM Type" (reference flow step 8). Reworked 2026-09-28 from a Physical/
// eSIM TAB pair (agent picks a path before seeing either control) to both
// paths shown SIDE BY SIDE from the start - Physical's scan field is the
// default-focused, primary action; eSIM's "Select eSIM" sits beside it as
// the explicit alternative, not a second screen behind a tab click.
//
// Physical issuance keeps the existing, evidenced real-time-inventory serial
// scan (Pattern 11), now auto-advancing the wizard the moment a scan
// validates - the agent no longer clicks Continue on a step this step's own
// two checks (serial validity + stock) already resolved for them. eSIM has
// no evidenced inventory/serial check in this corpus - generating a QR/
// activation code and optionally emailing it is the standard telco pattern,
// kept deliberately lightweight (no fabricated eSIM provisioning API), and
// still does NOT auto-advance: selecting eSIM is a choice to review, not a
// validation result to act on immediately.
export function SimTypeStep({ value, customerEmail, onChange }: SimTypeStepProps) {
  const [issuing, setIssuing] = useState(false);

  const generateEsim = async () => {
    setIssuing(true);
    await new Promise((r) => setTimeout(r, 500));
    setIssuing(false);
    onChange({ ...value, simType: 'eSIM', esimIssued: true, esimActivationCode: generateActivationCode() });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Physical SIM - the default-focused, primary path. */}
      <div className="space-y-3">
        <h4 className="text-fg font-medium text-[length:var(--fs-body)]">Physical SIM</h4>
        <SimSerialScanner
          value={value.simSerial ?? ''}
          autoFocus
          // eSIM is a valid alternative to a Physical serial, not an
          // additional requirement on top of it (2026-09-28 "Require either
          // eSIM selection or SIM Serial Number") - this panel's own blur
          // validation should stay quiet while the agent has gone the eSIM
          // route, rather than complain about a field they were never
          // going to fill in.
          suppressValidation={value.simType === 'eSIM'}
          onChange={(serial, valid, details) =>
            onChange({
              ...value,
              simType: 'Physical',
              simSerial: serial,
              simValid: valid,
              simIccid: details?.iccid,
              simStockStatus: details?.stockStatus,
            })
          }
        />
        {/* "After validation, display SIM Type, SIM Serial Number, ICCID,
            and Stock Status" (2026-09-28) - SimSerialScanner's own inline
            "available in stock" badge stays (other journeys sharing that
            component rely on it as their only confirmation); this is the
            fuller read-back specific to this step, and briefly visible
            before autoAdvanceWhen (NewPostpaidWizard) carries the wizard
            forward - the same "flash then advance" shape Eligibility's own
            auto-advance already has. */}
        {value.simType === 'Physical' && value.simValid && (
          <dl className="rounded-[var(--radius-card)] border border-success/30 bg-[color-mix(in_oklab,var(--success),var(--bg)_92%)] p-3 space-y-1 text-[length:var(--fs-caption)]">
            <div className="flex justify-between gap-3">
              <dt className="text-fg-2">SIM Type</dt>
              <dd className="text-fg font-medium">Physical</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-fg-2">SIM Serial Number</dt>
              <dd className="text-fg font-medium">{value.simSerial}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-fg-2">ICCID</dt>
              <dd className="text-fg font-medium">{value.simIccid ?? '-'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-fg-2">Stock Status</dt>
              <dd className="text-fg font-medium">{value.simStockStatus ?? '-'}</dd>
            </div>
          </dl>
        )}
      </div>

      {/* eSIM - the explicit alternative, not a second tab behind a click. */}
      <div className="space-y-3">
        <h4 className="text-fg font-medium text-[length:var(--fs-body)]">eSIM</h4>
        {/* The QR code and send-to-email controls have moved to the
            activation-complete screen (EsimActivationPanel). This step only
            issues the code; showing a scannable QR here meant the customer
            could install an eSIM for an order still four steps from being
            submitted. What stays is the confirmation that it was issued. */}
        {value.simType === 'eSIM' && value.esimIssued && value.esimActivationCode ? (
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
              The eSIM QR code will be available only after successful payment and order submission - it is never
              shown active before then.
            </p>
          </>
        ) : (
          <>
            <Button variant="primary-rect" onClick={generateEsim} disabled={issuing}>
              {issuing ? 'Selecting eSIM…' : 'Select eSIM'}
            </Button>
            {/* Stated up front (2026-09-28 request), not only after
                selecting - the agent should know this before choosing eSIM,
                not discover it afterward. */}
            <p className="text-muted text-[length:var(--fs-caption)]">
              The eSIM QR code is generated only after successful payment and order submission.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
