import { useEffect, useState } from 'react';
import { resolveFibreServiceability } from '../../engines/fibreServiceability';
import type { AddressParts, FibreServiceability } from '../../engines/fibreServiceability';
import { useNavigate } from 'react-router-dom';
import { useNotificationStore } from '../../stores/notificationStore';
import { OrderConfirmationScreen } from './OrderConfirmationScreen';
import { EsimActivationPanel } from '../domain/EsimActivationPanel';
import { usePersonaStore } from '../../stores/personaStore';
import { getPersona } from '../../engines/configEngine';
import { useEntityStore } from '../../stores/entityStore';
import { useAuthStore } from '../../stores/authStore';
import { closeOrderActivities, logActivity } from '../../engines/activityEngine';
import type { ActivityInput } from '../../engines/activityEngine';
import { useCustomerContext } from '../../stores/customerContextStore';
import { Badge } from '../primitives/Badge';
import { Button } from '../primitives/Button';
import { Modal } from '../primitives/Modal';
import { Textarea } from '../primitives/Textarea';

/**
 * The standard "Activation complete" page, for every activation journey.
 *
 * One layout, one row order, one set of actions - a journey supplies the facts
 * about its order and nothing else:
 *
 *   Customer | MSISDN | Plan | SIM Type | Due today | Monthly recurring | Status
 *   [View Order]  [Print]  [Create Activity]  [Done & Exit]  [Create Lead]  [Continue with Fibre]
 *
 * Monthly recurring is omitted for an order that has none (prepaid). An eSIM
 * order adds the QR handover panel beside the receipt. An order held for
 * approval is headed "Order submitted for approval" and reports "Submitted for
 * Approval" as its status.
 */
export interface ActivationCompleteOrder {
  orderId: string;
  /** Number of the automatic activity for this order (reserved at submission; the record is created on Done & Exit). */
  activityId?: string;
  /**
   * The automatic activity, without comments. Done & Exit records it, whether or not the agent also created a manual
   * activity here; the two are independent.
   */
  completionActivity?: ActivityInput;
  pendingApproval: boolean;
  customerName: string;
  /** Customer on file, when there is one - used to read the location's fibre serviceability. */
  customerId?: string;
  /** The address entered in the journey, when one was. */
  address?: AddressParts;
  msisdn: string;
  planName: string;
  simType?: string;
  /** Omit when the order takes no payment (a port-in request): the row and the email line are left out. */
  dueTodayQar?: number;
  /** Overrides the page heading, e.g. "Port-in request submitted". */
  heading?: string;
  /** Overrides the Status row, e.g. "Pending" for a port request that waits on the donor operator. */
  statusLabel?: string;
  /** Further rows after Status (a port-in request's NPAS reference, form number and response deadline). */
  extraLines?: { label: string; value: string }[];
  /** An extra button after View Order, e.g. to the port-in status screen. */
  trackAction?: { label: string; to: string };
  /** Omit when the order carries no recurring charge. */
  monthlyRecurringQar?: number;
  /** eSIM orders only - drives the QR handover panel. */
  esimActivationCode?: string;
  customerEmail?: string;
  /** The address as Customer Identification shows it (masked for a new customer). Defaults to customerEmail. */
  customerEmailDisplay?: string;
  customerEmailVerified?: boolean;
}

/** Cross-sell into the Fixed Line/Fibre wizard for the same counter visit (SCR-043). */
const FIBRE_ACTIVATION_ROUTE = '/fixed-line-fibre/new-fixed-line-wizard-contact-step';
const ORDER_DETAIL_ROUTE = '/order-management/order-approval-detail-attachments-order-details-activities-a';

// Heading by who submitted (2026-10-01): Direct Sales and Mass Market orders go
// for approval; Retail orders are submitted outright. Any other role keeps the
// previous behaviour (approval wording only when the order was actually held).
const APPROVAL_SUBMITTERS = new Set(['Direct Sales', 'Mass Market']);
const RETAIL_SUBMITTERS = new Set(['Retail Sales']);

// Orders whose confirmation email has already been sent this session, so re-rendering (or React's
// double-invoked effects) can never send it twice.
const emailedOrders = new Set<string>();
// Orders whose automatic activity has been recorded, so a second Done & Exit can never record it twice.
const completionLogged = new Set<string>();

// `numberLabel` and `hideSimType` let a journey without a SIM (Fixed Activation) name its number and drop the SIM row;
// both default to the Postpaid wording, so existing callers render exactly as before.
export function ActivationCompleteScreen({
  order,
  numberLabel = 'MSISDN',
  hideSimType = false,
}: {
  order: ActivationCompleteOrder;
  numberLabel?: string;
  hideSimType?: boolean;
}) {
  const navigate = useNavigate();
  const createRecord = useEntityStore((s) => s.createRecord);
  // 'sent' | 'blocked' (address missing or not verified) - never assumed sent.
  const [leadId, setLeadId] = useState<string | undefined>();
  const [closing, setClosing] = useState(false);
  // Fibre serviceability of the customer's location: undefined while it is being read.
  const [fibre, setFibre] = useState<FibreServiceability | undefined>();
  useEffect(() => {
    let cancelled = false;
    void resolveFibreServiceability(order.customerId, order.address).then((r) => !cancelled && setFibre(r));
    return () => {
      cancelled = true;
    };
  }, [order.customerId, order.address]);
  const [emailStatus, setEmailStatus] = useState<'sent' | 'blocked'>(emailedOrders.has(order.orderId) ? 'sent' : 'blocked');
  // Automatically send the order details - and, for an eSIM order, the QR code / activation code -
  // to the customer's VERIFIED email address as soon as the order is submitted. An address that is
  // missing or could not be verified against the ID record is never sent to. The prototype has no
  // mail service, so "sending" records the message against the customer.
  useEffect(() => {
    if (!order.customerEmail || !order.customerEmailVerified) {
      setEmailStatus('blocked');
      return;
    }
    if (emailedOrders.has(order.orderId)) {
      setEmailStatus('sent');
      return;
    }
    emailedOrders.add(order.orderId);
    setEmailStatus('sent');
    const lines = [
      `Order ${order.orderId} - ${order.pendingApproval ? 'submitted for approval' : 'complete'}`,
      `Plan: ${order.planName}`,
      `Number: ${order.msisdn}`,
      `SIM: ${order.simType ?? '-'}`,
      ...(order.dueTodayQar !== undefined ? [`Due today: QAR ${order.dueTodayQar}`] : []),
      ...(order.monthlyRecurringQar !== undefined ? [`Monthly: QAR ${order.monthlyRecurringQar}`] : []),
      ...(order.esimActivationCode ? [`eSIM QR code attached. Activation code: ${order.esimActivationCode}`] : []),
    ];
    void createRecord('customer-communications', {
      communicationId: `COM-${Date.now().toString(36).toUpperCase()}`,
      channel: 'Email',
      to: order.customerEmail,
      subject: `Your Vodafone order ${order.orderId}`,
      messageText: lines.join('\n'),
      attachments: order.esimActivationCode ? ['eSIM-QR-code.png'] : [],
      sentAt: new Date().toISOString(),
      deliveryState: 'Sent',
      orderId: order.orderId,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.orderId]);
  const pushToast = useNotificationStore((s) => s.pushToast);
  // Close Activity: the journey has ended (this page only exists after submit), so the activities
  // it created are closed and the agent returns to Agent 360.
  const closeActivity = async () => {
    if (closing) return;
    setClosing(true);
    // The automatic activity (no comments) is recorded here, independent of any manual activity created below.
    if (order.completionActivity && !completionLogged.has(order.orderId)) {
      completionLogged.add(order.orderId);
      await logActivity(order.completionActivity);
    }
    await closeOrderActivities(order.orderId);
    // The journey is over: the customer context is released.
    useCustomerContext.getState().endJourney();
    pushToast('success', order.activityId ? `Activity ${order.activityId} closed` : 'Activity closed', { key: `activity-closed-${order.orderId}` });
    navigate('/');
  };
  // Manual activity: an additional record the agent writes, with comments. It never replaces or affects the automatic one.
  const [activityOpen, setActivityOpen] = useState(false);
  const [activityComments, setActivityComments] = useState('');
  const [savingActivity, setSavingActivity] = useState(false);
  const createManualActivity = async () => {
    if (!activityComments.trim() || savingActivity) return;
    setSavingActivity(true);
    const number = await logActivity({
      trigger: 'manual',
      journey: order.completionActivity?.journey ?? 'Order',
      orderId: order.orderId,
      customerId: order.completionActivity?.customerId ?? order.customerId,
      customerName: order.completionActivity?.customerName ?? order.customerName,
      idNumber: order.completionActivity?.idNumber,
      comments: activityComments,
    });
    setSavingActivity(false);
    setActivityOpen(false);
    setActivityComments('');
    pushToast('success', `Activity ${number} created`, { key: `activity-${number}` });
  };
  const createLead = async () => {
    if (leadId) return;
    const id = `LEAD-${Date.now().toString().slice(-6)}`;
    await createRecord('leads', {
      leadId: id,
      serviceNeeded: 'Fixed Line',
      status: 'New',
      ownerId: useAuthStore.getState().profile?.userId ?? null,
      createdVia: 'Final Summary',
      customerName: order.customerName,
      mobileNumber: order.msisdn,
      orderId: order.orderId,
    });
    setLeadId(id);
    pushToast('success', `Lead ${id} created`, { key: `lead-${id}` });
  };
  const submitter = getPersona(usePersonaStore((s) => s.activePersonaId))?.name ?? '';
  const forApproval = order.pendingApproval || APPROVAL_SUBMITTERS.has(submitter);
  const heading = order.heading ?? (forApproval
    ? 'Order submitted for approval'
    : RETAIL_SUBMITTERS.has(submitter)
      ? 'Order submitted successfully'
      : 'Activation complete');
  return (
    <div className="p-8">
      <OrderConfirmationScreen
        heading={heading}
        orderId={order.orderId}
        activityId={order.activityId}
        headerNote={
          order.esimActivationCode ? undefined : emailStatus === 'sent' ? (
            <p className="text-success text-[length:var(--fs-body)]">Your order details have been sent to your email.</p>
          ) : (
            <p className="text-[var(--warn-text)] text-[length:var(--fs-caption)]">
              {order.customerEmail
                ? 'The email address could not be verified against the customer\'s ID record, so the order details were not sent.'
                : 'No email address is on file, so the order details were not sent.'}
            </p>
          )
        }
        handoverPanel={
          order.esimActivationCode ? (
            <EsimActivationPanel activationCode={order.esimActivationCode} emailSent={emailStatus === 'sent'} />
          ) : undefined
        }
        summaryLines={[
          { label: 'Customer', value: order.customerName },
          { label: numberLabel, value: order.msisdn },
          { label: 'Plan', value: order.planName },
          ...(hideSimType ? [] : [{ label: 'SIM Type', value: order.simType ?? '-' }]),
          ...(order.dueTodayQar !== undefined ? [{ label: 'Due today', value: `QAR ${order.dueTodayQar}` }] : []),
          ...(order.monthlyRecurringQar !== undefined
            ? [{ label: 'Monthly recurring', value: `QAR ${order.monthlyRecurringQar}/mo` }]
            : []),
          { label: 'Status', value: order.statusLabel ?? (order.pendingApproval ? 'Submitted for Approval' : 'Complete') },
          ...(order.extraLines ?? []),
          // The cue for the fibre actions below: whether the customer's location can be served by fibre.
          { label: 'Customer location', value: fibre === 'rfs' ? 'RFS - Eligible for Fibre' : fibre === 'not-rfs' ? 'Not RFS (not ready for service)' : fibre === 'unknown' ? 'Not on file' : 'Checking...' },
        ]}
        actions={[
          { label: 'View Order', variant: 'primary', onClick: () => navigate(`${ORDER_DETAIL_ROUTE}?id=${order.orderId}`) },
          ...(order.trackAction ? [{ label: order.trackAction.label, onClick: () => navigate(order.trackAction!.to) }] : []),
          { label: 'Print', onClick: () => window.print(), endRow: true },
          { label: 'Create Activity', onClick: () => setActivityOpen(true), endRow: true },
          { label: 'Done & Exit', onClick: () => void closeActivity(), endRow: true },
          // A location that is ready for service can go on to fibre activation. Create Lead (always offered once the
          // location is read) records the fibre interest as a lead straight away and confirms it with a toast.
          ...(fibre === 'rfs' ? [{ label: 'Continue with Fibre', onClick: () => navigate(FIBRE_ACTIVATION_ROUTE) }] : []),
          ...(fibre !== undefined ? [{ label: leadId ? `Lead ${leadId} created` : 'Create Lead', onClick: () => void createLead() }] : []),
        ]}
      />
      <Modal
        open={activityOpen}
        onClose={() => setActivityOpen(false)}
        title="Create Activity"
        footer={
          <>
            <Button variant="secondary" onClick={() => setActivityOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={savingActivity || !activityComments.trim()} onClick={() => void createManualActivity()}>
              {savingActivity ? 'Creating…' : 'Create Activity'}
            </Button>
          </>
        }
      >
        <p className="text-fg-2 text-[length:var(--fs-body)]">
          Records an additional activity on order {order.orderId}. The automatic activity is still created when you choose Done &amp; Exit.
        </p>
        <div className="mt-4">
          <Textarea
            label="Comments"
            rows={4}
            value={activityComments}
            onChange={(e) => setActivityComments(e.target.value)}
            error={activityComments.length > 0 && !activityComments.trim() ? 'Enter a comment to create the activity.' : undefined}
          />
        </div>
      </Modal>
      {fibre === 'rfs' && (
        <section aria-label="Eligible offers" className="max-w-xl mx-auto mt-6 card p-5 no-print print:hidden">
          <h2 className="text-fg font-semibold text-[length:var(--fs-body-lg)] mb-3">Eligible offers</h2>
          <ul className="divide-y divide-border-soft">
            <li className="flex items-center justify-between gap-3 py-2">
              <span className="text-fg text-[length:var(--fs-body)]">Fibre at the customer's location</span>
              <Badge variant="success">RFS - Eligible for Fibre</Badge>
            </li>
          </ul>
        </section>
      )}
    </div>
  );
}
