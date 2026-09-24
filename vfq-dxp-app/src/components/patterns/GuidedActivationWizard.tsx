import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useWorkflowStore } from '../../stores/workflowStore';
import { Button } from '../primitives/Button';
import { Icon } from '../primitives/Icon';
import { Modal } from '../primitives/Modal';
import { useEnterToSubmit } from '../../hooks/useEnterToSubmit';

const CHEVRON_LEFT = 'M15 18l-6-6 6-6';
const CHEVRON_RIGHT = 'M9 18l6-6-6-6';
const CHECK = 'M20 6L9 17l-5-5';

export interface WizardStep {
  key: string;
  label: string;
  /** Short secondary line shown under the label in the step list (e.g. "Customer identification"). Optional — omitted steps just show the label. */
  description?: string;
  render: (ctx: { values: Record<string, unknown>; setValue: (field: string, value: unknown) => void }) => ReactNode;
  /** Return true to auto-skip this step given current draft values (e.g. appointment step skipped for instant activation). */
  skip?: (values: Record<string, unknown>) => boolean;
  /** Return false to block Continue/Save & Finish (e.g. SIM Serial not found/already-assigned per Pattern 11). Defaults to true (no gate) if omitted. */
  isValid?: (values: Record<string, unknown>) => boolean;
}

interface GuidedActivationWizardProps {
  wizardId: string;
  title: string;
  steps: WizardStep[];
  onSubmit: (values: Record<string, unknown>) => void | Promise<void>;
  onAbandon?: () => void;
}

// Pattern 1: Guided Multi-Step Wizard — the single most-repeated shape in the
// entire corpus (SCR-043–050, SCR-121–134, SCR-152–162, SCR-190–192, etc.).
// Left-hand step list (numbered, with a secondary description line) + a
// single content panel for the active step's fields and Back/Continue
// footer — matches the reference layout supplied for this pattern.
export function GuidedActivationWizard({ wizardId, title, steps, onSubmit, onAbandon }: GuidedActivationWizardProps) {
  const draft = useWorkflowStore((s) => s.getDraft(wizardId));
  const setStep = useWorkflowStore((s) => s.setStep);
  const setFieldValue = useWorkflowStore((s) => s.setFieldValue);
  const clearDraft = useWorkflowStore((s) => s.clearDraft);
  // Guards against duplicate order submission: onSubmit is async (mock CRUD +
  // navigation) but goNext used to fire-and-forget it without disabling the
  // button, so a second click landing before the first submission's own
  // async work committed would re-read the same not-yet-cleared draft and
  // create a byte-identical second order. Confirmed live: a rapid double
  // click on "Save & Finish" produced two orders with the same ID and fields.
  // `submitting` state alone isn't enough — a second, genuinely-synchronous
  // invocation in the same tick still reads it as stale `false` (a state
  // update isn't visible until the next render), so `submittingRef` backs
  // it for the actual guard while `submitting` still drives the UI (button
  // label/disabled) — same split used in OrderApprovalDetail.tsx et al.
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [confirmingAbandon, setConfirmingAbandon] = useState(false);

  const activeSteps = steps.filter((s) => !s.skip?.(draft.values));
  const currentIndex = Math.min(draft.currentStep, activeSteps.length - 1);
  // Falls back to currentStep for drafts persisted before maxStepReached existed.
  const maxReached = Math.min(Math.max(draft.maxStepReached ?? draft.currentStep, currentIndex), activeSteps.length - 1);
  const currentStep = activeSteps[currentIndex];
  const canProceed = currentStep?.isValid ? currentStep.isValid(draft.values) : true;

  // Focus management: put the cursor in the first field the agent must fill to
  // get past this step — on arrival as well as on every step change, so a
  // walk-in journey starts typing rather than starts hunting.
  //
  // "Mandatory" is resolved from the rendered panel, not from the step
  // definition: `isValid` is an opaque predicate over the draft values, so it
  // can say whether the step passes but not which control is responsible. The
  // first EMPTY editable control in DOM order is that control in practice —
  // DOM order is the visual sequence the agent reads, which is what "the first
  // required field in the sequence" means. Fields already carrying a value
  // (a resumed draft, an MOI-prefilled name) are skipped, so returning to a
  // half-finished step lands on the first thing still outstanding.
  //
  // Radios are INCLUDED: on a step like Plan & Add-ons the mandatory decision
  // IS the radio group, and focusing a radio neither selects it nor blocks
  // anything — arrow keys then walk the options, which is the behaviour you
  // want. Excluded deliberately: [readonly] (the MOI-fetched email, "not
  // editable"), [disabled], hidden inputs, and type=checkbox, which in these
  // journeys is always an optional flag ("B2B2C order") and never the thing
  // gating Continue. Button-group choices (ID Type) are excluded too — they
  // arrive pre-selected, so they are not what is outstanding.
  //
  // Falls back to the step heading when a step has no editable field at all —
  // review, confirmation and summary steps — which preserves the previous
  // behaviour where it still matters: a screen-reader user hears the new step
  // title rather than silence.
  //
  // A single attempt one frame after the step change is NOT enough, which cost
  // two steps before this was observed: Address and Plan & Add-ons build their
  // fields from data they fetch, so at that frame the panel held no focusable
  // control at all. Address ended with focus on <body> — nothing focused, the
  // cursor simply lost — and Plan & Add-ons fell through to the heading while
  // its plan radios were still in flight. So the first attempt runs on the
  // next frame and a MutationObserver keeps watching the panel, claiming the
  // first field the moment it mounts.
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const stepPanelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const panel = stepPanelRef.current;
    if (!panel) return;
    let observer: MutationObserver | undefined;
    // The element THIS effect focused, as opposed to one the agent chose.
    // Without the distinction the "don't steal focus" check below tore the
    // observer down on its own success: it focused Zone, the next mutation saw
    // a real control focused, concluded the agent had taken over and stopped
    // watching — so when Zone was disabled a moment later nothing was left to
    // recover the lost cursor.
    let ours: HTMLElement | null = null;

    const tryFocus = () => {
      const active = document.activeElement;
      const candidates = [
        ...panel.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
          'input:not([type="hidden"]):not([type="checkbox"]):not([readonly]):not([disabled]),'
          + ' select:not([disabled]), textarea:not([readonly]):not([disabled])'
        ),
        // offsetParent is null for anything display:none — a step that renders
        // a collapsed branch must not pull focus into the hidden half.
      ].filter((el) => el.offsetParent !== null);
      // "Still outstanding" is per control type: a text/select control is
      // outstanding while its value is empty, but a radio always carries a
      // non-empty `value` attribute, so for one the question is whether its
      // GROUP has a selection yet. Without this split a radio could never
      // look outstanding and an unanswered plan choice would rank below an
      // already-filled text field.
      const outstanding = (el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) => {
        if (el instanceof HTMLInputElement && el.type === 'radio') {
          return el.name
            ? !panel.querySelector(`input[type="radio"][name="${el.name}"]:checked`)
            : !el.checked;
        }
        return !el.value;
      };
      // Leave the agent alone once they are in a control of their own
      // choosing, and stop watching for the rest of the step.
      const agentOwnsFocus =
        active
        && active !== document.body
        && active !== stepHeadingRef.current
        && active !== ours;
      if (agentOwnsFocus) {
        observer?.disconnect();
        return;
      }
      // Already sitting in a field that is still editable — typing, most
      // likely. Don't reshuffle, but keep watching in case it gets disabled.
      if (active === ours && candidates.some((c) => c === ours)) return;

      const target = candidates.find(outstanding) ?? candidates[0];
      // No focusable field (all disabled, or a review step): the heading, so
      // the step is still announced and focus is never left on <body>.
      const next = target ?? stepHeadingRef.current;
      if (next && next !== active) {
        next.focus();
        ours = next;
      }
    };

    // setTimeout, not requestAnimationFrame: this only needs to run after the
    // step's own initial render has settled, which a macrotask gives it, and
    // rAF does not fire at all while the document is hidden — so a journey
    // opened in a background tab would never have had its first field focused.
    // Focus needs no paint, so there is nothing rAF buys here.
    const firstAttempt = setTimeout(tryFocus, 0);
    observer = new MutationObserver(tryFocus);
    // `attributes` matters as much as `childList`, and is what a first pass
    // missed. On the Address step all four inputs mount empty and enabled, so
    // Zone takes focus; the MOI address lookup then resolves and marks the
    // address fetched-from-MOI, which DISABLES all four. A browser blurs a
    // focused element the moment it becomes disabled, so focus landed on
    // <body> and the cursor was simply lost. Watching the disabled attribute
    // re-runs the choice, which correctly finds no field left to fill and
    // falls back to the heading.
    observer.observe(panel, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled'],
    });
    // Bounded: stop watching rather than sit armed for the life of the step,
    // which would let a much later re-render (a lookup result, a validation
    // message) move the cursor long after the agent has oriented themselves.
    const stopWatching = setTimeout(() => observer?.disconnect(), 4000);

    return () => {
      clearTimeout(firstAttempt);
      clearTimeout(stopWatching);
      observer?.disconnect();
    };
  }, [currentIndex]);

  const setValue = (field: string, value: unknown) => setFieldValue(wizardId, field, value);

  const goNext = async () => {
    if (currentIndex < activeSteps.length - 1) {
      setStep(wizardId, currentIndex + 1);
      return;
    }
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await onSubmit(draft.values);
      clearDraft(wizardId);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const goBack = () => {
    if (currentIndex > 0) setStep(wizardId, currentIndex - 1);
  };

  // Any step already reached this session (in either direction) stays
  // reachable — jumping back to edit an earlier step must not strand the
  // user; they can return to the furthest step, or any step in between,
  // without re-walking Continue through steps whose data hasn't changed.
  // Steps beyond maxReached stay unreachable so forward validation gating
  // is still enforced.
  const goToStep = (index: number) => {
    if (index !== currentIndex && index <= maxReached) setStep(wizardId, index);
  };

  const abandon = () => {
    clearDraft(wizardId);
    setConfirmingAbandon(false);
    onAbandon?.();
  };

  const handleStepKeyDown = useEnterToSubmit(canProceed && !submitting, goNext);

  return (
    <div className="max-w-5xl">
      <h1 className="text-[length:var(--fs-h3)] font-medium text-fg mb-6">{title}</h1>

      <span className="sr-only" aria-live="polite">
        {currentStep && `Step ${currentIndex + 1} of ${activeSteps.length}: ${currentStep.label}`}
      </span>

      <div className="flex items-start gap-6">
        <ol className="w-72 shrink-0 rounded-[var(--radius-card)] border border-border-soft divide-y divide-border-soft bg-bg overflow-hidden">
          {activeSteps.map((step, i) => {
            const isActive = i === currentIndex;
            const isDone = i < maxReached;
            const isReachable = !isActive && i <= maxReached;
            return (
              <li
                key={step.key}
                aria-current={isActive ? 'step' : undefined}
                role={isReachable ? 'button' : undefined}
                tabIndex={isReachable ? 0 : undefined}
                aria-label={isReachable ? `Go to ${step.label} step` : undefined}
                onClick={isReachable ? () => goToStep(i) : undefined}
                onKeyDown={
                  isReachable
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          goToStep(i);
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
                  {isDone ? <Icon path={CHECK} className="w-3.5 h-3.5" /> : i + 1}
                </span>
                <div className="min-w-0">
                  <div className={`truncate ${isActive ? 'text-fg font-semibold' : 'text-fg-2 font-medium'}`}>{step.label}</div>
                  {step.description && (
                    <div className="text-[length:var(--fs-caption)] text-muted mt-0.5 truncate">{step.description}</div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        <div
          ref={stepPanelRef}
          className="flex-1 min-w-0 rounded-[var(--radius-card)] border border-border-soft bg-bg p-6"
          onKeyDown={handleStepKeyDown}
        >
          <div className="flex items-start justify-between gap-4 mb-4">
            <h2
              ref={stepHeadingRef}
              tabIndex={-1}
              className="text-[length:var(--fs-h4)] font-bold text-fg focus:outline-none focus-visible:shadow-[var(--focus-ring)]"
            >
              {currentStep?.label}
            </h2>
            {/* Secondary/destructive action, deliberately understated (plain
                text, no border/fill) and placed top-right so it doesn't
                compete with the primary Continue action in the footer. */}
            <button
              type="button"
              onClick={() => setConfirmingAbandon(true)}
              className="shrink-0 text-[length:var(--fs-caption)] text-muted hover:text-danger transition-colors"
            >
              Abandon Order
            </button>
          </div>
          {currentStep?.render({ values: draft.values, setValue })}
          <div className="flex items-center justify-between mt-6 pt-6 border-t border-border-soft">
            <div>
              {currentIndex > 0 && (
                <Button variant="ghost-rect" onClick={goBack}>
                  <Icon path={CHEVRON_LEFT} className="w-4 h-4" />
                  Back
                </Button>
              )}
            </div>
            <Button variant="primary-rect" onClick={goNext} disabled={!canProceed || submitting}>
              {submitting ? 'Submitting…' : currentIndex === activeSteps.length - 1 ? 'Save & Finish' : 'Continue'}
              {!submitting && <Icon path={CHEVRON_RIGHT} className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>

      <Modal
        open={confirmingAbandon}
        onClose={() => setConfirmingAbandon(false)}
        title="Abandon this order?"
        footer={
          <>
            <Button variant="ghost-rect" onClick={() => setConfirmingAbandon(false)}>
              Cancel
            </Button>
            <Button variant="primary-rect" onClick={abandon} className="bg-danger enabled:hover:bg-danger enabled:active:bg-danger">
              Discard order
            </Button>
          </>
        }
      >
        <p className="text-fg-2">This will discard everything entered in this order so far. This cannot be undone.</p>
      </Modal>
    </div>
  );
}
