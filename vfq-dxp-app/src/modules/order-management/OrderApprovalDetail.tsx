import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Tabs } from '../../components/primitives/Tabs';
import { Button } from '../../components/primitives/Button';
import { Badge } from '../../components/primitives/Badge';
import { Modal } from '../../components/primitives/Modal';
import { Select } from '../../components/primitives/Select';
import { Textarea } from '../../components/primitives/Textarea';
import { useEntityStore } from '../../stores/entityStore';
import { useNotificationStore } from '../../stores/notificationStore';
import * as mockDataEngine from '../../engines/mockDataEngine';

interface Order {
  orderId: string;
  orderType: string;
  status: string;
  customerName?: string;
  msisdn?: string;
  productId?: string;
  createdBy?: string;
  /** Where this order goes once approved — 'Complete' for most journeys, but
   * FWA orders still need WFM installation after approval (UJ-062), so they
   * carry 'Pending WFM Installation' here instead of jumping straight to Complete. */
  nextStatusOnApproval?: string;
}
interface RejectReason {
  reasonCode: string;
  reasonLabel: string;
}

// SCR-061: Order Approval detail — header (Contact, Order #) + 4 tabs
// (Attachments/Order Details/Activities/Agents Details) + action buttons
// (Approve, Reject - Correction, Reject - Drop Order, Go Back), evidenced
// identically across Fixed Line/FWA/Postpaid B2B2C-with-approval journeys.
export function OrderApprovalDetail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const orderId = params.get('id');
  const orders = (useEntityStore((s) => s.records.orders) ?? []) as unknown as Order[];
  const loadKind = useEntityStore((s) => s.loadKind);
  const updateRecord = useEntityStore((s) => s.updateRecord);
  const createRecord = useEntityStore((s) => s.createRecord);
  const pushToast = useNotificationStore((s) => s.pushToast);

  const [reasons, setReasons] = useState<RejectReason[]>([]);
  const [modal, setModal] = useState<'approve' | 'reject-correction' | 'reject-drop' | null>(null);
  const [ackApprove, setAckApprove] = useState(false);
  const [approveComment, setApproveComment] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [rejectComment, setRejectComment] = useState('');

  useEffect(() => {
    loadKind('orders');
    mockDataEngine.list<RejectReason>('reject-reasons').then(setReasons);
  }, [loadKind]);

  const order = orders.find((o) => o.orderId === orderId);
  if (!order) {
    return <div className="p-8 text-fg-2">No order selected — go back to the Approval Queue and Assign to Me first.</div>;
  }

  const logActivity = (text: string) =>
    createRecord('customer-activities', {
      activityId: `ACT-${Date.now().toString().slice(-6)}`,
      orderId: order.orderId,
      description: text,
      createdAt: new Date().toISOString(),
    });

  const approve = async () => {
    try {
      const nextStatus = order.nextStatusOnApproval ?? 'Complete';
      await updateRecord('orders', 'orderId', order.orderId, { status: nextStatus, approvalStatus: 'Approved' });
      await logActivity(`Order Approved — ${approveComment}`);
      pushToast(
        'success',
        nextStatus === 'Complete'
          ? `Order ${order.orderId} approved.`
          : `Order ${order.orderId} approved — moved to ${nextStatus}.`
      );
      navigate('/order-management');
    } catch (err) {
      console.error('[OrderApprovalDetail] approve failed:', err);
      pushToast('error', `Failed to approve order: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const reject = async (drop: boolean) => {
    const reasonLabel = reasons.find((r) => r.reasonCode === rejectReason)?.reasonLabel ?? rejectReason;
    await updateRecord('orders', 'orderId', order.orderId, {
      status: drop ? 'Cancelled' : 'Rejected - Correction',
      approvalStatus: 'Rejected',
      rejectReasonCode: rejectReason,
      rejectComment,
    });
    await logActivity(`Reject - ${drop ? 'Drop Order' : 'Correction'}: ${reasonLabel} — ${rejectComment}`);
    pushToast(drop ? 'warning' : 'warning', `Order ${order.orderId}: ${drop ? 'dropped as cancelled' : 'rejected — SMS sent to agent for correction'}.`);
    navigate('/order-management');
  };

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-[length:var(--fs-h3)] font-medium text-fg">Order {order.orderId}</h1>
        <Badge variant="outlined-red">{order.status}</Badge>
      </div>
      <p className="text-fg-2 mb-6">
        Contact: {order.customerName ?? '—'} · {order.orderType}
      </p>

      <Tabs
        items={[
          {
            key: 'attachments',
            label: 'Attachments',
            content: <p className="text-fg-2 text-[length:var(--fs-body)]">CAF, ID scans, and supplementary forms captured during the guided wizard.</p>,
          },
          {
            key: 'order-details',
            label: 'Order Details',
            content: (
              <dl className="grid grid-cols-2 gap-4 text-[length:var(--fs-body)]">
                <div>
                  <dt className="text-[length:var(--fs-caption)] text-muted">Product</dt>
                  <dd className="text-fg">{order.productId ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-[length:var(--fs-caption)] text-muted">MSISDN</dt>
                  <dd className="text-fg">{order.msisdn ?? '—'}</dd>
                </div>
              </dl>
            ),
          },
          {
            key: 'activities',
            label: 'Activities',
            content: <p className="text-fg-2 text-[length:var(--fs-body)]">Activity log entries for this order (Approve/Reject actions logged here).</p>,
          },
          {
            key: 'agents-details',
            label: 'Agents Details',
            content: (
              <p className="text-fg-2 text-[length:var(--fs-body)]">
                Submitted by: {order.createdBy ?? '—'}
              </p>
            ),
          },
        ]}
      />

      <div className="flex flex-wrap gap-2 mt-6">
        <Button variant="primary-rect" onClick={() => setModal('approve')}>
          Approve
        </Button>
        <Button variant="ghost-rect" onClick={() => setModal('reject-correction')}>
          Reject - Correction
        </Button>
        <Button variant="ghost-rect" className="!text-danger !border-danger" onClick={() => setModal('reject-drop')}>
          Reject - Drop Order
        </Button>
        <Button variant="ghost-rect" onClick={() => navigate('/order-management')}>
          Go Back
        </Button>
      </div>

      <Modal open={modal === 'approve'} onClose={() => setModal(null)} title="Approve Order">
        <div className="space-y-3">
          <label className="flex items-start gap-2 text-[length:var(--fs-body)] text-fg">
            <input type="checkbox" checked={ackApprove} onChange={(e) => setAckApprove(e.target.checked)} className="mt-1" />
            By clicking submit, I agree that I have verified all the documents and details to proceed with submission.
          </label>
          <Textarea label="Comments" value={approveComment} onChange={(e) => setApproveComment(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost-rect" onClick={() => setModal(null)}>Cancel</Button>
          <Button variant="primary-rect" onClick={approve} disabled={!ackApprove}>Submit</Button>
        </div>
      </Modal>

      <Modal open={modal === 'reject-correction' || modal === 'reject-drop'} onClose={() => setModal(null)} title="Reject Order">
        <div className="space-y-3">
          <Select
            label="Reject Reason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Select a reason"
            options={reasons.map((r) => ({ value: r.reasonCode, label: r.reasonLabel }))}
          />
          <Textarea label="Comments" value={rejectComment} onChange={(e) => setRejectComment(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost-rect" onClick={() => setModal(null)}>Cancel</Button>
          <Button variant="primary-rect" onClick={() => reject(modal === 'reject-drop')} disabled={!rejectReason}>
            Reject Order
          </Button>
        </div>
      </Modal>
    </div>
  );
}
