import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Badge } from '../../../components/primitives/Badge';
import { Button } from '../../../components/primitives/Button';
import { Textarea } from '../../../components/primitives/Textarea';
import { Tabs } from '../../../components/primitives/Tabs';
import { useEntityStore } from '../../../stores/entityStore';
import { useNotificationStore } from '../../../stores/notificationStore';
import { evaluateRule } from '../../../engines/ruleEngine';

interface PublicNote {
  author: string;
  text: string;
  createdAt: string;
}
interface Ticket {
  ticketId: string;
  customerId: string;
  status: string;
  category: string;
  actualIssue?: string;
  queue: string;
  priority: string;
  publicNotes?: PublicNote[];
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'filled-neutral'> = {
  Open: 'warning',
  Resolved: 'success',
  Closed: 'success',
  Reopened: 'danger',
};

// SCR-029 (Ticket detail: public notes / bell icon notifications) + SCR-210
// (Ticket Homepage: fields filled by which role is responsible, internal
// Activities) — both describe the same central ticket-management page from
// two evidenced angles, so they share this one component. Public notes are
// rendered as their own prominent panel (not tucked in a tab) directly
// addressing the evidenced UX complaint that agents currently miss them
// next to the bell icon (screens.md SCR-029).
export function TicketDetail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const ticketId = params.get('id');
  const tickets = (useEntityStore((s) => s.records['trouble-tickets']) ?? []) as unknown as Ticket[];
  const loadKind = useEntityStore((s) => s.loadKind);
  const updateRecord = useEntityStore((s) => s.updateRecord);
  const pushToast = useNotificationStore((s) => s.pushToast);
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    loadKind('trouble-tickets');
  }, [loadKind]);

  const ticket = tickets.find((t) => t.ticketId === ticketId);
  if (!ticket) {
    return <div className="p-8 text-fg-2">No ticket selected — go back to the Tickets Dashboard.</div>;
  }

  const notes = ticket.publicNotes ?? [];

  const addNote = async () => {
    if (!noteText.trim()) return;
    const next = [...notes, { author: 'Current Agent', text: noteText, createdAt: new Date().toISOString() }];
    await updateRecord('trouble-tickets', 'ticketId', ticket.ticketId, { publicNotes: next });
    setNoteText('');
  };

  const reopen = async () => {
    const rule = evaluateRule('BR-066', {});
    await updateRecord('trouble-tickets', 'ticketId', ticket.ticketId, { status: 'Reopened' });
    pushToast(rule.pass ? 'warning' : 'error', `Ticket ${ticket.ticketId} reopened.`);
  };

  const canReopen = ticket.status === 'Resolved' || ticket.status === 'Closed';

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-[length:var(--fs-h3)] font-medium text-fg">Ticket {ticket.ticketId}</h1>
        <Badge variant={STATUS_VARIANT[ticket.status] ?? 'filled-neutral'}>{ticket.status}</Badge>
        <span className="ml-auto flex items-center gap-1 text-fg-2" title="Notifications">
          🔔 <span className="text-[length:var(--fs-caption)]">{notes.length}</span>
        </span>
      </div>
      <p className="text-fg-2 mb-6">
        Customer: {ticket.customerId} · {ticket.category} · Owned by <Badge variant="outlined-red">{ticket.queue}</Badge>
      </p>

      <div className="rounded-[var(--radius-card)] border border-border-soft bg-bg p-4 mb-6">
        <h2 className="text-fg font-medium mb-3">Public Notes</h2>
        <div className="space-y-2 mb-3">
          {notes.length === 0 && <p className="text-fg-2 text-[length:var(--fs-body)]">No public notes yet.</p>}
          {notes.map((n, i) => (
            <div key={i} className="text-[length:var(--fs-body)] border-l-2 border-accent pl-3">
              <p className="text-fg">{n.text}</p>
              <p className="text-[length:var(--fs-caption)] text-muted">{n.author} — {new Date(n.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
        <Textarea placeholder="Add a public note…" value={noteText} onChange={(e) => setNoteText(e.target.value)} />
        <Button variant="ghost-rect" className="mt-2" onClick={addNote} disabled={!noteText.trim()}>
          Add Note
        </Button>
      </div>

      <Tabs
        items={[
          {
            key: 'details',
            label: 'Details',
            content: (
              <dl className="grid grid-cols-2 gap-4 text-[length:var(--fs-body)]">
                <div>
                  <dt className="text-[length:var(--fs-caption)] text-muted">Issue</dt>
                  <dd className="text-fg">{ticket.actualIssue ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-[length:var(--fs-caption)] text-muted">Priority</dt>
                  <dd className="text-fg">{ticket.priority}</dd>
                </div>
              </dl>
            ),
          },
          {
            key: 'activities',
            label: 'Activities',
            content: <p className="text-fg-2 text-[length:var(--fs-body)]">Internal activity log for this ticket (status changes, reopens).</p>,
          },
        ]}
      />

      <div className="flex gap-2 mt-6">
        {canReopen && (
          <Button variant="ghost-rect" onClick={reopen}>
            Reopen (Agent only)
          </Button>
        )}
        <Button variant="ghost-rect" onClick={() => navigate('/trouble-ticketing-complaints/tickets-dashboard')}>
          Go Back
        </Button>
      </div>
    </div>
  );
}
