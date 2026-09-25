import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as mockDataEngine from '../engines/mockDataEngine';
import { useEntityStore } from '../stores/entityStore';
import { useNotificationStore } from '../stores/notificationStore';
import { useActiveCustomerStore } from '../stores/activeCustomerStore';
import { useQnomyQueueStore } from '../stores/qnomyQueueStore';
import {
  nextTicketFor,
  waitingCountFor,
  queueLabelsForRole,
  mobileMatches,
  JOURNEY_PURPOSE_LABELS,
} from '../engines/qnomyQueueEngine';
import { usePersonaStore } from '../stores/personaStore';
import { canSeeQnomyTicketNumber, canSeeCtiReferenceNumber } from '../engines/agentPrivilegeEngine';
import { toActiveCustomerSummary, type CustomerRecord } from '../engines/customer360Engine';
import { Badge } from '../components/primitives/Badge';
import { Button } from '../components/primitives/Button';
import { Icon } from '../components/primitives/Icon';
import { Tooltip } from '../components/primitives/Tooltip';

interface QTicketRecord {
  qTicketId: string;
  kioskMobileNumber: string | null;
  customerId: string | null;
  journeyCode: string | null;
  queueName: string | null;
  generatedAt: string;
  status: string;
  agentInDxpSessionId: string | null;
}

const REFRESH_ICON_PATH = 'M3 12a9 9 0 0 1 15.3-6.4L21 8 M21 3v5h-5 M21 12a9 9 0 0 1-15.3 6.4L3 16 M3 21v-5h5';
interface TroubleTicketRecord {
  ticketId: string;
  customerId: string;
  category: string;
  createdAt: string;
}

function mostRecentFor<T extends { customerId: string }>(records: T[], customerId: string, dateField: keyof T): T | undefined {
  return records
    .filter((r) => r.customerId === customerId)
    .sort((a, b) => String(a[dateField]).localeCompare(String(b[dateField])))
    .at(-1);
}

// Header placement, immediately following the search box, read-only display
// (plain text stat / Badge - never an editable input). Both reference
// numbers are scoped to the customer currently loaded into
// activeCustomerStore. Persistence across every page/screen is structural:
// PersonaSwitcher (this component's parent) is mounted once in App.tsx
// outside <AppRouter/>, so it never unmounts on navigation.
//
//   - Qnomy Ticket Number: the customer's walk-in queue ticket (qtickets.json,
//     status 'Fed to Agent-in-DXP'), exclusively for Retail Agents and their
//     manager. Carries the Finish -> Next Customer servicing workflow below.
//   - CTI Reference Number: the customer's most recent active trouble ticket
//     (trouble-tickets.json), exclusively for Back-Office Agents and their
//     manager.
//
// Deliberately NOT shown here: a post-completion Tracking Record/Reference
// Number (e.g. the confirmation number issued only once a Mobile Postpaid
// Connection has actually been provisioned). That number doesn't exist for
// most of the servicing journey, so unlike the two above it can't function
// as a persistent "which interaction am I in" header reference - it belongs
// on the completed order/journey screen itself, not here.
//
// Next Customer -> Finish: nothing is ever assigned automatically. Clicking
// Next Customer pulls the oldest 'Waiting' ticket from a queue THIS ROLE
// SERVES (qnomyQueueEngine), marks it fed to this agent's session, retains the
// kiosk-entered mobile number for the interaction, and - if that number
// resolves to a customer on file - opens Customer 360 on their record.
// Clicking Finish completes the ticket, releases both the assignment and the
// retained number, and parks the queue in an explicit "awaiting next" state;
// the system does NOT auto-advance.
//
// Opening the record is deliberately NOT behind the identity gate. BR-01
// governs "demographic, contact, address or billing maintenance", and
// Customer360Layout / ContactSection / AddressSection each call
// requireVerification before such an edit. Gating the call itself meant the
// agent had to verify a customer they could not yet see.
export function SessionReferenceNumbers() {
  const navigate = useNavigate();
  const activePersonaId = usePersonaStore((s) => s.activePersonaId);
  const activeCustomer = useActiveCustomerStore((s) => s.customer);
  const setActiveCustomer = useActiveCustomerStore((s) => s.setActiveCustomer);
  const clearActiveCustomer = useActiveCustomerStore((s) => s.clearActiveCustomer);
  const updateRecord = useEntityStore((s) => s.updateRecord);
  const pushToast = useNotificationStore((s) => s.pushToast);
  const awaitingNext = useQnomyQueueStore((s) => s.awaitingNext);
  const setAwaitingNext = useQnomyQueueStore((s) => s.setAwaitingNext);
  const assignedQTicketId = useQnomyQueueStore((s) => s.assignedQTicketId);
  const kioskMobileNumber = useQnomyQueueStore((s) => s.kioskMobileNumber);
  const setKioskMobileNumber = useQnomyQueueStore((s) => s.setKioskMobileNumber);
  const setAssignedQTicketId = useQnomyQueueStore((s) => s.setAssignedQTicketId);

  const [activeQTicket, setActiveQTicket] = useState<QTicketRecord | undefined>();
  const [completedQTicket, setCompletedQTicket] = useState<QTicketRecord | undefined>();
  const [ctiTicket, setCtiTicket] = useState<TroubleTicketRecord | undefined>();
  const [refreshKey, setRefreshKey] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [abandoning, setAbandoning] = useState(false);
  // Which way the last ticket left the session. `completedQTicket` holds the
  // just-released ticket for either outcome, so without this the post-release
  // chip would report a green "Completed" for a ticket the agent abandoned.
  const [releasedAs, setReleasedAs] = useState<'completed' | 'abandoned'>('completed');
  const [callingNext, setCallingNext] = useState(false);
  const [waitingCount, setWaitingCount] = useState<number | null>(null);

  const showQnomy = canSeeQnomyTicketNumber(activePersonaId);
  const showCti = canSeeCtiReferenceNumber(activePersonaId);

  useEffect(() => {
    // Driven by the SESSION'S assignment, not by the loaded customer.
    //
    // Two reasons it must not depend on activeCustomer. Matching on ticket
    // status alone would let a pre-fed seed record for whichever customer
    // happened to be open look like an assignment made to this agent. And
    // requiring a matching customer meant a ticket for a walk-in whose kiosk
    // number resolves to NOBODY on file rendered nothing at all - the agent
    // held a ticket and a retained number, and the header showed an idle
    // queue, which is the one case where that number is the whole point.
    if (!showQnomy || !assignedQTicketId) {
      setActiveQTicket(undefined);
      return;
    }
    let cancelled = false;
    mockDataEngine.list<QTicketRecord>('qtickets').then((qTickets) => {
      if (cancelled) return;
      setActiveQTicket(qTickets.find((t) => t.qTicketId === assignedQTicketId));
    });
    return () => {
      cancelled = true;
    };
  }, [showQnomy, assignedQTicketId, refreshKey]);

  useEffect(() => {
    if (!activeCustomer || !showCti) {
      setCtiTicket(undefined);
      return;
    }
    let cancelled = false;
    mockDataEngine.list<TroubleTicketRecord>('trouble-tickets').then((tickets) => {
      if (cancelled) return;
      setCtiTicket(mostRecentFor(tickets, activeCustomer.customerId, 'createdAt'));
    });
    return () => {
      cancelled = true;
    };
  }, [activeCustomer?.customerId, showCti]);

  useEffect(() => {
    if (!showQnomy) return;
    let cancelled = false;
    mockDataEngine.list<QTicketRecord>('qtickets').then((qTickets) => {
      if (cancelled) return;
      setWaitingCount(waitingCountFor(activePersonaId, qTickets));
    });
    return () => {
      cancelled = true;
    };
  }, [showQnomy, refreshKey, activeQTicket, activePersonaId]);

  const handleFinish = async () => {
    if (!activeQTicket) return;
    setFinishing(true);
    await updateRecord('qtickets', 'qTicketId', activeQTicket.qTicketId, { status: 'Completed', agentInDxpSessionId: null });
    setFinishing(false);
    setReleasedAs('completed');
    setCompletedQTicket(activeQTicket);
    setActiveQTicket(undefined);
    setAssignedQTicketId(null);
    setKioskMobileNumber(null);
    setAwaitingNext(true);
    pushToast('success', `Customer servicing for ticket ${activeQTicket.qTicketId} completed.`);
  };

  // Same release path as handleFinish - completes the servicing session,
  // clears the assignment and retained number, and parks the queue in
  // "awaiting next" without auto-advancing. The only difference is the
  // outcome written to the ticket: the customer left before servicing
  // finished, so the ticket is not 'Completed'.
  //
  // 'Abandoned' is a NEW status value. The corpus only evidences 'Waiting',
  // and this component writes 'Fed to Agent-in-DXP' and 'Completed'; the
  // qticket `status` field is a free-form string with no enum to validate
  // against, so nothing rejected it. Flagged rather than presented as
  // evidenced - if the real Qnomy vocabulary calls this "No Show" or
  // similar, this is the one string to change.
  const handleAbandon = async () => {
    if (!activeQTicket) return;
    setAbandoning(true);
    await updateRecord('qtickets', 'qTicketId', activeQTicket.qTicketId, { status: 'Abandoned', agentInDxpSessionId: null });
    setAbandoning(false);
    setReleasedAs('abandoned');
    setCompletedQTicket(activeQTicket);
    setActiveQTicket(undefined);
    setAssignedQTicketId(null);
    setKioskMobileNumber(null);
    setAwaitingNext(true);
    pushToast('warning', `Ticket ${activeQTicket.qTicketId} marked abandoned.`);
  };

  const assignTicket = async (waiting: QTicketRecord) => {
    const sessionId = `DXP-SESS-${Date.now().toString().slice(-6)}`;
    await updateRecord('qtickets', 'qTicketId', waiting.qTicketId, {
      status: 'Fed to Agent-in-DXP',
      agentInDxpSessionId: sessionId,
    });
    setAssignedQTicketId(waiting.qTicketId);
    // Retained for the whole interaction, whether or not it resolves to an
    // existing customer - a new walk-in's number is exactly the value the
    // activation journey needs to carry forward.
    setKioskMobileNumber(waiting.kioskMobileNumber ?? null);
    setAwaitingNext(false);
    setCompletedQTicket(undefined);
    setRefreshKey((k) => k + 1);
  };

  const handleNextCustomer = async () => {
    setCallingNext(true);
    const [qTickets, customers] = await Promise.all([
      mockDataEngine.list<QTicketRecord>('qtickets'),
      mockDataEngine.list<CustomerRecord>('customers'),
    ]);
    // Only from a queue this role serves (qnomyQueueEngine), oldest first.
    const waiting = nextTicketFor(activePersonaId, qTickets);
    setCallingNext(false);
    if (!waiting) {
      pushToast('info', `No customers waiting in your queue (${queueLabelsForRole(activePersonaId)}).`);
      return;
    }

    await assignTicket(waiting);

    // Identify by the KIOSK-ENTERED MOBILE NUMBER, not by the ticket's
    // customerId: the kiosk only knows what the customer typed, so resolving
    // the number is the step that decides whether this is an existing customer
    // at all. Falls back to the ticket's own link when a number is absent.
    const matched =
      customers.find((c) => mobileMatches(waiting.kioskMobileNumber, c.phone))
      ?? customers.find((c) => c.customerId === waiting.customerId);

    if (matched) {
      // Existing customer: open Customer 360 on their record automatically.
      // NOT gated behind identity verification - BR-01 governs "demographic,
      // contact, address or billing maintenance", and Customer360Layout /
      // ContactSection / AddressSection each already call requireVerification
      // before any such edit. Blocking the mere act of opening the record made
      // calling a customer impossible until you had verified someone you
      // could not yet see.
      setActiveCustomer(toActiveCustomerSummary(matched));
      // Headline says what happened; who it happened to goes on the detail
      // line. One sentence carrying both made the ticket id compete with the
      // customer name for the same glance.
      // Structured rather than a sentence: these are five separate facts the
      // agent reads off the screen while greeting a walk-in, and "Purpose of
      // visit" is the queue the customer chose at the kiosk - queueName, not
      // an interpretation of journeyCode.
      pushToast('success', 'New ticket assigned', {
        rows: [
          { label: 'Ticket number', value: waiting.qTicketId, tone: 'id' },
          { label: 'Customer name', value: matched.name },
          { label: 'Mobile number', value: waiting.kioskMobileNumber ?? 'Not captured' },
          { label: 'Customer status', value: 'Existing registered customer', tone: 'success' },
          {
            label: 'Purpose of visit',
            // The journey the kiosk code stands for, not the queue the
            // customer is queuing in. Falls back to the queue name for a code
            // with no mapped journey rather than inventing a purpose.
            value:
              (waiting.journeyCode ? JOURNEY_PURPOSE_LABELS[waiting.journeyCode] : undefined) ??
              waiting.queueName ??
              'Not recorded',
          },
        ],
      });
      // A queue walk-in arrives through the New Connections journey, so that
      // is what the rail should show rather than Customer Search - the agent
      // did not search for this customer, the queue handed them over.
      navigate(`/customer/${matched.customerId}`, { state: { navKey: 'mobile.new-connections' } });
      return;
    }

    // No customer on file for that number. Say so plainly and keep the number
    // rather than dead-ending: this is a new walk-in, and the number is what
    // the activation journey starts from.
    //
    // Navigating away matters as much as clearing the store. Customer360Layout
    // reads the route param, not activeCustomer, so staying put left the
    // PREVIOUS customer's record on screen while the header announced a new
    // one - the agent would be reading Mohammed's file while serving someone
    // else. The Dashboard is the honest landing: the retained kiosk number is
    // in the header, and the activation quick actions are right there.
    clearActiveCustomer();
    navigate('/');
    // Same shape for a walk-in with no record, so the agent reads the same
    // five rows either way. Customer status carries the difference and is
    // deliberately NOT toned 'success': there is nothing to confirm here, and
    // a green row would suggest a match was found.
    pushToast('info', 'New ticket assigned', {
      rows: [
        { label: 'Ticket number', value: waiting.qTicketId, tone: 'id' },
        { label: 'Customer name', value: 'Not on file' },
        { label: 'Mobile number', value: waiting.kioskMobileNumber ?? 'Not captured' },
        { label: 'Customer status', value: 'New customer' },
        {
            label: 'Purpose of visit',
            // The journey the kiosk code stands for, not the queue the
            // customer is queuing in. Falls back to the queue name for a code
            // with no mapped journey rather than inventing a purpose.
            value:
              (waiting.journeyCode ? JOURNEY_PURPOSE_LABELS[waiting.journeyCode] : undefined) ??
              waiting.queueName ??
              'Not recorded',
          },
      ],
    });
  };

  // A Qnomy-eligible agent ALWAYS has something here: a held ticket, a just-
  // finished one, or the idle queue control. Previously this bailed out
  // whenever no ticket was held, which made the idle "Next Customer" control
  // unreachable - a freshly logged-in agent had no way to call anyone.
  const showIdleQueue = showQnomy && !activeQTicket && !(awaitingNext && completedQTicket);
  if (!showQnomy && !(showCti && ctiTicket)) return null;

  return (
    <div className="flex items-center gap-2 shrink-0">
      {showQnomy && activeQTicket && (
        <>
          <Tooltip
            content={
              activeCustomer
                ? `Qnomy queue ticket for ${activeCustomer.name} (read-only)`
                : `Qnomy queue ticket - no customer on file for ${kioskMobileNumber ?? 'this number'}; treat as a new customer`
            }
            placement="bottom"
          >
            <div className="flex flex-col leading-tight">
              <span className="text-[length:var(--fs-caption)] uppercase tracking-wide text-muted">
                {activeQTicket.queueName ?? 'Qnomy Ticket'}
              </span>
              <span className="text-fg font-semibold text-[length:var(--fs-body)]">
                {activeQTicket.qTicketId}
                {kioskMobileNumber && (
                  <span className="text-fg-2 font-normal"> · {kioskMobileNumber}</span>
                )}
              </span>
            </div>
          </Tooltip>
          {/* A walk-in with no record is a normal outcome, not an error - the
              agent needs to see it, keep the number, and start an activation. */}
          {!activeCustomer && <Badge variant="warning">New customer</Badge>}
          <Button variant="primary-rect" compact disabled={finishing || abandoning} onClick={handleFinish}>
            {finishing ? 'Finishing…' : 'Finish'}
          </Button>
          {/* Secondary style (`ghost-rect`) - the same variant the completed
              state's Next Customer already uses in this component, so the
              two outcomes are not competing primaries. Both buttons disable
              during either action: they write to the same ticket, and the
              release is not idempotent. */}
          <Button variant="ghost-rect" compact disabled={finishing || abandoning} onClick={handleAbandon}>
            {abandoning ? 'Abandoning…' : 'Abandoned'}
          </Button>
        </>
      )}
      {/* Idle: no ticket held by this session and nothing just finished. The
          agent is at the front desk with the queue in front of them, so this
          is where Next Customer lives - previously it only appeared after a
          Finish, which left a freshly-logged-in agent with no way to call
          anyone at all. */}
      {showIdleQueue && (
        <>
          <Tooltip content={`Waiting in your queue: ${queueLabelsForRole(activePersonaId)}`} placement="bottom">
            <div className="flex flex-col leading-tight">
              <span className="text-[length:var(--fs-caption)] uppercase tracking-wide text-muted">Queue</span>
              <span className="text-fg font-semibold text-[length:var(--fs-body)]">
                {waitingCount === null ? '-' : `${waitingCount} waiting`}
              </span>
            </div>
          </Tooltip>
          <Button
            variant="primary-rect"
            compact
            disabled={callingNext || waitingCount === 0}
            onClick={handleNextCustomer}
          >
            <Icon path={REFRESH_ICON_PATH} className="w-4 h-4" />
            {callingNext ? 'Calling…' : 'Next Customer'}
          </Button>
        </>
      )}
      {showQnomy && !activeQTicket && awaitingNext && completedQTicket && (
        <>
          <Tooltip
            content={
              releasedAs === 'abandoned'
                ? 'Qnomy queue ticket for the previous customer - abandoned before servicing finished (read-only)'
                : 'Qnomy queue ticket for the previous customer - servicing completed (read-only)'
            }
            placement="bottom"
          >
            <div className="flex flex-col leading-tight opacity-40">
              <span className="text-[length:var(--fs-caption)] uppercase tracking-wide text-muted">Qnomy Ticket</span>
              <span className="text-fg font-semibold text-[length:var(--fs-body)]">{completedQTicket.qTicketId}</span>
            </div>
          </Tooltip>
          {releasedAs === 'abandoned' ? (
            <Badge variant="warning">Abandoned</Badge>
          ) : (
            <Badge variant="success">Completed</Badge>
          )}
          <Button variant="ghost-rect" compact disabled={callingNext} onClick={handleNextCustomer}>
            <Icon path={REFRESH_ICON_PATH} className="w-4 h-4" />
            {callingNext ? 'Calling…' : 'Next Customer'}
          </Button>
        </>
      )}
      {showCti && ctiTicket && (
        <Tooltip content={`Active ticket (${ctiTicket.category}) for ${activeCustomer?.name ?? 'this customer'} (read-only)`} placement="bottom">
          <Badge variant="filled-neutral">CTI {ctiTicket.ticketId}</Badge>
        </Tooltip>
      )}
    </div>
  );
}
