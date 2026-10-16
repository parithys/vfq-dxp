import { useEffect, useMemo, useState } from 'react';
import * as mockDataEngine from '../../../engines/mockDataEngine';
import { formatDate } from '../../../lib/format';
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
  returnTo,
  variant = 'aside',
}: {
  /** Completed steps that declare a summary, in step order. */
  completed: CompletedSummaryStep[];
  /** Steps in the journey, for "N of M steps completed". */
  totalSteps: number;
  values: Record<string, unknown>;
  /** Go back to a step. Absent when editing is not allowed. */
  onEdit?: (index: number) => void;
  /** Shown after going back to edit: jumps to the furthest step reached. */
  returnTo?: { label: string; onReturn: () => void };
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
  const percent = totalSteps > 0 ? Math.min(100, Math.round((completed.length / totalSteps) * 100)) : 0;

  const returnButton = returnTo ? (
    <div className="px-4 py-3 border-b border-border-soft">
      <button
        type="button"
        onClick={returnTo.onReturn}
        className="w-full rounded-[var(--radius-button)] border border-[var(--accent-secondary)] bg-bg px-4 py-2 text-[var(--accent-secondary)] font-semibold text-[length:var(--fs-btn-compact)] hover:bg-surface-warm focus:outline-none focus-visible:shadow-[var(--focus-ring)]"
      >
        Return to {returnTo.label}
      </button>
    </div>
  ) : null;

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
                value={formatSummaryValue(f, f.value(values), f.labelFrom ? labels[sourceKey(f.labelFrom)] : undefined, (v) => (v === undefined || v === null || v === '' ? undefined : formatDate(v)))}
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
      <aside aria-label="Summary of completed steps" className="lg:hidden mt-6 card ">
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
        {accordionOpen && <div className="border-t border-border-soft max-h-96 overflow-y-auto">{returnButton}{body}</div>}
      </aside>
    );
  }

  return (
    <aside
      aria-label="Summary of completed steps"
      className="hidden lg:flex lg:flex-col w-80 shrink-0 self-start sticky top-0 max-h-[calc(100vh-11rem)] overflow-hidden my-8 mr-8 card"
    >
      {/* The header stays put; only the sections below it scroll. */}
      <header className="shrink-0 border-b border-on-dark-line-2 bg-charcoal-panel px-4 py-4 text-on-dark [&_.text-fg]:!text-on-dark [&_.text-fg-2]:!text-on-dark-2 [&_.text-muted]:!text-on-dark-3">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-card)] bg-bg text-[var(--brand-plum)] shadow-[var(--shadow-icon-tile)]" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <path d="M9 4h6v3H9z M7 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-1 M9 12h6 M9 16h4" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-fg font-bold text-[length:var(--fs-h5)]">{heading}</h2>
            <p className="text-fg-2 text-[length:var(--fs-caption)]">{count}</p>
          </div>
          <span className="shrink-0 rounded-[var(--radius-pill)] bg-bg px-3 py-1 text-[var(--brand-plum)] font-bold text-[length:var(--fs-caption)] shadow-[var(--shadow-icon-tile)]">{percent}%</span>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-[var(--radius-pill)] bg-bg" role="progressbar" aria-label="Steps completed" aria-valuemin={0} aria-valuemax={totalSteps} aria-valuenow={completed.length}>
            <div className="h-full rounded-[var(--radius-pill)] bg-[var(--brand-plum)] transition-[width] duration-[var(--motion-slow)]" style={{ width: `${percent}%` }} />
          </div>
          <span className="shrink-0 text-muted font-bold uppercase tracking-wide text-[length:var(--fs-micro)]">Progress</span>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {live}
        {returnButton}
        {body}
      </div>
    </aside>
  );
}
