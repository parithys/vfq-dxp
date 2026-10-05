import { useId } from 'react';
import type { ReactNode } from 'react';
import { Icon } from '../../primitives/Icon';

const CHECK_CIRCLE = 'M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4L12 14.01l-3-3';
const CHEVRON_RIGHT = 'M9 18l6-6-6-6';

/** One completed step: a collapsible block titled with the step's rail label, with an Edit action that goes back to it. */
export function StepSummarySection({
  title,
  open,
  onToggle,
  onEdit,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  /** Absent when editing is not allowed (a locked journey). */
  onEdit?: () => void;
  children: ReactNode;
}) {
  const bodyId = useId();
  return (
    <section className="border-b border-border-soft last:border-0">
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex flex-1 min-w-0 items-center gap-2 text-left text-fg font-semibold text-[length:var(--fs-body)] rounded-[var(--radius-sm)] focus:outline-none focus-visible:shadow-[var(--focus-ring)]"
        >
          <Icon path={CHECK_CIRCLE} className="w-4 h-4 shrink-0 text-success" />
          <span className="truncate">{title}</span>
          <Icon path={CHEVRON_RIGHT} className={`w-4 h-4 shrink-0 text-fg-2 transition-transform ${open ? 'rotate-90' : ''}`} />
        </button>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${title}`}
            className="shrink-0 text-accent font-medium text-[length:var(--fs-body)] hover:underline rounded-[var(--radius-sm)] focus:outline-none focus-visible:shadow-[var(--focus-ring)]"
          >
            Edit
          </button>
        )}
      </div>
      {open && (
        <dl id={bodyId} className="px-4 pb-3">
          {children}
        </dl>
      )}
    </section>
  );
}
