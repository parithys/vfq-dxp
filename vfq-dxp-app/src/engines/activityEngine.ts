import * as mockDataEngine from './mockDataEngine';
import { useAuthStore } from '../stores/authStore';

// One place that writes the activity a customer journey leaves behind, so an agent never has to
// log it by hand. Every activity gets a generated unique ID; its name and reason come from the
// journey and the event that triggered it. Only Abandoned and Save & Exit carry agent comments;
// an Abandoned comment is mandatory (blank or whitespace-only is rejected), Save & Exit's is optional.

export type ActivityTrigger = 'completed' | 'abandoned' | 'saved-exit' | 'workflow-event' | 'hard-stop';

const OUTCOME: Record<ActivityTrigger, { verb: string; status: string; outcome: string }> = {
  completed: { verb: 'Completed', status: 'Solved', outcome: 'Order Created' },
  abandoned: { verb: 'Abandoned', status: 'Abandoned', outcome: 'Abandoned' },
  'saved-exit': { verb: 'Saved & Exited', status: 'Open', outcome: 'Save & Exit' },
  'workflow-event': { verb: 'Workflow Approval', status: 'Open', outcome: 'Workflow Approval' },
  'hard-stop': { verb: 'Hard Stop', status: 'Closed', outcome: 'Hard Stop' },
};

export interface ActivityInput {
  trigger: ActivityTrigger;
  /** The journey, e.g. "New Postpaid Connection". */
  journey: string;
  /** Overrides the generated name - used by workflow events, whose name is the event itself. */
  name?: string;
  /** What caused it: the issue, outcome or trigger. Generated from the trigger when omitted. */
  reason?: string;
  /** Agent-entered, optional. Stored only for Abandoned and Save & Exit. */
  comments?: string;
  orderId?: string;
  customerId?: string;
  customerName?: string;
  idNumber?: string;
  stepLabel?: string;
}

/** ACT-<time><random>: unique per activity, never typed by the agent. */
export function newActivityId(): string {
  return `ACT-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export function buildActivity(input: ActivityInput): Record<string, unknown> {
  const { verb, status, outcome } = OUTCOME[input.trigger];
  if (input.trigger === 'abandoned' && !input.comments?.trim()) {
    throw new Error('A comment is required before an abandoned journey can be saved.');
  }
  const name = input.name ?? `${input.journey} - ${verb}`;
  const reason =
    input.reason ??
    (input.trigger === 'completed'
      ? `${input.journey} completed${input.orderId ? ` - order ${input.orderId} submitted` : ''}.`
      : input.trigger === 'abandoned'
        ? `Agent abandoned ${input.journey}${input.stepLabel ? ` at the ${input.stepLabel} step` : ''}; the order was not placed.`
        : input.trigger === 'saved-exit'
          ? `Agent saved ${input.journey}${input.stepLabel ? ` at the ${input.stepLabel} step` : ''} to finish later.`
          : input.trigger === 'hard-stop'
            ? `${input.journey} ended at a hard stop; the customer is not eligible.`
            : `${input.journey} routed for approval.`);
  const comments = input.trigger === 'abandoned' || input.trigger === 'saved-exit' ? input.comments?.trim() : '';
  const profile = useAuthStore.getState().profile;
  return {
    activityNumber: newActivityId(),
    activityName: name,
    activityReason: reason,
    trigger: input.trigger,
    outcome,
    journey: input.journey,
    status,
    ...(comments ? { comments } : {}),
    orderId: input.orderId,
    customerId: input.customerId,
    customerName: input.customerName,
    idNumber: input.idNumber,
    agentId: profile?.userId,
    agentName: profile?.name,
    transactionDate: new Date().toISOString(),
  };
}

export async function logActivity(input: ActivityInput): Promise<string> {
  const record = buildActivity(input);
  await mockDataEngine.create('customer-activities', record);
  return record.activityNumber as string;
}

/**
 * Closes every open activity the journey left on this order (Completed, plus any workflow events)
 * and returns how many were closed. The agent never picks an activity: the order identifies them.
 */
export async function closeOrderActivities(orderId: string): Promise<number> {
  const all = await mockDataEngine.list<Record<string, unknown>>('customer-activities');
  const closedBy = useAuthStore.getState().profile?.userId;
  let closed = 0;
  for (const a of all) {
    if (a.orderId !== orderId || a.status === 'Closed') continue;
    // The shared record is edited in place: the engine's id-field guess does not suit this collection.
    Object.assign(a, { status: 'Closed', closedAt: new Date().toISOString(), closedBy });
    closed += 1;
  }
  return closed;
}
