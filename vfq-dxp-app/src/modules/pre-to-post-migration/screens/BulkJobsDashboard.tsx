import { useEffect } from 'react';
import { DataTable } from '../../../components/primitives/DataTable';
import { Badge } from '../../../components/primitives/Badge';
import { useEntityStore } from '../../../stores/entityStore';

interface BulkJob {
  bulkOrderId: string;
  jobType?: string;
  method?: string;
  msisdn?: string;
  orderIdReference?: string;
  promotionId?: string;
  billLimit?: number;
  overallStatus: string;
  updatedAt?: string;
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'filled-neutral'> = {
  Processed: 'success',
  Completed: 'success',
  'Partial Success': 'warning',
  'In Processing': 'warning',
  Error: 'danger',
};

// SCR-183: Bulk Jobs / Bulk Processing screen (TM Bulk Batch List Applet) —
// backend orchestration-status screen shared with the Enterprise/IoT bulk
// adjustment screens (Pattern 17); BR-273: Pre2Post migration orders progress
// asynchronously to Complete via this job queue (job type "PreToPost").
export function BulkJobsDashboard() {
  const jobs = (useEntityStore((s) => s.records['bulk-activation-orders']) ?? []) as unknown as BulkJob[];
  const loadKind = useEntityStore((s) => s.loadKind);

  useEffect(() => {
    loadKind('bulk-activation-orders');
  }, [loadKind]);

  return (
    <div className="p-8">
      <h1 className="text-[length:var(--fs-h3)] font-medium text-fg mb-1">Bulk Jobs</h1>
      <p className="text-fg-2 mb-6">TM Bulk Batch List Applet — backend bulk processing job status.</p>
      <DataTable<BulkJob>
        columns={[
          { key: 'bulkOrderId', header: 'Job #' },
          { key: 'jobType', header: 'Job Type', render: (r) => r.jobType ?? r.method ?? '—' },
          { key: 'msisdn', header: 'MSISDN / Reference', render: (r) => r.msisdn ?? r.orderIdReference ?? '—' },
          { key: 'promotionId', header: 'Promotion' },
          { key: 'overallStatus', header: 'Status', render: (r) => <Badge variant={STATUS_VARIANT[r.overallStatus] ?? 'filled-neutral'}>{r.overallStatus}</Badge> },
          { key: 'updatedAt', header: 'Updated', render: (r) => (r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '—') },
        ]}
        rows={jobs}
        rowKey={(r) => r.bulkOrderId}
        emptyMessage="No bulk jobs."
      />
    </div>
  );
}
