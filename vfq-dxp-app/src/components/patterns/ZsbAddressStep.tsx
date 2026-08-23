import { Input } from '../primitives/Input';
import { Button } from '../primitives/Button';
import { ZsbConflictNotice } from '../domain/ZsbConflictNotice';

export interface ZsbAddressValue {
  zone?: string;
  streetNo?: string;
  buildingNo?: string;
  aptFlatUnit?: string;
  skipped?: boolean;
}

interface ZsbAddressStepProps {
  value: ZsbAddressValue;
  onChange: (value: ZsbAddressValue) => void;
}

// SCR-155/SCR-122 (MNP Postpaid Address, FLD-523–526): Zone/Street No./Building
// No./Apt-Flat-Unit, all evidenced Mandatory: No, with "Save Address"/"Skip
// Address"/"Go back"/"Cancel" buttons — a mobile-channel address step, distinct
// from Fixed Line/FWA's AddressSelectionStep (which picks an existing
// serviceable Address record). See ZsbConflictNotice for conflict-report.md
// Conflict 2's unresolved-policy advisory.
export function ZsbAddressStep({ value, onChange }: ZsbAddressStepProps) {
  return (
    <div className="space-y-4">
      <ZsbConflictNotice />
      {!value.skipped && (
        <div className="grid grid-cols-2 gap-4">
          <Input label="Zone" value={value.zone ?? ''} onChange={(e) => onChange({ ...value, zone: e.target.value })} />
          <Input
            label="Street No."
            value={value.streetNo ?? ''}
            onChange={(e) => onChange({ ...value, streetNo: e.target.value })}
          />
          <Input
            label="Building No."
            value={value.buildingNo ?? ''}
            onChange={(e) => onChange({ ...value, buildingNo: e.target.value })}
          />
          <Input
            label="Apt/Flat/Unit"
            value={value.aptFlatUnit ?? ''}
            onChange={(e) => onChange({ ...value, aptFlatUnit: e.target.value })}
          />
        </div>
      )}
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
    </div>
  );
}
