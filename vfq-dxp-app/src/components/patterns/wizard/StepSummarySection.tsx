import { Button } from '../../../components/primitives/Button';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { Icon } from '../../primitives/Icon';

const CHEVRON_RIGHT = 'M9 18l6-6-6-6';
const FLAG = 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z M4 22v-7';

/** One completed step: a collapsible block titled with the step's rail label, with an Edit action that goes back to it. */
export function StepSummarySection({
  title,
  open,
  onToggle,
  onEdit,
  milestone = false,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  /** Absent when editing is not allowed (a locked journey). */
  onEdit?: () => void;
  /** The step reached a journey milestone: its disc carries a flag in place of the tick. */
  milestone?: boolean;
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
          {/* Completed: a solid green disc with a white tick - or a white flag on an orange disc, when the step reached a journey milestone. */}
          <svg viewBox="0 0 24 24" aria-hidden="true" className="w-5 h-5 shrink-0">
            {/* A milestone step's disc is orange, not the completed green, so it stands apart from the other steps. */}
            <circle cx="12" cy="12" r="12" className={milestone ? 'text-[var(--summary-milestone)]' : 'text-success'} fill="currentColor" />
            {milestone ? (
              <path d={FLAG} transform="translate(6.2 6.2) scale(0.6)" fill="none" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            )}
          </svg>
          <span className="truncate">{title}</span>
          {milestone && <span className="sr-only">(milestone reached)</span>}
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
