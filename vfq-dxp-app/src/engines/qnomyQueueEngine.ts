import { getPersona } from './configEngine';

// Which Qnomy queues a role may be handed a ticket from.
//
// `journeyCode` is the queue dimension already present on qtickets.json (J011
// is the Mobile Postpaid Activation journey named on the BRSD's J011 slide), so
// "the relevant queue" is keyed to evidenced data rather than a new field
// invented for it. Two further codes were seeded so the distinction is
// demonstrable — with a single queue, "relevant" is unfalsifiable.
//
// Role -> queues is derived from the persona's GROUP, which already exists,
// rather than a per-role table that would need editing for all 26 roles:
//
//   Sales & Acquisition            -> J011  new connections / activations
//   Customer Service & Retention   -> J020  care and complaints
//   Billing, Credit & Collections  -> J030  billing and payments
//   Management, Approval & Gov.    -> all   oversight roles cover the floor
//
// Only roles whose contextCard is 'Queue Number + Ticket Number' (plus
// oversight) ever see the control at all — see canSeeQnomyTicketNumber — so
// this is about WHICH queue, not WHETHER.

export const QUEUE_LABELS: Record<string, string> = {
  J011: 'New Connections',
  J020: 'Care & Complaints',
  J030: 'Billing & Payments',
};

const GROUP_QUEUES: Record<string, string[]> = {
  'Sales & Acquisition': ['J011'],
  'Customer Service & Retention': ['J020'],
  'Billing, Credit & Collections': ['J030'],
};

const ALL_QUEUES = Object.keys(QUEUE_LABELS);

/** The journey codes this role may be served from. An oversight role, or a
 * group with no explicit mapping, gets the whole floor rather than nothing —
 * handing a supervisor an empty queue would read as a broken queue rather
 * than as a scoping decision. */
export function queuesForRole(personaId: string | undefined): string[] {
  const persona = personaId ? getPersona(personaId) : undefined;
  if (!persona) return ALL_QUEUES;
  if (persona.capabilities.includes('agent-oversight')) return ALL_QUEUES;
  return GROUP_QUEUES[persona.group] ?? ALL_QUEUES;
}

export function queueLabelsForRole(personaId: string | undefined): string {
  return queuesForRole(personaId)
    .map((c) => QUEUE_LABELS[c] ?? c)
    .join(' · ');
}

export interface QueueTicket {
  qTicketId: string;
  kioskMobileNumber: string | null;
  customerId: string | null;
  journeyCode: string | null;
  queueName: string | null;
  status: string;
  generatedAt: string;
  branch?: string | null;
  counterNumber?: string | null;
}

/** Oldest waiting ticket in any queue this role serves. Oldest-first across
 * the role's queues combined, so a role covering several is served strictly in
 * arrival order rather than queue-by-queue. */
export function nextTicketFor<T extends QueueTicket>(
  personaId: string | undefined,
  tickets: T[]
): T | undefined {
  const mine = new Set(queuesForRole(personaId));
  return tickets
    .filter((t) => t.status === 'Waiting' && t.journeyCode && mine.has(t.journeyCode))
    .sort((a, b) => a.generatedAt.localeCompare(b.generatedAt))[0];
}

export function waitingCountFor(personaId: string | undefined, tickets: QueueTicket[]): number {
  const mine = new Set(queuesForRole(personaId));
  return tickets.filter((t) => t.status === 'Waiting' && t.journeyCode && mine.has(t.journeyCode)).length;
}

/** Normalises for comparison — a kiosk keypad entry may carry spaces or omit
 * the country code, while customers.json stores full E.164. Compared on the
 * last 8 digits, which is the national subscriber number in Qatar. */
export function mobileMatches(kiosk: string | null | undefined, onFile: string | null | undefined): boolean {
  if (!kiosk || !onFile) return false;
  const digits = (v: string) => v.replace(/\D/g, '');
  const a = digits(kiosk);
  const b = digits(onFile);
  if (!a || !b) return false;
  return a.slice(-8) === b.slice(-8);
}
