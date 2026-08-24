import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable } from '../../../components/primitives/DataTable';
import { Badge } from '../../../components/primitives/Badge';
import { Button } from '../../../components/primitives/Button';
import { useEntityStore } from '../../../stores/entityStore';
import { useNotificationStore } from '../../../stores/notificationStore';
import { TicketCreationModal } from './TicketCreationModal';
import type { NewTicketValue } from './TicketCreationModal';

interface Ticket {
  ticketId: string;
  customerId: string;
  status: string;
  category: string;
  actualIssue?: string;
  queue: string;
  priority: string;
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'filled-neutral'> = {
  Open: 'warning',
  Resolved: 'success',
  Closed: 'success',
  Reopened: 'danger',
};

// SCR-211: Tickets Dashboard — generic dashboard shape (tiles/counters + grid,
// drill-down nav) per screen-behaviour-catalogue.md; evidence for this screen
// is title-only (slide 35), so the counters/grid are the Assumed dashboard
// baseline, not an invented richer design.
export function TicketsDashboard() {
  const tickets = (useEntityStore((s) => s.records['trouble-tickets']) ?? []) as unknown as Ticket[];
  const loadKind = useEntityStore((s) => s.loadKind);
  const createRecord = useEntityStore((s) => s.createRecord);
  const pushToast = useNotificationStore((s) => s.pushToast);
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    loadKind('trouble-tickets');
  }, [loadKind]);

  const counts = tickets.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {});

  const createTicket = async (value: NewTicketValue) => {
    const ticketId = `TT-${Date.now().toString().slice(-6)}`;
    await createRecord('trouble-tickets', {
      ticketId,
      customerId: value.customerId,
      status: 'Open',
      category: value.issueType,
      actualIssue: value.template || value.templateContent.slice(0, 40),
      queue: value.queue,
      priority: value.priority,
      hashtags: [],
      publicNotes: [],
    });
    pushToast('success', `Ticket ${ticketId} submitted to ${value.queue}.`);
    setModalOpen(false);
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
        {['Open', 'Resolved', 'Reopened', 'Closed'].map((status) => (
          <div key={status} className="rounded-[var(--radius-card)] border border-border-soft p-4">
            <div className="text-[length:var(--fs-caption)] text-muted">{status}</div>
            <div className="text-[length:var(--fs-h3)] text-fg font-medium">{counts[status] ?? 0}</div>
          </div>
        ))}
      </div>

      <DataTable<Ticket>
        columns={[
          { key: 'ticketId', header: 'Ticket #' },
          { key: 'customerId', header: 'Customer' },
          { key: 'category', header: 'Category' },
          { key: 'queue', header: 'Queue' },
          { key: 'priority', header: 'Priority' },
          { key: 'status', header: 'Status', render: (r) => <Badge variant={STATUS_VARIANT[r.status] ?? 'filled-neutral'}>{r.status}</Badge> },
        ]}
        rows={tickets}
        rowKey={(r) => r.ticketId}
        onRowClick={(r) => navigate(`/trouble-ticketing-complaints/ticket-detail-screen-public-notes-bell-icon-notifications?id=${r.ticketId}`)}
        emptyMessage="No trouble tickets."
      />

      <TicketCreationModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmit={createTicket} />
    </div>
  );
}
