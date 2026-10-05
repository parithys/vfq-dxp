import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useWorkflowStore } from '../../../stores/workflowStore';
import { useNotificationStore } from '../../../stores/notificationStore';
import { useAuthStore } from '../../../stores/authStore';
import * as mockDataEngine from '../../../engines/mockDataEngine';
import { Button } from '../../primitives/Button';
import { Icon } from '../../primitives/Icon';
import { Tooltip } from '../../primitives/Tooltip';
import { logActivity } from '../../../engines/activityEngine';
import { AbandonDialog, SaveExitDialog } from './WizardDialogs';
import { CustomerMirrorPanel } from './CustomerMirrorPanel';
import { WizardRail } from './WizardRail';
import { useCustomerContext } from '../../../stores/customerContextStore';
import { useEnterToSubmit } from '../../../hooks/useEnterToSubmit';
import type { DraftOrderRecord, GuidedActivationWizardProps } from './guidedWizardTypes';


const CHEVRON_LEFT = 'M15 18l-6-6 6-6';
const CHEVRON_RIGHT = 'M9 18l6-6-6-6';

const EYE_ICON = 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z';

// Pattern 1: Guided Multi-Step Wizard - the single most-repeated shape in the
// entire corpus (SCR-043–050, SCR-121–134, SCR-152–162, SCR-190–192, etc.).
// Left-hand step list (numbered, with a secondary description line) + a
// single content panel for the active step's fields and Back/Continue
// footer - matches the reference layout supplied for this pattern.
/** The customer a draft is for, from whatever the Contact step has captured by now. */
function draftCustomerName(values: Record<string, unknown>): string {
  const c = values.contact as
    | { moiResult?: { name?: string }; firstName?: string; lastName?: string }
    | undefined;
  return c?.moiResult?.name || [c?.firstName, c?.lastName].filter(Boolean).join(' ') || 'New Customer';
}

export function GuidedActivationWizard({
  wizardId,
  title,
  titleAside,
  allowCustomerView,
  draftActionLabel,
  steps,
  onSubmit,
  onAbandon,
  hideAbandonFrom,
  onSaveExit,
}: GuidedActivationWizardProps) {
  const draft = useWorkflowStore((s) => s.getDraft(wizardId));
  const setStep = useWorkflowStore((s) => s.setStep);
  const setFieldValue = useWorkflowStore((s) => s.setFieldValue);
  const clearDraft = useWorkflowStore((s) => s.clearDraft);
  const [abandonOpen, setAbandonOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  // Agent note for the Abandoned (required) / Save & Exit (optional) activity.
  const [activityComments, setActivityComments] = useState('');
  // A step's own Abandon action (e.g. a hard stop) may confirm without offering to keep working.
  const [abandonNoKeep, setAbandonNoKeep] = useState(false);
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
          // Eligibility is NEVER carried over from a saved draft: the customer's
          // status may have changed since, so it is re-evaluated on resume.
          const { eligibility: _staleEligibility, ...resumedValues } = order.draftValues;
          hydrateDraft(wizardId, {
            currentStep: stepIndex,
            maxStepReached: stepIndex,
            values: resumedValues,
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
    if (isMirror) return; // the pop-up only displays; it never writes the order
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
  // True while THIS render's active step wants the stripped-down, no-chrome
  // presentation - re-evaluated every render (see the WizardStep doc above),
  // not cached, so it can flip back off within the same step once signed.
  const isCustomerFacing = Boolean(currentStep?.customerFacing?.(draft.values));
  // ---- Customer view as a pop-up window --------------------------------------------------
  // "Customer view" opens THIS journey in a second window (?mirror=1) that follows the agent's
  // screen: the agent window broadcasts its draft (current step and every value) over a
  // BroadcastChannel, and the pop-up shows the step content only, read-only, with none of the
  // agent's chrome. Prototype scope: one browser, one-way (the customer cannot type or sign in
  // the pop-up; the signature is still captured in the agent window).
  const isMirror = allowCustomerView && new URLSearchParams(location.search).get('mirror') === '1';
  const channelName = `vfq-mirror-${wizardId}`;
  const [popupBlocked, setPopupBlocked] = useState(false);
  const popupRef = useRef<Window | null>(null);
  // Toggle: open the pop-up (button shows active), or close it again from the same button.
  const [viewOpen, setViewOpen] = useState(false);
  // Spoken by the polite live region below whenever sharing starts or stops.
  const [shareAnnouncement, setShareAnnouncement] = useState('');
  const stopCustomerView = () => {
    popupRef.current?.close();
    popupRef.current = null;
    setViewOpen(false);
    setShareAnnouncement('Customer view stopped');
  };
  const toggleCustomerView = () => {
    if (viewOpen) {
      stopCustomerView();
      return;
    }
    const url = `${location.pathname}?mirror=1`;
    const w = window.open(url, 'vfq-customer-view', 'popup=yes,width=1100,height=820');
    popupRef.current = w;
    setPopupBlocked(!w);
    setViewOpen(Boolean(w));
    if (w) setShareAnnouncement('Now showing to customer');
  };
  // The customer view can also be closed from its own window: return the button to its default state.
  useEffect(() => {
    if (!viewOpen) return;
    const t = setInterval(() => {
      if (!popupRef.current || popupRef.current.closed) {
        popupRef.current = null;
        setViewOpen(false);
        setShareAnnouncement('Customer view stopped');
      }
    }, 500);
    return () => clearInterval(t);
  }, [viewOpen]);
  // Sharing is for ONE screen: moving to another step stops it and clears the customer's window,
  // so nothing from the next screen is ever shown without the agent choosing to share it.
  const sharedStepKey = currentStep?.key;
  useEffect(() => {
    if (viewOpen) stopCustomerView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedStepKey]);
  // Leaving the journey closes the customer view with it - and so does anything that ends the page:
  // closing the tab, a reload, signing out or a session timeout (both reload, see resetApplicationState).
  useEffect(() => {
    const closeCustomerWindow = () => popupRef.current?.close();
    window.addEventListener('pagehide', closeCustomerWindow);
    return () => {
      window.removeEventListener('pagehide', closeCustomerWindow);
      popupRef.current?.close();
    };
  }, []);
  // Agent window: send the draft whenever it changes, and answer a newly opened pop-up.
  useEffect(() => {
    if (!allowCustomerView || isMirror) return;
    const ch = new BroadcastChannel(channelName);
    const send = () => ch.postMessage({ type: 'draft', draft: useWorkflowStore.getState().getDraft(wizardId) });
    ch.onmessage = (e) => {
      if (e.data?.type === 'hello') send();
      // The customer's pop-up edited a field (the signature step): apply it here.
      else if (e.data?.type === 'set') setFieldValue(wizardId, e.data.field, e.data.value);
    };
    send();
    const unsub = useWorkflowStore.subscribe(send);
    return () => {
      unsub();
      ch.close();
    };
  }, [allowCustomerView, isMirror, channelName, wizardId, setFieldValue]);
  // Pop-up window: follow the agent's draft.
  const mirrorCh = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    if (!isMirror) return;
    const ch = new BroadcastChannel(channelName);
    mirrorCh.current = ch;
    ch.onmessage = (e) => {
      if (e.data?.type === 'draft' && e.data.draft) hydrateDraft(wizardId, e.data.draft);
    };
    ch.postMessage({ type: 'hello' });
    return () => {
      ch.close();
      mirrorCh.current = null;
    };
  }, [isMirror, channelName, wizardId, hydrateDraft]);
  // True once ANY step up to and including the current one has crossed its
  // own locksAfter condition - checked over the whole prefix, not just the
  // current step, so the lock persists once the agent has moved past it
  // (e.g. into Payment) rather than only applying while sitting on the step
  // that triggered it.
  const isLocked = activeSteps.slice(0, currentIndex + 1).some((s) => s.locksAfter?.(draft.values));
  const hideAbandonFromIndex = hideAbandonFrom ? activeSteps.findIndex((s) => s.key === hideAbandonFrom) : -1;
  const abandonHidden = hideAbandonFromIndex !== -1 && currentIndex >= hideAbandonFromIndex;

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
          'input:not([type="hidden"]):not([type="checkbox"]):not([readonly]):not([disabled]):not([data-no-autofocus]),'
          + ' select:not([disabled]):not([data-no-autofocus]), textarea:not([readonly]):not([disabled]):not([data-no-autofocus])'
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
    if (isMirror) return; // the agent's window drives the steps
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
      // Pass over autoPass steps (never past the last step, which submits).
      let next = currentIndex + 1;
      while (next < activeSteps.length - 1 && activeSteps[next].autoPass?.(draft.values)) next++;
      setStep(wizardId, next);
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
  // The activity is created here, automatically - the agent only supplies the optional comment.
  const recordActivity = (trigger: 'abandoned' | 'saved-exit' | 'hard-stop', orderId: string | undefined, comments?: string) =>
    logActivity({
      trigger,
      journey: title,
      orderId,
      // The identified customer for this journey (see customerContextStore), not re-derived.
      customerId: useCustomerContext.getState().journey?.customerId ?? wizardId.match(/existing-(.+)$/)?.[1],
      customerName: useCustomerContext.getState().journey?.customerName ?? draftCustomerName(draft.values),
      idNumber: useCustomerContext.getState().journey?.idNumber,
      stepLabel: activeSteps[currentIndex]?.label,
      comments,
    });

  // Hard Stop: the activity is written automatically as soon as the hard stop is shown, once per stop.
  const hardStopLogged = useRef(false);
  const hardStopShown = Boolean((draft.values.eligibility as { hardStop?: boolean } | undefined)?.hardStop);
  useEffect(() => {
    if (!hardStopShown) {
      hardStopLogged.current = false;
      return;
    }
    if (hardStopLogged.current || isMirror) return;
    hardStopLogged.current = true;
    void recordActivity('hard-stop', draftOrderId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hardStopShown]);

  const abandonOrder = async () => {
    if (!activityComments.trim()) return;
    await recordActivity('abandoned', draftOrderId, activityComments);
    useCustomerContext.getState().endJourney(wizardId);
    setActivityComments('');
    if (draftOrderId) await mockDataEngine.remove('orders', draftOrderId);
    clearDraft(wizardId);
    setAbandonOpen(false);
    onAbandon?.();
  };

  // Explicitly distinct from abandonOrder (2026-09-28 "keep this distinct
  // from saving a draft"): this KEEPS the draft order row rather than
  // deleting it, creating one first if the journey never had one (a brand
  // new, never-resumed journey has no draftOrderId at all - see the
  // step-change effect above, which only ever UPDATES an existing row). No
  // per-wizard order shape is needed here: `title` and `wizardId` are
  // already this component's own props, and `location.pathname` is already
  // the route this wizard is mounted at, so a minimal-but-resumable Draft
  // order row falls out of data this component already has, rather than
  // requiring every wizard to hand it a bespoke record shape.
  // Writes the draft order (creating it on first save) and returns its id.
  const persistDraft = async (): Promise<string | undefined> => {
    const activeKey = activeSteps[currentIndex]?.key;
    if (!activeKey) return undefined;
    if (draftOrderId) {
      await mockDataEngine.update('orders', draftOrderId, {
        draftStepKey: activeKey,
        draftValues: draft.values,
      });
    } else {
      const newOrderId = `ORD-${Date.now().toString().slice(-6)}`;
      await mockDataEngine.create('orders', {
        orderId: newOrderId,
        orderType: title,
        status: 'Draft',
        draftWizardId: wizardId,
        draftResumePath: location.pathname,
        draftStepKey: activeKey,
        draftValues: draft.values,
      });
      // A saved draft shows up in the agent's Draft Orders list (a task of type
      // 'Draft Order' linked to the order - the list is built from tasks, and
      // its row click resumes the journey via the order's draftResumePath).
      await mockDataEngine.create('tasks', {
        taskId: `TASK-${Date.now().toString().slice(-6)}`,
        taskName: `${draftCustomerName(draft.values)} – ${draftActionLabel ?? title}`,
        taskDescription: 'Draft order saved but not submitted.',
        taskType: 'Draft Order',
        taskStatus: 'Open',
        priorityFlag: false,
        assignedAgentId: useAuthStore.getState().profile?.userId ?? null,
        relatedOrderId: newOrderId,
        createdAt: new Date().toISOString(),
      });
      return newOrderId;
    }
    return draftOrderId;
  };

  const saveAndExit = async (comments?: string) => {
    const id = await persistDraft();
    if (!id) return;
    await recordActivity('saved-exit', id, comments);
    useCustomerContext.getState().endJourney(wizardId);
    clearDraft(wizardId);
    onSaveExit?.();
  };

  // Save: writes the draft order, confirms with a toast and clears the in-memory draft (the saved
  // order now holds it). The caller decides where to go next.
  const saveDraft = async () => {
    const id = await persistDraft();
    if (!id) return;
    await recordActivity('saved-exit', id);
    useCustomerContext.getState().endJourney(wizardId);
    clearDraft(wizardId);
    useNotificationStore.getState().pushToast('success', 'Draft saved', { key: `draft-saved-${wizardId}`, detail: 'This order can be resumed from Draft Orders.' });
  };

  const requestAbandon = () => {
    setAbandonNoKeep(false);
    setAbandonOpen(true);
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

  const goToStepKey = (key: string) => {
    const index = activeSteps.findIndex((s) => s.key === key);
    if (index !== -1) goToStep(index);
  };

  const handleStepKeyDown = useEnterToSubmit(canProceed && !submitting, goNext);

  // The abandon confirmation, shared by the normal layout and the customer-facing one.
  const abandonModal = (
    <AbandonDialog
      open={abandonOpen}
      noKeep={abandonNoKeep}
      comments={activityComments}
      onCommentsChange={setActivityComments}
      onClose={() => setAbandonOpen(false)}
      onConfirm={() => void abandonOrder()}
    />
  );

  // Save & Exit: confirms with an optional comment, then saves the draft and records the activity.
  const exitModal = (
    <SaveExitDialog
      open={exitOpen}
      comments={activityComments}
      onCommentsChange={setActivityComments}
      onClose={() => setExitOpen(false)}
      onConfirm={() => {
        setExitOpen(false);
        void saveAndExit(activityComments).then(() => setActivityComments(''));
      }}
    />
  );

  // Customer-facing: ONLY this step's own render() output, full stop. No
  // rail (which names every other step and product discussed), no Abandon/
  // Save & Exit, no wizard Back/Continue footer - the step's own content is
  // responsible for whatever action it needs (e.g. CafSignatureCapture's own
  // "Please Sign"), because nothing here should invite the customer to
  // interact with wizard chrome meant for the agent.
  if (isMirror) {
    // The customer's pop-up. Scrollable everywhere. Read-only on every step except CAF & Signature,
    // where the customer reads the terms, ticks the agreement and signs: those edits are sent to the
    // agent's window, which owns the order.
    const interactive = currentStep?.key === 'caf';
    const mirrorSetValue = (field: string, value: unknown) => {
      setFieldValue(wizardId, field, value);
      mirrorCh.current?.postMessage({ type: 'set', field, value });
    };
    return (
      <div className="p-8">
        <CustomerMirrorPanel step={currentStep} values={draft.values} interactive={interactive} onSetValue={mirrorSetValue} />
      </div>
    );
  }
  if (isCustomerFacing) {
    return (
      <div className="max-w-2xl mx-auto p-8" onKeyDown={handleStepKeyDown}>
        {currentStep?.render({ values: draft.values, setValue, goNext: () => void goNext(), goToStepKey, saveDraft, saveAndExit, requestAbandon })}
        {abandonModal}
      </div>
    );
  }

  // Save & Exit and Abandon Order sit in the page's title row, at the right.
  const exitLinks = (
    <>
              {/* "Save & Exit" (2026-09-28) - distinct from Abandon: this
                  keeps the draft for later resumption rather than deleting
                  it. No confirmation modal, unlike Abandon - it is not
                  destructive, so it should not carry the same weight. Stays
                  available even once locked: a signed-but-unpaid order is
                  exactly the kind of thing an agent needs to be able to set
                  aside and come back to. */}
              {onSaveExit && (
                <Button
                  variant="secondary-rect"
                  compact
                  onClick={() => {
                    setActivityComments('');
                    setExitOpen(true);
                  }}
                >
                  Save & Exit
                </Button>
              )}
              {/* "Abandon Order" - removed 2026-09-26, restored 2026-09-27 on
                  direction. A ghost (tertiary) button as of 2026-10-04, with Save & Exit as
                  the secondary button; neither is primary, so neither competes with Continue. Confirmed before it fires, because it discards
                  everything the agent has entered. Hidden from hideAbandonFrom
                  onward (2026-09-28) - see that prop's own note. */}
              {onAbandon && !abandonHidden && (
                <Button
                  variant="ghost-rect"
                  compact
                  onClick={() => {
                    setAbandonNoKeep(false);
                    setAbandonOpen(true);
                  }}
                >
                  Abandon Order
                </Button>
              )}
    </>
  );

  return (
    <div>
      {/* Title area: carries the page's own padding and a bottom border, so the step rail below it can sit flush against the left edge. */}
      <div className="px-8 pt-8 pb-6 bg-bg border-b border-[var(--field-card-border)]">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-[length:var(--fs-h3)] font-medium text-fg">{title}</h1>
          <div className="flex items-center gap-3">
            {exitLinks}
          </div>
        </div>
        {/* The fixed customer for this journey sits under the title. */}
        {titleAside && <div className="mt-3">{titleAside}</div>}
        {popupBlocked && (
          <p role="alert" className="text-[var(--warn-text)] text-[length:var(--fs-caption)] mt-3">
            The browser blocked the customer view pop-up. Allow pop-ups for this site and try again.
          </p>
        )}
      </div>

      <span className="sr-only" aria-live="polite" role="status">
        {shareAnnouncement}
      </span>
      <span className="sr-only" aria-live="polite">
        {currentStep && `Step ${currentIndex + 1} of ${activeSteps.length}: ${currentStep.label}`}
      </span>

      <div className="flex items-stretch">
        {!currentStep?.hideRail && (
          <WizardRail steps={activeSteps} currentIndex={currentIndex} maxReached={maxReached} isLocked={isLocked} onGoToStep={goToStep} />
        )}

        <div
          ref={stepPanelRef}
          className={`flex-1 min-w-0 m-8 rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg p-6 ${viewOpen ? 'outline outline-2 outline-accent' : ''}`}
          onKeyDown={handleStepKeyDown}
        >
          {/* Title left, Customer view right and vertically centred with it; the button wraps below the title when the row is too narrow. */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-4">
            <div>
              <h2
                ref={stepHeadingRef}
                tabIndex={-1}
                className="text-[length:var(--fs-h4)] font-bold text-fg focus:outline-none focus-visible:shadow-[var(--focus-ring)]"
              >
                {currentStep?.heading ?? currentStep?.label}
              </h2>
              {currentStep?.subheading && (
                <p className="text-fg-2 text-[length:var(--fs-body)] mt-1">{currentStep.subheading}</p>
              )}
            </div>
            {allowCustomerView && !currentStep?.hideCustomerView && (
              <div className="flex items-center gap-3">
                {/* Says which content the customer can see; the container's outline says where it ends. */}
                {viewOpen && (
                  <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-surface-warm px-2.5 py-0.5 text-accent text-[length:var(--fs-tag)] font-medium">
                    <Icon path={EYE_ICON} className="w-3.5 h-3.5" />
                    Visible to customer
                  </span>
                )}
                <Tooltip
                  content={viewOpen ? 'The customer can see this section. Click to stop sharing.' : 'Show this section to the customer'}
                  placement="bottom"
                >
                  <Button variant={viewOpen ? 'primary-rect' : 'secondary-rect'} compact onClick={toggleCustomerView} aria-pressed={viewOpen}>
                    {viewOpen && (
                      <span aria-hidden="true" className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-75 motion-safe:animate-ping" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                      </span>
                    )}
                    <Icon path={EYE_ICON} className="w-4 h-4" />
                    {viewOpen ? 'Showing to customer' : 'Customer view'}
                  </Button>
                </Tooltip>
              </div>
            )}
          </div>
          {currentStep?.render({ values: draft.values, setValue, goNext: () => void goNext(), goToStepKey, saveDraft, saveAndExit, requestAbandon })}
          <div className="flex items-center justify-between mt-6 pt-6 border-t border-border-soft">
            <div className="flex items-center gap-3">
              {/* Locked (2026-09-28): Back disappears entirely alongside the
                  rail going unclickable - "disable/remove Back navigation".
                  currentIndex > 0 alone would still show it on Payment even
                  though the rail behind it is frozen. */}
              {currentIndex > 0 && !isLocked && (
                <Button variant="ghost-rect" onClick={goBack}>
                  <Icon path={CHEVRON_LEFT} className="w-4 h-4" />
                  Back
                </Button>
              )}
              {currentStep?.footerLeft?.({ values: draft.values })}
            </div>
            {(() => {
              const defaultButton = (
                <Button variant="primary-rect" onClick={goNext} disabled={!canProceed || submitting}>
                  {submitting ? 'Submitting…' : currentIndex === activeSteps.length - 1 ? 'Save & Finish' : 'Continue'}
                  {!submitting && <Icon path={CHEVRON_RIGHT} className="w-4 h-4" />}
                </Button>
              );
              return (
                currentStep?.primaryAction?.({
                  values: draft.values,
                  setValue,
                  goNext: () => void goNext(),
                  abandon: (opts) => {
                    setAbandonNoKeep(Boolean(opts?.hideKeepWorking));
                    setAbandonOpen(true);
                  },
                  defaultButton,
                }) ?? defaultButton
              );
            })()}
          </div>
        </div>
      </div>

      {/* Confirmed, not immediate: this discards every field the agent has
          entered and, once a draft order exists, deletes that row. Modal
          rather than Drawer per Modal.tsx's own note - it is reserved for
          exactly this short confirmation. */}
      {abandonModal}
      {exitModal}
    </div>
  );
}
