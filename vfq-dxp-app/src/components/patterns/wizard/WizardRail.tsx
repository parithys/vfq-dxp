import { useState } from 'react';
import { PANEL_ICON, RAIL_KEY } from '../../primitives/Tabs';
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
  // Same remembered expanded/collapsed choice as the Customer 360 icon rail.
  const [expanded, setExpanded] = useState(() => localStorage.getItem(RAIL_KEY) !== '0');
  const toggle = () =>
    setExpanded((v) => {
      localStorage.setItem(RAIL_KEY, v ? '0' : '1');
      return !v;
    });
  return (
    <nav aria-label="Journey steps" className={`${expanded ? 'w-64' : 'w-16'} shrink-0 self-stretch bg-bg border-r border-[var(--field-card-border)]`}>
    <div className="sticky top-0">
    <button
      type="button"
      onClick={toggle}
      aria-label={expanded ? 'Collapse steps' : 'Expand steps'}
      title={expanded ? 'Collapse steps' : 'Expand steps'}
      className={`h-12 w-full flex items-center border-b border-border-soft text-fg-2 hover:bg-surface focus:outline-none focus-visible:shadow-[var(--focus-ring)] ${expanded ? 'justify-end px-5' : 'justify-center'}`}
    >
      <Icon path={PANEL_ICON} className="w-5 h-5" />
    </button>
    <ol>
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
            className={`group relative min-h-12 flex items-center border-l-2 border-l-transparent transition-colors ${expanded ? 'px-5 gap-3' : 'justify-center'} ${
              isActive ? 'bg-accent text-accent-on' : 'text-fg-2'
            } ${isReachable ? 'cursor-pointer hover:bg-surface-warm hover:text-accent focus:outline-none focus-visible:shadow-[var(--focus-ring)]' : ''}`}
          >
            <span className={`w-5 shrink-0 text-center text-[length:var(--fs-body)] font-medium ${isDone && !isActive ? 'text-success' : ''}`}>
              {isDone ? <Icon path={CHECK} className="w-5 h-5" strokeWidth={3} /> : i + 1}
            </span>
            {expanded && (
              <div className="min-w-0 py-2">
                <div className={`truncate text-[length:var(--fs-body)] ${isActive ? 'font-semibold' : 'font-medium text-fg'}`}>{step.label}</div>
                {step.description && (
                  <div className={`text-[length:var(--fs-caption)] mt-0.5 truncate ${isActive ? 'text-accent-on' : 'text-muted'}`}>{step.description}</div>
                )}
              </div>
            )}
            {!expanded && (
              // Overlay label, same as the Customer 360 rail: over the page, never shifts the layout.
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute left-0 top-0 z-30 hidden h-full items-center gap-3 pl-[18px] pr-5 whitespace-nowrap rounded-r-[var(--radius-sm)] border border-l-0 border-[var(--field-card-border)] shadow-raised text-[length:var(--fs-body)] opacity-0 transition-opacity duration-100 lg:flex group-hover:opacity-100 group-focus-within:opacity-100 ${
                  isActive ? 'bg-accent text-accent-on font-semibold border-transparent' : 'bg-surface-warm text-fg font-medium'
                }`}
              >
                <span className="w-5 text-center">{isDone ? <Icon path={CHECK} className="w-5 h-5" strokeWidth={3} /> : i + 1}</span>
                {step.label}
              </span>
            )}
          </li>
        );
      })}
    </ol>
    </div>
    </nav>
  );
}
