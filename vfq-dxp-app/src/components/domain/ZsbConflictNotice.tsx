import { useEffect, useState } from 'react';
import { evaluateRule } from '../../engines/ruleEngine';
import { Badge } from '../primitives/Badge';

// Surfaces BR-ZSB-MANDATORY-FOR-MOBILE's evaluation (conflict-report.md
// Conflict 2) as a visible advisory — never silently resolved either way.
export function ZsbConflictNotice() {
  const [message, setMessage] = useState<string | undefined>();

  useEffect(() => {
    setMessage(evaluateRule('BR-ZSB-MANDATORY-FOR-MOBILE', {}).message);
  }, []);

  if (!message) return null;

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--warn)] bg-[color-mix(in_oklab,var(--warn),white_92%)] p-3 space-y-1">
      <Badge variant="warning">Unresolved policy conflict</Badge>
      <p className="text-[length:var(--fs-caption)] text-fg">{message}</p>
    </div>
  );
}
