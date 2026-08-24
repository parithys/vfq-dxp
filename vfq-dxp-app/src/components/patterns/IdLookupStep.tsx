import { useState } from 'react';
import { QidInput } from '../domain/QidInput';
import { Button } from '../primitives/Button';
import { Badge } from '../primitives/Badge';
import * as mockDataEngine from '../../engines/mockDataEngine';
import { useEnterToSubmit } from '../../hooks/useEnterToSubmit';

interface MoiResult {
  name: string;
  dob: string;
  nationality: string;
}

interface IdLookupStepProps {
  value?: { idNumber?: string; moiResult?: MoiResult };
  onChange: (value: { idNumber?: string; moiResult?: MoiResult }) => void;
}

// Pattern 2: Customer/Contact Lookup Step (QID/Kahramaa ID Scan + MOI Validation) —
// prompts to scan/insert ID, calls out to MOI validation, returns a confirmation
// banner, pre-fills name/DOB/nationality for agent review (read-only per
// PERSONA-001's evidenced restriction: "cannot manually enter ID details, only
// re-scan/search"). Buttons: Go / Search Again / Cancel.
export function IdLookupStep({ value = {}, onChange }: IdLookupStepProps) {
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const runMoiValidation = async () => {
    if (!value.idNumber) return;
    setLoading(true);
    setNotFound(false);
    const identityDocs = await mockDataEngine.list<{ documentNumber: string; customerId: string }>('identity-documents');
    const match = identityDocs.find((d) => d.documentNumber === value.idNumber);
    if (!match) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const customers = await mockDataEngine.list<{ customerId: string; name: string; dob: string; nationality: string }>(
      'customers'
    );
    const customer = customers.find((c) => c.customerId === match.customerId);
    setLoading(false);
    if (customer) {
      onChange({ ...value, moiResult: { name: customer.name, dob: customer.dob, nationality: customer.nationality } });
    }
  };

  const searchAgain = () => onChange({ idNumber: undefined, moiResult: undefined });

  const handleKeyDown = useEnterToSubmit(Boolean(value.idNumber) && !loading, runMoiValidation);

  if (value.moiResult) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="success">MOI Validated</Badge>
        </div>
        <div className="rounded-[var(--radius-card)] bg-surface p-4 grid grid-cols-3 gap-4 text-[length:var(--fs-body)]">
          <div>
            <div className="text-[length:var(--fs-caption)] text-muted">Name</div>
            <div className="text-fg">{value.moiResult.name}</div>
          </div>
          <div>
            <div className="text-[length:var(--fs-caption)] text-muted">Date of Birth</div>
            <div className="text-fg">{value.moiResult.dob}</div>
          </div>
          <div>
            <div className="text-[length:var(--fs-caption)] text-muted">Nationality</div>
            <div className="text-fg">{value.moiResult.nationality}</div>
          </div>
        </div>
        <Button variant="ghost-rect" onClick={searchAgain}>
          Edit &amp; Search Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3" onKeyDown={handleKeyDown}>
      <QidInput value={value.idNumber ?? ''} onChange={(idNumber) => onChange({ ...value, idNumber })} />
      {notFound && <p className="text-danger text-[length:var(--fs-caption)]">No MOI record found for this ID — try again.</p>}
      <Button variant="primary-rect" onClick={runMoiValidation} disabled={!value.idNumber || loading}>
        {loading ? 'Validating…' : 'Go'}
      </Button>
    </div>
  );
}
