import type { ReactNode } from 'react';
import { Badge } from '../../../components/primitives/Badge';
import { getVisibleTopicFields } from '../../../engines/customer360VisibilityEngine';

/**
 * The single rendering pattern for every Customer 360 tab (2026-09-29
 * rebuild): lists exactly the fields this persona is entitled to see for a
 * customer360-fields.json topic (real-time vs. drill-down, per the
 * visibility engine), each resolved against real Customer 360 data - never
 * a fabricated value. A field with no resolver, or one that returns
 * nothing, says so plainly rather than leaving a blank cell that reads as
 * a loading failure.
 */
export function TopicFieldsSection({
  personaId,
  topic,
  resolveValue,
  richFields,
}: {
  personaId: string | undefined;
  topic: string;
  resolveValue?: (details: string) => ReactNode | undefined;
  /**
   * Fields whose spec value literally IS a list/action surface (e.g. "All
   * Orders", "Bell Icon/Bulk Notes") render the given component full-width
   * below the field's own heading/badge, instead of being squeezed into the
   * flat label/value row every other field gets - that's how every
   * interactive capability that already existed (Create Ticket, Log
   * Interaction, edit drawers, service actions) stays reachable, re-anchored
   * to the specific field it satisfies rather than removed.
   */
  richFields?: Record<string, ReactNode>;
}) {
  const fields = getVisibleTopicFields(personaId, topic);

  if (fields.length === 0) {
    return <p className="text-muted text-[length:var(--fs-body)]">Nothing visible here for your role.</p>;
  }

  return (
    <div className="space-y-4">
      {fields.map(({ field, visibility }, index) => {
        // Not just field.sourceId - a handful of source rows (e.g.
        // "Actiivity (last 5)" under Account Information) repeat the exact
        // same details with sourceId: null, which collided here and made
        // React drop/duplicate one of the two rows.
        const key = `${field.sourceId ?? field.details}-${index}`;
        const rich = richFields?.[field.details];
        const badge = (
          <Badge variant={visibility === 'real-time' ? 'success' : 'filled-neutral'}>
            {visibility === 'real-time' ? 'Real Time' : 'Drill Down'}
          </Badge>
        );

        if (rich !== undefined) {
          return (
            <section key={key} className="rounded-[var(--radius-card)] border border-border-soft bg-bg p-4">
              <div className="flex items-center justify-between gap-4 mb-3">
                <h3 className="text-[length:var(--fs-caption-upper)] uppercase tracking-wide font-semibold text-fg">{field.details}</h3>
                {badge}
              </div>
              {rich}
            </section>
          );
        }

        const value = resolveValue?.(field.details);
        return (
          <div key={key} className="flex items-start justify-between gap-4 rounded-[var(--radius-card)] border border-border-soft bg-bg p-3">
            <div className="min-w-0">
              <div className="text-fg text-[length:var(--fs-body)]">{field.details}</div>
              <div className="text-fg-2 text-[length:var(--fs-body)] mt-0.5">
                {value ?? <span className="text-muted italic">Not available in this environment</span>}
              </div>
            </div>
            {badge}
          </div>
        );
      })}
    </div>
  );
}
