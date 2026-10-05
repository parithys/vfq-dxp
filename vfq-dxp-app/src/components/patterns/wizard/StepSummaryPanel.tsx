import { useEffect, useMemo, useState } from 'react';
import * as mockDataEngine from '../../../engines/mockDataEngine';
import { fmtDate } from '../../../workspace/customer360/sections/C360Kit';
import { StepSummarySection } from './StepSummarySection';
import { SummaryFieldRow } from './SummaryFieldRow';
import { formatSummaryValue } from './stepSummary';
import type { SummaryField, SummaryLabelSource } from './stepSummary';
import type { WizardStep } from './guidedWizardTypes';

export interface CompletedSummaryStep {
  index: number;
  step: WizardStep;
}

const sourceKey = (s: SummaryLabelSource) => `${s.kind}|${s.idField}|${s.labelField}`;

/** id -> label maps for every data-backed field in view. Loaded once per source; nothing about the order is copied. */
function useSummaryLabels(fields: SummaryField[]) {
  const [labels, setLabels] = useState<Record<string, Record<string, string>>>({});
  const sources = useMemo(() => {
    const m = new Map<string, SummaryLabelSource>();
    for (const f of fields) if (f.labelFrom) m.set(sourceKey(f.labelFrom), f.labelFrom);
    return [...m.values()];
  }, [fields]);
  useEffect(() => {
    let cancelled = false;
    for (const s of sources) {
      void mockDataEngine.list<Record<string, unknown>>(s.kind).then((rows) => {
        if (cancelled) return;
        const map: Record<string, string> = {};
        for (const r of rows) map[String(r[s.idField])] = String(r[s.labelField] ?? r[s.idField]);
        setLabels((prev) => ({ ...prev, [sourceKey(s)]: map }));
      });
    }
    return () => {
      cancelled = true;
    };
  }, [sources]);
  return labels;
}

/**
 * Running summary of the steps already completed. Everything shown is derived on render from the wizard's single
 * draft-values object and each step's own `summary` declaration, so an edit to an earlier step shows immediately and
 * a new step or field appears here without touching this component.
 */
export function StepSummaryPanel({
  completed,
  totalSteps,
  values,
  onEdit,
  variant = 'aside',
}: {
  /** Completed steps that declare a summary, in step order. */
  completed: CompletedSummaryStep[];
  /** Steps in the journey, for "N of M steps completed". */
  totalSteps: number;
  values: Record<string, unknown>;
  /** Go back to a step. Absent when editing is not allowed. */
  onEdit?: (index: number) => void;
  /** 'aside': the fixed side panel. 'accordion': the collapsible block shown above the action buttons on small screens. */
  variant?: 'aside' | 'accordion';
}) {
  const [openOverride, setOpenOverride] = useState<Record<string, boolean>>({});
  const [accordionOpen, setAccordionOpen] = useState(false);
  const lastKey = completed.at(-1)?.step.key;
  const isOpen = (key: string) => openOverride[key] ?? key === lastKey;

  const allFields = useMemo(() => completed.flatMap((c) => c.step.summary ?? []), [completed]);
  const labels = useSummaryLabels(allFields);

  const heading = `Summary`;
  const count = `${completed.length} of ${totalSteps} steps completed`;

  const body =
    completed.length === 0 ? (
      <p className="px-4 py-6 text-muted text-[length:var(--fs-body)]">Your details will appear here as you complete each step.</p>
    ) : (
      completed.map(({ index, step }) => (
        <StepSummarySection
          key={step.key}
          title={step.label}
          open={isOpen(step.key)}
          onToggle={() => setOpenOverride((o) => ({ ...o, [step.key]: !isOpen(step.key) }))}
          onEdit={onEdit ? () => onEdit(index) : undefined}
        >
          {(step.summary ?? [])
            .filter((f) => f.when?.(values) !== false)
            .map((f) => (
              <SummaryFieldRow
                key={f.key}
                label={f.label}
                value={formatSummaryValue(f, f.value(values), f.labelFrom ? labels[sourceKey(f.labelFrom)] : undefined, fmtDate)}
              />
            ))}
        </StepSummarySection>
      ))
    );

  const live = (
    <span className="sr-only" aria-live="polite" role="status">
      {completed.length === 0 ? 'No steps completed yet.' : `Summary updated: ${count}.`}
    </span>
  );

  if (variant === 'accordion') {
    return (
      <aside aria-label="Summary of completed steps" className="lg:hidden mt-6 rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg">
        <button
          type="button"
          onClick={() => setAccordionOpen((o) => !o)}
          aria-expanded={accordionOpen}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left rounded-[var(--radius-card)] focus:outline-none focus-visible:shadow-[var(--focus-ring)]"
        >
          <span className="text-fg font-semibold text-[length:var(--fs-body)]">{accordionOpen ? 'Hide summary' : 'View summary'}</span>
          <span className="text-fg-2 text-[length:var(--fs-caption)]">{count}</span>
        </button>
        {live}
        {accordionOpen && <div className="border-t border-border-soft max-h-96 overflow-y-auto">{body}</div>}
      </aside>
    );
  }

  return (
    <aside
      aria-label="Summary of completed steps"
      className="hidden lg:block w-80 shrink-0 self-start sticky top-0 max-h-screen overflow-y-auto my-8 mr-8 rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg"
    >
      <header className="sticky top-0 z-10 bg-bg border-b border-border-soft px-4 py-3">
        <h2 className="text-fg font-bold text-[length:var(--fs-h5)]">{heading}</h2>
        <p className="text-fg-2 text-[length:var(--fs-caption)]">{count}</p>
      </header>
      {live}
      {body}
    </aside>
  );
}
