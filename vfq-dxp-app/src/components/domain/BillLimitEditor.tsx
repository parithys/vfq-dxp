import { useState } from 'react';
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
}

// Pattern 8: Plan/Promotion Detail Modal with Limit Editing — "Edit Bill Limit"
// button revealing a constrained value; Validate fires when a limit falls below
// the Agent Minimum guardrail (SCR-166/167/188) — the priority rule
// implementation named in frontend-architecture.md §5, reused here via the
// same BR-AGENT-MIN-THRESHOLD rule already exercised by the field-inventory's
// evidenced Bill Limit Agent Minimum behavior.
export function BillLimitEditor({ product, value, onChange }: BillLimitEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ''));
  const agentMinimum = AGENT_MINIMUMS[product];
  const result = value !== undefined ? evaluateRule('BR-AGENT-MIN-THRESHOLD', { limitAmount: value, agentMinimum }) : null;

  const apply = () => {
    const amount = Number(draft);
    if (Number.isNaN(amount)) return;
    const r = evaluateRule('BR-AGENT-MIN-THRESHOLD', { limitAmount: amount, agentMinimum });
    onChange(amount, r.pass);
    setEditing(false);
  };

  return (
    <div className="rounded-[var(--radius-card)] border border-border-soft bg-bg p-3">
      <div className="flex items-center justify-between">
        <span className="text-fg">Bill Limit ({product})</span>
        {!editing && (
          <Button variant="ghost-rect" compact onClick={() => setEditing(true)}>
            Edit Bill Limit
          </Button>
        )}
      </div>
      {editing ? (
        <div className="flex items-end gap-2 mt-2">
          <Input label={`QR (Agent Min ${agentMinimum})`} type="number" value={draft} onChange={(e) => setDraft(e.target.value)} />
          <Button variant="primary-rect" onClick={apply}>
            Apply
          </Button>
        </div>
      ) : (
        value !== undefined && <div className="text-fg mt-1">QR {value}</div>
      )}
      {result && !result.pass && <p className="text-danger text-[length:var(--fs-caption)] mt-2">{result.message}</p>}
    </div>
  );
}
