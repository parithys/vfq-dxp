import { useState } from 'react';
import type { ReactNode } from 'react';
import { useWorkflowStore } from '../../stores/workflowStore';
import { Button } from '../primitives/Button';

export interface WizardStep {
  key: string;
  label: string;
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
// Accordion-style, only the active step expanded, persistent "You are here"
// breadcrumb, Continue/Save & Finish/Cancel/Go Back/Abandon Order buttons.
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

  const activeSteps = steps.filter((s) => !s.skip?.(draft.values));
  const currentIndex = Math.min(draft.currentStep, activeSteps.length - 1);
  const currentStep = activeSteps[currentIndex];
  const canProceed = currentStep?.isValid ? currentStep.isValid(draft.values) : true;

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

  const abandon = () => {
    clearDraft(wizardId);
    onAbandon?.();
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-[length:var(--fs-h3)] font-medium text-fg mb-1">{title}</h1>
      <p className="text-[length:var(--fs-caption)] text-muted mb-6">
        You are here: <span className="text-accent font-medium">{currentStep?.label}</span>
      </p>

      <div className="rounded-[var(--radius-card)] border border-border-soft divide-y divide-border-soft bg-bg">
        {activeSteps.map((step, i) => {
          const isActive = i === currentIndex;
          const isDone = i < currentIndex;
          return (
            <div key={step.key}>
              <div
                className={`flex items-center gap-3 px-4 py-3 ${isActive ? 'bg-surface-warm' : ''}`}
              >
                <span
                  className={`flex items-center justify-center w-6 h-6 rounded-[var(--radius-circle)] text-[length:var(--fs-caption)] shrink-0
                    ${isDone ? 'bg-success text-white' : isActive ? 'bg-accent text-accent-on' : 'bg-light-neutral text-muted'}`}
                >
                  {isDone ? '✓' : i + 1}
                </span>
                <span className={isActive ? 'text-fg font-medium' : 'text-fg-2'}>{step.label}</span>
              </div>
              {isActive && (
                <div className="px-4 pb-5 pt-1">
                  {step.render({ values: draft.values, setValue })}
                  <div className="flex items-center justify-between mt-6">
                    <div className="flex gap-2">
                      <Button variant="ghost-rect" onClick={abandon}>
                        Abandon Order
                      </Button>
                      {currentIndex > 0 && (
                        <Button variant="ghost-rect" onClick={goBack}>
                          Go Back
                        </Button>
                      )}
                    </div>
                    <Button variant="primary-rect" onClick={goNext} disabled={!canProceed || submitting}>
                      {submitting ? 'Submitting…' : currentIndex === activeSteps.length - 1 ? 'Save & Finish' : 'Continue'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
