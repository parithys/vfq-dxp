import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAllModules, getPersona } from '../engines/configEngine';
import { MODULE_DESCRIPTIONS } from '../engines/moduleDescriptions';
import { usePersonaStore } from '../stores/personaStore';
import { useEntityStore } from '../stores/entityStore';
import { Icon } from '../components/primitives/Icon';

const ICONS = {
  ticket: 'M4 9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1.5a1.5 1.5 0 0 0 0 3V15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1.5a1.5 1.5 0 0 0 0-3V9z',
  checkCircle: 'M21 11.5a9 9 0 1 1-5.3-8.2 M21 4.5l-9 9-3-3',
  users: 'M8 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M2.5 20c.6-3.4 3-5.5 5.5-5.5s4.9 2.1 5.5 5.5 M16.5 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M15.5 13.2c2.2.5 3.9 2.3 4.3 4.8',
  simCard: 'M8 3h8l4 4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M9 12h6 M9 16h6',
  refresh: 'M3 12a9 9 0 0 1 15.3-6.4L21 8 M21 3v5h-5 M21 12a9 9 0 0 1-15.3 6.4L3 16 M3 21v-5h5',
  contacts: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.3-4.3',
  openArrow: 'M7 17L17 7 M7 7h10v10',
};

interface Ticket { status: string; }
interface Order { status: string; }
interface SimSwapOrder { status: string; }
interface BulkJob { overallStatus: string; jobType?: string; }

// New landing page — not evidenced in the source corpus (no SCR- id). Folds in
// Pattern 15 (App/Module Launcher Home Screen, Tile Grid — evidenced across
// SCR-040/053/056/077/107/119/168/176/187 per reusable-patterns.md), formerly
// its own Home.tsx, as the module-launcher section below a KPI summary. The
// KPI cards pull real counts from entityStore rather than static demo
// numbers, mirroring the login page's "Operational overview" preview but
// with live in-app data since this screen is reached only post-authentication.
export function Dashboard() {
  const activePersonaId = usePersonaStore((s) => s.activePersonaId);
  const persona = getPersona(activePersonaId);
  const modules = getAllModules();
  const totalScreens = modules.reduce((sum, m) => sum + m.screenCount, 0);
  const [query, setQuery] = useState('');
  const filteredModules = modules.filter((m) => m.module.toLowerCase().includes(query.toLowerCase()));

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
      icon: ICONS.contacts,
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

  return (
    <div className="p-8">
      <h1 className="text-[length:var(--fs-h3)] font-medium text-fg mb-1">
        Welcome back{persona ? `, ${persona.name.split('(')[0].trim()}` : ''}!
      </h1>
      <p className="text-fg-2 mb-8">Here's what's happening across the platform right now.</p>

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

      <p className="text-fg-2 mb-4">
        Choose a module to get started · {modules.length} modules · {totalScreens} screens catalogued
      </p>

      <div className="relative max-w-md mb-6">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
          <Icon path={ICONS.search} className="w-4 h-4" />
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search modules…"
          className="w-full rounded-[var(--radius-pill)] border border-border-soft bg-bg pl-9 pr-3 py-2 text-fg text-[length:var(--fs-body)] placeholder:text-muted focus:outline-none focus-visible:shadow-[var(--focus-ring)]"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredModules.map((m) => (
          <Link
            key={m.moduleId}
            to={`/${m.moduleSlug}`}
            className="group rounded-[var(--radius-card)] border border-border-soft bg-bg p-5 hover:shadow-raised hover:border-accent transition-all"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="font-medium text-fg text-[length:var(--fs-body-lg)]">{m.module}</div>
              <Icon path={ICONS.openArrow} className="w-4 h-4 text-muted shrink-0 mt-1 group-hover:text-accent transition-colors" />
            </div>
            <div className="text-accent text-[length:var(--fs-micro)] font-semibold uppercase tracking-wide mb-2">
              {m.screenCount} screens
            </div>
            <p className="text-fg-2 text-[length:var(--fs-caption)]">{MODULE_DESCRIPTIONS[m.module] ?? ''}</p>
          </Link>
        ))}
        {filteredModules.length === 0 && <p className="text-muted col-span-full">No modules match “{query}”.</p>}
      </div>
    </div>
  );
}
