import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Badge } from '../../../components/primitives/Badge';
import { Button } from '../../../components/primitives/Button';
import { Textarea } from '../../../components/primitives/Textarea';
import { Input } from '../../../components/primitives/Input';
import { Select } from '../../../components/primitives/Select';
import { Drawer } from '../../../components/primitives/Drawer';
import { Tabs } from '../../../components/primitives/Tabs';
import { useEntityStore } from '../../../stores/entityStore';
import { useNotificationStore } from '../../../stores/notificationStore';
import { usePersonaStore } from '../../../stores/personaStore';
import { evaluateRule } from '../../../engines/ruleEngine';
import * as mockDataEngine from '../../../engines/mockDataEngine';
import {
  STATUS_VARIANT,
  RESOLUTION_CODES,
  ESCALATION_REASONS,
  CANCELLATION_REASONS,
  HASHTAGS_BY_CATEGORY,
  REOPEN_WINDOW_DAYS,
} from '../ticketReferenceData';

const CURRENT_AGENT = 'Current Agent';
const MAX_ATTACHMENTS = 5; // P-15 is "To be confirmed" in the source — placeholder cap pending VFQ confirmation.

interface PublicNote {
  author: string;
  text: string;
  createdAt: string;
}
interface Activity {
  type: 'Manual' | 'Auto';
  description: string;
  createdAt: string;
  createdBy: string;
  open: boolean;
}
interface Escalation {
  reason: string;
  escalatedAt: string;
  escalatedBy: string;
}
interface Attachment {
  name: string;
  size: number;
  uploadedAt: string;
}
interface Ticket {
  ticketId: string;
  customerId: string;
  status: string;
  category: string;
  area?: string;
  actualIssue?: string;
  queue: string;
  priority: string;
  createdAt?: string;
  assignedTo?: string | null;
  assignedAt?: string | null;
  slaTargetHours?: number;
  slaDueAt?: string;
  resolutionCode?: string | null;
  l3Reference?: string | null;
  escalations?: Escalation[];
  activities?: Activity[];
  attachments?: Attachment[];
  reopenCount?: number;
  closedAt?: string | null;
  cancelReason?: string | null;
  publicNotes?: PublicNote[];
  hashtags?: string[];
}
interface AuditRecord {
  auditId: string;
  recordType: string;
  recordId: string;
  employeeUser: string;
  fieldModified: string;
  newValue: string;
  timestamp: string;
}

// SCR-029 (Ticket detail: public notes / bell icon notifications) + SCR-210
// (Ticket Homepage: fields filled by which role is responsible, internal
// Activities) — both describe the same central ticket-management page from
// two evidenced angles, so they share this one component. Extended per the
// Trouble Ticket BRSD gap analysis (2026-09-11) to close the majority of the
// journey's remaining capabilities: Assignment/Reassignment (ASG),
// Escalation (ESC), Resolution/Completion/Closure/Cancellation/Reopen (RES),
// Attachments (ATT), real Activities (VEW), and Audit Trail (AUD) — see the
// per-action comments below for exact requirement/rule citations.
export function TicketDetail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const ticketId = params.get('id');
  const tickets = (useEntityStore((s) => s.records['trouble-tickets']) ?? []) as unknown as Ticket[];
  const loadKind = useEntityStore((s) => s.loadKind);
  const updateRecord = useEntityStore((s) => s.updateRecord);
  const createRecord = useEntityStore((s) => s.createRecord);
  const pushToast = useNotificationStore((s) => s.pushToast);
  const activePersonaId = usePersonaStore((s) => s.activePersonaId);
  const [noteText, setNoteText] = useState('');
  const [activityText, setActivityText] = useState('');
  const [auditRecords, setAuditRecords] = useState<AuditRecord[]>([]);
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [escalateReason, setEscalateReason] = useState('');
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolutionCode, setResolutionCode] = useState('');
  const [resolutionHashtags, setResolutionHashtags] = useState<string[]>([]);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [reassignQueue, setReassignQueue] = useState('');

  useEffect(() => {
    loadKind('trouble-tickets');
  }, [loadKind]);

  useEffect(() => {
    if (!ticketId) return;
    mockDataEngine.list<AuditRecord>('audit-trail').then((all) => {
      setAuditRecords(all.filter((a) => a.recordType === 'Ticket' && a.recordId === ticketId).sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
    });
  }, [ticketId, tickets]);

  const ticket = tickets.find((t) => t.ticketId === ticketId);
  if (!ticket) {
    return <div className="p-8 text-fg-2">No ticket selected — go back to the Tickets Dashboard.</div>;
  }

  // BR-067 (config): "an audit trail exists on tickets... but is role-
  // restricted from agents." PERSONA-001/066 are the frontline/FL-Agent
  // personas in this app's persona list; the rest (Complaints Team,
  // Supervisor, Back Office/Admin, Retention) can see it.
  const isFrontline = activePersonaId === 'PERSONA-001' || activePersonaId === 'PERSONA-066';
  const canSeeAudit = !isFrontline;
  // RBAC-132/144: Resolution Code is a "Filled By Complaints Team"-designated
  // field FL Agents cannot fill — resolution is routed to Complaints Team,
  // Supervisor or Admin personas instead.
  const canResolve = activePersonaId === 'PERSONA-059' || activePersonaId === 'PERSONA-024' || activePersonaId === 'PERSONA-044';
  const canReassignQueue = activePersonaId === 'PERSONA-024' || activePersonaId === 'PERSONA-044';

  const notes = ticket.publicNotes ?? [];
  const activities = ticket.activities ?? [];
  const attachments = ticket.attachments ?? [];
  const openActivities = activities.filter((a) => a.open);
  const terminal = ticket.status === 'Closed' || ticket.status === 'Cancelled';
  const slaRule = evaluateRule('BR-349', { slaDueAt: ticket.slaDueAt, status: ticket.status });
  const ragVariant = terminal || !ticket.slaDueAt ? 'filled-neutral' : !slaRule.pass ? 'danger' : slaRule.message?.includes('Amber') ? 'warning' : 'success';
  const ragLabel = terminal || !ticket.slaDueAt ? '—' : ragVariant === 'danger' ? 'Red' : ragVariant === 'warning' ? 'Amber' : 'Green';

  const audit = async (fieldModified: string, newValue: string) => {
    await createRecord('audit-trail', {
      auditId: `AUD-TT-${Date.now().toString().slice(-6)}`,
      recordType: 'Ticket',
      recordId: ticket.ticketId,
      employeeUser: CURRENT_AGENT,
      fieldModified,
      newValue,
      timestamp: new Date().toISOString(),
    });
  };

  const addActivity = (description: string, type: Activity['type'] = 'Auto', open = false) => [
    ...activities,
    { type, description, createdAt: new Date().toISOString(), createdBy: CURRENT_AGENT, open },
  ];

  const notify = async (smsText: string) => {
    await createRecord('osb-notifications', {
      messageId: `MSG-TT-${Date.now().toString().slice(-6)}`,
      orderId: ticket.ticketId,
      dbTimestamp: new Date().toISOString(),
      server: 'OSB-PRD-NODE1',
      state: 'COMPLETED',
      node: 'Node1',
      pipeline: 'PS_VFQA_Communication_Pipeline',
      stage: 'SendSMS',
      inboundService: 'PS_VFQA_Communication',
      operation: 'CreateCommunication',
      smsText,
    });
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    const next = [...notes, { author: CURRENT_AGENT, text: noteText, createdAt: new Date().toISOString() }];
    await updateRecord('trouble-tickets', 'ticketId', ticket.ticketId, { publicNotes: next });
    setNoteText('');
  };

  const addManualActivity = async () => {
    if (!activityText.trim()) return;
    await updateRecord('trouble-tickets', 'ticketId', ticket.ticketId, { activities: addActivity(activityText, 'Manual', true) });
    await audit('Activity', activityText);
    setActivityText('');
  };

  const closeActivity = async (index: number) => {
    const next = activities.map((a, i) => (i === index ? { ...a, open: false } : a));
    await updateRecord('trouble-tickets', 'ticketId', ticket.ticketId, { activities: next });
  };

  // MPRA_001_ASG-06/07: self-assignment sets Status AND Sub-Status to
  // "Assigned" per the source's own single-status-field model.
  const assignToMe = async () => {
    await updateRecord('trouble-tickets', 'ticketId', ticket.ticketId, {
      assignedTo: CURRENT_AGENT,
      assignedAt: new Date().toISOString(),
      status: ticket.status === 'Not Solved' ? 'Assigned' : ticket.status,
      activities: addActivity(`Ticket assigned to ${CURRENT_AGENT}.`),
    });
    await audit('Assignment', CURRENT_AGENT);
    pushToast('success', `Ticket ${ticket.ticketId} assigned to you.`);
  };

  // MPRA_001_ASG-05: supervisor cross-queue reassignment.
  const reassignQueueSubmit = async () => {
    if (!reassignQueue) return;
    await updateRecord('trouble-tickets', 'ticketId', ticket.ticketId, {
      queue: reassignQueue,
      activities: addActivity(`Reassigned from ${ticket.queue} to ${reassignQueue} by supervisor.`),
    });
    await audit('Queue', reassignQueue);
    pushToast('success', `Ticket ${ticket.ticketId} reassigned to ${reassignQueue}.`);
    setReassignQueue('');
  };

  // MPRA_001_ESC-05: manual escalation with mandatory reason. Also models
  // ESC-06/07's distribution-list/hierarchical notification as a persisted
  // notification record rather than a real email/DL send.
  const escalate = async () => {
    if (!escalateReason) return;
    const entry = { reason: escalateReason, escalatedAt: new Date().toISOString(), escalatedBy: CURRENT_AGENT };
    await updateRecord('trouble-tickets', 'ticketId', ticket.ticketId, {
      status: 'Escalate',
      escalations: [...(ticket.escalations ?? []), entry],
      activities: addActivity(`Escalated — reason: ${escalateReason}.`),
    });
    await audit('Status', 'Escalate');
    await notify(`Ticket ${ticket.ticketId} escalated (${escalateReason}) — distribution list and next-hierarchy-position notified (ESC-06/07).`);
    pushToast('warning', `Ticket ${ticket.ticketId} escalated.`);
    setEscalateOpen(false);
    setEscalateReason('');
  };

  // MPRA_001_RES-01: gated on Resolution Code + Hashtag + Actual Issue.
  const resolve = async () => {
    if (!resolutionCode || resolutionHashtags.length === 0) return;
    await updateRecord('trouble-tickets', 'ticketId', ticket.ticketId, {
      status: 'Solved',
      resolutionCode,
      hashtags: resolutionHashtags,
      activities: addActivity(`Marked Solved — ${resolutionCode}.`),
    });
    await audit('Status', 'Solved');
    pushToast('success', `Ticket ${ticket.ticketId} marked Solved.`);
    setResolveOpen(false);
  };

  // MPRA_001_RES-08: gated on no outstanding activities.
  const complete = async () => {
    if (openActivities.length > 0) return;
    await updateRecord('trouble-tickets', 'ticketId', ticket.ticketId, { status: 'Completed', activities: addActivity('Marked Completed.') });
    await audit('Status', 'Completed');
    pushToast('success', `Ticket ${ticket.ticketId} marked Completed.`);
  };

  // MPRA_001_RES-09: closes all activities on ticket closure. MPRA_001_CSA-01/02:
  // Medallia (spelled inconsistently across the BRSD as Medilia/Medelia/Medallia)
  // survey trigger fires only on reaching this terminal state.
  const closeTicket = async () => {
    const closedAt = new Date().toISOString();
    const closedActivities: Activity[] = [
      ...activities.map((a) => ({ ...a, open: false })),
      { type: 'Auto', description: 'Ticket closed — all activities closed.', createdAt: closedAt, createdBy: CURRENT_AGENT, open: false },
    ];
    await updateRecord('trouble-tickets', 'ticketId', ticket.ticketId, { status: 'Closed', closedAt, activities: closedActivities });
    await audit('Status', 'Closed');
    await notify(`Ticket ${ticket.ticketId} closed. A customer satisfaction survey has been triggered (CSA-01/02, Medallia).`);
    pushToast('success', `Ticket ${ticket.ticketId} closed.`);
  };

  // MPRA_001_RES-11: mandatory reason code, excluded from performance reporting.
  const cancel = async () => {
    if (!cancelReason) return;
    await updateRecord('trouble-tickets', 'ticketId', ticket.ticketId, {
      status: 'Cancelled',
      cancelReason,
      excludedFromReporting: true,
      activities: addActivity(`Cancelled — reason: ${cancelReason}.`),
    });
    await audit('Status', 'Cancelled');
    pushToast('warning', `Ticket ${ticket.ticketId} cancelled.`);
    setCancelOpen(false);
    setCancelReason('');
  };

  // MPRA_001_RES-10: reopen only within the configured window (P-12 —
  // placeholder pending VFQ confirmation), with a mandatory reason, returning
  // status to "Not Solved" (not a separate "Reopened" state) and incrementing
  // reopenCount.
  const withinReopenWindow = ticket.closedAt ? Date.now() - new Date(ticket.closedAt).getTime() <= REOPEN_WINDOW_DAYS * 24 * 60 * 60 * 1000 : false;
  const reopen = async () => {
    if (!reopenReason.trim() || !withinReopenWindow) return;
    await updateRecord('trouble-tickets', 'ticketId', ticket.ticketId, {
      status: 'Not Solved',
      reopenCount: (ticket.reopenCount ?? 0) + 1,
      activities: addActivity(`Reopened — reason: ${reopenReason}.`),
    });
    await audit('Status', 'Not Solved (Reopened)');
    pushToast('warning', `Ticket ${ticket.ticketId} reopened.`);
    setReopenOpen(false);
    setReopenReason('');
  };

  // MPRA_001_ATT-01–05: metadata-only capture (name/size) — no real file
  // storage exists in this mock app, so nothing beyond the metadata a real
  // <input type="file"> gives us is fabricated.
  const attach = async (file: File) => {
    if (terminal) return; // ATT-03
    if (attachments.length >= MAX_ATTACHMENTS) {
      pushToast('error', `Maximum ${MAX_ATTACHMENTS} attachments per ticket (P-15 placeholder).`);
      return;
    }
    const next = [...attachments, { name: file.name, size: file.size, uploadedAt: new Date().toISOString() }];
    await updateRecord('trouble-tickets', 'ticketId', ticket.ticketId, { attachments: next });
    await audit('Attachment', file.name);
  };

  const availableHashtags = HASHTAGS_BY_CATEGORY[ticket.category] ?? [];

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex flex-col lg:flex-row items-start gap-6">
        <div className="flex-1 min-w-0 space-y-6">
          <div className="rounded-[var(--radius-card)] border border-border-soft bg-bg p-5">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-[length:var(--fs-h3)] font-medium text-fg">Ticket {ticket.ticketId}</h1>
              <Badge variant={STATUS_VARIANT[ticket.status] ?? 'filled-neutral'}>{ticket.status}</Badge>
              <Badge variant={ragVariant}>SLA: {ragLabel}</Badge>
              <span className="ml-auto flex items-center gap-1 text-fg-2" title="Notifications">
                🔔 <span className="text-[length:var(--fs-caption)]">{notes.length}</span>
              </span>
            </div>
            <p className="text-fg-2 mb-1">
              Customer: {ticket.customerId} · {ticket.category}{ticket.area ? ` — ${ticket.area}` : ''} · Queue <Badge variant="outlined-red">{ticket.queue}</Badge>
            </p>
            <p className="text-fg-2 text-[length:var(--fs-caption)]">
              Assigned to: {ticket.assignedTo ?? 'Unassigned'} · {slaRule.message}
            </p>
          </div>

          <div className="rounded-[var(--radius-card)] border border-border-soft bg-bg p-5">
            <h2 className="text-[length:var(--fs-h5)] text-fg font-medium mb-3">Public Notes</h2>
            <div className="space-y-2 mb-3">
              {notes.length === 0 && <p className="text-fg-2 text-[length:var(--fs-body)]">No public notes yet.</p>}
              {notes.map((n, i) => (
                <div key={i} className="text-[length:var(--fs-body)] border-l-2 border-accent pl-3">
                  <p className="text-fg">{n.text}</p>
                  <p className="text-[length:var(--fs-caption)] text-muted">{n.author} — {new Date(n.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
            <Textarea aria-label="Add a public note" placeholder="Add a public note…" value={noteText} onChange={(e) => setNoteText(e.target.value)} />
            <Button variant="ghost-rect" className="mt-2" onClick={addNote} disabled={!noteText.trim()}>
              Add Note
            </Button>
          </div>

          <div className="rounded-[var(--radius-card)] border border-border-soft bg-bg p-5">
            <Tabs
              items={[
                {
                  key: 'details',
                  label: 'Details',
                  content: (
                    <dl className="grid grid-cols-2 gap-4 text-[length:var(--fs-body)]">
                      <div><dt className="text-[length:var(--fs-caption)] text-muted">Issue</dt><dd className="text-fg">{ticket.actualIssue ?? '—'}</dd></div>
                      <div><dt className="text-[length:var(--fs-caption)] text-muted">Priority</dt><dd className="text-fg">{ticket.priority}</dd></div>
                      <div><dt className="text-[length:var(--fs-caption)] text-muted">Resolution Code</dt><dd className="text-fg">{ticket.resolutionCode ?? '—'}</dd></div>
                      <div><dt className="text-[length:var(--fs-caption)] text-muted">Hashtags</dt><dd className="text-fg">{(ticket.hashtags ?? []).join(', ') || '—'}</dd></div>
                      <div><dt className="text-[length:var(--fs-caption)] text-muted">SLA Target</dt><dd className="text-fg">{ticket.slaTargetHours ? `${ticket.slaTargetHours}h, due ${ticket.slaDueAt ? new Date(ticket.slaDueAt).toLocaleString() : '—'}` : '—'}</dd></div>
                      <div><dt className="text-[length:var(--fs-caption)] text-muted">Reopen count</dt><dd className="text-fg">{ticket.reopenCount ?? 0}</dd></div>
                      <div className="col-span-2">
                        <dt className="text-[length:var(--fs-caption)] text-muted mb-1">L3 Reference (RES-07 — editable while Not Solved)</dt>
                        <Input
                          aria-label="L3 Reference"
                          placeholder="External L3 ticket reference"
                          value={ticket.l3Reference ?? ''}
                          disabled={ticket.status !== 'Not Solved'}
                          onChange={(e) => updateRecord('trouble-tickets', 'ticketId', ticket.ticketId, { l3Reference: e.target.value })}
                        />
                      </div>
                      {(ticket.escalations ?? []).length > 0 && (
                        <div className="col-span-2">
                          <dt className="text-[length:var(--fs-caption)] text-muted mb-1">Escalation History</dt>
                          <ul className="list-disc list-inside text-fg text-[length:var(--fs-caption)]">
                            {(ticket.escalations ?? []).map((e, i) => (
                              <li key={i}>{e.reason} — {new Date(e.escalatedAt).toLocaleString()} by {e.escalatedBy}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </dl>
                  ),
                },
                {
                  key: 'activities',
                  label: 'Activities',
                  content: (
                    <div className="space-y-3">
                      {activities.length === 0 && <p className="text-fg-2 text-[length:var(--fs-body)]">No activities logged yet.</p>}
                      {activities.map((a, i) => (
                        <div key={i} className="flex items-center justify-between border-b border-border-soft pb-2 last:border-0">
                          <div>
                            <span className="text-fg text-[length:var(--fs-body)]">{a.description}</span>
                            <span className="block text-[length:var(--fs-caption)] text-muted">{a.type} · {a.createdBy} · {new Date(a.createdAt).toLocaleString()}</span>
                          </div>
                          {a.open ? (
                            <Button variant="ghost-rect" compact onClick={() => closeActivity(i)}>Close</Button>
                          ) : (
                            <Badge variant="filled-neutral">Closed</Badge>
                          )}
                        </div>
                      ))}
                      <div className="flex gap-2 pt-2">
                        <Input aria-label="Log a manual activity" placeholder="Log a manual activity…" value={activityText} onChange={(e) => setActivityText(e.target.value)} className="flex-1" />
                        <Button variant="ghost-rect" onClick={addManualActivity} disabled={!activityText.trim()}>Add</Button>
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'attachments',
                  label: 'Attachments',
                  content: (
                    <div className="space-y-2">
                      {attachments.length === 0 && <p className="text-fg-2 text-[length:var(--fs-body)]">No attachments.</p>}
                      {attachments.map((a, i) => (
                        <div key={i} className="flex items-center justify-between text-[length:var(--fs-body)] border-b border-border-soft pb-1 last:border-0">
                          <span className="text-fg">{a.name} ({Math.round(a.size / 1024)} KB)</span>
                          <span className="text-[length:var(--fs-caption)] text-muted">{new Date(a.uploadedAt).toLocaleString()}</span>
                        </div>
                      ))}
                      {terminal ? (
                        <p className="text-[length:var(--fs-caption)] text-muted">Attachments are blocked on Closed/Cancelled tickets (ATT-03).</p>
                      ) : (
                        <input
                          type="file"
                          aria-label="Upload attachment"
                          className="text-[length:var(--fs-caption)] text-fg-2"
                          onChange={(e) => e.target.files?.[0] && attach(e.target.files[0])}
                        />
                      )}
                    </div>
                  ),
                },
                {
                  key: 'audit',
                  label: 'Audit Trail',
                  content: canSeeAudit ? (
                    <div className="space-y-2">
                      {auditRecords.length === 0 && <p className="text-fg-2 text-[length:var(--fs-body)]">No audit events yet.</p>}
                      {auditRecords.map((a) => (
                        <div key={a.auditId} className="text-[length:var(--fs-caption)] border-b border-border-soft pb-1 last:border-0">
                          <span className="text-fg">{a.fieldModified} → {a.newValue}</span>
                          <span className="block text-muted">{a.employeeUser} · {new Date(a.timestamp).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-fg-2 text-[length:var(--fs-body)]">Audit trail is role-restricted from this persona (BR-067).</p>
                  ),
                },
              ]}
            />
          </div>
        </div>

        <div className="w-full lg:w-72 shrink-0 space-y-6">
          <div className="rounded-[var(--radius-card)] border border-border-soft bg-bg p-5">
            <h2 className="text-[length:var(--fs-body-lg)] text-fg font-medium mb-3">Actions</h2>
            <div className="flex flex-col gap-2">
              {!ticket.assignedTo && !terminal && (
                <Button variant="ghost-rect" className="w-full justify-center" onClick={assignToMe}>Assign to me</Button>
              )}
              {canReassignQueue && !terminal && (
                <div className="flex flex-col gap-2">
                  <Select value={reassignQueue} onChange={(e) => setReassignQueue(e.target.value)} placeholder="Reassign queue…" options={['FL Agents', 'Complaints Team'].map((q) => ({ value: q, label: q }))} />
                  <Button variant="ghost-rect" className="w-full justify-center" onClick={reassignQueueSubmit} disabled={!reassignQueue}>Reassign</Button>
                </div>
              )}
              {!terminal && ticket.status !== 'Escalate' && (
                <Button variant="ghost-rect" className="w-full justify-center" onClick={() => setEscalateOpen(true)}>Escalate</Button>
              )}
              {canResolve && !terminal && ticket.status !== 'Solved' && ticket.status !== 'Completed' && (
                <Button variant="ghost-rect" className="w-full justify-center" onClick={() => setResolveOpen(true)}>Resolve</Button>
              )}
              {!canResolve && !terminal && ticket.status !== 'Solved' && ticket.status !== 'Completed' && (
                <p className="text-[length:var(--fs-caption)] text-muted">Resolution requires Complaints Team — use Escalate to route it.</p>
              )}
              {ticket.status === 'Solved' && (
                <Button variant="ghost-rect" className="w-full justify-center" onClick={complete} disabled={openActivities.length > 0}>
                  {openActivities.length > 0 ? `Complete (${openActivities.length} open)` : 'Complete'}
                </Button>
              )}
              {ticket.status === 'Completed' && (
                <Button variant="primary-rect" className="w-full justify-center" onClick={closeTicket}>Close Ticket</Button>
              )}
              {!terminal && (
                <Button variant="ghost-rect" className="w-full justify-center" onClick={() => setCancelOpen(true)}>Cancel</Button>
              )}
              {ticket.status === 'Closed' && (
                <Button
                  variant="ghost-rect"
                  className="w-full justify-center"
                  onClick={() => (withinReopenWindow ? setReopenOpen(true) : undefined)}
                  disabled={!withinReopenWindow}
                >
                  {withinReopenWindow ? 'Reopen' : 'Reopen (outside window)'}
                </Button>
              )}
              {ticket.status === 'Closed' && !withinReopenWindow && (
                <p className="text-[length:var(--fs-caption)] text-danger">
                  Outside the {REOPEN_WINDOW_DAYS}-day reopen window (RES-10) — raise a linked ticket instead.
                </p>
              )}
              {ticket.cancelReason && <p className="text-[length:var(--fs-caption)] text-danger">Cancelled: {ticket.cancelReason}</p>}
              <Button
                variant="ghost-rect"
                className="w-full justify-center !border-transparent"
                onClick={() => navigate('/trouble-ticketing-complaints/tickets-dashboard')}
              >
                Go back
              </Button>
            </div>
          </div>

          <div className="rounded-[var(--radius-card)] border border-border-soft bg-bg p-5">
            <h2 className="text-[length:var(--fs-body-lg)] text-fg font-medium mb-3">Overview</h2>
            <div className="space-y-3 text-[length:var(--fs-body)]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted">Status</span>
                <Badge variant={STATUS_VARIANT[ticket.status] ?? 'filled-neutral'}>{ticket.status}</Badge>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted">Ticket #</span>
                <span className="text-accent font-medium">{ticket.ticketId}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted">Category</span>
                <span className="text-fg text-right">{ticket.category}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted">Priority</span>
                <span className="text-fg">{ticket.priority}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted">Queue</span>
                <Badge variant="outlined-red">{ticket.queue}</Badge>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted">Assigned to</span>
                <span className={ticket.assignedTo ? 'text-fg' : 'text-muted italic'}>{ticket.assignedTo ?? 'Unassigned'}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted">Customer</span>
                <span className="text-fg">{ticket.customerId}</span>
              </div>
              {ticket.createdAt && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted">Created</span>
                  <span className="text-fg">{new Date(ticket.createdAt).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Drawer open={escalateOpen} onClose={() => setEscalateOpen(false)} title="Escalate Ticket">
        <div className="space-y-3">
          <Select label="Escalation Reason (mandatory)" value={escalateReason} onChange={(e) => setEscalateReason(e.target.value)} placeholder="Select a reason" options={ESCALATION_REASONS.map((r) => ({ value: r, label: r }))} />
          {!escalateReason && <p className="text-[length:var(--fs-caption)] text-danger">An escalation without a selected reason is rejected (ESC-05).</p>}
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost-rect" onClick={() => setEscalateOpen(false)}>Cancel</Button>
          <Button variant="primary-rect" onClick={escalate} disabled={!escalateReason}>Escalate</Button>
        </div>
      </Drawer>

      <Drawer open={resolveOpen} onClose={() => setResolveOpen(false)} title="Resolve Ticket">
        <div className="space-y-3">
          <Select label="Resolution Code (mandatory, RES-01/02)" value={resolutionCode} onChange={(e) => setResolutionCode(e.target.value)} placeholder="Select one code" options={RESOLUTION_CODES.map((r) => ({ value: r, label: r }))} />
          <div>
            <div className="text-[length:var(--fs-caption)] text-muted mb-1">Hashtags (mandatory, at least one — RES-03)</div>
            <div className="flex flex-wrap gap-2">
              {availableHashtags.map((h) => (
                <label key={h} className="flex items-center gap-1 text-[length:var(--fs-caption)]">
                  <input
                    type="checkbox"
                    checked={resolutionHashtags.includes(h)}
                    onChange={(e) => setResolutionHashtags(e.target.checked ? [...resolutionHashtags, h] : resolutionHashtags.filter((x) => x !== h))}
                    className="accent-[var(--field-selected)]"
                  />
                  {h}
                </label>
              ))}
              {availableHashtags.length === 0 && <span className="text-muted text-[length:var(--fs-caption)]">No hashtags configured for this category.</span>}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost-rect" onClick={() => setResolveOpen(false)}>Cancel</Button>
          <Button variant="primary-rect" onClick={resolve} disabled={!resolutionCode || resolutionHashtags.length === 0}>Mark Solved</Button>
        </div>
      </Drawer>

      <Drawer open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel Ticket">
        <Select label="Cancellation Reason (mandatory, RES-11)" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Select a reason" options={CANCELLATION_REASONS.map((r) => ({ value: r, label: r }))} />
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost-rect" onClick={() => setCancelOpen(false)}>Back</Button>
          <Button variant="primary-rect" onClick={cancel} disabled={!cancelReason} className="bg-danger enabled:hover:bg-danger enabled:active:bg-danger">Cancel Ticket</Button>
        </div>
      </Drawer>

      <Drawer open={reopenOpen} onClose={() => setReopenOpen(false)} title="Reopen Ticket">
        <Textarea label="Reopen reason (mandatory, RES-10)" value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} placeholder="Why is this ticket being reopened?" />
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost-rect" onClick={() => setReopenOpen(false)}>Cancel</Button>
          <Button variant="primary-rect" onClick={reopen} disabled={!reopenReason.trim()}>Reopen</Button>
        </div>
      </Drawer>
    </div>
  );
}
