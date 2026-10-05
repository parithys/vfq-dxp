import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable } from '../../../components/primitives/DataTable';
import { Badge } from '../../../components/primitives/Badge';
import { Button } from '../../../components/primitives/Button';
import { ErrorBanner } from '../../../components/primitives/ErrorBanner';
import { useEntityStore } from '../../../stores/entityStore';
import { useAuthStore } from '../../../stores/authStore';
import { isVisibleToAgent } from '../../../engines/agentTaskEngine';
import { TICKET_APPROVAL_ELIGIBLE_JOB_TITLES } from '../../../data/reference/ticketReferenceData';

interface Ticket {
  ticketId: string;
  customerId: string;
  category: string;
  status: string;
  priority: string;
  assignedApproverId?: string | null;
}

// Screen 16 (Approval Queue & Ticket Review) - mirrors
// src/modules/order-management/OrderApprovalQueue.tsx structurally (claim-
// based visibility via isVisibleToAgent, eligibility gate before the action
// button renders), against a ticket-appropriate eligibility list rather
// than the order module's category-keyed approval-matrix.json - see
// TICKET_APPROVAL_ELIGIBLE_JOB_TITLES's own comment in ticketReferenceData.ts
// for why no per-category matrix exists here.
interface TicketApprovalQueueProps {
  /** False when embedded in a parent that already provides padding
   * (SupportWorkspace's Tabs) - mirrors OrderApprovalQueue's own prop. */
  padded?: boolean;
}

export function TicketApprovalQueue({ padded = true }: TicketApprovalQueueProps) {
  const tickets = (useEntityStore((s) => s.records['trouble-tickets']) ?? []) as unknown as Ticket[];
  const loadKind = useEntityStore((s) => s.loadKind);
  const updateRecord = useEntityStore((s) => s.updateRecord);
  const loadError = useEntityStore((s) => s.errors['trouble-tickets']);
  const loading = useEntityStore((s) => s.loading['trouble-tickets']);
  const navigate = useNavigate();
  const currentAgentId = useAuthStore((s) => s.profile?.userId);
  const currentJobTitle = useAuthStore((s) => s.profile?.jobTitle);

  useEffect(() => {
    loadKind('trouble-tickets');
  }, [loadKind]);

  const pending = tickets
    .filter((t) => t.status === 'Pending Approval')
    .filter((t) => isVisibleToAgent(t.assignedApproverId, currentAgentId));

  const isEligible = () => TICKET_APPROVAL_ELIGIBLE_JOB_TITLES.includes(currentJobTitle ?? '');

  const assignToMe = (ticket: Ticket) => {
    if (ticket.assignedApproverId !== currentAgentId) {
      updateRecord('trouble-tickets', 'ticketId', ticket.ticketId, { assignedApproverId: currentAgentId ?? null });
    }
    navigate(`/trouble-ticketing-complaints/approval-review?id=${ticket.ticketId}`);
  };

  return (
    <div className={padded ? 'p-8' : ''}>
      <h1 className="text-[length:var(--fs-h3)] font-medium text-fg mb-1">Ticket Approval Queue</h1>
      <p className="text-fg-2 mb-6">Trouble tickets awaiting an approval decision.</p>
      <ErrorBanner message={loadError} />
      <DataTable<Ticket>
        columns={[
          { key: 'ticketId', header: 'Ticket #' },
          { key: 'customerId', header: 'Customer' },
          { key: 'category', header: 'Category' },
          { key: 'priority', header: 'Priority' },
          { key: 'status', header: 'Status', render: () => <Badge variant="accent">Pending Approval</Badge> },
          {
            key: 'action',
            header: '',
            render: (r) =>
              isEligible() ? (
                <Button variant="ghost-rect" compact onClick={() => assignToMe(r)}>
                  {r.assignedApproverId === currentAgentId ? 'Open' : 'Assign to Me'}
                </Button>
              ) : (
                <span className="text-muted text-[length:var(--fs-caption)]">
                  Requires: {TICKET_APPROVAL_ELIGIBLE_JOB_TITLES.join(' or ')}
                </span>
              ),
          },
        ]}
        rows={pending}
        rowKey={(r) => r.ticketId}
        emptyMessage="No tickets awaiting approval."
        loading={loading}
      />
    </div>
  );
}
