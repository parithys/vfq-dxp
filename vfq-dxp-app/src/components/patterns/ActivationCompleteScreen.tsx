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
import { closeOrderActivities } from '../../engines/activityEngine';
import { useCustomerContext } from '../../stores/customerContextStore';

/**
 * The standard "Activation complete" page, for every activation journey.
 *
 * One layout, one row order, one set of actions - a journey supplies the facts
 * about its order and nothing else:
 *
 *   Customer | MSISDN | Plan | SIM Type | Due today | Monthly recurring | Status
 *   [View Order]  [Print]  [Close Activity]  [Create Lead]  [Continue with Fibre]
 *
 * Monthly recurring is omitted for an order that has none (prepaid). An eSIM
 * order adds the QR handover panel beside the receipt. An order held for
 * approval is headed "Order submitted for approval" and reports "Submitted for
 * Approval" as its status.
 */
export interface ActivationCompleteOrder {
  orderId: string;
  /** ID of the activity the journey created for this order. */
  activityId?: string;
  pendingApproval: boolean;
  customerName: string;
  /** Customer on file, when there is one - used to read the location's fibre serviceability. */
  customerId?: string;
  /** The address entered in the journey, when one was. */
  address?: AddressParts;
  msisdn: string;
  planName: string;
  simType?: string;
  dueTodayQar: number;
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
export const FIBRE_ACTIVATION_ROUTE = '/fixed-line-fibre/new-fixed-line-wizard-contact-step';
const ORDER_DETAIL_ROUTE = '/order-management/order-approval-detail-attachments-order-details-activities-a';

// Heading by who submitted (2026-10-01): Direct Sales and Mass Market orders go
// for approval; Retail orders are submitted outright. Any other role keeps the
// previous behaviour (approval wording only when the order was actually held).
const APPROVAL_SUBMITTERS = new Set(['Direct Sales Agent', 'Mass Market Agent']);
const RETAIL_SUBMITTERS = new Set(['Retail Sales Agent']);

// Orders whose confirmation email has already been sent this session, so re-rendering (or React's
// double-invoked effects) can never send it twice.
const emailedOrders = new Set<string>();

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
      `Due today: QR ${order.dueTodayQar}`,
      ...(order.monthlyRecurringQar !== undefined ? [`Monthly: QR ${order.monthlyRecurringQar}`] : []),
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
    pushToastOnce();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.orderId]);
  function pushToastOnce() {
    useNotificationStore.getState().pushToast('success', `Your order details${order.esimActivationCode ? ' and eSIM details' : ''} have been sent to your email.`, {
      key: `order-email-${order.orderId}`,
    });
  }
  const pushToast = useNotificationStore((s) => s.pushToast);
  // Close Activity: the journey has ended (this page only exists after submit), so the activities
  // it created are closed and the agent returns to Agent 360.
  const closeActivity = async () => {
    if (closing) return;
    setClosing(true);
    await closeOrderActivities(order.orderId);
    // The journey is over: the customer context is released.
    useCustomerContext.getState().endJourney();
    pushToast('success', 'Activity closed', { key: `activity-closed-${order.orderId}` });
    navigate('/');
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
  const heading = forApproval
    ? 'Order submitted for approval.'
    : RETAIL_SUBMITTERS.has(submitter)
      ? 'Order submitted successfully.'
      : 'Activation complete';
  return (
    <div className="p-8">
      <OrderConfirmationScreen
        heading={heading}
        orderId={order.orderId}
        activityId={order.activityId}
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
          { label: 'Due today', value: `QR ${order.dueTodayQar}` },
          ...(order.monthlyRecurringQar !== undefined
            ? [{ label: 'Monthly recurring', value: `QR ${order.monthlyRecurringQar}/mo` }]
            : []),
          { label: 'Status', value: order.pendingApproval ? 'Submitted for Approval' : 'Complete' },
          // The cue for the fibre actions below: whether the customer's location can be served by fibre.
          { label: 'Customer location', value: fibre === 'rfs' ? 'RFS (Ready For Service)' : fibre === 'not-rfs' ? 'Not RFS (not ready for service)' : fibre === 'unknown' ? 'Not on file' : 'Checking...' },
        ]}
        actions={[
          { label: 'View Order', variant: 'primary-rect', onClick: () => navigate(`${ORDER_DETAIL_ROUTE}?id=${order.orderId}`) },
          { label: 'Print', onClick: () => window.print(), endRow: true },
          { label: 'Close Activity', onClick: () => void closeActivity(), endRow: true },
          // Contextual: a location that is ready for service goes on to fibre activation; any other location (not ready,
          // or no address to check) offers capturing the fibre interest as a lead instead. Neither shows while it is read.
          ...(fibre === 'rfs' ? [{ label: 'Continue with Fibre', onClick: () => navigate(FIBRE_ACTIVATION_ROUTE) }] : []),
          ...(fibre === 'not-rfs' || fibre === 'unknown' ? [{ label: leadId ? `Lead ${leadId} created` : 'Create Lead', onClick: () => void createLead() }] : []),
        ]}
      />
      {!order.esimActivationCode &&
        (emailStatus === 'sent' ? (
          <p className="text-success text-center text-[length:var(--fs-body)] mt-4">Your order details have been sent to your email.</p>
        ) : (
          <p className="text-[var(--warn-text)] text-center text-[length:var(--fs-caption)] mt-4">
            {order.customerEmail
              ? 'The email address could not be verified against the customer\'s ID record, so the order details were not sent.'
              : 'No email address is on file, so the order details were not sent.'}
          </p>
        ))}
    </div>
  );
}
