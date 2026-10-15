import { Button } from '../../../components/primitives/Button';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { Icon } from '../../primitives/Icon';

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
          {/* Completed: a solid green disc with a white tick. */}
          <svg viewBox="0 0 24 24" aria-hidden="true" className="w-5 h-5 shrink-0">
            <circle cx="12" cy="12" r="12" className="text-success" fill="currentColor" />
            <path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="truncate">{title}</span>
          <Icon path={CHEVRON_RIGHT} className={`w-4 h-4 shrink-0 text-fg-2 transition-transform ${open ? 'rotate-90' : ''}`} />
        </button>
        {onEdit && (
          <Button variant="tertiary" compact className="shrink-0" onClick={onEdit} aria-label={`Edit ${title}`}>
            Edit
          </Button>
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
