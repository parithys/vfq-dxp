// Agent 360 BRSD role-matrix gating (APM-01/05/08, BIN-01, BIN-04, BNT-04;
// BR-01/BR-02/BR-03). None of these BRSD clauses come with a confirmed
// privilege matrix (OI-AGN-06/11/13 all leave "which role" open) — but rather
// than leave the check absent entirely (the prior state, flagged by the
// compliance audit as a real gap), these two predicates ground the gate in
// personas.json data that already exists and is unambiguous, the same way
// ATV-03's Supervisor-only assignment gate is grounded in PERSONA-024 rather
// than an invented role.

// personas.json's own `type` field already distinguishes genuine internal
// Vodafone staff from three categories that are not Vodafone agents at all:
// enterprise customer-side contacts (PERSONA-009/010/011), an external donor
// operator (PERSONA-016), a non-human system/service account (PERSONA-050),
// and an external channel partner (PERSONA-052). None of these represent a
// human Vodafone employee who should be self-managing an "Agent Profile" —
// this is the one BR-01/APM-01 distinction the source data actually supports
// without inventing a role that was never evidenced.
const NON_AGENT_PERSONA_IDS = new Set([
  'PERSONA-009', // Chooser (Enterprise customer-side authorised contact)
  'PERSONA-010', // Payment Support Contact (Enterprise customer-side authorised contact)
  'PERSONA-011', // Technical Contact (Enterprise customer-side authorised contact)
  'PERSONA-016', // Donor Operator (Ooredoo/QTEL) — external telecom operator
  'PERSONA-050', // System user SADMIN — backend/system account, not a person
  'PERSONA-052', // Offshore Retailer / Channel Partner (VSA/BSA) — external
]);

// personas.json's `type` field also names several roles as explicitly
// "Back Office" / "Back-office" / "Supervisory" / "Approval" — the closest
// evidenced match to BR-03's "designated Backoffice or privileged staff."
const BACKOFFICE_OR_PRIVILEGED_PERSONA_IDS = new Set([
  'PERSONA-005', // Back Office Fulfilment Agent (Siebel Responsibility)
  'PERSONA-019', // Manager (Approver/Bypass/System Admin role, general)
  'PERSONA-024', // Supervisor — same persona ATV-03/BR-05 already gates on
  'PERSONA-044', // Back Office / Admin (broad org-wide access)
  'PERSONA-046', // Dispatcher/Back-Office WFM User
  'PERSONA-060', // Back Office (generic activity channel)
]);

/** APM-01/05/08, BR-01/BR-02: is this persona a genuine internal Vodafone
 * agent who may view/edit their own Agent Profile (password, MFA)? */
export function isInternalAgentPersona(personaId: string | undefined): boolean {
  if (!personaId) return false;
  return !NON_AGENT_PERSONA_IDS.has(personaId);
}

/** BIN-01, BNT-04, BR-03: is this persona "designated Backoffice or
 * privileged staff" for configuring bell notifications / bulk notes? */
export function isBackofficeOrPrivilegedPersona(personaId: string | undefined): boolean {
  if (!personaId) return false;
  return BACKOFFICE_OR_PRIVILEGED_PERSONA_IDS.has(personaId);
}

/** Customer 360 BRSD v3.1 BR-02: "Customer, contact, address and
 * billing-profile changes may be performed only by agents authorised under
 * the VFQ-approved role and approval matrix." No confirmed matrix exists
 * (same OI-AGN-06/11/13 gap as above) — reuses the one persona distinction
 * the source data actually supports: a genuine internal Vodafone agent may
 * edit; the non-agent categories (enterprise customer-side contacts, the
 * donor operator, the system account, the channel partner) may not, since
 * none of them represent a human VFQ staff member the approval matrix could
 * plausibly apply to. */
export function canEditCustomerRecords(personaId: string | undefined): boolean {
  return isInternalAgentPersona(personaId);
}

// Session reference number visibility (Qnomy Ticket Number / Ticket
// Reference Number in the page header). No BRSD clause enumerates these
// exact persona sets either — grounded the same way as the gates above, in personas.json's
// own name/type text, not an invented mapping:
//   - "Retail Agent": personas explicitly named/typed Retail or Frontline.
//     Excludes PERSONA-033 ("Retail Agent (Retail Operations Stakeholder -
//     Giri)") — its type is "internal business stakeholder", i.e. a named
//     workshop participant reference, not a functional day-to-day agent
//     role, and PERSONA-053 (a broad multi-role family spanning retail,
//     telesales, complaints AND back-office at once) — too broad to safely
//     call "Retail Agent" specifically.
//   - "Back-Office Agent": every persona explicitly named/typed Back Office.
//   - "their managers": personas.json has no retail-specific vs
//     back-office-specific manager persona — only PERSONA-024 (Supervisor)
//     is evidenced as generic agent-oversight ("would need visibility
//     across all agents' tickets"), so it's treated as manager for BOTH
//     groups rather than inventing a split that isn't evidenced.
//     PERSONA-041 ("Team Manager / Approver... Order Approval, Test
//     Manager") was deliberately excluded — its evidenced responsibilities
//     are order-approval-workflow specific, not agent line-management, so
//     including it would over-grant beyond what's actually supported.
// Field Technicians (PERSONA-025 and the field-adjacent PERSONA-045/055) and
// IT Operations (PERSONA-008) are excluded by construction: this is an
// allowlist, so any persona not named below — including those — sees
// neither reference number.
const RETAIL_AGENT_PERSONA_IDS = new Set([
  'PERSONA-001', // Retail/Sales Agent (Frontline/Cross-Sell/Front-Office)
  'PERSONA-043', // Retail Agent (Lead Owner, reassignment target)
]);
const BACK_OFFICE_AGENT_PERSONA_IDS = new Set([
  'PERSONA-005', // Back Office Fulfilment Agent (Siebel Responsibility)
  'PERSONA-044', // Back Office / Admin (broad org-wide access)
  'PERSONA-046', // Dispatcher/Back-Office WFM User
  'PERSONA-060', // Back Office (generic activity channel)
]);
const AGENT_MANAGER_PERSONA_IDS = new Set([
  'PERSONA-024', // Supervisor — the one evidenced generic agent-oversight role
]);

/** Qnomy Ticket Number: visible exclusively to Retail Agents and their managers. */
export function canSeeQnomyTicketNumber(personaId: string | undefined): boolean {
  if (!personaId) return false;
  return RETAIL_AGENT_PERSONA_IDS.has(personaId) || AGENT_MANAGER_PERSONA_IDS.has(personaId);
}

/** CTI Reference Number — the customer's active interaction reference,
 * available throughout the servicing journey (not a post-completion
 * tracking/order number, which is a separate concept that deliberately does
 * NOT belong in the header — see SessionReferenceNumbers.tsx). Covers
 * service requests, enquiries, and issue-related cases alike, sourced from
 * the customer's active trouble ticket. Visible exclusively to Back-Office
 * Agents and their managers. */
export function canSeeCtiReferenceNumber(personaId: string | undefined): boolean {
  if (!personaId) return false;
  return BACK_OFFICE_AGENT_PERSONA_IDS.has(personaId) || AGENT_MANAGER_PERSONA_IDS.has(personaId);
}
