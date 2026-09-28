import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useWorkflowStore } from '../../stores/workflowStore';
import * as mockDataEngine from '../../engines/mockDataEngine';
import { Button } from '../primitives/Button';
import { Icon } from '../primitives/Icon';
import { Modal } from '../primitives/Modal';
import { useEnterToSubmit } from '../../hooks/useEnterToSubmit';

const CHEVRON_LEFT = 'M15 18l-6-6 6-6';
const CHEVRON_RIGHT = 'M9 18l6-6-6-6';
const CHECK = 'M20 6L9 17l-5-5';

/** The draft-specific half of an order record - see orders.json's _note. */
interface DraftOrderRecord {
  orderId: string;
  draftStepKey?: string;
  draftValues?: Record<string, unknown>;
}

export interface WizardStep {
  key: string;
  label: string;
  /** Short secondary line shown under the label in the step list (e.g. "Customer identification"). Optional - omitted steps just show the label. */
  description?: string;
  render: (ctx: { values: Record<string, unknown>; setValue: (field: string, value: unknown) => void }) => ReactNode;
  /** Return true to auto-skip this step given current draft values (e.g. appointment step skipped for instant activation). */
  skip?: (values: Record<string, unknown>) => boolean;
  /** Return false to block Continue/Save & Finish (e.g. SIM Serial not found/already-assigned per Pattern 11). Defaults to true (no gate) if omitted. */
  isValid?: (values: Record<string, unknown>) => boolean;
  /**
   * Return true to move straight on to the next step without the agent
   * pressing Continue - for a step that only REPORTS a result and needs no
   * input, such as Eligibility, whose seven checks either clear or stop the
   * journey.
   *
   * Fires at most ONCE per step per mount. That matters because the agent can
   * still walk back to the step: without the guard they would be bounced
   * forward again the instant they arrived, making Back unusable for every
   * step behind it.
   */
  autoAdvanceWhen?: (values: Record<string, unknown>) => boolean;
}

interface GuidedActivationWizardProps {
  wizardId: string;
  title: string;
  steps: WizardStep[];
  onSubmit: (values: Record<string, unknown>) => void | Promise<void>;
  /**
   * Where to go once the order is thrown away. Providing this is what puts
   * "Abandon Order" on the header; wizards that omit it render no such action.
   *
   * Restored 2026-09-27. This existed until 2026-09-26, when it was removed on
   * direction ("a half-entered order is left where it is rather than needing an
   * explicit throw-away action") - reinstated on direction again, because a
   * journey that HARD-STOPS at Eligibility leaves the agent with a draft they
   * cannot advance and, without this, no way to be rid of it.
   */
  onAbandon?: () => void;
}

// Pattern 1: Guided Multi-Step Wizard - the single most-repeated shape in the
// entire corpus (SCR-043–050, SCR-121–134, SCR-152–162, SCR-190–192, etc.).
// Left-hand step list (numbered, with a secondary description line) + a
// single content panel for the active step's fields and Back/Continue
// footer - matches the reference layout supplied for this pattern.
export function GuidedActivationWizard({ wizardId, title, steps, onSubmit, onAbandon }: GuidedActivationWizardProps) {
  const draft = useWorkflowStore((s) => s.getDraft(wizardId));
  const setStep = useWorkflowStore((s) => s.setStep);
  const setFieldValue = useWorkflowStore((s) => s.setFieldValue);
  const clearDraft = useWorkflowStore((s) => s.clearDraft);
  const [abandonOpen, setAbandonOpen] = useState(false);
  const hydrateDraft = useWorkflowStore((s) => s.hydrateDraft);
  // Guards against duplicate order submission: onSubmit is async (mock CRUD +
  // navigation) but goNext used to fire-and-forget it without disabling the
  // button, so a second click landing before the first submission's own
  // async work committed would re-read the same not-yet-cleared draft and
  // create a byte-identical second order. Confirmed live: a rapid double
  // click on "Save & Finish" produced two orders with the same ID and fields.
  // `submitting` state alone isn't enough - a second, genuinely-synchronous
  // invocation in the same tick still reads it as stale `false` (a state
  // update isn't visible until the next render), so `submittingRef` backs
  // it for the actual guard while `submitting` still drives the UI (button
  // label/disabled) - same split used in OrderApprovalDetail.tsx et al.
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  // STARTING a journey discards whatever draft was left behind; RESUMING one
  // does not. A journey card navigates with state.startFresh (see
  // JourneyCard), which is the only thing that triggers this - so a
  // mid-journey reload, a step click in the rail, or a back-navigation all
  // still find the agent's work where they left it.
  //
  // The flag is CONSUMED, not just acted on: cleared from history the moment
  // it is honoured, by replacing the current entry with a state-less one.
  //
  // Necessary because React Router persists location.state into
  // history.state, so it survives a page reload - and an in-memory "already
  // handled" ref does not. A reload mid-journey therefore re-read
  // startFresh=true and wiped the agent's work, which is the exact opposite of
  // what this is for. Verified: without the replace, reloading on step 3
  // dropped back to step 1 with the scan gone.
  //
  // Replacing rather than pushing, so Back does not land on an entry that
  // would clear the draft all over again. Same path, so no remount.
  //
  // Runs in an effect because it writes to the store and to history; the ref
  // still guards against a double-fire within one navigation.
  const location = useLocation();
  const navigate = useNavigate();
  const freshenedFor = useRef<string | null>(null);
  useEffect(() => {
    const nav = location.state as { startFresh?: boolean; resumeOrderId?: string } | null;
    if (!nav?.startFresh && !nav?.resumeOrderId) return;
    if (freshenedFor.current === location.key) return;
    freshenedFor.current = location.key;

    const consume = () => navigate(location.pathname + location.search, { replace: true, state: null });

    if (nav.resumeOrderId) {
      // RESUME a stored Draft Order. Its values and step replace the working
      // copy, so the agent lands exactly where that order was left - not
      // wherever this journey's last session happened to stop.
      void mockDataEngine
        .get<DraftOrderRecord>('orders', nav.resumeOrderId)
        .then((order) => {
          if (!order?.draftValues) return;
          // Key, not index: active steps are filtered by each step's skip(),
          // so an index saved against one customer's journey can point at a
          // different step in another's.
          const stepIndex = Math.max(
            steps.filter((st) => !st.skip?.(order.draftValues ?? {})).findIndex((st) => st.key === order.draftStepKey),
            0
          );
          hydrateDraft(wizardId, {
            currentStep: stepIndex,
            maxStepReached: stepIndex,
            values: order.draftValues,
            draftOrderId: order.orderId,
          });
        })
        .finally(consume);
      return;
    }

    clearDraft(wizardId);
    consume();
  }, [
    location.key,
    location.state,
    location.pathname,
    location.search,
    clearDraft,
    hydrateDraft,
    navigate,
    steps,
    wizardId,
  ]);

  // Progress back to the order, on STEP CHANGE rather than on every keystroke.
  // "Resume from the last saved stage" is a statement about steps, and writing
  // on each character would put a mock-store write behind every letter the
  // agent types into a name field.
  const draftOrderId = draft.draftOrderId;
  const savedStepRef = useRef<number | null>(null);
  useEffect(() => {
    if (!draftOrderId) return;
    if (savedStepRef.current === draft.currentStep) return;
    savedStepRef.current = draft.currentStep;
    const activeKey = steps.filter((st) => !st.skip?.(draft.values))[draft.currentStep]?.key;
    if (!activeKey) return;
    void mockDataEngine.update('orders', draftOrderId, {
      draftStepKey: activeKey,
      draftValues: draft.values,
    });
    // draft.values is deliberately absent from the deps: it changes on every
    // keystroke, and this effect only has anything to do when the STEP moves.
    // The values written are still the current ones, read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftOrderId, draft.currentStep, steps]);

  const activeSteps = steps.filter((s) => !s.skip?.(draft.values));
  const currentIndex = Math.min(draft.currentStep, activeSteps.length - 1);
  // Falls back to currentStep for drafts persisted before maxStepReached existed.
  const maxReached = Math.min(Math.max(draft.maxStepReached ?? draft.currentStep, currentIndex), activeSteps.length - 1);
  const currentStep = activeSteps[currentIndex];
  const canProceed = currentStep?.isValid ? currentStep.isValid(draft.values) : true;

  // Focus management: put the cursor in the first field the agent must fill to
  // get past this step - on arrival as well as on every step change, so a
  // walk-in journey starts typing rather than starts hunting.
  //
  // "Mandatory" is resolved from the rendered panel, not from the step
  // definition: `isValid` is an opaque predicate over the draft values, so it
  // can say whether the step passes but not which control is responsible. The
  // first EMPTY editable control in DOM order is that control in practice -
  // DOM order is the visual sequence the agent reads, which is what "the first
  // required field in the sequence" means. Fields already carrying a value
  // (a resumed draft, an MOI-prefilled name) are skipped, so returning to a
  // half-finished step lands on the first thing still outstanding.
  //
  // Radios are INCLUDED: on a step like Plan & Add-ons the mandatory decision
  // IS the radio group, and focusing a radio neither selects it nor blocks
  // anything - arrow keys then walk the options, which is the behaviour you
  // want. Excluded deliberately: [readonly] (the MOI-fetched email, "not
  // editable"), [disabled], hidden inputs, and type=checkbox, which in these
  // journeys is always an optional flag ("B2B2C order") and never the thing
  // gating Continue. Button-group choices (ID Type) are excluded too - they
  // arrive pre-selected, so they are not what is outstanding.
  //
  // Falls back to the step heading when a step has no editable field at all -
  // review, confirmation and summary steps - which preserves the previous
  // behaviour where it still matters: a screen-reader user hears the new step
  // title rather than silence.
  //
  // A single attempt one frame after the step change is NOT enough, which cost
  // two steps before this was observed: Address and Plan & Add-ons build their
  // fields from data they fetch, so at that frame the panel held no focusable
  // control at all. Address ended with focus on <body> - nothing focused, the
  // cursor simply lost - and Plan & Add-ons fell through to the heading while
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
    // watching - so when Zone was disabled a moment later nothing was left to
    // recover the lost cursor.
    let ours: HTMLElement | null = null;

    const tryFocus = () => {
      const active = document.activeElement;
      const candidates = [
        ...panel.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
          'input:not([type="hidden"]):not([type="checkbox"]):not([readonly]):not([disabled]),'
          + ' select:not([disabled]), textarea:not([readonly]):not([disabled])'
        ),
        // offsetParent is null for anything display:none - a step that renders
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
      // Already sitting in a field that is still editable - typing, most
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
    // rAF does not fire at all while the document is hidden - so a journey
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

  // Auto-advance for report-only steps.
  //
  // ONLY ON FIRST FORWARD ARRIVAL, which `maxReached <= currentIndex` is what
  // tests: reaching a step for the first time means nothing further has been
  // reached yet. Walking BACK to it later leaves maxReached ahead of
  // currentIndex, so the agent is not bounced forward again.
  //
  // That condition replaced a per-mount Set of step keys, which looked
  // equivalent and was not: the ref resets on remount, so after any reload or
  // navigation away and back, clicking Eligibility in the step rail threw the
  // agent straight to Address again and the step could never be re-read.
  // maxStepReached lives in the persisted draft, so this guard survives both.
  // Caught by walking back to the step after a reload.
  //
  // The ref is kept as well, purely to stop a double-fire inside one mount
  // while setStep's state update is in flight.
  const autoAdvancedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const step = activeSteps[currentIndex];
    if (!step?.autoAdvanceWhen) return;
    if (maxReached > currentIndex) return;
    if (autoAdvancedRef.current.has(step.key)) return;
    if (!step.autoAdvanceWhen(draft.values)) return;
    autoAdvancedRef.current.add(step.key);
    void goNext();
    // goNext is recreated each render; the two guards above are what bound
    // this, not the dependency list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, maxReached, draft.values, activeSteps]);

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

  // Throw the order away: delete the persisted draft ORDER row (if one was
  // ever created - it only exists once the journey has been saved/resumed),
  // then clear the in-memory/session draft, then hand control back to the
  // caller to navigate away. Order matters: clearing the draft first would
  // lose the draftOrderId this needs.
  const abandonOrder = async () => {
    if (draftOrderId) await mockDataEngine.remove('orders', draftOrderId);
    clearDraft(wizardId);
    setAbandonOpen(false);
    onAbandon?.();
  };

  const goBack = () => {
    if (currentIndex > 0) setStep(wizardId, currentIndex - 1);
  };

  // Any step already reached this session (in either direction) stays
  // reachable - jumping back to edit an earlier step must not strand the
  // user; they can return to the furthest step, or any step in between,
  // without re-walking Continue through steps whose data hasn't changed.
  // Steps beyond maxReached stay unreachable so forward validation gating
  // is still enforced.
  const goToStep = (index: number) => {
    if (index !== currentIndex && index <= maxReached) setStep(wizardId, index);
  };

  const handleStepKeyDown = useEnterToSubmit(canProceed && !submitting, goNext);

  return (
    <div>
      <h1 className="text-[length:var(--fs-h3)] font-medium text-fg mb-6">{title}</h1>

      <span className="sr-only" aria-live="polite">
        {currentStep && `Step ${currentIndex + 1} of ${activeSteps.length}: ${currentStep.label}`}
      </span>

      <div className="flex items-start gap-6">
        {/* The rail holds its position while the step panel scrolls past it
            (2026-09-26). Sticky rather than fixed, so it still participates in
            the layout and cannot overlap the panel at narrow widths.
            
            It anchors to <main>, which is the scrolling ancestor (App.tsx
            gives it overflow-y-auto) - not to the viewport, so the header and
            breadcrumbs above it scroll away normally.
            
            `self-start` matters: the row is `items-start`, but a flex item
            that stretched to the row's height would have nothing left to
            stick within, and the rail would simply sit still because it was
            already as tall as its container. max-h + its own overflow keep a
            long rail usable on a short viewport instead of clipping its last
            steps out of reach. */}
        <ol className="w-72 shrink-0 self-start sticky top-8 max-h-[calc(100vh-8rem)] overflow-y-auto
          rounded-[var(--radius-card)] border border-border-soft divide-y divide-border-soft bg-bg">
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
            {/* "Abandon Order" - removed 2026-09-26, restored 2026-09-27 on
                direction. A plain text action rather than a Button: it is
                destructive and secondary, and giving it button weight next to
                the step heading would set it against Continue as an equal
                choice. Confirmed before it fires, because it discards
                everything the agent has entered. */}
            {onAbandon && (
              <button
                type="button"
                onClick={() => setAbandonOpen(true)}
                className="shrink-0 text-[length:var(--fs-caption)] text-muted underline
                  hover:text-danger focus:outline-none focus-visible:shadow-[var(--focus-ring)]
                  rounded-[var(--radius-button)] px-1"
              >
                Abandon Order
              </button>
            )}
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

      {/* Confirmed, not immediate: this discards every field the agent has
          entered and, once a draft order exists, deletes that row. Modal
          rather than Drawer per Modal.tsx's own note - it is reserved for
          exactly this short confirmation. */}
      <Modal
        open={abandonOpen}
        onClose={() => setAbandonOpen(false)}
        title="Abandon this order?"
        footer={
          <>
            <Button variant="ghost-rect" onClick={() => setAbandonOpen(false)}>
              Keep working
            </Button>
            <Button variant="primary-rect" onClick={() => void abandonOrder()}>
              Abandon Order
            </Button>
          </>
        }
      >
        <p className="text-fg-2 text-[length:var(--fs-body)]">
          Everything entered for this customer will be discarded and the saved draft deleted. This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
