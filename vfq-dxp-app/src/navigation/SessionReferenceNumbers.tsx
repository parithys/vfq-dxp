import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as mockDataEngine from '../engines/mockDataEngine';
import { getAllRoutes } from '../engines/configEngine';
import { useEntityStore } from '../stores/entityStore';
import { useNotificationStore } from '../stores/notificationStore';
import { useActiveCustomerStore } from '../stores/activeCustomerStore';
import { useQnomyQueueStore } from '../stores/qnomyQueueStore';
import { useAuthStore } from '../stores/authStore';
import {
  nextTicketFor,
  waitingCountFor,
  queueLabelsForRole,
  mobileMatches,
  purposeOfVisit,
  JOURNEY_LAUNCH_SCREENS,
} from '../engines/qnomyQueueEngine';
import { usePersonaStore } from '../stores/personaStore';
import { canSeeQnomyTicketNumber, canSeeCtiReferenceNumber } from '../engines/agentPrivilegeEngine';
import { toActiveCustomerSummary, type AccountRecord, type CustomerRecord } from '../engines/customer360Engine';
import { groupServicesByCategory, listCustomerServices, type ServiceSources } from '../engines/customerServicesEngine';
import { Badge } from '../components/primitives/Badge';
import { Button } from '../components/primitives/Button';
import { Icon } from '../components/primitives/Icon';
import { Tooltip } from '../components/primitives/Tooltip';
import type { ToastBrand, ToastKind, ToastOptions, ToastRow, ToastServiceLink } from '../stores/notificationStore';

interface QTicketRecord {
  qTicketId: string;
  kioskMobileNumber: string | null;
  customerId: string | null;
  journeyCode: string | null;
  queueName: string | null;
  generatedAt: string;
  status: string;
  agentInDxpSessionId: string | null;
  /** Per-ticket purpose refinement - see purposeOfVisit()'s own note. */
  taskType?: string | null;
}

const INFO_ICON_PATH = 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 11v5 M12 7.5h.01';
const REFRESH_ICON_PATH = 'M3 12a9 9 0 0 1 15.3-6.4L21 8 M21 3v5h-5 M21 12a9 9 0 0 1-15.3 6.4L3 16 M3 21v-5h5';
interface TroubleTicketRecord {
  ticketId: string;
  customerId: string;
  category: string;
  createdAt: string;
}

// Everything the notification says about WHO is at the counter: which
// operator they belong to, their relationship on this number, and how many
// lines they hold.
//
// Resolved from the KIOSK-ENTERED MOBILE NUMBER, not the ticket's customerId,
// per the 2026-09-25 direction ("determined based on the customer number
// received from Qnomy"). That is also the honest source: the kiosk only knows
// what the walk-in typed, and matching it is the step that decides whether
// this is a Vodafone customer at all. It reuses the same mobileMatches() the
// assignment path already resolves identity with, so the mark can never
// disagree with the record the agent is shown.
//
// One resolution returns BOTH facts, so the operator mark and the Active lines
// row cannot end up describing different people.
//
// Yields operator 'other' - the Ooredoo mark - for a number with no Vodafone
// record. Reachable with the current seed: QTK-7006 carries +97455519999 and a
// null customerId, which matches nobody in customers.json.
interface KioskCustomerFacts {
  brand: ToastBrand;
  /** One link per service CATEGORY the customer holds. Empty for none. */
  links: ToastServiceLink[];
  /**
   * Total services across those categories. Carried explicitly rather than
   * summed back out of the link labels - those are formatted display strings
   * ("Postpaid (2)"), and re-parsing a number out of presentation text is a
   * dependency on the wording that would break the moment it changed.
   */
  serviceCount: number;
}

// The Active lines row. The COUNT lives in the label - "Active lines (4)" -
// so the value cell holds the breakdown alone rather than a number with a
// list hanging under it, which read as two separate values stacked in one
// cell.
//
// Three link-less shapes, each a different claim and none of them "0":
//
//   - 'Not applicable' - a competitor's customer. The question does not apply
//     to them; they do not hold zero Vodafone services.
//   - 'None'           - a Vodafone customer who genuinely holds nothing.
//   - 'Not recorded'   - facts never resolved, so nothing is known either way.
function activeLinesRow(facts: KioskCustomerFacts | undefined): ToastRow {
  if (!facts) return { label: 'Active lines', value: 'Not recorded' };
  if (facts.brand.operator === 'other') return { label: 'Active lines', value: 'Not applicable' };
  if (facts.serviceCount === 0) return { label: 'Active lines', value: 'None' };
  // Empty value, not a repeat of the count: it is in the label now.
  // The count is SERVICES, not category rows: facts.links.length would have
  // read "Active lines (2)" for a customer holding four services across two
  // categories.
  return { label: `Active lines (${facts.serviceCount})`, value: '', links: facts.links };
}

function factsForKioskNumber(
  mobile: string | null,
  customers: CustomerRecord[],
  sources: ServiceSources
): KioskCustomerFacts {
  const matched = mobile ? customers.find((c) => mobileMatches(mobile, c.phone)) : undefined;
  if (!matched) {
    // Not "None": a competitor's customer does not hold zero Vodafone
    // services, the question does not apply to them. Zero is a different
    // claim.
    return { brand: { operator: 'other' }, links: [], serviceCount: 0 };
  }

  // The customer's WHOLE relationship, not their mobile lines - mobile,
  // GigaHome, OSNtv, IPTV, smart devices, installed services. This replaced
  // activePostpaidLines + activePrepaidLines, which are mobile-only and so
  // reported "None" for CUST-1003 (active GigaHome) and CUST-1004 (GigaHome
  // plus a smart plug).
  //
  // The count shown is the length of this list, so the figure and the
  // breakdown can never disagree. That does mean it no longer echoes the two
  // count fields on the customer record:
  // CUST-1005 carries 4 lines by count but has no account and therefore no
  // enumerable service records, so only the one line his own number
  // identifies is listed. Counting 4 while showing 1 would be worse - the
  // three others have no number to link to and cannot be opened.
  const services = listCustomerServices(matched, sources);
  // GROUPED BY CATEGORY as of 2026-09-25, not one row per service. Four
  // identifiers under a count told the agent what the services ARE called,
  // which is not a question they have at the moment of greeting; the shape of
  // the relationship is. "Postpaid (2), GigaHome Fibre (1)" answers that in
  // one glance where "+97455512001 / SVC-30011 / GHO-15001 / IPTV-2001" did
  // not.
  const groups = groupServicesByCategory(services);
  return {
    brand: { operator: 'vodafone', segment: segmentOf(matched), relationship: relationshipOf(matched) },
    serviceCount: services.length,
    links: groups.map((group) => ({
      label: `${group.category} (${group.count})`,
      customerId: matched.customerId,
      tab: group.tab,
      // No serviceRef: a category opens its tab, it does not select one
      // service. Customer360Layout leaves nothing highlighted, which is right
      // - the agent asked for the category, not a row in it.
      note: `${group.count} ${group.count === 1 ? 'service' : 'services'}`,
    })),
  };
}

// Resolves a journey code to the route its screen lives at, or undefined when
// the code has no mapped screen or the screen is not in routes.json.
function launchPathFor(journeyCode: string | null): string | undefined {
  if (!journeyCode) return undefined;
  const screenId = JOURNEY_LAUNCH_SCREENS[journeyCode];
  if (!screenId) return undefined;
  return getAllRoutes().find((r) => r.screenId === screenId)?.path;
}

// The four datasets the service inventory needs beyond `customers`. Bundled
// into one helper because both entry points - the queue assignment and the
// info-icon reopen - need exactly the same set, and listing them twice is how
// the two would come to disagree about what counts as a service.
function loadServiceSources(): Promise<ServiceSources> {
  return Promise.all([
    mockDataEngine.list<AccountRecord>('accounts'),
    mockDataEngine.list<Record<string, unknown>>('installed-assets'),
    mockDataEngine.list<Record<string, unknown>>('gigahome-osntv-subscriptions'),
    mockDataEngine.list<Record<string, unknown>>('iptv-stb-bundles'),
    mockDataEngine.list<Record<string, unknown>>('smart-devices'),
  ]).then(([accounts, installedAssets, gigahome, iptvBundles, smartDevices]) => ({
    accounts,
    installedAssets,
    gigahome,
    iptvBundles,
    smartDevices,
  }));
}

// Consumer or Business, collapsed from customers.json's three segment values:
// 'Consumer', 'Consumer (HRN)' and 'Enterprise (EBU)'.
//
// HRN stays CONSUMER on purpose. It is a risk classification layered on top
// of a consumer account - it drives an advance payment, not a different line
// of business - and the Eligibility step already reports it in its own row.
// Folding it into "Business" would misfile a consumer as an enterprise.
//
// Anything unrecognised returns undefined rather than defaulting to Consumer,
// so a new segment value surfaces as a missing label instead of being
// silently filed as the commoner of the two.
function segmentOf(customer: CustomerRecord): string | undefined {
  const segment = customer.segment ?? '';
  if (/enterprise|business|b2b|ebu/i.test(segment)) return 'Business';
  if (/consumer/i.test(segment)) return 'Consumer';
  return undefined;
}

// Prepaid or Postpaid for THE NUMBER Qnomy handed over - never both.
//
// Reads `lineType`, which describes the single line `phone` identifies, and
// NOT activePostpaidLines/activePrepaidLines. Those are counts across the
// whole customer, so they cannot answer the question this notification asks:
// a customer holding lines of both kinds made them report "Prepaid +
// Postpaid", which is a fact about the customer and not about the walk-in's
// number. Reading one field rather than comparing two also means "both" is
// now unrepresentable rather than merely unreached.
//
// `undefined` when the customer has no line, which is a REAL state: four of
// the eight seeded customers are registered with none, and CUST-1004 is the
// one queued for a new postpaid connection. Defaulting those to either value
// would put a relationship on screen that the customer does not have.
function relationshipOf(customer: CustomerRecord): string | undefined {
  return customer.lineType;
}

// The facts an agent reads off the ticket, built in ONE place.
//
// Three call sites want them: the two assignment toasts and the header's info
// button, which re-shows the notification after it has been dismissed. Three
// inline copies would drift, and the one most likely to drift is the re-show -
// the copy nobody looks at until a customer is standing at the counter.
//
// "Customer status" ("Existing registered customer" / "New customer") was
// removed on 2026-09-25. The operator mark on the header line now carries the
// same distinction and carries it better: a Vodafone mark IS "existing
// registered", and the Ooredoo mark says "not ours" more directly than the
// word "New" did. Keeping both put the same fact on screen twice, in two
// vocabularies, one of which called a competitor's customer "New".
//
// With no name to show, the fallback is chosen by the OPERATOR, not merely by
// the name being absent - the two are not the same condition, and conflating
// them would mislabel people. `brand` comes from resolving the kiosk number,
// while `customerName` can be null for a Vodafone customer whose record
// simply is not loaded: the info-icon reopen reads the active customer store,
// which Finish clears. Keying "Ooredoo Customer" off a missing name would
// therefore have relabelled a Vodafone walk-in as a competitor's customer the
// moment the agent reopened the notification.
//
//   - no name, operator 'other'    -> "Ooredoo Customer" (2026-09-25)
//   - no name, operator 'vodafone' -> "Not on file", as before
function ticketToastRows(
  ticket: QTicketRecord,
  customerName: string | null,
  customerId: string | null,
  mobile: string | null,
  facts: KioskCustomerFacts | undefined
): ToastRow[] {
  return [
    // "Ticket number" is no longer a row (2026-09-25): the id moved into the
    // headline, where it names the notification rather than sitting as the
    // first of five equal-weight facts. It keeps its 'id' tone nowhere now,
    // so the cyan value treatment only appears if another row asks for it.
    {
      label: 'Customer name',
      value: customerName ?? (facts?.brand.operator === 'other' ? 'Ooredoo Customer' : 'Not on file'),
      // Clicking the name opens Customer 360 (2026-09-27) - same `to`
      // mechanism "Purpose of visit" already uses below, so a customer row
      // and a journey row are actionable the same way rather than two
      // different link conventions on one toast. Only when there IS a
      // customer: "Ooredoo Customer" and "Not on file" both mean no record
      // exists to open, so neither gets a link.
      to: customerId ? `/customer/${customerId}` : undefined,
    },
    {
      label: 'Mobile number',
      value: mobile ?? 'Not captured',
      // The relationship on THIS number, in brackets beneath it (2026-09-25).
      // Absent rather than guessed for a competitor's customer and for a
      // Vodafone customer with no active line - neither has a prepaid or
      // postpaid standing on this number to state.
      sub: facts?.brand.relationship ? `(${facts.brand.relationship})` : undefined,
    },
    activeLinesRow(facts),
    {
      label: 'Purpose of visit',
      // The journey the kiosk code stands for, not the queue the customer is
      // queuing in - refined by the ticket's own taskType when it carries
      // one (2026-09-27), the same derivation the Ticket History page uses,
      // so a ticket cannot read one purpose here and a different one there.
      value: purposeOfVisit(ticket),
      // Clicking the purpose LAUNCHES it (2026-09-25), so the agent starts the
      // journey from the greeting rather than re-finding it in the nav.
      //
      // Undefined for a purpose with no mapped screen, which leaves the value
      // as plain text - see JOURNEY_LAUNCH_SCREENS for why only J011 is
      // mapped. Resolved here rather than stored as a screen id because the
      // notification store holds no engine lookups.
      //
      // The active customer is deliberately NOT cleared first, unlike
      // SalesWorkspace's blank-start acquisition buttons: the queue has
      // already put this walk-in in the bridge, and the wizard prefilling
      // with the person standing at the counter is the entire point.
      to: launchPathFor(ticket.journeyCode),
    },
  ];
}

// The whole notification, not just its rows: kind, headline and key together.
//
// Both entry points - the queue assigning a ticket, and the header info icon
// reopening it - call this, so they cannot drift. They previously built the
// kind separately and disagreed: an assignment for a customer on file was
// 'success' (green dot) while the reopen was always 'info' (grey), so the
// same notification looked like two different ones.
//
// The key is the ticket, so reopening REPLACES the notification rather than
// pushing another. Without it, four clicks of the info icon meant four
// stacked toasts and four unread items in the bell.
function ticketToast(
  ticket: QTicketRecord,
  customerName: string | null,
  customerId: string | null,
  mobile: string | null,
  facts: KioskCustomerFacts | undefined
): [ToastKind, string, ToastOptions] {
  return [
    customerName ? 'success' : 'info',
    // The ticket id is IN the headline as of 2026-09-25, replacing "New ticket
    // assigned" and the Ticket number row both. The structured header renders
    // uppercase and tracked, which is left as-is: it is the shared treatment
    // for every structured toast, and the id is uppercase already, so only its
    // letter-spacing changes.
    //
    // The id goes in `reference`, NOT interpolated into this string, so it can
    // keep the colour it had as a `tone: 'id'` row. Interpolating it is exactly
    // what made it plain white when it first moved up here.
    'Assigned Ticket Number:',
    {
      rows: ticketToastRows(ticket, customerName, customerId, mobile, facts),
      key: `qticket-${ticket.qTicketId}`,
      brand: facts?.brand,
      reference: ticket.qTicketId,
    },
  ];
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
  // Whose history this release belongs to, for the Ticket History page - the
  // stable per-login identity (users-agents.json's userId), not the active
  // PERSONA: a role can be switched mid-session without the agent behind it
  // changing, and it's the agent, not the role, whose servicing this is.
  const staffUserId = useAuthStore((s) => s.profile?.userId) ?? null;
  const pushToast = useNotificationStore((s) => s.pushToast);
  const awaitingNext = useQnomyQueueStore((s) => s.awaitingNext);
  const setAwaitingNext = useQnomyQueueStore((s) => s.setAwaitingNext);
  const recordCustomerServed = useQnomyQueueStore((s) => s.recordCustomerServed);
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
  // Operator mark AND active-line count for the ticket in hand, both
  // resolved from its kiosk number in one pass.
  const [ticketFacts, setTicketFacts] = useState<KioskCustomerFacts | undefined>(undefined);
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
      setTicketFacts(undefined);
      return;
    }
    let cancelled = false;
    // Customers alongside the tickets so the operator mark is available to the
    // info-icon reopen, which is a plain click handler with no list of its own.
    // Resolving it here rather than inside that handler keeps the handler
    // synchronous and keeps the mark derived from the SESSION'S ticket, which
    // is what the reopen is meant to re-show.
    Promise.all([
      mockDataEngine.list<QTicketRecord>('qtickets'),
      mockDataEngine.list<CustomerRecord>('customers'),
      loadServiceSources(),
    ]).then(([qTickets, customers, sources]) => {
      if (cancelled) return;
      const ticket = qTickets.find((t) => t.qTicketId === assignedQTicketId);
      setActiveQTicket(ticket);
      setTicketFacts(ticket ? factsForKioskNumber(ticket.kioskMobileNumber, customers, sources) : undefined);
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

  // Re-shows the assignment notification for the ticket in hand.
  //
  // The toast is transient and now also clears on any outside click, so the
  // five facts an agent greets a walk-in with could be gone before they have
  // read them. The header shows the ticket id and number but not the customer
  // name, status or purpose, so without this the only way back to them was to
  // open the bell and hunt through history.
  //
  // Rebuilt from current state rather than replaying the original toast: the
  // customer may have been resolved, or cleared, since it was pushed.
  const showTicketDetails = () => {
    if (!activeQTicket) return;
    pushToast(
      ...ticketToast(activeQTicket, activeCustomer?.name ?? null, activeCustomer?.customerId ?? null, kioskMobileNumber, ticketFacts)
    );
  };

  const handleFinish = async () => {
    if (!activeQTicket) return;
    setFinishing(true);
    // handledByUserId/releasedAt are written HERE, not on assignTicket, and
    // never cleared afterward - unlike agentInDxpSessionId, which still
    // nulls on release because it answers a different question ("is this
    // actively held right now"). Without a field that survives release, the
    // Ticket History page would have nothing to filter "my tickets" by -
    // exactly the gap qnomyQueueStore.ts's customersServed comment already
    // named.
    await updateRecord('qtickets', 'qTicketId', activeQTicket.qTicketId, {
      status: 'Completed',
      agentInDxpSessionId: null,
      handledByUserId: staffUserId,
      releasedAt: new Date().toISOString(),
    });
    setFinishing(false);
    setReleasedAs('completed');
    setCompletedQTicket(activeQTicket);
    setActiveQTicket(undefined);
    setAssignedQTicketId(null);
    setKioskMobileNumber(null);
    setAwaitingNext(true);
    // Counted here and not in handleAbandon - see the store's note.
    recordCustomerServed();
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
    // Same attribution as handleFinish, and for the same reason - an
    // abandoned ticket still belongs in the agent's history (it shows as
    // 'Abandoned', not hidden), so it needs the same durable link.
    await updateRecord('qtickets', 'qTicketId', activeQTicket.qTicketId, {
      status: 'Abandoned',
      agentInDxpSessionId: null,
      handledByUserId: staffUserId,
      releasedAt: new Date().toISOString(),
    });
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
    const [qTickets, customers, serviceSources] = await Promise.all([
      mockDataEngine.list<QTicketRecord>('qtickets'),
      mockDataEngine.list<CustomerRecord>('customers'),
      loadServiceSources(),
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
    const facts = factsForKioskNumber(waiting.kioskMobileNumber, customers, serviceSources);

    if (matched) setActiveCustomer(toActiveCustomerSummary(matched));
    else clearActiveCustomer();

    pushToast(...ticketToast(waiting, matched?.name ?? null, matched?.customerId ?? null, waiting.kioskMobileNumber, facts));

    // The ticket NAMES a journey (JOURNEY_LAUNCH_SCREENS) - go straight there,
    // starting from that journey's own first step, rather than opening
    // Customer 360 or the Dashboard and leaving the agent to find it. Per
    // direction (2026-09-27): every call is a fresh start regardless of
    // whether this customer left an earlier journey unfinished - an
    // incomplete order is a DRAFT TASK, resumed only by an agent explicitly
    // choosing to from the dashboard, never something Next Customer walks
    // back into on its own. `startFresh` is the exact mechanism
    // JourneyCard's own product-line launcher uses for the same reason - see
    // GuidedActivationWizard's consumption of it - so a queue-driven start and
    // a manually-clicked one behave identically once they reach the wizard.
    //
    // Matched and unmatched are treated alike here: a walk-in with no
    // Vodafone record wanting a new connection is the ordinary case for this
    // journey, not an exception that should dead-end at the Dashboard.
    const launchPath = launchPathFor(waiting.journeyCode);
    if (launchPath) {
      navigate(launchPath, { state: { startFresh: true } });
      return;
    }

    // No mapped screen for this queue (J020/J030 today - see
    // JOURNEY_LAUNCH_SCREENS' own note on why only J011 has one). Falls back
    // to the pre-existing landing: Customer 360 for a match, so the agent
    // isn't left hunting for the record the queue just resolved; the
    // Dashboard for a walk-in with none, where the retained kiosk number in
    // the header and the quick actions are both in reach.
    if (matched) {
      // NOT gated behind identity verification - BR-01 governs "demographic,
      // contact, address or billing maintenance", and Customer360Layout /
      // ContactSection / AddressSection each already call requireVerification
      // before any such edit. Blocking the mere act of opening the record made
      // calling a customer impossible until you had verified someone you
      // could not yet see.
      //
      // A queue walk-in arrives through the New Connections journey, so that
      // is what the rail should show rather than Customer Search - the agent
      // did not search for this customer, the queue handed them over.
      navigate(`/customer/${matched.customerId}`, { state: { navKey: 'mobile.new-connections' } });
      return;
    }
    // Navigating away matters as much as clearing the store above.
    // Customer360Layout reads the route param, not activeCustomer, so staying
    // put left the PREVIOUS customer's record on screen while the header
    // announced a new one - the agent would be reading Mohammed's file while
    // serving someone else.
    navigate('/');
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
          {/* Before the ticket text, so it reads as "info about this ticket"
              rather than another action alongside Finish and Abandoned. */}
          <Tooltip content="Show ticket details" placement="bottom">
            <button
              type="button"
              onClick={showTicketDetails}
              aria-label={`Show details for ticket ${activeQTicket.qTicketId}`}
              className="shrink-0 text-muted hover:text-fg transition-colors"
            >
              <Icon path={INFO_ICON_PATH} className="w-4.5 h-4.5" />
            </button>
          </Tooltip>
          <Tooltip
            content={
              activeCustomer
                ? `Qnomy queue ticket for ${activeCustomer.name} (read-only)`
                : `Qnomy queue ticket - no customer on file for ${kioskMobileNumber ?? 'this number'}; treat as a new customer`
            }
            placement="bottom"
          >
            <div className="flex flex-col leading-tight">
              {/* The TICKET ONLY, as of 2026-09-25. The queue name was the
                  label ("NEW CONNECTIONS") and the kiosk number trailed the
                  id; both are gone and the label is a fixed "Qnomy #".

                  Neither fact is lost - both are rows in the assignment
                  notification, which the info button immediately to the left
                  reopens on demand. That reopen is what made this safe to
                  trim: the number used to be recoverable ONLY from here,
                  which is why it was pinned in the header in the first
                  place, and it matters most for a walk-in with no record on
                  file. The tooltip still names that case. */}
              <span className="text-[length:var(--fs-caption)] uppercase tracking-wide text-muted">Qnomy #</span>
              <span className="text-fg font-semibold text-[length:var(--fs-body)]">{activeQTicket.qTicketId}</span>
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
            {/* The released ticket's OUTCOME is carried by this chip's own
                colour as of 2026-09-25, replacing the "Completed" /
                "Abandoned" badge that sat beside it.

                The abandoned colour is not optional. The badge existed
                because the two outcomes were otherwise identical, and
                colouring every released ticket green would have reported a
                completed handover for a customer the agent gave up on - the
                exact defect `releasedAs` was added to prevent. Green for
                completed, amber for abandoned, and the tooltip still spells
                out which in words for anyone who cannot use the colour.

                opacity-40 is gone with the badge: it dimmed the chip to mark
                it read-only, which would have left the outcome colour washed
                out and unreadable. Read-only is already conveyed by there
                being no control here and by the tooltip saying so. */}
            <div className="flex flex-col leading-tight">
              <span
                className={`text-[length:var(--fs-caption)] uppercase tracking-wide ${
                  releasedAs === 'abandoned' ? 'text-[var(--warn-text)]' : 'text-success'
                }`}
              >
                Qnomy #
              </span>
              <span
                className={`font-semibold text-[length:var(--fs-body)] ${
                  releasedAs === 'abandoned' ? 'text-[var(--warn-text)]' : 'text-success'
                }`}
              >
                {completedQTicket.qTicketId}
              </span>
            </div>
          </Tooltip>
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
