import { Badge } from '../../../components/primitives/Badge';
import { STATUS_VARIANT } from '../../../data/reference/ticketReferenceData';
import type { OsbNotification, Ticket } from './ticketDetailModel';

interface Props {
  ticket: Ticket;
  ragVariant: 'filled-neutral' | 'danger' | 'warning' | 'success';
  ragLabel: string;
  notesCount: number;
  slaMessage: string | undefined;
  surveyNotifications: OsbNotification[];
}

export function TicketHeaderCard({ ticket, ragVariant, ragLabel, notesCount, slaMessage, surveyNotifications }: Props) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg p-5">
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-[length:var(--fs-h3)] font-medium text-fg">Ticket {ticket.ticketId}</h1>
        <Badge variant={STATUS_VARIANT[ticket.status] ?? 'filled-neutral'}>{ticket.status}</Badge>
        <Badge variant={ragVariant}>SLA: {ragLabel}</Badge>
        <span className="ml-auto flex items-center gap-1 text-fg-2" title="Notifications">
          🔔 <span className="text-[length:var(--fs-caption)]">{notesCount}</span>
        </span>
      </div>
      <p className="text-fg-2 mb-1">
        Customer: {ticket.customerId} · {ticket.category}{ticket.area ? ` - ${ticket.area}` : ''} · Queue <Badge variant="outlined-red">{ticket.queue}</Badge>
      </p>
      <p className="text-fg-2 text-[length:var(--fs-caption)]">
        Assigned to: {ticket.assignedTo ?? 'Unassigned'} · {slaMessage}
      </p>
      <p className="text-fg-2 text-[length:var(--fs-caption)] mt-1">
        Customer feedback survey:{' '}
        {surveyNotifications.length > 0 ? (
          <span>Triggered on {new Date(surveyNotifications[surveyNotifications.length - 1].dbTimestamp).toLocaleString()}</span>
        ) : (
          <span className="italic text-muted">Not yet triggered</span>
        )}
      </p>
    </div>
  );
}
