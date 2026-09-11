import { useNavigate } from 'react-router-dom';
import { DataTable } from '../../../components/primitives/DataTable';
import { Badge } from '../../../components/primitives/Badge';
import type { Customer360Data } from '../../../engines/customer360Engine';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'filled-neutral'> = {
  Complete: 'success',
  Cancelled: 'danger',
  'Submitted for Approval': 'warning',
};

// Same underlying `orders` records the cross-customer Orders workspace
// shows, filtered to this customer by customer360Engine — not a separate
// data source, so there's nothing to keep in sync.
export function OrdersSection({ data }: { data: Customer360Data }) {
  const navigate = useNavigate();
  return (
    <DataTable
      rows={data.orders}
      rowKey={(r) => String(r.orderId)}
      emptyMessage="No orders on file for this customer."
      onRowClick={(r) => navigate(`/order-management/order-approval-detail-attachments-order-details-activities-a?id=${r.orderId}`)}
      columns={[
        { key: 'orderId', header: 'Order #' },
        { key: 'orderType', header: 'Type' },
        { key: 'msisdn', header: 'MSISDN' },
        { key: 'totalQAR', header: 'Total (QAR)' },
        {
          key: 'status',
          header: 'Status',
          render: (r) => <Badge variant={STATUS_VARIANT[String(r.status)] ?? 'filled-neutral'}>{String(r.status)}</Badge>,
        },
      ]}
    />
  );
}
