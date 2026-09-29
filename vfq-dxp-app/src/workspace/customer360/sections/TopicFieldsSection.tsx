import type { ReactNode } from 'react';
import { Badge } from '../../../components/primitives/Badge';
import { getVisibleTopicFields } from '../../../engines/customer360VisibilityEngine';

/**
 * Generic field-list renderer for a customer360-fields.json topic that has
 * no dedicated UI of its own. Lists exactly the fields this persona is
 * entitled to see for the topic (real-time vs. drill-down, per the
 * visibility engine), each resolved against real Customer 360 data where a
 * `resolveValue` mapping exists - never a fabricated value. A field with no
 * resolver, or one that returns nothing, says so plainly rather than
 * leaving a blank cell that reads as a loading failure.
 */
export function TopicFieldsSection({
  personaId,
  topic,
  resolveValue,
}: {
  personaId: string | undefined;
  topic: string;
  resolveValue?: (details: string) => ReactNode | undefined;
}) {
  const fields = getVisibleTopicFields(personaId, topic);

  if (fields.length === 0) {
    return <p className="text-muted text-[length:var(--fs-body)]">Nothing visible here for your role.</p>;
  }

  return (
    <div className="space-y-2">
      {fields.map(({ field, visibility }) => {
        const value = resolveValue?.(field.details);
        return (
          <div
            key={`${field.sourceId ?? field.details}`}
            className="flex items-start justify-between gap-4 rounded-[var(--radius-card)] border border-border-soft bg-bg p-3"
          >
            <div className="min-w-0">
              <div className="text-fg text-[length:var(--fs-body)]">{field.details}</div>
              <div className="text-fg-2 text-[length:var(--fs-body)] mt-0.5">
                {value ?? <span className="text-muted italic">Not available in this environment</span>}
              </div>
            </div>
            <Badge variant={visibility === 'real-time' ? 'success' : 'filled-neutral'}>
              {visibility === 'real-time' ? 'Real Time' : 'Drill Down'}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}
