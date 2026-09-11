// Shared reference data for the Trouble Ticket journey (VFQ_Trouble_Ticket_BRSD_v1.0),
// consumed by TicketCreationModal/TicketsDashboard/TicketDetail. Kept as inline
// constants rather than new mock-data JSON files — this mirrors the existing
// convention in this module (ISSUE_TYPES/TEMPLATES/QUEUES already live this
// way in TicketCreationModal.tsx) rather than introducing a new persistence
// shape for reference data the BRSD itself never gives concrete values for
// (Area/Sub-Area, Resolution Code, and Hashtag catalogues are all referenced
// by name in the requirements register but never enumerated).

// MPRA-style status vocabulary correction (BRSD gap-analysis G-11): the
// BRSD's own ticket lifecycle uses these terms in the Requirements register
// (RES-01/08/09/10/11, ESC-01) — "Open"/"Reopened" appear nowhere in the
// source. Reopen returns a ticket to "Not Solved", it does not introduce a
// new state.
export const TICKET_STATUSES = ['Not Solved', 'Assigned', 'Escalate', 'Solved', 'Completed', 'Closed', 'Cancelled'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'filled-neutral' | 'accent'> = {
  'Not Solved': 'warning',
  Assigned: 'filled-neutral',
  Escalate: 'accent',
  Solved: 'success',
  Completed: 'success',
  Closed: 'success',
  Cancelled: 'danger',
};

// P-03 (Priority LOV, Confirmed) — 1-ASAP/2-High/3-Medium/4-Low, not a plain
// Low/Medium/High scale.
export const PRIORITY_OPTIONS = ['1-ASAP', '2-High', '3-Medium', '4-Low'] as const;

// MPRA_001_CRE-16: priority is derived from Customer Type, not freely chosen.
// The BRSD names this as a requirement ("per the matrix") without ever
// enumerating the matrix's actual values, so this mapping is a reasonable,
// clearly-flagged placeholder against customers.json's real `segment` field,
// not a fabricated "real" VFQ policy.
export function derivePriorityFromSegment(segment: string | undefined): (typeof PRIORITY_OPTIONS)[number] {
  if (!segment) return '3-Medium';
  if (segment.startsWith('Enterprise')) return '1-ASAP';
  if (segment.includes('HRN')) return '2-High';
  return '3-Medium';
}

// P-10/P-11 (Confirmed, AS-IS baseline): SLA target 24h non-Expatriate / 48h
// Expatriate. customers.json has no literal "Expatriate" segment value, so
// this reuses the same nationality-based expat detection already evidenced
// and applied for BR-347 (Prepaid line cap) — non-Qatari nationality is
// treated as the Expatriate branch of the SLA matrix.
export function slaTargetHours(nationality: string | undefined): number {
  return nationality === 'Qatari' ? 24 : 48;
}

export const TT_AREAS: Record<string, string[]> = {
  Disconnection: ['Voluntary', 'Non-Payment'],
  'Migration (Pre-to-Post)': ['Eligibility', 'Billing Setup'],
  'Plan Downgrade': ['Eligibility', 'Billing'],
  'Language Change': ['Profile Update'],
  'End Data Session': ['Roaming', 'Domestic'],
  'Mobile Complaints': ['Voice', 'Data', 'Billing', 'SIM/Number'],
  'Fixed/5G Complaints': ['Fibre', 'IPTV', 'Router/CPE', 'Billing'],
  SOC: ['Provisioning', 'Billing'],
  'Human Error Complaints': ['Agent Error', 'System Error'],
};

export const HASHTAGS_BY_CATEGORY: Record<string, string[]> = {
  'Mobile Complaints': ['#SlowData', '#CallDrop', '#Postpaid', '#Prepaid'],
  'Fixed/5G Complaints': ['#IPTV', '#Fibre', '#RouterIssue'],
  Disconnection: ['#VoluntaryDisconnect', '#NonPayment'],
  'Migration (Pre-to-Post)': ['#MigrationEligibility'],
  'Plan Downgrade': ['#DowngradeRequest'],
  'Language Change': ['#ProfileUpdate'],
  'End Data Session': ['#RoamingSession'],
  SOC: ['#Provisioning'],
  'Human Error Complaints': ['#AgentError', '#SystemError'],
};

export const RESOLUTION_CODES = [
  'Resolved - Network Fix',
  'Resolved - Customer Education',
  'Resolved - Billing Adjustment',
  'Resolved - Device Replacement',
  'No Fault Found',
];

// ESC-05: mandatory reason from a controlled list.
export const ESCALATION_REASONS = [
  'SLA Breach Imminent',
  'Customer VIP / High Sensitivity',
  'Repeat / Recurring Issue',
  'Requires L3 Specialist',
  'Regulatory Sensitivity',
];

// RES-11: mandatory reason code.
export const CANCELLATION_REASONS = ['Raised in Error', 'Customer Withdrew Complaint', 'Duplicate of Another Ticket'];

// P-12 is explicitly "To be confirmed" in the source (the only reopen-window
// parameter given) — 7 days is a placeholder pending VFQ confirmation, not a
// sourced value.
export const REOPEN_WINDOW_DAYS = 7;

export interface NewTicketRecordInput {
  ticketId: string;
  customerId: string;
  issueType: string;
  area: string;
  template: string;
  templateContent: string;
  queue: string;
  priority: string;
  slaTargetHours: number;
  createdBy: string;
}

// Shared by TicketsDashboard.tsx and Customer 360's TicketsSection.tsx — both
// create the same entity shape from the same TicketCreationModal payload;
// centralising it here means the ASG-15/RES-01/ESC-01 fields this schema now
// carries only need to be listed once.
export function buildNewTicketRecord(input: NewTicketRecordInput): Record<string, unknown> {
  const createdAt = new Date().toISOString();
  const slaDueAt = new Date(Date.now() + input.slaTargetHours * 60 * 60 * 1000).toISOString();
  return {
    ticketId: input.ticketId,
    customerId: input.customerId,
    status: 'Not Solved',
    category: input.issueType,
    area: input.area,
    actualIssue: input.template || input.templateContent.slice(0, 40),
    queue: input.queue,
    priority: input.priority,
    createdAt,
    createdBy: input.createdBy,
    assignedTo: null,
    assignedAt: null,
    slaTargetHours: input.slaTargetHours,
    slaDueAt,
    resolutionCode: null,
    l3Reference: null,
    escalations: [],
    activities: [],
    attachments: [],
    reopenCount: 0,
    closedAt: null,
    cancelReason: null,
    excludedFromReporting: false,
    hashtags: [],
    publicNotes: [],
  };
}
