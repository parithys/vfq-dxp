import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useWorkflowStore } from '../../../stores/workflowStore';
import * as mockDataEngine from '../../../engines/mockDataEngine';
import type { DraftOrderRecord, WizardStep } from './guidedWizardTypes';

export function useJourneyStartResume(wizardId: string, steps: WizardStep[]) {
  const clearDraft = useWorkflowStore((s) => s.clearDraft);
  const hydrateDraft = useWorkflowStore((s) => s.hydrateDraft);
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
}
