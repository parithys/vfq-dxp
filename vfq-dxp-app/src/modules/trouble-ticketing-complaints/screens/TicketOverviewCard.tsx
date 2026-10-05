import { Badge } from '../../../components/primitives/Badge';
import { STATUS_VARIANT } from '../../../data/reference/ticketReferenceData';
import type { Ticket } from './ticketDetailModel';

interface Props {
  ticket: Ticket;
}

export function TicketOverviewCard({ ticket }: Props) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg p-5">
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
  );
}
