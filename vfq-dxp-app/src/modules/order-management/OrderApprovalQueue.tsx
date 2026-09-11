import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable } from '../../components/primitives/DataTable';
import { Badge } from '../../components/primitives/Badge';
import { Button } from '../../components/primitives/Button';
import { useEntityStore } from '../../stores/entityStore';
import { useAuthStore } from '../../stores/authStore';
import { isVisibleToAgent } from '../../engines/agentTaskEngine';

interface Order {
  orderId: string;
  orderType: string;
  status: string;
  customerName?: string;
  assignedApproverId?: string | null;
}

// SCR-060/SCR-197: TM SR Queue View / Order Approval Queue — manager queue of
// order-approval activities awaiting assignment ("Assign to Me" per
// guided-journeys-fixed-line-open-ui-tablet-fixed-line-prepatc-aa41d84a).
// Filters to orders in `Submitted for Approval` status — B2B2C orders from the
// New Fixed Line/FWA/Postpaid wizards route here (see those wizards' onSubmit).
//
// Agent 360 AAV-02: "display all approval tasks assigned to the specific
// agent." Previously "Assign to Me" was a pure navigation button — it never
// recorded who claimed the order, so every approver saw the same shared
// queue forever. It now sets assignedApproverId on click, and the queue
// hides orders claimed by someone else (isVisibleToAgent — same rule as
// Agent Task View's per-agent scoping).
export function OrderApprovalQueue() {
  const orders = (useEntityStore((s) => s.records.orders) ?? []) as unknown as Order[];
  const loadKind = useEntityStore((s) => s.loadKind);
  const updateRecord = useEntityStore((s) => s.updateRecord);
  const loadError = useEntityStore((s) => s.errors.orders);
  const loading = useEntityStore((s) => s.loading.orders);
  const navigate = useNavigate();
  const currentAgentId = useAuthStore((s) => s.profile?.userId);

  useEffect(() => {
    loadKind('orders');
  }, [loadKind]);

  const pending = orders
    .filter((o) => o.status === 'Submitted for Approval')
    .filter((o) => isVisibleToAgent(o.assignedApproverId, currentAgentId));

  const assignToMe = (order: Order) => {
    if (order.assignedApproverId !== currentAgentId) {
      updateRecord('orders', 'orderId', order.orderId, { assignedApproverId: currentAgentId ?? null });
    }
    navigate(`/order-management/order-approval-detail-attachments-order-details-activities-a?id=${order.orderId}`);
  };

  return (
    <div className="p-8">
      <h1 className="text-[length:var(--fs-h3)] font-medium text-fg mb-1">Order Approval Queue</h1>
      <p className="text-fg-2 mb-6">Queues: ADJ_APPR_QUEUE_BUSI_1000, VFQA_DSA_ORDER_APPROVAL_QUEUE_DSQ/JAGUAR/TESTING/VISTAS</p>
      {loadError && (
        <div className="mb-4 rounded border border-danger px-4 py-3 text-[length:var(--fs-body)] text-danger">
          {loadError}
        </div>
      )}
      <DataTable<Order>
        columns={[
          { key: 'orderId', header: 'Order #' },
          { key: 'customerName', header: 'Contact' },
          { key: 'orderType', header: 'Order Type' },
          { key: 'status', header: 'Approval Status', render: (r) => <Badge variant="warning">{r.status}</Badge> },
          {
            key: 'action',
            header: '',
            render: (r) => (
              <Button variant="ghost-rect" compact onClick={() => assignToMe(r)}>
                {r.assignedApproverId === currentAgentId ? 'Open' : 'Assign to Me'}
              </Button>
            ),
          },
        ]}
        rows={pending}
        rowKey={(r) => r.orderId}
        emptyMessage="No orders awaiting approval."
        loading={loading}
      />
    </div>
  );
}
