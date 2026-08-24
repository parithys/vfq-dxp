import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { DataTable } from '../../../components/primitives/DataTable';
import { Badge } from '../../../components/primitives/Badge';
import { Button } from '../../../components/primitives/Button';
import { Modal } from '../../../components/primitives/Modal';
import { Select } from '../../../components/primitives/Select';
import { Textarea } from '../../../components/primitives/Textarea';
import { useEntityStore } from '../../../stores/entityStore';
import { useNotificationStore } from '../../../stores/notificationStore';
import * as mockDataEngine from '../../../engines/mockDataEngine';

interface SimSwapOrder {
  simSwapOrderId: string;
  msisdn: string;
  newSimSerialNumber?: string;
  simSwapReason?: string;
  chargeStatus?: string;
  comments?: string;
  status: string;
}
interface RejectReason {
  reasonCode: string;
  reasonLabel: string;
}

// SCR-196: SIM Swap Queue / Order tasks tab — UJ-091: "Open SIM Swap Queue ->
// Order tasks tab -> select order -> Assign to Me -> open via Order ID
// hyperlink -> Approve or Reject." Only one evidenced screenId covers both
// the queue and its detail/approval facet, so this single component switches
// on the `id` query param rather than inventing a separate detail screenId.
export function SimSwapQueueScreen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const orderId = params.get('id');
  const orders = (useEntityStore((s) => s.records['sim-swap-orders']) ?? []) as unknown as SimSwapOrder[];
  const loadKind = useEntityStore((s) => s.loadKind);
  const updateRecord = useEntityStore((s) => s.updateRecord);
  const pushToast = useNotificationStore((s) => s.pushToast);

  const [reasons, setReasons] = useState<RejectReason[]>([]);
  const [modal, setModal] = useState<'approve' | 'reject' | null>(null);
  const [approveComment, setApproveComment] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [rejectComment, setRejectComment] = useState('');

  useEffect(() => {
    loadKind('sim-swap-orders');
    mockDataEngine.list<RejectReason>('reject-reasons').then(setReasons);
  }, [loadKind]);

  if (!orderId) {
    const pending = orders.filter((o) => o.status === 'Submitted for Approval');
    return (
      <div className="p-8">
        <h1 className="text-[length:var(--fs-h3)] font-medium text-fg mb-1">SIM Swap Queue</h1>
        <p className="text-fg-2 mb-6">Order tasks tab — tasks awaiting SIM Swap approval.</p>
        <DataTable<SimSwapOrder>
          columns={[
            { key: 'simSwapOrderId', header: 'Order #' },
            { key: 'msisdn', header: 'MSISDN' },
            { key: 'simSwapReason', header: 'Reason' },
            { key: 'status', header: 'Status', render: (r) => <Badge variant="warning">{r.status}</Badge> },
            {
              key: 'action',
              header: '',
              render: (r) => (
                <Button variant="ghost-rect" compact onClick={() => navigate(`/sim-number-management/sim-swap-queue-order-tasks-tab?id=${r.simSwapOrderId}`)}>
                  Assign to Me
                </Button>
              ),
            },
          ]}
          rows={pending}
          rowKey={(r) => r.simSwapOrderId}
          emptyMessage="No SIM Swap requests awaiting approval."
        />
      </div>
    );
  }

  const order = orders.find((o) => o.simSwapOrderId === orderId);
  if (!order) {
    return <div className="p-8 text-fg-2">No SIM Swap order selected — go back to the queue and Assign to Me first.</div>;
  }

  const approve = async () => {
    await updateRecord('sim-swap-orders', 'simSwapOrderId', order.simSwapOrderId, {
      status: 'Approved/Completed',
      approveComment,
    });
    pushToast('success', `SIM Swap ${order.simSwapOrderId} approved — order completed.`);
    navigate('/sim-number-management/sim-swap-queue-order-tasks-tab');
  };

  const reject = async () => {
    const reasonLabel = reasons.find((r) => r.reasonCode === rejectReason)?.reasonLabel ?? rejectReason;
    await updateRecord('sim-swap-orders', 'simSwapOrderId', order.simSwapOrderId, {
      status: 'Cancelled',
      rejectReasonCode: rejectReason,
      rejectComment,
    });
    pushToast('warning', `SIM Swap ${order.simSwapOrderId} dropped as cancelled — ${reasonLabel}.`);
    navigate('/sim-number-management/sim-swap-queue-order-tasks-tab');
  };

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-[length:var(--fs-h3)] font-medium text-fg">SIM Swap {order.simSwapOrderId}</h1>
        <Badge variant="outlined-red">{order.status}</Badge>
      </div>
      <p className="text-fg-2 mb-6">MSISDN: {order.msisdn}</p>

      <dl className="grid grid-cols-2 gap-4 text-[length:var(--fs-body)] rounded-[var(--radius-card)] border border-border-soft bg-bg p-4 mb-6">
        <div>
          <dt className="text-[length:var(--fs-caption)] text-muted">New SIM Serial</dt>
          <dd className="text-fg">{order.newSimSerialNumber ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-[length:var(--fs-caption)] text-muted">Reason</dt>
          <dd className="text-fg">{order.simSwapReason ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-[length:var(--fs-caption)] text-muted">Charge</dt>
          <dd className="text-fg">{order.chargeStatus ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-[length:var(--fs-caption)] text-muted">Comments</dt>
          <dd className="text-fg">{order.comments ?? '—'}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2">
        <Button variant="primary-rect" onClick={() => setModal('approve')}>
          Approve
        </Button>
        <Button variant="ghost-rect" className="!text-danger !border-danger" onClick={() => setModal('reject')}>
          Reject
        </Button>
        <Button variant="ghost-rect" onClick={() => navigate('/sim-number-management/sim-swap-queue-order-tasks-tab')}>
          Go Back
        </Button>
      </div>

      <Modal open={modal === 'approve'} onClose={() => setModal(null)} title="Approve SIM Swap">
        <Textarea label="Comments" value={approveComment} onChange={(e) => setApproveComment(e.target.value)} />
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost-rect" onClick={() => setModal(null)}>Cancel</Button>
          <Button variant="primary-rect" onClick={approve}>Submit</Button>
        </div>
      </Modal>

      <Modal open={modal === 'reject'} onClose={() => setModal(null)} title="Reject Task">
        <div className="space-y-3">
          <Select
            label="Rejection Reason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Select a reason"
            options={reasons.map((r) => ({ value: r.reasonCode, label: r.reasonLabel }))}
          />
          <Textarea label="Comments" value={rejectComment} onChange={(e) => setRejectComment(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost-rect" onClick={() => setModal(null)}>Cancel</Button>
          <Button variant="primary-rect" onClick={reject} disabled={!rejectReason}>Drop Order</Button>
        </div>
      </Modal>
    </div>
  );
}
