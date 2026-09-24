import { useEffect, useState } from 'react';
import { Input } from '../primitives/Input';
import { Button } from '../primitives/Button';
import { ZsbConflictNotice } from '../domain/ZsbConflictNotice';
import * as mockDataEngine from '../../engines/mockDataEngine';

export interface ZsbAddressValue {
  zone?: string;
  streetNo?: string;
  buildingNo?: string;
  aptFlatUnit?: string;
  skipped?: boolean;
  fetchedFromMoi?: boolean;
}

interface ZsbAddressStepProps {
  value: ZsbAddressValue;
  onChange: (value: ZsbAddressValue) => void;
  /** When the Contact step's ID lookup resolved a Qatari national, their
   * registered address is looked up and auto-filled (read-only) rather than
   * re-typed by the agent - a Qatari ID is already tied to a Kahramaa-linked
   * address record on file. Omitted/non-Qatari falls back to the existing
   * evidenced manual-entry + Skip Address flow unchanged. */
  idNumber?: string;
  nationality?: string;
}

interface AddressRecord {
  customerId: string;
  zone: string;
  streetNo: string;
  buildingNo: string;
  aptFlatUnit: string;
  primaryStatus: string;
  activeFlag: boolean;
}

// SCR-155/SCR-122 (MNP Postpaid Address, FLD-523–526): Zone/Street No./Building
// No./Apt-Flat-Unit, all evidenced Mandatory: No, with "Save Address"/"Skip
// Address"/"Go back"/"Cancel" buttons - a mobile-channel address step, distinct
// from Fixed Line/FWA's AddressSelectionStep (which picks an existing
// serviceable Address record). See ZsbConflictNotice for conflict-report.md
// Conflict 2's unresolved-policy advisory.
export function ZsbAddressStep({ value, onChange, idNumber, nationality }: ZsbAddressStepProps) {
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (nationality !== 'Qatari' || !idNumber || value.fetchedFromMoi || value.zone) return;
    let cancelled = false;
    (async () => {
      setFetching(true);
      const docs = await mockDataEngine.list<{ documentNumber: string; customerId: string }>('identity-documents');
      const doc = docs.find((d) => d.documentNumber === idNumber);
      if (!doc) {
        if (!cancelled) setFetching(false);
        return;
      }
      const addresses = await mockDataEngine.list<AddressRecord>('addresses');
      const onFile = addresses.find((a) => a.customerId === doc.customerId && a.primaryStatus === 'Primary' && a.activeFlag);
      setFetching(false);
      if (!cancelled && onFile) {
        onChange({
          zone: onFile.zone,
          streetNo: onFile.streetNo,
          buildingNo: onFile.buildingNo,
          aptFlatUnit: onFile.aptFlatUnit,
          fetchedFromMoi: true,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idNumber, nationality]);

  return (
    <div className="space-y-4">
      <ZsbConflictNotice />
      {fetching && <p className="text-muted text-[length:var(--fs-body)]">Checking for an address on file…</p>}
      {!value.skipped && (
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Zone"
            value={value.zone ?? ''}
            disabled={value.fetchedFromMoi}
            onChange={(e) => onChange({ ...value, zone: e.target.value })}
          />
          <Input
            label="Street No."
            value={value.streetNo ?? ''}
            disabled={value.fetchedFromMoi}
            onChange={(e) => onChange({ ...value, streetNo: e.target.value })}
          />
          <Input
            label="Building No."
            value={value.buildingNo ?? ''}
            disabled={value.fetchedFromMoi}
            onChange={(e) => onChange({ ...value, buildingNo: e.target.value })}
          />
          <Input
            label="Apt/Flat/Unit"
            value={value.aptFlatUnit ?? ''}
            disabled={value.fetchedFromMoi}
            helperText={value.fetchedFromMoi ? 'Fetched from MOI - not editable.' : undefined}
            onChange={(e) => onChange({ ...value, aptFlatUnit: e.target.value })}
          />
        </div>
      )}
      {!value.fetchedFromMoi && (
        <div className="flex gap-2">
          {value.skipped ? (
            <Button variant="ghost-rect" onClick={() => onChange({ ...value, skipped: false })}>
              Enter Address
            </Button>
          ) : (
            <>
              <Button variant="primary-rect" onClick={() => onChange(value)}>
                Save Address
              </Button>
              <Button variant="ghost-rect" onClick={() => onChange({ skipped: true })}>
                Skip Address
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
