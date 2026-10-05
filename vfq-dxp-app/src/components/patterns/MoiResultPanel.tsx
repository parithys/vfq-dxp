import { Badge } from '../primitives/Badge';
import type { IdLookupValue } from './idLookupModel';

interface MoiResultPanelProps {
  moiResult: NonNullable<IdLookupValue['moiResult']>;
  moiUpdateTimeText?: string;
}

/*
 * Only the showMoiDetails={true} shape renders this now: the bordered
 * panel with the Name/DOB/Nationality read-out, which is the ONLY
 * place the six other journeys (Passport-to-QID, SIM Swap,
 * Pre-to-Post and the rest) display that identity data. Its badge
 * stays inside the panel, heading the read-out it introduces.
 *
 * The showMoiDetails={false} shape used to render a bare badge in this
 * slot, a row of its own under the field. It moved onto the number
 * field's label line on 2026-09-25 and is passed as `status` in
 * IdLookupStep. GuidedContactStep needs nothing else here: its own identity
 * fields already show what the panel would restate, which is why the bordered
 * container went on 2026-09-24.
 */
export function MoiResultPanel({ moiResult, moiUpdateTimeText }: MoiResultPanelProps) {
  return (
    <div className="pt-2 border-t border-border-soft">
      <div className="rounded-[var(--radius-card)] border border-success bg-[color-mix(in_oklab,var(--success),var(--bg)_88%)] p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="success-solid">MOI validated successfully</Badge>
          {moiUpdateTimeText && <span className="text-[length:var(--fs-caption)] text-muted">{moiUpdateTimeText}</span>}
        </div>
        <div className="grid grid-cols-3 gap-4 text-[length:var(--fs-body)]">
          <div>
            <div className="text-[length:var(--fs-caption)] text-muted">Name</div>
            <div className="text-fg font-semibold text-[length:var(--fs-body-lg)]">{moiResult.name}</div>
          </div>
          <div>
            <div className="text-[length:var(--fs-caption)] text-muted">Date of Birth</div>
            <div className="text-fg font-semibold text-[length:var(--fs-body-lg)]">{moiResult.dob}</div>
          </div>
          <div>
            <div className="text-[length:var(--fs-caption)] text-muted">Nationality</div>
            <div className="text-fg font-semibold text-[length:var(--fs-body-lg)]">
              {moiResult.nationality}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
