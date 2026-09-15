import { useEffect, useState } from 'react';
import * as mockDataEngine from '../../engines/mockDataEngine';
import { LocationInput, type AddressRecord } from '../primitives/LocationInput';

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
//
// Backed by LocationInput's search-as-you-type UX instead of the previous
// list-every-seeded-address-as-a-card approach, which doesn't scale past a
// handful of records. Prop contract (value: addressId, onChange: (id) =>
// void) is unchanged, so neither wizard call site needs updating — this
// still self-fetches `addresses` (now just to resolve `value` back to a
// record for the confirmation summary below the search field).
export function AddressSelectionStep({ value, onChange }: AddressSelectionStepProps) {
  const [addresses, setAddresses] = useState<AddressRecord[]>([]);

  useEffect(() => {
    mockDataEngine.list<AddressRecord>('addresses').then(setAddresses);
  }, []);

  const selected = addresses.find((a) => a.id === value);

  return (
    <div className="space-y-3">
      <LocationInput label="Address" placeholder="Search by zone, street, building, or city…" onSelect={(a) => onChange(a.id)} />
      {selected && (
        <div className="rounded-[var(--radius-card)] border border-[var(--field-selected)] bg-surface-warm p-3">
          <div className="text-fg">
            Zone {selected.zone}, Street {selected.streetNo}, Building {selected.buildingNo}, {selected.aptFlatUnit}
          </div>
          <div className="text-[length:var(--fs-caption)] text-muted">{selected.city}</div>
        </div>
      )}
    </div>
  );
}
