import { useState } from 'react';
import { QidInput } from '../domain/QidInput';
import type { QidType } from '../domain/QidInput';
import { Badge } from '../primitives/Badge';
import * as mockDataEngine from '../../engines/mockDataEngine';
import { useEnterToSubmit } from '../../hooks/useEnterToSubmit';

interface MoiResult {
  name: string;
  dob: string;
  nationality: string;
  email?: string;
}

interface IdLookupStepProps {
  value?: { idType?: QidType; idNumber?: string; moiResult?: MoiResult };
  onChange: (value: { idType?: QidType; idNumber?: string; moiResult?: MoiResult }) => void;
}

// Pattern 2: Customer/Contact Lookup Step (QID/Kahramaa ID Scan + MOI Validation) —
// the ID Type selector, number field, and Fetch action stay on screen at all
// times; the MOI result renders directly beneath them once resolved, rather
// than replacing the input entirely. Editing the number (or switching ID
// Type) after a result exists clears it immediately — a fetched result stays
// pinned to the exact value it came from, never left showing stale
// demographic data for a field the agent has since changed. The returned
// name/DOB/nationality are still read-only display per PERSONA-001's
// evidenced restriction ("cannot manually enter ID details, only
// re-scan/search") — only the lookup ID number itself is directly editable.
export function IdLookupStep({ value = {}, onChange }: IdLookupStepProps) {
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const idType = value.idType ?? 'QID';

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
    const customers = await mockDataEngine.list<{ customerId: string; name: string; dob: string; nationality: string; email?: string }>(
      'customers'
    );
    const customer = customers.find((c) => c.customerId === match.customerId);
    setLoading(false);
    if (customer) {
      onChange({
        ...value,
        moiResult: { name: customer.name, dob: customer.dob, nationality: customer.nationality, email: customer.email },
      });
    }
  };

  const handleKeyDown = useEnterToSubmit(Boolean(value.idNumber) && !loading, runMoiValidation);

  return (
    <div className="space-y-4" onKeyDown={handleKeyDown}>
      <QidInput
        idType={idType}
        onIdTypeChange={(t) => onChange({ ...value, idType: t, moiResult: undefined })}
        value={value.idNumber ?? ''}
        onChange={(idNumber) => {
          setNotFound(false);
          onChange({ ...value, idNumber, moiResult: undefined });
        }}
        onFetch={runMoiValidation}
        fetching={loading}
        error={notFound ? 'No MOI record found for this ID — try again.' : undefined}
      />

      {value.moiResult && (
        <div className="space-y-3 pt-2 border-t border-border-soft">
          <Badge variant="success">MOI Validated</Badge>
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
        </div>
      )}
    </div>
  );
}
