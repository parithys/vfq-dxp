import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as mockDataEngine from '../engines/mockDataEngine';
import { useEntityStore } from '../stores/entityStore';
import { useNotificationStore } from '../stores/notificationStore';
import { useActiveCustomerStore } from '../stores/activeCustomerStore';
import { useCustomerVerificationStore } from '../stores/customerVerificationStore';
import { useQnomyQueueStore } from '../stores/qnomyQueueStore';
import { usePersonaStore } from '../stores/personaStore';
import { canSeeQnomyTicketNumber, canSeeCtiReferenceNumber } from '../engines/agentPrivilegeEngine';
import { toActiveCustomerSummary, type CustomerRecord } from '../engines/customer360Engine';
import { VerificationGate } from '../components/patterns/VerificationGate';
import { Badge } from '../components/primitives/Badge';
import { Button } from '../components/primitives/Button';
import { Icon } from '../components/primitives/Icon';
import { Tooltip } from '../components/primitives/Tooltip';

interface QTicketRecord {
  qTicketId: string;
  customerId: string;
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
// (plain text stat / Badge — never an editable input). Both reference
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
// as a persistent "which interaction am I in" header reference — it belongs
// on the completed order/journey screen itself, not here.
//
// Finish -> Next Customer: clicking Finish marks the active Qnomy ticket
// Completed and puts the queue into an explicit "awaiting next" state
// (qnomyQueueStore) — the system does NOT auto-advance. Only clicking Next
// Customer pulls the oldest 'Waiting' ticket, marks it fed to this agent,
// and assigns it as the active customer (verifying identity first if this
// session hasn't already, consistent with CAM-04-A elsewhere in the app).
export function SessionReferenceNumbers() {
  const navigate = useNavigate();
  const activePersonaId = usePersonaStore((s) => s.activePersonaId);
  const activeCustomer = useActiveCustomerStore((s) => s.customer);
  const setActiveCustomer = useActiveCustomerStore((s) => s.setActiveCustomer);
  const updateRecord = useEntityStore((s) => s.updateRecord);
  const pushToast = useNotificationStore((s) => s.pushToast);
  const isVerified = useCustomerVerificationStore((s) => s.isVerified);
  const awaitingNext = useQnomyQueueStore((s) => s.awaitingNext);
  const setAwaitingNext = useQnomyQueueStore((s) => s.setAwaitingNext);

  const [activeQTicket, setActiveQTicket] = useState<QTicketRecord | undefined>();
  const [completedQTicket, setCompletedQTicket] = useState<QTicketRecord | undefined>();
  const [ctiTicket, setCtiTicket] = useState<TroubleTicketRecord | undefined>();
  const [refreshKey, setRefreshKey] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [callingNext, setCallingNext] = useState(false);
  const [pendingVerifyCustomerId, setPendingVerifyCustomerId] = useState<string | null>(null);
  const [pendingVerifyName, setPendingVerifyName] = useState('');

  const showQnomy = canSeeQnomyTicketNumber(activePersonaId);
  const showCti = canSeeCtiReferenceNumber(activePersonaId);

  useEffect(() => {
    if (!activeCustomer || !showQnomy) {
      setActiveQTicket(undefined);
      return;
    }
    let cancelled = false;
    mockDataEngine.list<QTicketRecord>('qtickets').then((qTickets) => {
      if (cancelled) return;
      const forCustomer = mostRecentFor(
        qTickets.filter((t) => t.status === 'Fed to Agent-in-DXP'),
        activeCustomer.customerId,
        'generatedAt'
      );
      setActiveQTicket(forCustomer);
    });
    return () => {
      cancelled = true;
    };
  }, [activeCustomer?.customerId, showQnomy, refreshKey]);

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

  const handleFinish = async () => {
    if (!activeQTicket) return;
    setFinishing(true);
    await updateRecord('qtickets', 'qTicketId', activeQTicket.qTicketId, { status: 'Completed', agentInDxpSessionId: null });
    setFinishing(false);
    setCompletedQTicket(activeQTicket);
    setActiveQTicket(undefined);
    setAwaitingNext(true);
    pushToast('success', `Customer servicing for ticket ${activeQTicket.qTicketId} completed.`);
  };

  const assignAndGo = async (waiting: QTicketRecord, customer: CustomerRecord) => {
    const sessionId = `DXP-SESS-${Date.now().toString().slice(-6)}`;
    await updateRecord('qtickets', 'qTicketId', waiting.qTicketId, { status: 'Fed to Agent-in-DXP', agentInDxpSessionId: sessionId });
    setActiveCustomer(toActiveCustomerSummary(customer));
    setAwaitingNext(false);
    setCompletedQTicket(undefined);
    setRefreshKey((k) => k + 1);
    pushToast('success', `Next customer called — ticket ${waiting.qTicketId} (${customer.name}) assigned to you.`);
    navigate(`/customer/${customer.customerId}`);
  };

  const handleNextCustomer = async () => {
    setCallingNext(true);
    const [qTickets, customers] = await Promise.all([
      mockDataEngine.list<QTicketRecord>('qtickets'),
      mockDataEngine.list<CustomerRecord>('customers'),
    ]);
    const waiting = qTickets.filter((t) => t.status === 'Waiting').sort((a, b) => a.generatedAt.localeCompare(b.generatedAt))[0];
    setCallingNext(false);
    if (!waiting) {
      pushToast('info', 'No customers waiting in the queue.');
      return;
    }
    const customer = customers.find((c) => c.customerId === waiting.customerId);
    if (!customer) {
      pushToast('error', `Queue ticket ${waiting.qTicketId} has no matching customer record.`);
      return;
    }
    if (!isVerified(customer.customerId)) {
      setPendingVerifyCustomerId(customer.customerId);
      setPendingVerifyName(customer.name);
      return;
    }
    await assignAndGo(waiting, customer);
  };

  const onQueueVerified = async () => {
    if (!pendingVerifyCustomerId) return;
    const [qTickets, customers] = await Promise.all([
      mockDataEngine.list<QTicketRecord>('qtickets'),
      mockDataEngine.list<CustomerRecord>('customers'),
    ]);
    const waiting = qTickets.find((t) => t.status === 'Waiting' && t.customerId === pendingVerifyCustomerId);
    const customer = customers.find((c) => c.customerId === pendingVerifyCustomerId);
    setPendingVerifyCustomerId(null);
    if (waiting && customer) await assignAndGo(waiting, customer);
  };

  const nothingToShow = !(showQnomy && (activeQTicket || (awaitingNext && completedQTicket))) && !(showCti && ctiTicket);
  if (nothingToShow) return null;

  return (
    <div className="flex items-center gap-2 shrink-0">
      {showQnomy && activeQTicket && (
        <>
          <Tooltip content={`Qnomy queue ticket for ${activeCustomer?.name ?? 'this customer'} (read-only)`} placement="bottom">
            <div className="flex flex-col leading-tight">
              <span className="text-[length:var(--fs-caption)] uppercase tracking-wide text-muted">Qnomy Ticket</span>
              <span className="text-fg font-semibold text-[length:var(--fs-body)]">{activeQTicket.qTicketId}</span>
            </div>
          </Tooltip>
          <Button variant="primary-rect" compact disabled={finishing} onClick={handleFinish}>
            {finishing ? 'Finishing…' : 'Finish'}
          </Button>
        </>
      )}
      {showQnomy && !activeQTicket && awaitingNext && completedQTicket && (
        <>
          <Tooltip content={`Qnomy queue ticket for the previous customer — servicing completed (read-only)`} placement="bottom">
            <div className="flex flex-col leading-tight opacity-40">
              <span className="text-[length:var(--fs-caption)] uppercase tracking-wide text-muted">Qnomy Ticket</span>
              <span className="text-fg font-semibold text-[length:var(--fs-body)]">{completedQTicket.qTicketId}</span>
            </div>
          </Tooltip>
          <Badge variant="success">Completed</Badge>
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
      {pendingVerifyCustomerId && (
        <VerificationGate
          customerId={pendingVerifyCustomerId}
          customerName={pendingVerifyName}
          open
          onClose={() => setPendingVerifyCustomerId(null)}
          onVerified={onQueueVerified}
        />
      )}
    </div>
  );
}
