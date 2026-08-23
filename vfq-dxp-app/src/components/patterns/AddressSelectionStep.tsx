import { useEffect, useState } from 'react';
import * as mockDataEngine from '../../engines/mockDataEngine';

interface AddressRecord {
  id: string;
  zone: string;
  streetNo: string;
  buildingNo: string;
  aptFlatUnit: string;
  city: string;
}

interface AddressSelectionStepProps {
  value: string | undefined;
  onChange: (addressId: string) => void;
}

// Address step shared across New Fixed Line (SCR-045), New FWA (SCR-079), and
// New Postpaid (SCR-155) wizards. FLD-281 evidences a read-only Service Points
// grid (Service Point ID / Status / Device Type) surfaced once an address
// resolves to an existing serviceable point — no dedicated service-point mock
// dataset exists in reconstruction-package/mock-data (only ENT-036 Address
// records), so this step lets the agent select/confirm a physical address; the
// Service Point grid itself remains a documented gap (screens.md SCR-034 covers
// the KID/lookup variant with the same limitation).
export function AddressSelectionStep({ value, onChange }: AddressSelectionStepProps) {
  const [addresses, setAddresses] = useState<AddressRecord[]>([]);

  useEffect(() => {
    mockDataEngine.list<AddressRecord>('addresses').then(setAddresses);
  }, []);

  return (
    <div className="space-y-2">
      {addresses.map((a) => (
        <button
          key={a.id}
          onClick={() => onChange(a.id)}
          className={`w-full text-left rounded-[var(--radius-card)] border p-3 ${
            value === a.id ? 'border-accent bg-surface-warm' : 'border-border-soft hover:border-accent'
          }`}
        >
          <div className="text-fg">
            Zone {a.zone}, Street {a.streetNo}, Building {a.buildingNo}, {a.aptFlatUnit}
          </div>
          <div className="text-[length:var(--fs-caption)] text-muted">{a.city}</div>
        </button>
      ))}
      {addresses.length === 0 && <p className="text-muted">Loading addresses…</p>}
    </div>
  );
}
