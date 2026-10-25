import * as mockDataEngine from './mockDataEngine';
import { canViewCustomerSegment } from './agentPrivilegeEngine';
import { queuesForRole, waitingCountFor, QUEUE_LABELS, type QueueTicket } from './qnomyQueueEngine';

/**
 * The walk-in queue is never empty. A branch always has someone arriving at a kiosk, so when a role's queue has been worked down to nobody, the
 * kiosk issues the next walk-in: a new Waiting ticket in one of the role's own queues, for a customer on file the role may see (a protected-segment
 * customer is never handed to a role that cannot see them). Pure: returns the ticket to issue, or undefined when someone is already waiting.
 */
export function nextWalkInTicket(
  personaId: string | undefined,
  tickets: (QueueTicket & { kioskMobileNumber: string | null })[],
  customers: { customerId: string; phone?: string; segment?: string }[],
  now = new Date()
): Record<string, unknown> | undefined {
  if (waitingCountFor(personaId, tickets) > 0) return undefined;
  const queues = queuesForRole(personaId);
  const journeyCode = queues[tickets.length % queues.length];
  const eligible = customers.filter((c) => c.phone && canViewCustomerSegment(personaId, c.segment));
  const customer = eligible.length ? eligible[tickets.length % eligible.length] : undefined;
  return {
    qTicketId: `QTK-W${now.getTime().toString().slice(-8)}`,
    kioskMobileNumber: customer?.phone ?? null,
    customerId: customer?.customerId ?? null,
    orderId: null,
    journeyCode,
    queueName: QUEUE_LABELS[journeyCode] ?? journeyCode,
    generatedInSystem: 'Qnomy',
    generatedAt: now.toISOString(),
    branch: 'Doha City Center',
    counterNumber: null,
    status: 'Waiting',
    agentInDxpSessionId: null,
    handledByUserId: null,
    releasedAt: null,
    taskType: null,
  };
}

let inFlight: Promise<void> | undefined;

/** Issues a walk-in when the role's queue is empty (see nextWalkInTicket). One at a time, so two screens asking together issue one ticket. */
export function ensureWalkInWaiting(personaId: string | undefined): Promise<void> {
  inFlight ??= (async () => {
    const [tickets, customers] = await Promise.all([
      mockDataEngine.list<QueueTicket & { kioskMobileNumber: string | null }>('qtickets'),
      mockDataEngine.list<{ customerId: string; phone?: string; segment?: string }>('customers'),
    ]);
    const ticket = nextWalkInTicket(personaId, tickets, customers);
    if (ticket) await mockDataEngine.create('qtickets', ticket);
  })().finally(() => {
    inFlight = undefined;
  });
  return inFlight;
}
