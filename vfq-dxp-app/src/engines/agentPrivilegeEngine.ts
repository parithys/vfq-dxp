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
