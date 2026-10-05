import { Input } from '../primitives/Input';
import { idTypesFor, idTypeLabel } from '../../data/idTypes';
import { Select } from '../primitives/Select';

export interface DonorDetailsValue {
  portInNumber?: string;
  donorId?: string;
  donorIdType?: string;
}

interface DonorDetailsStepProps {
  value: DonorDetailsValue;
  onChange: (value: DonorDetailsValue) => void;
}

// SCR-126: MNP wizard step: Donor Details - FLD-531–536 (guided-journeys-mnp-postpaid-open-ui-desktop-mnp-postpaid-6cb03f33,
// high confidence): Port-in Number and Donor ID/ID Type are agent-entered;
// Donor Type, Donor Operator, and Subscription Type are evidenced read-only/
// greyed once the port-in number resolves - no dedicated donor-operator
// lookup dataset exists beyond the two evidenced examples (Qtel, Ooredoo
// Qatar), so this derives them deterministically once both fields are filled
// rather than fabricating a richer lookup than the corpus evidences.
export function DonorDetailsStep({ value, onChange }: DonorDetailsStepProps) {
  const resolved = Boolean(value.portInNumber && value.donorId);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Port-in Number"
          value={value.portInNumber ?? ''}
          placeholder="97466000666"
          onChange={(e) => onChange({ ...value, portInNumber: e.target.value })}
        />
        <Input label="Donor ID" value={value.donorId ?? ''} onChange={(e) => onChange({ ...value, donorId: e.target.value })} />
        <Select
          label="Donor ID Type"
          value={value.donorIdType ?? 'Passport'}
          onChange={(e) => onChange({ ...value, donorIdType: e.target.value })}
          options={idTypesFor('donor').map((t) => ({ value: t, label: idTypeLabel(t) }))}
        />
      </div>

      {resolved && (
        <div className="grid grid-cols-3 gap-4 pt-2 border-t border-border-soft text-[length:var(--fs-body)]">
          <div>
            <div className="text-[length:var(--fs-caption)] text-muted">Donor Type</div>
            <div className="text-fg-2">Consumer</div>
          </div>
          <div>
            <div className="text-[length:var(--fs-caption)] text-muted">Donor Operator</div>
            <div className="text-fg-2">Ooredoo Qatar</div>
          </div>
          <div>
            <div className="text-[length:var(--fs-caption)] text-muted">Subscription Type</div>
            <div className="text-fg-2">Postpaid</div>
          </div>
        </div>
      )}
    </div>
  );
}
