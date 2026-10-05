// Two flows, chosen by where the journey was started (2026-10-02):
//  - 'new'      Agent 360 (Dashboard) or Mobile Connections: the customer is
//               ALWAYS treated as NEW. Full scan -> NAS lookup; even an ID that
//               has a Siebel record proceeds as a new customer.
//  - 'existing' Customer Details: the customer is already identified, so the
//               Customer Identification step opens pre-resolved with the ID
//               locked (read-only); eligibility still runs.
// Separate wizard ids keep their drafts from overwriting each other.
export type NewConnectionFlow = 'new' | 'existing';

export const WIZARD_ID_BY_FLOW: Record<NewConnectionFlow, string> = { new: 'new-connection', existing: 'new-connection-existing' };

// Placeholder pending business confirmation (2026-09-28: "Do not assume
// Agent 360 as the destination, as this has not been finalised. Keep the
// post-exit destination configurable until confirmed"). A single named
// constant rather than a config-engine entry: the value itself is explicitly
// unconfirmed, so a whole schema/file for it would be structure built for a
// requirement that does not exist yet. Change this one line - used by both
// Save & Exit and Abandon - once the real destination is decided.
export const POST_EXIT_DESTINATION = '/';

// Save & Exit lands on the agent's Draft Orders list.
export const DRAFT_ORDERS_PATH = '/tasks?filter=draft-orders';

export interface Product {
  productId: string;
  name: string;
  mrcQAR: number;
  starNumberEntitlementQar?: number;
  /** See PostpaidPlanAddonsStep's PostpaidPlan.preBundledOffer for what this
   * drives - the 'plan' step's autoAdvanceWhen below is the other half. */
  preBundledOffer?: boolean;
}

export interface ConfirmedOrder {
  orderId: string;
  activityId?: string;
  pendingApproval: boolean;
  customerName: string;
  msisdn: string;
  planName: string;
  dueTodayQar: number;
  monthlyRecurringQar: number;
  simType?: string;
  /** Set only for eSIM orders - drives the QR handover panel below. */
  esimActivationCode?: string;
  /**
   * The account's own contact email, whatever it is - no longer gated on
   * verification (2026-09-28: "populate it only from existing account
   * contact emails," shown even when unverified so the agent can see why
   * sending is blocked). See customerEmailVerified for the gate itself.
   */
  customerEmail?: string;
  /** The address as Customer Identification shows it (masked for a new customer). */
  customerEmailDisplay?: string;
  /** Same definition as GuidedContactStep's own emailVerification tick. */
  customerEmailVerified: boolean;
}
