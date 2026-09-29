import { DataTable } from '../../../components/primitives/DataTable';
import { Badge } from '../../../components/primitives/Badge';
import type { Customer360Data } from '../../../engines/customer360Engine';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'filled-neutral'> = {
  Applied: 'danger',
  Pending: 'warning',
  Waived: 'success',
};

/** Customer 360's "Penalty View" tab, over data.penalties
 * (commitment-penalties.json, already joined by customer360Engine). */
export function PenaltyViewSection({ data }: { data: Customer360Data }) {
  return (
    <DataTable
      rows={data.penalties}
      rowKey={(r) => String(r.penaltyId)}
      emptyMessage="No commitment penalties on file for this customer."
      columns={[
        { key: 'penaltyId', header: 'Penalty #' },
        { key: 'actionType', header: 'Action' },
        { key: 'calculatedValue', header: 'Amount (QAR)' },
        { key: 'calculatedAt', header: 'Calculated' },
        {
          key: 'status',
          header: 'Status',
          render: (r) => <Badge variant={STATUS_VARIANT[String(r.status)] ?? 'filled-neutral'}>{String(r.status)}</Badge>,
        },
      ]}
    />
  );
}
