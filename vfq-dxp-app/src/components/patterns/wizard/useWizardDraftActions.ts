import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useWorkflowStore } from '../../../stores/workflowStore';
import { useNotificationStore } from '../../../stores/notificationStore';
import { useAuthStore } from '../../../stores/authStore';
import * as mockDataEngine from '../../../engines/mockDataEngine';
import { logActivity } from '../../../engines/activityEngine';
import { useCustomerContext } from '../../../stores/customerContextStore';
import type { WizardStep } from './guidedWizardTypes';

/** The customer a draft is for, from whatever the Contact step has captured by now. */
function draftCustomerName(values: Record<string, unknown>): string {
  const c = values.contact as
    | { moiResult?: { name?: string }; firstName?: string; lastName?: string }
    | undefined;
  return c?.moiResult?.name || [c?.firstName, c?.lastName].filter(Boolean).join(' ') || 'New Customer';
}

/** Abandon / Save & Exit / Save draft: dialog state, the draft order row and the activity record. */
export function useWizardDraftActions({
  wizardId,
  title,
  draftActionLabel,
  isMirror,
  draftOrderId,
  values,
  activeSteps,
  currentIndex,
  onAbandon,
  onSaveExit,
}: {
  wizardId: string;
  title: string;
  draftActionLabel: string | undefined;
  isMirror: boolean;
  draftOrderId: string | undefined;
  values: Record<string, unknown>;
  activeSteps: WizardStep[];
  currentIndex: number;
  onAbandon: (() => void) | undefined;
  onSaveExit: (() => void) | undefined;
}) {
  const clearDraft = useWorkflowStore((s) => s.clearDraft);
  const location = useLocation();
  const [abandonOpen, setAbandonOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  // Agent note for the Abandoned (required) / Save & Exit (optional) activity.
  const [activityComments, setActivityComments] = useState('');
  // A step's own Abandon action (e.g. a hard stop) may confirm without offering to keep working.
  const [abandonNoKeep, setAbandonNoKeep] = useState(false);

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
      customerName: useCustomerContext.getState().journey?.customerName ?? draftCustomerName(values),
      idNumber: useCustomerContext.getState().journey?.idNumber,
      stepLabel: activeSteps[currentIndex]?.label,
      comments,
    });

  // Hard Stop: the activity is written automatically as soon as the hard stop is shown, once per stop.
  const hardStopLogged = useRef(false);
  const hardStopShown = Boolean((values.eligibility as { hardStop?: boolean } | undefined)?.hardStop);
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
        draftValues: values,
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
        draftValues: values,
      });
      // A saved draft shows up in the agent's Draft Orders list (a task of type
      // 'Draft Order' linked to the order - the list is built from tasks, and
      // its row click resumes the journey via the order's draftResumePath).
      await mockDataEngine.create('tasks', {
        taskId: `TASK-${Date.now().toString().slice(-6)}`,
        taskName: `${draftCustomerName(values)} – ${draftActionLabel ?? title}`,
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

  return {
    abandonOpen,
    setAbandonOpen,
    exitOpen,
    setExitOpen,
    activityComments,
    setActivityComments,
    abandonNoKeep,
    setAbandonNoKeep,
    abandonOrder,
    saveAndExit,
    saveDraft,
    requestAbandon,
  };
}
