import type { WizardStep } from './guidedWizardTypes';
import { Icon } from '../../primitives/Icon';

const CHECK = 'M20 6L9 17l-5-5';

/**
 * The step rail. Done steps get a tick, the active step is highlighted, and steps already reached are
 * clickable unless the journey is locked.
 */
export function WizardRail({
  steps,
  currentIndex,
  maxReached,
  isLocked,
  onGoToStep,
}: {
  steps: WizardStep[];
  currentIndex: number;
  maxReached: number;
  isLocked: boolean;
  onGoToStep: (index: number) => void;
}) {
  // The rail holds its position while the step panel scrolls past it
  // (2026-09-26). Sticky rather than fixed, so it still participates in
  // the layout and cannot overlap the panel at narrow widths.
  //
  // It anchors to <main>, which is the scrolling ancestor (App.tsx
  // gives it overflow-y-auto) - not to the viewport, so the header and
  // breadcrumbs above it scroll away normally.
  //
  // `self-start` matters: the row is `items-start`, but a flex item
  // that stretched to the row's height would have nothing left to
  // stick within, and the rail would simply sit still because it was
  // already as tall as its container. max-h + its own overflow keep a
  // long rail usable on a short viewport instead of clipping its last
  // steps out of reach.
  return (
    <nav aria-label="Journey steps" className="w-72 shrink-0 self-stretch bg-bg">
    <ol className="sticky top-0">
      {steps.map((step, i) => {
        const isActive = i === currentIndex;
        const isDone = i < maxReached;
        // Locked (2026-09-28): the rail stops accepting clicks entirely
        // once the journey has crossed a locksAfter step, regardless of
        // maxReached - "prevent all edits" means the agent cannot jump
        // back to Contact/Plan/etc. to change what was signed against,
        // not merely that Back is hidden.
        const isReachable = !isLocked && !isActive && i <= maxReached;
        return (
          <li
            key={step.key}
            aria-current={isActive ? 'step' : undefined}
            role={isReachable ? 'button' : undefined}
            tabIndex={isReachable ? 0 : undefined}
            aria-label={isReachable ? `Go to ${step.label} step` : undefined}
            onClick={isReachable ? () => onGoToStep(i) : undefined}
            onKeyDown={
              isReachable
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onGoToStep(i);
                    }
                  }
                : undefined
            }
            className={`flex items-start gap-3 px-4 py-4 border-l-2 ${isActive ? 'bg-surface-warm border-l-accent' : 'border-l-transparent'} ${
              isReachable ? 'cursor-pointer hover:bg-surface focus:outline-none focus-visible:shadow-[var(--focus-ring)]' : ''
            }`}
          >
            <span
              className={`flex items-center justify-center w-7 h-7 rounded-[var(--radius-circle)] text-[length:var(--fs-caption)] font-medium shrink-0
                ${isDone ? 'bg-success text-white' : isActive ? 'bg-accent text-accent-on' : 'bg-light-neutral text-muted'}`}
            >
              {isDone ? <Icon path={CHECK} className="w-3.5 h-3.5" strokeWidth={3.5} /> : i + 1}
            </span>
            <div className="min-w-0">
              {/* Every step label is --fg; weight alone marks the active
                  one. The inactive labels were --fg-2, which on the rail's
                  white card read as disabled rather than merely
                  not-current - and reachable steps are clickable, so
                  looking unavailable was wrong. The step's description
                  below stays --muted, so the two lines still separate. */}
              <div className={`truncate text-fg ${isActive ? 'font-semibold' : 'font-medium'}`}>{step.label}</div>
              {step.description && (
                <div className="text-[length:var(--fs-caption)] text-muted mt-0.5 truncate">{step.description}</div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
    </nav>
  );
}
