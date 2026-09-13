import { useEffect } from 'react';
import { DataTable } from '../../components/primitives/DataTable';
import { Badge } from '../../components/primitives/Badge';
import { useEntityStore } from '../../stores/entityStore';

interface Order {
  orderId: string;
  orderType: string;
  status: string;
  customerName?: string;
  msisdn?: string;
}

const statusVariant = (status: string) => {
  if (status === 'Complete') return 'success' as const;
  if (status === 'Cancelled' || status.startsWith('Rejected')) return 'danger' as const;
  if (status === 'Submitted for Approval') return 'warning' as const;
  return 'filled-neutral' as const;
};

// SCR-059: My Sales Orders / My Pending Approval Orders queue — agent view of
// own submitted orders and their approval status (evidenced across Fixed
// Line/FWA/Postpaid B2B2C guided journeys).
interface MySalesOrdersProps {
  /** False when embedded in a parent that already provides the same padding
   * (OrdersWorkspace's own p-8 around its Tabs) — true (self-padded) for the
   * standalone legacy-route usage at SCR-059, which has no other padding
   * source. */
  padded?: boolean;
}

export function MySalesOrders({ padded = true }: MySalesOrdersProps) {
  const orders = (useEntityStore((s) => s.records.orders) ?? []) as unknown as Order[];
  const loadKind = useEntityStore((s) => s.loadKind);
  const loading = useEntityStore((s) => s.loading.orders);

  useEffect(() => {
    loadKind('orders');
  }, [loadKind]);

  return (
    <div className={padded ? 'p-8' : ''}>
      <h1 className="text-[length:var(--fs-h3)] font-medium text-fg mb-1">My Sales Orders</h1>
      <p className="text-fg-2 mb-6">{orders.length} order(s).</p>
      <DataTable<Order>
        columns={[
          { key: 'orderId', header: 'Order #' },
          { key: 'customerName', header: 'Contact' },
          { key: 'orderType', header: 'Order Type' },
          { key: 'msisdn', header: 'MSISDN' },
          { key: 'status', header: 'Approval Status', render: (r) => <Badge variant={statusVariant(r.status)}>{r.status}</Badge> },
        ]}
        rows={orders}
        rowKey={(r) => r.orderId}
        emptyMessage="No orders submitted yet — build one via a New Fixed Line/FWA/Postpaid wizard first."
        loading={loading}
      />
    </div>
  );
}
