import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable } from '../../components/primitives/DataTable';
import { Badge } from '../../components/primitives/Badge';
import { Button } from '../../components/primitives/Button';
import { useEntityStore } from '../../stores/entityStore';

interface Order {
  orderId: string;
  orderType: string;
  status: string;
  customerName?: string;
}

// SCR-060/SCR-197: TM SR Queue View / Order Approval Queue — manager queue of
// order-approval activities awaiting assignment ("Assign to Me" per
// guided-journeys-fixed-line-open-ui-tablet-fixed-line-prepatc-aa41d84a).
// Filters to orders in `Submitted for Approval` status — B2B2C orders from the
// New Fixed Line/FWA/Postpaid wizards route here (see those wizards' onSubmit).
export function OrderApprovalQueue() {
  const orders = (useEntityStore((s) => s.records.orders) ?? []) as unknown as Order[];
  const loadKind = useEntityStore((s) => s.loadKind);
  const navigate = useNavigate();

  useEffect(() => {
    loadKind('orders');
  }, [loadKind]);

  const pending = orders.filter((o) => o.status === 'Submitted for Approval');

  return (
    <div className="p-8">
      <h1 className="text-[length:var(--fs-h3)] font-medium text-fg mb-1">Order Approval Queue</h1>
      <p className="text-fg-2 mb-6">Queues: ADJ_APPR_QUEUE_BUSI_1000, VFQA_DSA_ORDER_APPROVAL_QUEUE_DSQ/JAGUAR/TESTING/VISTAS</p>
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
              <Button variant="ghost-rect" compact onClick={() => navigate(`/order-management/order-approval-detail-attachments-order-details-activities-a?id=${r.orderId}`)}>
                Assign to Me
              </Button>
            ),
          },
        ]}
        rows={pending}
        rowKey={(r) => r.orderId}
        emptyMessage="No orders awaiting approval."
      />
    </div>
  );
}
