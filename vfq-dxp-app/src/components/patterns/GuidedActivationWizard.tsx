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
  const [submitting, setSubmitting] = useState(false);
  const [confirmingAbandon, setConfirmingAbandon] = useState(false);

  const activeSteps = steps.filter((s) => !s.skip?.(draft.values));
  const currentIndex = Math.min(draft.currentStep, activeSteps.length - 1);
  // Falls back to currentStep for drafts persisted before maxStepReached existed.
  const maxReached = Math.min(Math.max(draft.maxStepReached ?? draft.currentStep, currentIndex), activeSteps.length - 1);
  const currentStep = activeSteps[currentIndex];
  const canProceed = currentStep?.isValid ? currentStep.isValid(draft.values) : true;

  // Focus management: move focus to the new step's heading when advancing
  // via Continue/Back, but never steal focus on first mount.
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const hasMountedRef = useRef(false);
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    stepHeadingRef.current?.focus();
  }, [currentIndex]);

  const setValue = (field: string, value: unknown) => setFieldValue(wizardId, field, value);

  const goNext = async () => {
    if (currentIndex < activeSteps.length - 1) {
      setStep(wizardId, currentIndex + 1);
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(draft.values);
      clearDraft(wizardId);
    } finally {
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

        <div className="flex-1 min-w-0 rounded-[var(--radius-card)] border border-border-soft bg-bg p-6" onKeyDown={handleStepKeyDown}>
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
