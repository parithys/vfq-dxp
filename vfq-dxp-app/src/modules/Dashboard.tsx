import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getPersona, getAllRoutes } from '../engines/configEngine';
import { usePersonaStore } from '../stores/personaStore';
import { useEntityStore } from '../stores/entityStore';
import { useActiveCustomerStore } from '../stores/activeCustomerStore';
import * as mockDataEngine from '../engines/mockDataEngine';
import { Icon } from '../components/primitives/Icon';

const ICONS = {
  ticket: 'M4 9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1.5a1.5 1.5 0 0 0 0 3V15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1.5a1.5 1.5 0 0 0 0-3V9z',
  checkCircle: 'M21 11.5a9 9 0 1 1-5.3-8.2 M21 4.5l-9 9-3-3',
  users: 'M8 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M2.5 20c.6-3.4 3-5.5 5.5-5.5s4.9 2.1 5.5 5.5 M16.5 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M15.5 13.2c2.2.5 3.9 2.3 4.3 4.8',
  simCard: 'M8 3h8l4 4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M9 12h6 M9 16h6',
  refresh: 'M3 12a9 9 0 0 1 15.3-6.4L21 8 M21 3v5h-5 M21 12a9 9 0 0 1-15.3 6.4L3 16 M3 21v-5h5',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.3-4.3',
  openArrow: 'M7 17L17 7 M7 7h10v10',
};

interface Ticket { status: string; }
interface Order { status: string; }
interface SimSwapOrder { status: string; }
interface BulkJob { overallStatus: string; jobType?: string; }
interface CustomerRecord { customerId: string; name: string; segment: string; }

// Agent Workspace redesign: the KPI summary (real entityStore counts) is kept
// unchanged, but the module-launcher grid it used to sit above is gone — the
// whole point of the Customer -> Product -> Action model is that this page
// no longer needs to list implementation modules. What replaces it: a
// direct path into Customer Search, quick actions for the handful of things
// an agent starts without a customer already in mind, and their recently
// viewed customers (from the active-customer bridge's history) so returning
// to someone they just helped is one click, not a re-search.
interface QuickAction {
  label: string;
  screenId?: string;
  path?: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'New Postpaid Connection', screenId: 'SCR-037' },
  { label: 'New Fixed Line', screenId: 'SCR-043' },
  { label: 'Start a Lead', path: '/sales' },
  { label: 'Create Ticket', path: '/support' },
];

export function Dashboard() {
  const navigate = useNavigate();
  const activePersonaId = usePersonaStore((s) => s.activePersonaId);
  const persona = getPersona(activePersonaId);
  const recentCustomerIds = useActiveCustomerStore((s) => s.recentCustomerIds);
  const clearActiveCustomer = useActiveCustomerStore((s) => s.clearActiveCustomer);
  const [recentCustomers, setRecentCustomers] = useState<CustomerRecord[]>([]);

  const loadKind = useEntityStore((s) => s.loadKind);
  const tickets = (useEntityStore((s) => s.records['trouble-tickets']) ?? []) as unknown as Ticket[];
  const orders = (useEntityStore((s) => s.records.orders) ?? []) as unknown as Order[];
  const leads = useEntityStore((s) => s.records.leads) ?? [];
  const simSwaps = (useEntityStore((s) => s.records['sim-swap-orders']) ?? []) as unknown as SimSwapOrder[];
  const customers = useEntityStore((s) => s.records.customers) ?? [];
  const bulkJobs = (useEntityStore((s) => s.records['bulk-activation-orders']) ?? []) as unknown as BulkJob[];
  const loadingMap = useEntityStore((s) => s.loading);
  const anyLoading = ['trouble-tickets', 'orders', 'leads', 'sim-swap-orders', 'customers', 'bulk-activation-orders'].some(
    (k) => loadingMap[k as keyof typeof loadingMap]
  );

  useEffect(() => {
    ['trouble-tickets', 'orders', 'leads', 'sim-swap-orders', 'customers', 'bulk-activation-orders'].forEach((k) =>
      loadKind(k as Parameters<typeof loadKind>[0])
    );
  }, [loadKind]);

  useEffect(() => {
    if (recentCustomerIds.length === 0) {
      setRecentCustomers([]);
      return;
    }
    mockDataEngine.list<CustomerRecord>('customers').then((all) => {
      const byId = new Map(all.map((c) => [c.customerId, c]));
      setRecentCustomers(recentCustomerIds.map((id) => byId.get(id)).filter((c): c is CustomerRecord => Boolean(c)));
    });
  }, [recentCustomerIds]);

  const kpis = [
    {
      icon: ICONS.ticket,
      value: tickets.filter((t) => t.status === 'Open' || t.status === 'Reopened').length,
      label: 'Open tickets',
      sub: 'across all queues',
    },
    {
      icon: ICONS.checkCircle,
      value: orders.filter((o) => o.status === 'Submitted for Approval').length,
      label: 'Orders pending approval',
      sub: 'awaiting a manager',
    },
    {
      icon: ICONS.users,
      value: leads.length,
      label: 'Total leads',
      sub: 'created this session',
    },
    {
      icon: ICONS.simCard,
      value: simSwaps.filter((s) => s.status === 'Submitted for Approval').length,
      label: 'SIM swaps pending',
      sub: 'awaiting approval',
    },
    {
      icon: ICONS.users,
      value: customers.length,
      label: 'Customers on file',
      sub: 'in the mock directory',
    },
    {
      icon: ICONS.refresh,
      value: bulkJobs.filter((j) => j.overallStatus === 'Processed' || j.overallStatus === 'Completed').length,
      label: 'Bulk jobs processed',
      sub: 'incl. Pre-to-Post migrations',
    },
  ];

  const launchQuickAction = (action: QuickAction) => {
    if (action.path) {
      navigate(action.path);
      return;
    }
    const route = action.screenId ? getAllRoutes().find((r) => r.screenId === action.screenId) : undefined;
    if (!route) return;
    clearActiveCustomer();
    navigate(route.path);
  };

  return (
    <div className="p-8">
      <h1 className="text-[length:var(--fs-h3)] font-medium text-fg mb-1">
        Welcome back{persona ? `, ${persona.name.split('(')[0].trim()}` : ''}!
      </h1>
      <p className="text-fg-2 mb-6">Here's what's happening across the platform right now.</p>

      <Link
        to="/customer-search"
        className="flex items-center gap-3 rounded-[var(--radius-pill)] border border-border-soft bg-bg px-5 py-3.5 mb-8 max-w-xl text-muted hover:border-accent hover:text-fg transition-colors"
      >
        <Icon path={ICONS.search} className="w-5 h-5" />
        <span className="text-[length:var(--fs-body)]">Search a customer by mobile, QID, name, or account number…</span>
      </Link>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-[var(--radius-card)] border border-border-soft bg-bg p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <div className="font-medium text-fg text-[length:var(--fs-body)]">{kpi.label}</div>
                <div className="text-muted text-[length:var(--fs-caption)]">{kpi.sub}</div>
              </div>
              <span className="w-9 h-9 rounded-full bg-surface-warm text-accent flex items-center justify-center shrink-0">
                <Icon path={kpi.icon} className="w-4.5 h-4.5" />
              </span>
            </div>
            <div className="text-[length:var(--fs-h3)] font-extrabold text-fg">{anyLoading ? '—' : kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-[length:var(--fs-body-lg)] font-medium text-fg mb-3">Quick actions</h2>
          <div className="flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                onClick={() => launchQuickAction(action)}
                className="rounded-[var(--radius-button)] border border-border px-4 py-2 text-[length:var(--fs-btn-compact)] text-fg hover:bg-surface hover:border-accent transition-colors"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-[length:var(--fs-body-lg)] font-medium text-fg mb-3">Recently viewed customers</h2>
          {recentCustomers.length === 0 && (
            <p className="text-muted text-[length:var(--fs-body)]">Customers you look up will show up here for quick return access.</p>
          )}
          <div className="space-y-2">
            {recentCustomers.map((customer) => (
              <Link
                key={customer.customerId}
                to={`/customer/${customer.customerId}`}
                className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-border-soft bg-bg px-4 py-3 hover:border-accent hover:shadow-raised transition-all"
              >
                <div>
                  <div className="font-medium text-fg text-[length:var(--fs-body)]">{customer.name}</div>
                  <div className="text-fg-2 text-[length:var(--fs-caption)]">{customer.customerId} · {customer.segment}</div>
                </div>
                <Icon path={ICONS.openArrow} className="w-4 h-4 text-muted shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
