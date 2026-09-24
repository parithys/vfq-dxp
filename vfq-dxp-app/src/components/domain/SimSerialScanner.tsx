import { useState } from 'react';
import { Input } from '../primitives/Input';
import * as mockDataEngine from '../../engines/mockDataEngine';

interface SimRecord {
  simSerial: string;
  stockStatus: string;
}

interface SimSerialScannerProps {
  value: string;
  onChange: (value: string, valid: boolean) => void;
}

// Pattern 11: SIM/Device Serial Capture with Real-Time Inventory Validation -
// barcode-scan input validated against UIM/inventory in real time; blocks
// Continue with an inline error if blank/not-found/already-assigned
// (SCR-093/099/124/158/192).
export function SimSerialScanner({ value, onChange }: SimSerialScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const validate = async (serial: string) => {
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
      setError('SIM Serial not found in inventory.');
      onChange(serial, false);
      return;
    }
    if (found.stockStatus === 'Issued') {
      setError('This SIM is already assigned.');
      onChange(serial, false);
      return;
    }
    setError(null);
    onChange(serial, true);
  };

  return (
    <div>
      <Input
        label="SIM Serial Number"
        placeholder="Please enter or scan the SIM Serial number below."
        value={value}
        onChange={(e) => onChange(e.target.value, false)}
        onBlur={(e) => validate(e.target.value)}
        error={error ?? undefined}
      />
      {checking && <p className="text-[length:var(--fs-caption)] text-muted mt-1">Checking inventory…</p>}
    </div>
  );
}
