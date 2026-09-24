import { useRef, useState } from 'react';
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
// than replacing the input entirely. Editing the number after a result exists
// clears that result immediately — a fetched result stays pinned to the exact
// value it came from, never left showing stale demographic data for a field
// the agent has since changed. Switching ID Type clears the result AND the
// number, since a number entered under one scheme is never valid under
// another. The returned
// name/DOB/nationality are still read-only display per the Retail Sales Agent
// restriction carried over from the 66-persona model's PERSONA-001 ("cannot
// manually enter ID details, only re-scan/search") — only the lookup ID
// number itself is directly editable.
export function IdLookupStep({ value = {}, onChange }: IdLookupStepProps) {
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const numberInputRef = useRef<HTMLInputElement>(null);
  const idType = value.idType ?? 'QID';

  const handleIdTypeChange = (nextType: QidType) => {
    // Re-clicking the type you are already on is a no-op, not a reset. These
    // are plain buttons rather than radios, so without this a stray second
    // click on the selected chip would wipe a number the agent had just typed.
    if (nextType === idType) return;
    setNotFound(false);
    // Clear the NUMBER, not just the MOI result. The two ID schemes have
    // nothing in common, so a number carried across a type switch is always
    // wrong for the field it now sits in — the reported case was a QID,
    // 28456701234, left sitting under a "Diplomatic ID Number" label whose
    // own placeholder reads "e.g. DIP-QA-004521". Fetch would then either miss
    // or, worse, resolve the OLD document and show demographics that have
    // nothing to do with the selected type.
    //
    // `email` needs no clearing here: GuidedContactStep re-derives it from
    // moiResult on every change. `altPhone` is deliberately kept — switching
    // type normally means the same walk-in presenting a different document,
    // and discarding a contact number the agent typed would be the bigger
    // loss.
    onChange({ ...value, idType: nextType, idNumber: '', moiResult: undefined });
    // The number field is now the outstanding one and typing it is the
    // unambiguous next action, so move the cursor there rather than leaving it
    // on the chip the agent just clicked.
    //
    // Synchronous, NOT wrapped in requestAnimationFrame. The input node
    // already exists and React reuses it across this re-render, so there is
    // nothing to wait for — and rAF never fires while the document is hidden,
    // so an agent returning to a backgrounded tab would have found the field
    // cleared but the cursor still on the chip.
    numberInputRef.current?.focus();
  };

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
        onIdTypeChange={handleIdTypeChange}
        inputRef={numberInputRef}
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
        <div className="pt-2 border-t border-border-soft">
          <div className="rounded-[var(--radius-card)] border border-success/30 bg-[color-mix(in_oklab,var(--success),white_92%)] shadow-raised p-4 space-y-3">
            <Badge variant="success">MOI Validated</Badge>
            <div className="grid grid-cols-3 gap-4 text-[length:var(--fs-body)]">
              <div>
                <div className="text-[length:var(--fs-caption)] text-muted">Name</div>
                <div className="text-fg font-semibold text-[length:var(--fs-body-lg)]">{value.moiResult.name}</div>
              </div>
              <div>
                <div className="text-[length:var(--fs-caption)] text-muted">Date of Birth</div>
                <div className="text-fg font-semibold text-[length:var(--fs-body-lg)]">{value.moiResult.dob}</div>
              </div>
              <div>
                <div className="text-[length:var(--fs-caption)] text-muted">Nationality</div>
                <div className="text-fg font-semibold text-[length:var(--fs-body-lg)]">{value.moiResult.nationality}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
