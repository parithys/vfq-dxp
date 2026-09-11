import { TicketsDashboard } from '../../modules/trouble-ticketing-complaints/screens/TicketsDashboard';

// Cross-customer ticket queue — the standalone counterpart to Customer 360's
// Tickets tab (same `trouble-tickets` records, unfiltered here vs. filtered
// there). Wraps the existing screen unchanged rather than re-implementing it.
export function SupportWorkspace() {
  return <TicketsDashboard />;
}
