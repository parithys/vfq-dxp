import { useState } from 'react';
import { Input } from '../primitives/Input';
import { Badge } from '../primitives/Badge';
import { Icon } from '../primitives/Icon';
import * as mockDataEngine from '../../engines/mockDataEngine';

interface SimRecord {
  simSerial: string;
  iccid: string;
  stockStatus: string;
}

/** A row of bars of varying width, standing in for a 1D barcode symbol at the
 * small size this renders at (the field's trailing icon, ~16px) - same icon
 * as QidInput.tsx's barcode scan trigger, for the same control elsewhere in
 * the app. */
const BARCODE_ICON = 'M3 4v16 M6 4v16 M8 4v16 M11 4v16 M13 4v16 M14 4v16 M17 4v16 M19 4v16 M21 4v16';

interface SimSerialScannerProps {
  value: string;
  /**
   * `details` carries ICCID/Stock Status the moment validation succeeds
   * (2026-09-28 request: "display SIM Type, SIM Serial Number, ICCID, and
   * Stock Status") - undefined on every other call, including a failed
   * validation, since there is nothing confirmed to report then.
   */
  onChange: (value: string, valid: boolean, details?: { iccid: string; stockStatus: string }) => void;
  /** Set by SimTypeStep only (2026-09-28 "Default focus to the Physical SIM
   * Serial Number scan field") - other callers of this same component keep
   * their existing behaviour, since this defaults to false/unset. */
  autoFocus?: boolean;
  /**
   * Set by SimTypeStep only, true while eSIM is the agent's current choice
   * (2026-09-28: "Require either eSIM selection or SIM Serial Number. If
   * eSIM is selected, suppress the 'SIM Serial is required' validation
   * error."). The wizard step's own isValid already treats the two paths as
   * alternatives - this fixes the display bug where the unused Physical
   * panel still ran its own blur validation and showed an error for a field
   * the agent was never going to fill in. Other callers omit this and keep
   * validating normally.
   */
  suppressValidation?: boolean;
}

// Pattern 11: SIM/Device Serial Capture with Real-Time Inventory Validation -
// barcode-scan input validated against UIM/inventory in real time; blocks
// Continue with an inline error if blank/not-found/already-assigned
// (SCR-093/099/124/158/192).
//
// 2026-09-27 walkthrough added two things: an explicit "Scan SIM" ACTION
// (scanning was previously only implied by placeholder text, so the barcode
// path was invisible unless the agent read the grey hint), and a positive
// stock readout - the step used to say nothing at all when a serial was good,
// so "available in this store's stock" was indistinguishable from "not checked
// yet".
export function SimSerialScanner({ value, onChange, autoFocus, suppressValidation }: SimSerialScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [inStock, setInStock] = useState(false);
  const [scanning, setScanning] = useState(false);

  const validate = async (serial: string) => {
    setInStock(false);
    // eSIM is the agent's current choice - this panel is not the one being
    // filled in, so it has nothing to validate or complain about yet.
    if (suppressValidation) {
      setError(null);
      return;
    }
    if (!serial) {
      setError('SIM Serial is required.');
      onChange(serial, false);
      return;
    }
    setChecking(true);
    const sims = await mockDataEngine.list<SimRecord>('sims');
    const found = sims.find((s) => s.simSerial === serial);
    setChecking(false);
    if (!found) {
      // Phrased as store stock rather than "inventory": the agent is standing
      // at one counter and can only issue what is in front of them, so the
      // actionable fact is that THIS store does not hold it.
      setError("SIM not found in this store's stock.");
      onChange(serial, false);
      return;
    }
    if (found.stockStatus === 'Issued') {
      setError('This SIM is already assigned.');
      onChange(serial, false);
      return;
    }
    setError(null);
    setInStock(true);
    onChange(serial, true, { iccid: found.iccid, stockStatus: found.stockStatus });
  };

  // Simulated barcode read. Picks a serial that is genuinely available in
  // sims.json rather than inventing one, so the success path it produces is
  // the same path a real reader would produce - and if the store holds nothing
  // available, it reports that instead of fabricating a SIM.
  const scanSim = async () => {
    setScanning(true);
    const sims = await mockDataEngine.list<SimRecord>('sims');
    await new Promise((r) => setTimeout(r, 600));
    setScanning(false);
    const available = sims.find((s) => s.stockStatus !== 'Issued');
    if (!available) {
      setError("SIM not found in this store's stock.");
      onChange('', false);
      return;
    }
    onChange(available.simSerial, false);
    await validate(available.simSerial);
  };

  return (
    <div>
      {/* Barcode scan trigger moved INSIDE the field as a trailing icon
          (2026-09-28), replacing the separate "Scan SIM" button below it -
          the icon fills the same box the agent would otherwise type into,
          the way a real barcode reader's output lands in the field it's
          wired to. scanSim's simulated-scan logic is unchanged; only where
          the trigger sits has moved. */}
      <Input
        label="SIM Serial Number"
        // Not required while eSIM is the agent's chosen alternative
        // (2026-09-28 asterisk sweep) - same condition as the error
        // suppression above, so the label never asserts a requirement this
        // panel isn't actually enforcing right now. Callers that never set
        // suppressValidation (every other journey sharing this component)
        // get `required` unconditionally, unchanged from before.
        required={!suppressValidation}
        placeholder="Enter the SIM serial number, or use the barcode scanner"
        value={value}
        onChange={(e) => onChange(e.target.value, false)}
        onBlur={(e) => validate(e.target.value)}
        error={suppressValidation ? undefined : (error ?? undefined)}
        autoFocus={autoFocus}
        trailingAddon={
          <button
            type="button"
            onClick={scanSim}
            disabled={scanning || checking}
            aria-label="Scan SIM barcode"
            title={scanning ? 'Scanning…' : 'Scan SIM barcode'}
            className="p-1.5 -mr-1.5 rounded-[var(--radius-button)] text-muted
              hover:text-accent disabled:opacity-50 disabled:hover:text-muted
              focus:outline-none focus-visible:shadow-[var(--focus-ring)]"
          >
            <Icon path={BARCODE_ICON} className="w-4 h-4" />
          </button>
        }
      />
      <div className="mt-2 flex items-center gap-3">
        {/* "Scanning…" used to be the button's own label; now that the
            trigger is an icon, this line is what carries that same visible
            feedback (the icon itself only shows it via a disabled state and
            hover title). */}
        {scanning && <span className="text-[length:var(--fs-caption)] text-muted">Scanning…</span>}
        {checking && !scanning && <span className="text-[length:var(--fs-caption)] text-muted">Checking stock…</span>}
        {inStock && !checking && !scanning && <Badge variant="success">SIM available in this store's stock</Badge>}
      </div>
    </div>
  );
}
