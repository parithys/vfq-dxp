import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Tabs } from '../../components/primitives/Tabs';
import { Button } from '../../components/primitives/Button';
import { Badge } from '../../components/primitives/Badge';
import { Drawer } from '../../components/primitives/Drawer';
import { Select } from '../../components/primitives/Select';
import { Textarea } from '../../components/primitives/Textarea';
import { useEntityStore } from '../../stores/entityStore';
import { useAuthStore } from '../../stores/authStore';
import { useNotificationStore } from '../../stores/notificationStore';
import * as mockDataEngine from '../../engines/mockDataEngine';
import { getRequiredApproverRole } from '../../engines/configEngine';
import { isVisibleToAgent } from '../../engines/agentTaskEngine';

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
  /** Set by "Assign to Me" in the queue — governs both queue visibility and
   * (AAV-00) whether this detail page may be opened at all by direct URL. */
  assignedApproverId?: string | null;
}
interface RejectReason {
  reasonCode: string;
  reasonLabel: string;
}

interface ApprovalHistoryEntry {
  activityNumber: string;
  orderId: string;
  actionTaken: string;
  notes?: string;
  transactionDate: string;
}

// AAV-05: "see task history before confirming Approval, Rejection, or
// Return" — the Activities tab already shows this, but a Drawer overlays
// the page, so this same list is repeated directly inside each confirmation
// Drawer, immediately above the confirm button, rather than relying on the
// agent having scrolled past the Activities tab earlier in the session.
function HistoryPreview({ history, orderType }: { history: ApprovalHistoryEntry[]; orderType: string }) {
  if (history.length === 0) return null;
  return (
    <div className="rounded-[var(--radius-card)] border border-border-soft divide-y divide-border-soft">
      <p className="px-3 py-2 text-[length:var(--fs-caption-upper)] uppercase tracking-wide text-muted">Task history</p>
      {history.map((entry) => (
        <div key={entry.activityNumber} className="px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium text-fg text-[length:var(--fs-caption)]">{entry.actionTaken}</span>
            <span className="text-muted text-[length:var(--fs-micro)]">{new Date(entry.transactionDate).toLocaleString()}</span>
          </div>
          <div className="text-fg-2 text-[length:var(--fs-micro)] mt-0.5">
            Task ID: {entry.orderId} · Task Name: {orderType}
          </div>
        </div>
      ))}
    </div>
  );
}

// SCR-061: Order Approval detail — header (Contact, Order #) + 4 tabs
// (Attachments/Order Details/Activities/Agents Details) + action buttons
// (Approve, Reject - Correction, Reject - Drop Order, Return, Go Back),
// evidenced identically across Fixed Line/FWA/Postpaid B2B2C-with-approval
// journeys, extended with Agent 360 BRSD's Return action (AAV-03), real
// task history (AAV-05 — `actionTaken` distinguishes an approval-decision
// record from the pre-seeded general `customer-activities` timeline, which
// carries no such field), and approval-matrix role gating (AAV-01/BR-06).
export function OrderApprovalDetail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const orderId = params.get('id');
  const orders = (useEntityStore((s) => s.records.orders) ?? []) as unknown as Order[];
  const activities = (useEntityStore((s) => s.records['customer-activities']) ?? []) as unknown as ApprovalHistoryEntry[];
  const loadKind = useEntityStore((s) => s.loadKind);
  const updateRecord = useEntityStore((s) => s.updateRecord);
  const createRecord = useEntityStore((s) => s.createRecord);
  const pushToast = useNotificationStore((s) => s.pushToast);
  const currentJobTitle = useAuthStore((s) => s.profile?.jobTitle);
  const currentAgentId = useAuthStore((s) => s.profile?.userId);

  const [reasons, setReasons] = useState<RejectReason[]>([]);
  const [modal, setModal] = useState<'approve' | 'reject-correction' | 'reject-drop' | 'return' | null>(null);
  const [ackApprove, setAckApprove] = useState(false);
  const [approveComment, setApproveComment] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [rejectComment, setRejectComment] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [returnComment, setReturnComment] = useState('');
  // Guards against duplicate submission. Uses a ref, not just `submitting`
  // state: two click dispatches landing in the same synchronous tick both
  // read `submitting` as stale `false` (a state update isn't visible until
  // the next render) — observed in practice as this handler otherwise
  // creating two near-identical history entries per single click.
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    loadKind('orders');
    loadKind('customer-activities');
    mockDataEngine.list<RejectReason>('reject-reasons').then(setReasons);
  }, [loadKind]);

  const order = orders.find((o) => o.orderId === orderId);
  if (!order) {
    return <div className="p-8 text-fg-2">No order selected — go back to the Approval Queue and Assign to Me first.</div>;
  }

  // AAV-00 clause (b): "if the task is not assigned or accessible to the
  // agent, access is denied." Unassigned orders (assignedApproverId is null)
  // are still open queue items anyone eligible can claim, so they remain
  // accessible; once assigned, only that approver may open this page —
  // matching the same isVisibleToAgent rule the queue itself already
  // enforces (OrderApprovalQueue.tsx), so a direct URL can no longer bypass
  // the queue's own visibility rule.
  if (!isVisibleToAgent(order.assignedApproverId, currentAgentId)) {
    return (
      <div className="p-8 text-fg-2">
        <p className="text-fg font-medium mb-1">Access denied.</p>
        <p>This order is assigned to another approver and is not accessible from your account.</p>
      </div>
    );
  }

  const history = activities.filter((a) => a.orderId === order.orderId && a.actionTaken);

  // AAV-01: reject/approve/return still require the matrix role even if an
  // agent reaches this page directly (e.g. by URL) rather than through the
  // queue's own "Assign to Me" gate — see OrderApprovalQueue.tsx.
  const requiredRole = getRequiredApproverRole(order.orderType);
  const isEligibleApprover = !requiredRole || requiredRole === currentJobTitle;

  const logActivity = (actionTaken: string, notes: string) =>
    createRecord('customer-activities', {
      activityNumber: `ACT-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      orderId: order.orderId,
      actionTaken,
      notes,
      transactionDate: new Date().toISOString(),
    });

  const approve = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const nextStatus = order.nextStatusOnApproval ?? 'Complete';
      await updateRecord('orders', 'orderId', order.orderId, { status: nextStatus, approvalStatus: 'Approved' });
      await logActivity('Approved', approveComment);
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
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const reject = async (drop: boolean) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const reasonLabel = reasons.find((r) => r.reasonCode === rejectReason)?.reasonLabel ?? rejectReason;
      await updateRecord('orders', 'orderId', order.orderId, {
        status: drop ? 'Cancelled' : 'Rejected - Correction',
        approvalStatus: 'Rejected',
        rejectReasonCode: rejectReason,
        rejectComment,
      });
      await logActivity(`Rejected — ${drop ? 'Drop Order' : 'Correction'}`, `${reasonLabel}: ${rejectComment}`);
      pushToast(drop ? 'warning' : 'warning', `Order ${order.orderId}: ${drop ? 'dropped as cancelled' : 'rejected — SMS sent to agent for correction'}.`);
      navigate('/order-management');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  // AAV-03/Annex_02: Return is distinct from Reject — it loops the order back
  // to "Submitted for Approval" (permitted next status per the BRSD's own
  // status model) rather than terminating it, and per BR-06 requires a
  // reason + notes exactly like Reject does.
  const returnOrder = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const reasonLabel = reasons.find((r) => r.reasonCode === returnReason)?.reasonLabel ?? returnReason;
      await updateRecord('orders', 'orderId', order.orderId, {
        status: 'Submitted for Approval',
        approvalStatus: 'Returned',
        returnReasonCode: returnReason,
        returnComment,
      });
      await logActivity('Returned', `${reasonLabel}: ${returnComment}`);
      pushToast('warning', `Order ${order.orderId} returned for correction — back in the approval queue.`);
      navigate('/order-management');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
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
            content: (
              <div>
                <p className="text-fg-2 text-[length:var(--fs-body)] mb-3">
                  Task history — visible before you confirm a decision, per Agent 360 AAV-05.
                </p>
                {history.length === 0 && <p className="text-muted text-[length:var(--fs-body)]">No approval actions recorded yet for this order.</p>}
                {history.length > 0 && (
                  <div className="rounded-[var(--radius-card)] border border-border-soft divide-y divide-border-soft">
                    {history.map((entry) => (
                      <div key={entry.activityNumber} className="px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-fg text-[length:var(--fs-body)]">{entry.actionTaken}</span>
                          <span className="text-muted text-[length:var(--fs-caption)]">{new Date(entry.transactionDate).toLocaleString()}</span>
                        </div>
                        <div className="text-fg-2 text-[length:var(--fs-caption)] mt-0.5">
                          Task ID: {entry.orderId} · Task Name: {order.orderType}{entry.notes ? ` · ${entry.notes}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ),
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

      {!isEligibleApprover && (
        <div className="mb-4 rounded border border-[var(--warn)] px-4 py-3 text-[length:var(--fs-body)] text-[var(--warn-text)]">
          Only a {requiredRole} may approve, reject, or return this order (Agent 360 AAV-01/BR-06).
        </div>
      )}

      <div className="flex flex-wrap gap-2 mt-6">
        <Button variant="primary-rect" onClick={() => setModal('approve')} disabled={!isEligibleApprover}>
          Approve
        </Button>
        <Button variant="ghost-rect" onClick={() => setModal('reject-correction')} disabled={!isEligibleApprover}>
          Reject - Correction
        </Button>
        <Button
          variant="ghost-rect"
          className="!text-danger !border-danger"
          onClick={() => setModal('reject-drop')}
          disabled={!isEligibleApprover}
        >
          Reject - Drop Order
        </Button>
        <Button variant="ghost-rect" onClick={() => setModal('return')} disabled={!isEligibleApprover}>
          Return
        </Button>
        <Button variant="ghost-rect" onClick={() => navigate('/order-management')}>
          Go Back
        </Button>
      </div>

      <Drawer open={modal === 'approve'} onClose={() => setModal(null)} title="Approve Order">
        <div className="space-y-3">
          <HistoryPreview history={history} orderType={order.orderType} />
          <label className="flex items-start gap-2 text-[length:var(--fs-body)] text-fg">
            <input type="checkbox" checked={ackApprove} onChange={(e) => setAckApprove(e.target.checked)} className="mt-1" />
            By clicking submit, I agree that I have verified all the documents and details to proceed with submission.
          </label>
          <Textarea label="Comments" value={approveComment} onChange={(e) => setApproveComment(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost-rect" onClick={() => setModal(null)}>Cancel</Button>
          <Button variant="primary-rect" onClick={approve} disabled={!ackApprove || submitting}>Submit approval</Button>
        </div>
      </Drawer>

      <Drawer open={modal === 'reject-correction' || modal === 'reject-drop'} onClose={() => setModal(null)} title="Reject Order">
        <div className="space-y-3">
          <HistoryPreview history={history} orderType={order.orderType} />
          <Select
            label="Reject Reason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Select a reason"
            options={reasons.map((r) => ({ value: r.reasonCode, label: r.reasonLabel }))}
          />
          <Textarea label="Comments (required — BR-06)" value={rejectComment} onChange={(e) => setRejectComment(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost-rect" onClick={() => setModal(null)}>Cancel</Button>
          <Button
            variant="primary-rect"
            onClick={() => reject(modal === 'reject-drop')}
            disabled={!rejectReason || !rejectComment.trim() || submitting}
          >
            Reject Order
          </Button>
        </div>
      </Drawer>

      <Drawer open={modal === 'return'} onClose={() => setModal(null)} title="Return Order">
        <div className="space-y-3">
          <HistoryPreview history={history} orderType={order.orderType} />
          <p className="text-fg-2 text-[length:var(--fs-body)]">
            Returning sends this order back to the approval queue for correction, rather than rejecting it outright.
          </p>
          <Select
            label="Return Reason"
            value={returnReason}
            onChange={(e) => setReturnReason(e.target.value)}
            placeholder="Select a reason"
            options={reasons.map((r) => ({ value: r.reasonCode, label: r.reasonLabel }))}
          />
          <Textarea label="Notes" value={returnComment} onChange={(e) => setReturnComment(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost-rect" onClick={() => setModal(null)}>Cancel</Button>
          <Button variant="primary-rect" onClick={returnOrder} disabled={!returnReason || !returnComment || submitting}>
            Return Order
          </Button>
        </div>
      </Drawer>
    </div>
  );
}
