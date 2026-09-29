import type { ReactNode } from 'react';
import { DataTable } from '../../../components/primitives/DataTable';
import type { Customer360Data } from '../../../engines/customer360Engine';
import type { CustomerService } from '../../../engines/customerServicesEngine';
import { OrdersSection } from './OrdersSection';
import { TicketsSection } from './TicketsSection';
import { AccountHierarchySection } from './AccountHierarchySection';
import { ProductsAssetsSection } from './MiscSections';

export interface AccountInfoContext {
  data: Customer360Data;
  services: CustomerService[];
}

type Resolver = (ctx: AccountInfoContext) => ReactNode | undefined;

// Same fixed session date customer360Engine.ts uses for its own "is this
// bill within the last 12 months" window (SESSION_TODAY) - this app has no
// live clock-driven billing/SLA cycle, so "overdue" is computed against
// that same frozen date rather than the real Date.now().
const SESSION_TODAY = new Date(2026, 8, 14); // 2026-09-14
const CLOSED_TICKET_STATUSES = new Set(['Solved', 'Completed', 'Closed', 'Cancelled']);
const TON_TERMINAL_STATUSES = new Set(['completed']);
const ADJUSTMENT_TERMINAL_STATUSES = new Set(['Approved', 'Rejected', 'Failed']);

function last(n: number, rows: Record<string, unknown>[], dateKey: string) {
  return [...rows].sort((a, b) => String(b[dateKey] ?? '').localeCompare(String(a[dateKey] ?? ''))).slice(0, n);
}

/** customer360-fields.json's Account Information topic, resolved against
 * real Customer 360 data. Keys are the field's exact `details` string from
 * the source JSON. */
export const accountInformationResolvers: Record<string, Resolver> = {
  'AM name': ({ data }) => data.accounts[0]?.accountManagerName,
  'AM mobile': ({ data }) => data.accounts[0]?.accountManagerMobile,
  'AM Email': ({ data }) => data.accounts[0]?.accountManagerEmail,
  // No matching field exists - accounts.json carries a backup-AM NAME
  // (backupAccountManagerName), not an email. Left out of this map
  // entirely so TopicFieldsSection renders the honest "Not available" state.
  'Availability/escalation contact': ({ data }) => data.accounts[0]?.escalationContact,
  'Primary MSISDN': ({ data }) => data.customer.phone,
  Segment: ({ data }) => data.customer.segment,
  'Service Type Number of Connections (Total Per Account + Total Per Plan Type)': ({ services }) => {
    if (services.length === 0) return undefined;
    const byCategory = new Map<string, number>();
    for (const s of services) byCategory.set(s.category, (byCategory.get(s.category) ?? 0) + 1);
    return `${services.length} total - ${Array.from(byCategory.entries()).map(([c, n]) => `${c}: ${n}`).join(', ')}`;
  },
  'Billing Email ID (It should show all the email Ids which are marked for Billing Receipent)': ({ data }) =>
    data.billingProfiles[0]?.billingContactEmail as string | undefined,
  'Current Dunning Stage': ({ data }) => data.billingProfiles[0]?.collectionStage as string | undefined,
  'Overdue TT': ({ data }) => {
    const overdue = data.tickets.filter(
      (t) => !CLOSED_TICKET_STATUSES.has(String(t.status)) && t.slaDueAt && new Date(String(t.slaDueAt)) < SESSION_TODAY
    );
    return overdue.length > 0 ? `${overdue.length} overdue (past SLA)` : '0 overdue';
  },
  'Credit Limit': ({ data }) => {
    const cl = data.creditLimits[0];
    if (!cl) return undefined;
    return `${String(cl.creditLimitQar ?? cl.creditLimitQAR ?? '-')} QAR`;
  },
};

/** Fields whose spec value is itself a list/action surface - rendered
 * full-width via TopicFieldsSection's `richFields`, not squeezed into a
 * flat label/value row. Built per-call (needs live `data`/callbacks), so
 * this is a function rather than a static map like the resolvers above. */
export function accountInformationRichFields({
  data,
  onTicketCreated,
}: {
  data: Customer360Data;
  onTicketCreated: (ticket: Record<string, unknown>) => void;
}): Record<string, ReactNode> {
  const pendingAdjustments = data.adjustments.filter((a) => !ADJUSTMENT_TERMINAL_STATUSES.has(String(a.status)));
  const pendingSimSwaps = data.simSwapOrders.filter((s) => String(s.status).includes('Pending'));
  const pendingTon = data.tonCases.filter((t) => !TON_TERMINAL_STATUSES.has(String(t.status)));

  return {
    'Account Hierarchy': <AccountHierarchySection data={data} />,
    'Contact Hierarchy': (
      <DataTable
        rows={data.contacts}
        rowKey={(r) => String(r.contactRecordId)}
        emptyMessage="No contacts on file for this customer. (No hierarchy relationship data exists in this corpus - contacts are flat records, not a tree.)"
        columns={[
          { key: 'firstName', header: 'First Name' },
          { key: 'lastName', header: 'Last Name' },
          { key: 'idType', header: 'ID Type' },
        ]}
      />
    ),
    'Recent Milestones or Interactions (including all recent purschages add-on, Plan change, activation, change done to MSISDN, account, ticket or activity)':
      (
        <DataTable
          rows={last(5, data.activities, 'transactionDate')}
          rowKey={(r) => String(r.activityNumber)}
          emptyMessage="No activity on file for this customer."
          columns={[
            { key: 'transactionDate', header: 'Date' },
            { key: 'topic', header: 'Topic' },
            { key: 'comments', header: 'Comments' },
          ]}
        />
      ),
    // Full OrdersSection, not a flat table - keeps the existing click-through
    // to order detail rather than demoting it to read-only text.
    'All Orders': <OrdersSection data={data} />,
    'Last 5 Orders': (
      <OrdersSection data={{ ...data, orders: last(5, data.orders, 'orderId') }} />
    ),
    // Full TicketsSection, not a flat table - keeps Create Ticket reachable
    // from the one field the spec actually names it under.
    'All Trouble Tickets': <TicketsSection data={data} onTicketCreated={onTicketCreated} />,
    'All Billing Profiles': (
      <DataTable
        rows={data.billingProfiles}
        rowKey={(r) => String(r.billingProfileId)}
        emptyMessage="No billing profiles on file for this customer."
        columns={[
          { key: 'name', header: 'Profile' },
          { key: 'billingCycle', header: 'Cycle' },
          { key: 'collectionStatus', header: 'Collection Status' },
        ]}
      />
    ),
    'Installed Assets': <ProductsAssetsSection data={data} />,
    'Pending TON requests': (
      <DataTable
        rows={pendingTon}
        rowKey={(r) => String(r.id)}
        emptyMessage="No pending transfer-of-ownership requests for this customer."
        columns={[
          { key: 'id', header: 'TON #' },
          { key: 'type', header: 'Type' },
          { key: 'currentQueue', header: 'Current Queue' },
          { key: 'status', header: 'Status' },
        ]}
      />
    ),
    'Pending Adjustments': (
      <DataTable
        rows={pendingAdjustments}
        rowKey={(r) => String(r.adjustmentId)}
        emptyMessage="No pending adjustments for this customer."
        columns={[
          { key: 'reason', header: 'Reason' },
          { key: 'amount', header: 'Amount' },
          { key: 'status', header: 'Status' },
        ]}
      />
    ),
    'Pending Sim swap': (
      <DataTable
        rows={pendingSimSwaps}
        rowKey={(r) => String(r.simSwapOrderId)}
        emptyMessage="No pending SIM swaps for this customer."
        columns={[
          { key: 'msisdn', header: 'MSISDN' },
          { key: 'simSwapReason', header: 'Reason' },
          { key: 'status', header: 'Status' },
        ]}
      />
    ),
    'Actiivity (last 5)': (
      <DataTable
        rows={last(5, data.activities, 'transactionDate')}
        rowKey={(r) => String(r.activityNumber)}
        emptyMessage="No activity on file for this customer."
        columns={[
          { key: 'transactionDate', header: 'Date' },
          { key: 'topic', header: 'Topic' },
          { key: 'comments', header: 'Comments' },
        ]}
      />
    ),
  };
}
