import { useState } from 'react';
import { Drawer } from '../../capabilities';
import { Input } from '../../components/primitives/Input';
import { ChoiceCards } from '../../components/primitives/ChoiceCards';
import { Button } from '../../components/primitives/Button';
import { useEntityStore } from '../../stores/entityStore';
import { useProfileChangeTicket } from '../../engines/profileChangeTicket';
import { useSubmit } from '../../hooks/useSubmit';
import { useNotificationStore } from '../../stores/notificationStore';
import { currentAgentId } from '../../stores/authStore';
import { defaultCreditLimitForSegment } from '../../engines/hrnConfiguration';
import { COLLECTION_TEAM_ROLE } from '../../capabilities/CustomerType/customerTypeModel';
import { CREDIT_LIMIT_CHANGE_ORDER_TYPE } from './creditLimitChange';
import type { CustomerRecord } from '../../engines/customer360Engine';
import { EDITABLE_ACCOUNT_STATUSES, diffAccountEdits } from './accountEditModel';
import { ALL_SEGMENTS, SEGMENT_GROUPS } from '../../data/customerSegments';

// Icon tiles of the choice cards (24px grid paths).
const STATUS_ICON: Record<string, string> = {
  Active: 'M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4L12 14.01l-3-3',
  Suspended: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M10 9v6 M14 9v6',
  Closed: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M15 9l-6 6 M9 9l6 6',
};
// An account status reads at a glance: Active green, Suspended amber, Closed grey.
const STATUS_TONE: Record<string, 'success' | 'warn' | 'danger' | 'neutral'> = { Active: 'success', Suspended: 'warn', Closed: 'neutral' };
const SEGMENT_ICON = 'M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.9l1.1-6.5L2.6 9.8l6.5-.9z';

/**
 * Edit Account Details (Customer 360 > Account Information): only the account details an agent may change - Credit Limit, Account Status and
 * Customer Segment. Everything else on the account stays read-only. The caller has already verified the customer (the verification drawer).
 */
export function AccountEditDrawer({
  open,
  onClose,
  customer,
  account,
  creditLimit,
  onSaved,
  onTicketCreated,
}: {
  open: boolean;
  onClose: () => void;
  customer: CustomerRecord;
  account: { accountId: string; status?: string } | undefined;
  /** The credit-limit record on file for the customer, when there is one. */
  creditLimit: { id?: string; creditLimitQar?: number } | undefined;
  onSaved: (patch: { segment?: string; accountStatus?: string; creditLimitQar?: number }) => void;
  onTicketCreated: (ticket: Record<string, unknown>) => void;
}) {
  const updateRecord = useEntityStore((s) => s.updateRecord);
  const createRecord = useEntityStore((s) => s.createRecord);
  const createChangeTicket = useProfileChangeTicket();
  // The limit in force: the one on file, else the default for the customer's segment.
  const effectiveCurrent = creditLimit?.creditLimitQar ?? defaultCreditLimitForSegment(customer.segment);
  const pushToast = useNotificationStore((s) => s.pushToast);
  const [limit, setLimit] = useState(String(effectiveCurrent));
  const [status, setStatus] = useState(account?.status ?? '');
  const [segment, setSegment] = useState(customer.segment);
  const [error, setError] = useState<string | undefined>();

  const { run: save, pending: saving } = useSubmit(async () => {
    const { changed, edits, error: problem } = diffAccountEdits(
      { creditLimitQar: effectiveCurrent, accountStatus: account?.status, segment: customer.segment },
      { creditLimit: limit, accountStatus: status, segment }
    );
    if (problem) {
      setError(problem);
      return;
    }
    if (edits.segment) await updateRecord('customers', 'customerId', customer.customerId, { segment: edits.segment });
    if (edits.accountStatus && account) await updateRecord('accounts', 'accountId', account.accountId, { status: edits.accountStatus });
    // The credit limit is not changed here: it is requested, and Credit Control approves it (the order's approval applies it).
    let requestId: string | undefined;
    if (edits.creditLimitQar !== undefined) {
      requestId = `ORD-${Date.now().toString().slice(-6)}`;
      await createRecord('orders', {
        orderId: requestId,
        orderType: CREDIT_LIMIT_CHANGE_ORDER_TYPE,
        orderSubType: 'Credit Control',
        status: 'Submitted for Approval',
        approverRole: COLLECTION_TEAM_ROLE,
        createdAt: new Date().toISOString(),
        createdBy: currentAgentId(),
        customerId: customer.customerId,
        customerName: customer.name,
        accountId: account?.accountId,
        currentCreditLimitQar: effectiveCurrent,
        requestedCreditLimitQar: edits.creditLimitQar,
        approvalReason: `Credit limit change requested: QAR ${effectiveCurrent} to QAR ${edits.creditLimitQar}. Needs Credit Control approval.`,
      });
      pushToast('success', `Credit limit change requested (${requestId}) - it takes effect once ${COLLECTION_TEAM_ROLE} approves it.`);
    }
    if (changed.length > 0) {
      const { record } = await createChangeTicket(customer.customerId, 'Account', changed);
      onTicketCreated(record);
    }
    // The limit shown stays as it is until the change is approved.
    onSaved({ segment: edits.segment, accountStatus: edits.accountStatus });
    onClose();
  }, 'Could not save the account details. Please try again.');

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Edit Account Details"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={saving} onClick={save}>
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Credit Limit (QAR)"
          helperText="A change is sent to Credit Control for approval and takes effect once approved."
          type="number"
          min={0}
          value={limit}
          error={error}
          onChange={(e) => {
            setLimit(e.target.value);
            setError(undefined);
          }}
        />
        <ChoiceCards
          legend="Account Status"
          items={[...new Set([...(account?.status ? [account.status] : []), ...EDITABLE_ACCOUNT_STATUSES])].map((st) => ({ key: st, label: st, icon: STATUS_ICON[st] ?? STATUS_ICON.Active, tone: STATUS_TONE[st] }))}
          value={status}
          onChange={setStatus}
        />
        {/* Customer Segment: one card group per segment group (Consumer, Enterprise); a segment on the record that is no longer on the list is kept, under its own heading. */}
        {SEGMENT_GROUPS.map((g) => (
          <ChoiceCards
            key={g.group}
            legend={g.group === 'Consumer' ? 'Customer Segment - Consumer' : 'Customer Segment - Enterprise'}
            items={g.segments.map((sg) => ({ key: sg, label: sg, icon: SEGMENT_ICON }))}
            value={g.segments.includes(segment) ? segment : undefined}
            onChange={setSegment}
          />
        ))}
        {!ALL_SEGMENTS.includes(customer.segment) && (
          <ChoiceCards
            legend="Customer Segment - Current"
            items={[{ key: customer.segment, label: customer.segment, icon: SEGMENT_ICON }]}
            value={segment === customer.segment ? segment : undefined}
            onChange={setSegment}
          />
        )}
        <p className="pt-2 border-t border-border-soft text-[length:var(--fs-caption)] text-muted">
          Only these account details can be changed here. Saving creates a reference ticket for follow-up.
        </p>
      </div>
    </Drawer>
  );
}
