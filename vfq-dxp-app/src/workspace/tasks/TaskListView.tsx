import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DataTable } from '../../components/primitives/DataTable';
import { Badge } from '../../components/primitives/Badge';
import { ErrorBanner } from '../../components/primitives/ErrorBanner';
import { useEntityStore } from '../../stores/entityStore';
import { useAuthStore } from '../../stores/authStore';
import { isVisibleToAgent } from '../../engines/agentTaskEngine';
import { PageHeader } from '../../components/patterns/PageHeader';

interface AgentTask {
  taskId: string;
  taskName: string;
  taskType: string;
  taskStatus: string;
  priorityFlag: boolean;
  assignedAgentId: string | null;
  createdAt: string;
  /** Set on a Draft Order task whose order is stored - see orders.json. */
  relatedOrderId?: string;
}

/** The fields a Draft Order row needs to resume into its journey. */
interface DraftOrder {
  orderId: string;
  status: string;
  draftResumePath?: string;
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'filled-neutral' | 'outlined-red'> = {
  Open: 'warning',
  Assigned: 'filled-neutral',
  'In Progress': 'outlined-red',
  Closed: 'success',
};

const FILTER_LABELS: Record<string, string> = {
  open: 'Open Tasks',
  'in-progress': 'In Progress Tasks',
  payments: 'Pending Payments',
  priority: 'Priority Tasks',
  'draft-orders': 'Draft Orders',
};

// Agent 360 ATV-01/04: the task dashboard's 5 category tiles drill into this
// filtered list; selecting a row opens the task detail (ATV-04). Filtering
// logic mirrors Dashboard.tsx's tile counts exactly - see that file's
// comment on how the 5 BRSD categories map onto taskStatus/taskType/
// priorityFlag, since the BRSD itself leaves the derivation open (OI-AGN-14/18).
export function TaskListView() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const filter = params.get('filter') ?? 'open';
  const tasks = (useEntityStore((s) => s.records.tasks) ?? []) as unknown as AgentTask[];
  const loadKind = useEntityStore((s) => s.loadKind);
  const loading = useEntityStore((s) => s.loading.tasks);
  const loadError = useEntityStore((s) => s.errors.tasks);
  const currentAgentId = useAuthStore((s) => s.profile?.userId);

  // Orders too, so a Draft Order row knows where its journey resumes. Read
  // from the store the rest of this screen already uses rather than a separate
  // fetch, so the row click has the path in hand and does not have to await
  // anything mid-navigation.
  const orders = (useEntityStore((s) => s.records.orders) ?? []) as unknown as DraftOrder[];
  const draftOrders = Object.fromEntries(
    orders.filter((o) => o.status === 'Draft').map((o) => [o.orderId, o])
  );

  useEffect(() => {
    loadKind('tasks');
    loadKind('orders');
  }, [loadKind]);

  // ATV-02 - see Dashboard.tsx's tile counts for the same rule; kept
  // consistent via the shared isVisibleToAgent() predicate.
  const openTasks = tasks
    .filter((t) => t.taskStatus !== 'Closed')
    .filter((t) => isVisibleToAgent(t.assignedAgentId, currentAgentId));
  const filtered = {
    open: openTasks.filter((t) => t.taskStatus === 'Open'),
    'in-progress': openTasks.filter((t) => t.taskStatus === 'In Progress'),
    payments: openTasks.filter((t) => t.taskType === 'Payment'),
    priority: openTasks.filter((t) => t.priorityFlag),
    'draft-orders': openTasks.filter((t) => t.taskType === 'Draft Order'),
  }[filter] ?? openTasks;

  return (
    <div className="p-8">
      <PageHeader title={<>{FILTER_LABELS[filter] ?? 'My Tasks'}</>} description={<>{filtered.length} task(s).</>} />
      <ErrorBanner message={loadError} />
      <DataTable<AgentTask>
        columns={[
          { key: 'taskId', header: 'Task ID' },
          { key: 'taskName', header: 'Task Name' },
          { key: 'taskType', header: 'Type' },
          {
            key: 'priorityFlag',
            header: 'Priority',
            render: (t) => (t.priorityFlag ? <Badge variant="danger">Priority</Badge> : <span>-</span>),
          },
          {
            key: 'taskStatus',
            header: 'Status',
            render: (t) => <Badge variant={STATUS_VARIANT[t.taskStatus] ?? 'filled-neutral'}>{t.taskStatus}</Badge>,
          },
          { key: 'assignedAgentId', header: 'Assigned To' },
        ]}
        rows={filtered}
        rowKey={(t) => t.taskId}
        // A Draft Order row RESUMES its journey; every other task opens its
        // detail view. This is the only way back into an unfinished journey -
        // the product-line cards always start a new one - so the row has to
        // land the agent in the wizard rather than on a page describing it.
        //
        // Falls back to task detail when the task carries no relatedOrderId:
        // TASK-70006 is a GigaHome draft with no seeded fixed-line order, and
        // sending it into a postpaid journey would resume something it is not
        // about.
        onRowClick={(t) => {
          const order = t.relatedOrderId ? draftOrders[t.relatedOrderId] : undefined;
          if (order?.draftResumePath) {
            navigate(order.draftResumePath, { state: { resumeOrderId: order.orderId } });
            return;
          }
          navigate(`/tasks/${t.taskId}`);
        }}
        emptyMessage="No tasks in this category."
        loading={loading}
      />
    </div>
  );
}
