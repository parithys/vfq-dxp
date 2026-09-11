import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable } from '../../../components/primitives/DataTable';
import { Badge } from '../../../components/primitives/Badge';
import { Button } from '../../../components/primitives/Button';
import { useEntityStore } from '../../../stores/entityStore';
import { TicketCreationModal, type NewTicketValue } from '../../../modules/trouble-ticketing-complaints/screens/TicketCreationModal';
import { STATUS_VARIANT, buildNewTicketRecord } from '../../../modules/trouble-ticketing-complaints/ticketReferenceData';
import type { Customer360Data } from '../../../engines/customer360Engine';

// Create Ticket and Track Ticket are the two real Support actions available
// from Customer 360 — both reuse the exact same TicketCreationModal/entity
// records the standalone Support workspace uses, just pre-scoped to this
// customer. Escalation/Complaints/Service Requests are ticket *categories*
// selected inside that same modal, not separate screens, so they aren't
// listed as distinct actions here.
export function TicketsSection({ data }: { data: Customer360Data }) {
  const navigate = useNavigate();
  const createRecord = useEntityStore((s) => s.createRecord);
  const [modalOpen, setModalOpen] = useState(false);

  const createTicket = async (value: NewTicketValue) => {
    const ticketId = `TT-${Date.now().toString().slice(-6)}`;
    await createRecord('trouble-tickets', buildNewTicketRecord({ ticketId, ...value, createdBy: 'AGENT-VINODHINIR' }));
    setModalOpen(false);
  };

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button variant="primary-rect" compact onClick={() => setModalOpen(true)}>
          Create Ticket
        </Button>
      </div>
      <DataTable
        rows={data.tickets}
        rowKey={(r) => String(r.ticketId)}
        emptyMessage="No tickets on file for this customer."
        onRowClick={(r) => navigate(`/trouble-ticketing-complaints/ticket-homepage?id=${r.ticketId}`)}
        columns={[
          { key: 'ticketId', header: 'Ticket #' },
          { key: 'category', header: 'Category' },
          { key: 'actualIssue', header: 'Issue' },
          { key: 'priority', header: 'Priority' },
          {
            key: 'status',
            header: 'Status',
            render: (r) => <Badge variant={STATUS_VARIANT[String(r.status)] ?? 'filled-neutral'}>{String(r.status)}</Badge>,
          },
        ]}
      />
      <TicketCreationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={createTicket}
        initialCustomerId={data.customer.customerId}
      />
    </div>
  );
}
