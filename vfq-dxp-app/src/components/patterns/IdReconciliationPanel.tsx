import { Badge, type BadgeVariant } from '../primitives/Badge';
import { reconciliationPasses, type AttributeMatch, type ReconResult } from './idReconciliation';

// MOI holds ISO dates; the app shows DD/MM/YYYY everywhere.
const shown = (a: AttributeMatch, v: string | undefined): string => {
  const iso = (a.attribute === 'dob' || a.attribute === 'expiry') && v ? /^(\d{4})-(\d{2})-(\d{2})/.exec(v) : null;
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : (v ?? '-');
};

const RESULT: Record<ReconResult, { label: string; variant: BadgeVariant }> = {
  match: { label: 'Matches MOI', variant: 'tag-green' },
  mismatch: { label: 'Does not match MOI', variant: 'tag-red' },
  'not-captured': { label: 'Not captured', variant: 'filled-neutral' },
  'moi-missing': { label: 'Not on MOI record', variant: 'tag-amber' },
};

/**
 * The attribute-level result of comparing the captured ID with MOI when it does not match: one row per attribute (what was captured, what MOI
 * holds, and whether they agree). Not shown for a clean match. A failed reconciliation is named (each attribute that differs) in the error under the number field.
 */
export function IdReconciliationPanel({ result }: { result: AttributeMatch[] }) {
  const passed = reconciliationPasses(result);
  return (
    <section aria-label="ID reconciliation" className="rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-fg font-semibold text-[length:var(--fs-body)]">ID reconciliation</h3>
        <Badge variant={passed ? 'tag-green' : 'tag-red'}>{passed ? 'All captured attributes match' : 'Mismatch'}</Badge>
      </div>
      <dl className="divide-y divide-border-soft">
        {result.map((a) => (
          <div key={a.attribute} className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-[10rem_1fr_1fr_auto] sm:items-center sm:gap-3">
            <dt className="text-fg-2 text-[length:var(--fs-caption)]">{a.label}</dt>
            <dd className="text-fg text-[length:var(--fs-body)] break-words">
              <span className="text-muted text-[length:var(--fs-caption)] sm:hidden">Captured: </span>
              {shown(a, a.captured)}
            </dd>
            <dd className="text-fg text-[length:var(--fs-body)] break-words">
              <span className="text-muted text-[length:var(--fs-caption)] sm:hidden">MOI: </span>
              {shown(a, a.moi)}
            </dd>
            <dd>
              <Badge variant={RESULT[a.result].variant}>{RESULT[a.result].label}</Badge>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
