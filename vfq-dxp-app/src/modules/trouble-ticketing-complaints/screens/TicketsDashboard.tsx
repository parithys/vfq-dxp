import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable } from '../../../components/primitives/DataTable';
import { Badge } from '../../../components/primitives/Badge';
import { Button } from '../../../components/primitives/Button';
import { Input } from '../../../components/primitives/Input';
import { Select } from '../../../components/primitives/Select';
import { useEntityStore } from '../../../stores/entityStore';
import { useNotificationStore } from '../../../stores/notificationStore';
import { evaluateRule } from '../../../engines/ruleEngine';
import { downloadCsv } from '../../../engines/csvExport';
import { TicketCreationModal } from './TicketCreationModal';
import type { NewTicketValue } from './TicketCreationModal';
import { STATUS_VARIANT, TICKET_STATUSES, buildNewTicketRecord } from '../ticketReferenceData';

const CURRENT_AGENT = 'Current Agent';

interface Ticket {
  ticketId: string;
  customerId: string;
  status: string;
  category: string;
  actualIssue?: string;
  queue: string;
  priority: string;
  assignedTo?: string | null;
  slaDueAt?: string;
  escalations?: { escalatedBy: string }[];
}

function ragVariant(ticket: Ticket): 'success' | 'warning' | 'danger' | 'filled-neutral' {
  const rule = evaluateRule('BR-349', { slaDueAt: ticket.slaDueAt, status: ticket.status });
  if (!ticket.slaDueAt || ticket.status === 'Closed' || ticket.status === 'Cancelled') return 'filled-neutral';
  if (!rule.pass) return 'danger';
  return rule.message?.includes('Amber') ? 'warning' : 'success';
}

// SCR-211: Tickets Dashboard. Extended per the Trouble Ticket BRSD gap
// analysis (2026-09-11) to close MPRA_001_VEW-01/02/03/06 (list filters,
// Excel export, My/All Trouble Tickets views, RAG status indicator) and
// ESC-09 ("escalated to me" filter) — "My Team's Trouble Tickets" is not
// modelled since no team-roster entity exists anywhere in this app to
// resolve it from; only the two views this schema can actually support
// (My / All) are built, rather than a fabricated team grouping.
export function TicketsDashboard() {
  const tickets = (useEntityStore((s) => s.records['trouble-tickets']) ?? []) as unknown as Ticket[];
  const loadKind = useEntityStore((s) => s.loadKind);
  const loading = useEntityStore((s) => s.loading['trouble-tickets']);
  const createRecord = useEntityStore((s) => s.createRecord);
  const pushToast = useNotificationStore((s) => s.pushToast);
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [queueFilter, setQueueFilter] = useState('');
  const [view, setView] = useState<'all' | 'mine' | 'escalated'>('all');

  useEffect(() => {
    loadKind('trouble-tickets');
  }, [loadKind]);

  const counts = tickets.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {});

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (view === 'mine' && t.assignedTo !== CURRENT_AGENT) return false;
      if (view === 'escalated' && t.status !== 'Escalate') return false;
      if (statusFilter && t.status !== statusFilter) return false;
      if (priorityFilter && t.priority !== priorityFilter) return false;
      if (queueFilter && t.queue !== queueFilter) return false;
      if (q && !(t.ticketId.toLowerCase().includes(q) || t.customerId.toLowerCase().includes(q) || t.category.toLowerCase().includes(q) || (t.actualIssue ?? '').toLowerCase().includes(q))) {
        return false;
      }
      return true;
    });
  }, [tickets, search, statusFilter, priorityFilter, queueFilter, view]);

  const createTicket = async (value: NewTicketValue) => {
    const ticketId = `TT-${Date.now().toString().slice(-6)}`;
    await createRecord('trouble-tickets', buildNewTicketRecord({ ticketId, ...value, createdBy: 'AGENT-VINODHINIR' }));
    pushToast('success', `Ticket ${ticketId} submitted to ${value.queue}.`);
    setModalOpen(false);
  };

  const exportList = () => {
    downloadCsv(
      `trouble-tickets-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((t) => ({
        'Ticket #': t.ticketId,
        Customer: t.customerId,
        Category: t.category,
        Queue: t.queue,
        Priority: t.priority,
        Status: t.status,
        'Assigned To': t.assignedTo ?? '',
      }))
    );
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[length:var(--fs-h3)] font-medium text-fg mb-1">Tickets Dashboard</h1>
          <p className="text-fg-2">Trouble tickets and complaints across all queues.</p>
        </div>
        <Button variant="primary-rect" onClick={() => setModalOpen(true)}>
          New Ticket
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {TICKET_STATUSES.map((status) => (
          <div key={status} className="rounded-[var(--radius-card)] border border-border-soft bg-bg p-4">
            <div className="text-[length:var(--fs-caption)] text-muted">{status}</div>
            <div className="text-[length:var(--fs-h3)] text-fg font-medium">{counts[status] ?? 0}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="flex gap-1 border-b border-border-soft">
          {(
            [
              ['all', 'All Trouble Tickets'],
              ['mine', 'My Trouble Tickets'],
              ['escalated', 'Escalated to Me'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`px-3 py-1.5 text-[length:var(--fs-body)] border-b-2 -mb-px ${
                view === key ? 'border-accent text-accent font-medium' : 'border-transparent text-fg-2'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-end gap-2">
          <Input placeholder="Search ticket #, customer, category, issue…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            placeholder="Status"
            options={TICKET_STATUSES.map((s) => ({ value: s, label: s }))}
          />
          <Select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            placeholder="Priority"
            options={['1-ASAP', '2-High', '3-Medium', '4-Low'].map((p) => ({ value: p, label: p }))}
          />
          <Select
            value={queueFilter}
            onChange={(e) => setQueueFilter(e.target.value)}
            placeholder="Queue"
            options={['FL Agents', 'Complaints Team'].map((q) => ({ value: q, label: q }))}
          />
          <Button variant="ghost-rect" onClick={exportList} disabled={filtered.length === 0}>
            Export (CSV)
          </Button>
        </div>
      </div>

      <DataTable<Ticket>
        columns={[
          { key: 'ticketId', header: 'Ticket #' },
          { key: 'customerId', header: 'Customer' },
          { key: 'category', header: 'Category' },
          { key: 'queue', header: 'Queue' },
          { key: 'priority', header: 'Priority' },
          { key: 'assignedTo', header: 'Assigned To', render: (r) => r.assignedTo ?? '—' },
          { key: 'status', header: 'Status', render: (r) => <Badge variant={STATUS_VARIANT[r.status] ?? 'filled-neutral'}>{r.status}</Badge> },
          { key: 'rag', header: 'SLA', render: (r) => <Badge variant={ragVariant(r)}>{ragVariant(r) === 'danger' ? 'Red' : ragVariant(r) === 'warning' ? 'Amber' : ragVariant(r) === 'success' ? 'Green' : '—'}</Badge> },
        ]}
        rows={filtered}
        rowKey={(r) => r.ticketId}
        onRowClick={(r) => navigate(`/trouble-ticketing-complaints/ticket-detail-screen-public-notes-bell-icon-notifications?id=${r.ticketId}`)}
        emptyMessage="No trouble tickets match the current filters."
        loading={loading}
      />

      <TicketCreationModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmit={createTicket} />
    </div>
  );
}
