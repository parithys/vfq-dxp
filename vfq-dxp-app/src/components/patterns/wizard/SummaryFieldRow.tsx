import { useState } from 'react';
import type { FormattedSummaryValue } from './stepSummary';

/** One label / value pair. A value cut to its first few entries ("a, b, c +2 more") expands to the full list. */
export function SummaryFieldRow({ label, value }: { label: string; value: FormattedSummaryValue }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="flex flex-col gap-0.5 py-2 border-b border-border-soft last:border-0">
      <dt className="text-fg-2 text-[length:var(--fs-caption)]">{label}</dt>
      <dd className={`min-w-0 break-words text-[length:var(--fs-body)] ${value.empty ? 'text-muted' : 'text-fg font-medium'}`}>
        {value.fullList ? (
          <>
            {expanded ? value.fullList.join(', ') : value.text}{' '}
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              aria-expanded={expanded}
              className="text-accent font-medium text-[length:var(--fs-caption)] hover:underline focus:outline-none focus-visible:shadow-[var(--focus-ring)] rounded-[var(--radius-sm)]"
            >
              {expanded ? 'Show less' : 'Show all'}
            </button>
          </>
        ) : (
          value.text
        )}
      </dd>
    </div>
  );
}
