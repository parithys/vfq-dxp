import { useState } from 'react';
import { Input } from '../primitives/Input';
import { Button } from '../primitives/Button';
import { Badge } from '../primitives/Badge';
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
//
// 2026-09-27 walkthrough added two things: an explicit "Scan SIM" ACTION
// (scanning was previously only implied by placeholder text, so the barcode
// path was invisible unless the agent read the grey hint), and a positive
// stock readout - the step used to say nothing at all when a serial was good,
// so "available in this store's stock" was indistinguishable from "not checked
// yet".
export function SimSerialScanner({ value, onChange }: SimSerialScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [inStock, setInStock] = useState(false);
  const [scanning, setScanning] = useState(false);

  const validate = async (serial: string) => {
    setInStock(false);
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
    onChange(serial, true);
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
      <Input
        label="SIM Serial Number"
        placeholder="Enter the SIM serial number, or use Scan SIM"
        value={value}
        onChange={(e) => onChange(e.target.value, false)}
        onBlur={(e) => validate(e.target.value)}
        error={error ?? undefined}
      />
      <div className="mt-2 flex items-center gap-3">
        <Button variant="ghost-rect" compact onClick={scanSim} disabled={scanning || checking}>
          {scanning ? 'Scanning…' : 'Scan SIM'}
        </Button>
        {checking && <span className="text-[length:var(--fs-caption)] text-muted">Checking stock…</span>}
        {inStock && !checking && <Badge variant="success">SIM available in this store's stock</Badge>}
      </div>
    </div>
  );
}
