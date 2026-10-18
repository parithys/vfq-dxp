import { useEffect, useState } from 'react';
import { Input } from '../primitives/Input';
import { Button } from '../primitives/Button';
import { evaluateRule } from '../../engines/ruleEngine';

export type BillLimitProduct = 'Mobile' | 'Mobile Plus';

// BR-226 (Mobile, Agent Min Value 50) / BR-227 (Mobile Plus, Agent Min Value 75),
// both Explicit/high-confidence per business-rules.json.
const AGENT_MINIMUMS: Record<BillLimitProduct, number> = { Mobile: 50, 'Mobile Plus': 75 };

interface BillLimitEditorProps {
  product: BillLimitProduct;
  value: number | undefined;
  onChange: (value: number, pass: boolean) => void;
  /** 'row': a title with the current limit under it and a sentence-case Edit button (the Add-ons step). Default: the compact box. */
  layout?: 'default' | 'row';
  /** No box around it (no border, fill or padding): it sits directly on the page, e.g. under a separator line. */
  bare?: boolean;
}

// Pattern 8: Plan/Promotion Detail Modal with Limit Editing - "Edit Bill Limit"
// button revealing a constrained value; Validate fires when a limit falls below
// the Agent Minimum guardrail (SCR-166/167/188) - the priority rule
// implementation named in frontend-architecture.md §5, reused here via the
// same BR-AGENT-MIN-THRESHOLD rule already exercised by the field-inventory's
// evidenced Bill Limit Agent Minimum behavior.
export function BillLimitEditor({ product, value, onChange, layout = 'default', bare = false }: BillLimitEditorProps) {
  const row = layout === 'row';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ''));
  // Resync while NOT editing (2026-09-28), so a caller that changes `value`
  // out from under this component - e.g. Plan & Add-ons re-deriving the
  // default from a newly selected plan's MRC - is reflected the next time
  // the agent opens the editor. Without this, draft stayed pinned to
  // whatever `value` was on first mount, so switching plans before ever
  // clicking "Edit Bill Limit" would open the editor on a stale figure.
  useEffect(() => {
    if (!editing) setDraft(String(value ?? ''));
  }, [value, editing]);
  const agentMinimum = AGENT_MINIMUMS[product];
  const result = value !== undefined ? evaluateRule('BR-AGENT-MIN-THRESHOLD', { limitAmount: value, agentMinimum }) : null;

  const apply = () => {
    const amount = Number(draft);
    if (Number.isNaN(amount)) return;
    const r = evaluateRule('BR-AGENT-MIN-THRESHOLD', { limitAmount: amount, agentMinimum });
    onChange(amount, r.pass);
    setEditing(false);
  };

  const step = (delta: number) => {
    const current = Number(draft) || 0;
    setDraft(String(Math.max(0, current + delta)));
  };

  return (
    <div className={bare ? '' : `card ${row ? 'p-4' : 'p-3'}`}>
      <div className="flex items-center justify-between gap-3">
        {row && !editing ? (
          <div>
            <p className="text-fg font-semibold">Bill Limit ({product})</p>
            {value !== undefined && <p className="text-fg-2 text-[length:var(--fs-caption)]">Current limit · QAR {value}</p>}
          </div>
        ) : (
          <span className="text-fg">Bill Limit ({product})</span>
        )}
        {!editing && (
          <Button variant="secondary" compact onClick={() => setEditing(true)}>
            {row ? 'Edit bill limit' : 'Edit Bill Limit'}
          </Button>
        )}
      </div>
      {editing ? (
        <div className="flex items-end gap-2 mt-2">
          <Button variant="secondary" compact className="h-[var(--size-btn-compact-h)]" aria-label="Decrease by 50 QR" onClick={() => step(-50)}>
            −50
          </Button>
          <Input label={`QAR (Agent Min ${agentMinimum})`} type="number" value={draft} onChange={(e) => setDraft(e.target.value)} />
          <Button variant="secondary" compact className="h-[var(--size-btn-compact-h)]" aria-label="Increase by 50 QR" onClick={() => step(50)}>
            +50
          </Button>
          <Button variant="primary" className="h-[var(--size-btn-compact-h)]" onClick={apply}>
            Apply
          </Button>
        </div>
      ) : (
        !row && value !== undefined && <div className="text-fg mt-1">QAR {value}</div>
      )}
      {result && !result.pass && <p className="text-danger text-[length:var(--fs-caption)] mt-2">{result.message}</p>}
    </div>
  );
}
