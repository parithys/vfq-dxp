import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllModules, getAllRoutes } from '../engines/configEngine';
import * as mockDataEngine from '../engines/mockDataEngine';
import { Icon } from '../components/primitives/Icon';

const SEARCH_ICON = 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.3-4.3';
const CLEAR_ICON = 'M6 6l12 12 M18 6L6 18';

interface RecordResult {
  key: string;
  kind: string;
  label: string;
  sub: string;
  path: string;
}

interface LeadRecord { leadId: string; serviceNeeded: string; status: string }
interface TicketRecord { ticketId: string; category: string; status: string }
interface OrderRecord { orderId: string; orderType: string; status: string }
interface SimSwapRecord { simSwapOrderId: string; msisdn: string; status: string }

// Topbar-wide global search — replaces the static "N evidenced RBAC entries"
// label with a real search across modules, screens/pages, and a handful of
// evidenced entity kinds that have a real, registered detail screen to land
// on (leads, tickets, orders, SIM swap orders). Customers were deliberately
// left out: no customer-profile screen is registered anywhere in this build
// (SCR-021/SCR-095 exist in routes.json but neither has a component), so
// including them would produce dead-end results — the same "no fabricated
// destinations" discipline applied throughout this app.
export function GlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [recordResults, setRecordResults] = useState<RecordResult[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const modules = getAllModules();
  const routes = getAllRoutes();
  const q = query.trim().toLowerCase();

  const moduleMatches = useMemo(() => {
    if (!q) return [];
    return modules.filter((m) => m.module.toLowerCase().includes(q)).slice(0, 5);
  }, [q, modules]);

  const screenMatches = useMemo(() => {
    if (!q) return [];
    return routes.filter((r) => r.screenName.toLowerCase().includes(q) || r.screenId.toLowerCase().includes(q)).slice(0, 6);
  }, [q, routes]);

  useEffect(() => {
    if (!q) {
      setRecordResults([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const [leads, tickets, orders, simSwaps] = await Promise.all([
        mockDataEngine.list<LeadRecord>('leads'),
        mockDataEngine.list<TicketRecord>('trouble-tickets'),
        mockDataEngine.list<OrderRecord>('orders'),
        mockDataEngine.list<SimSwapRecord>('sim-swap-orders'),
      ]);
      if (cancelled) return;

      const results: RecordResult[] = [];
      leads
        .filter((l) => l.leadId.toLowerCase().includes(q) || l.serviceNeeded.toLowerCase().includes(q))
        .slice(0, 3)
        .forEach((l) =>
          results.push({
            key: `lead-${l.leadId}`,
            kind: 'Lead',
            label: l.leadId,
            sub: `${l.serviceNeeded} · ${l.status}`,
            path: `/lead-management/lead-details-view?id=${l.leadId}`,
          })
        );
      tickets
        .filter((t) => t.ticketId.toLowerCase().includes(q) || t.category.toLowerCase().includes(q))
        .slice(0, 3)
        .forEach((t) =>
          results.push({
            key: `ticket-${t.ticketId}`,
            kind: 'Ticket',
            label: t.ticketId,
            sub: `${t.category} · ${t.status}`,
            path: `/trouble-ticketing-complaints/ticket-detail-screen-public-notes-bell-icon-notifications?id=${t.ticketId}`,
          })
        );
      orders
        .filter((o) => o.orderId.toLowerCase().includes(q) || o.orderType.toLowerCase().includes(q))
        .slice(0, 3)
        .forEach((o) =>
          results.push({
            key: `order-${o.orderId}`,
            kind: 'Order',
            label: o.orderId,
            sub: `${o.orderType} · ${o.status}`,
            path: `/order-management/order-approval-detail-attachments-order-details-activities-a?id=${o.orderId}`,
          })
        );
      simSwaps
        .filter((s) => s.simSwapOrderId.toLowerCase().includes(q) || s.msisdn.toLowerCase().includes(q))
        .slice(0, 3)
        .forEach((s) =>
          results.push({
            key: `simswap-${s.simSwapOrderId}`,
            kind: 'SIM Swap',
            label: s.simSwapOrderId,
            sub: `${s.msisdn} · ${s.status}`,
            path: `/sim-number-management/sim-swap-queue-order-tasks-tab?id=${s.simSwapOrderId}`,
          })
        );
      setRecordResults(results);
    })();
    return () => {
      cancelled = true;
    };
  }, [q]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const hasResults = moduleMatches.length > 0 || screenMatches.length > 0 || recordResults.length > 0;

  const go = (path: string) => {
    navigate(path);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-md min-w-0">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
        <Icon path={SEARCH_ICON} className="w-4 h-4" />
      </span>
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false);
            inputRef.current?.blur();
          }
        }}
        placeholder="Search modules, screens, leads, orders, tickets…"
        aria-label="Global search"
        className={`w-full rounded-[var(--field-radius)] border bg-bg pl-9 pr-9 py-2 text-fg text-[length:var(--fs-body)] placeholder:text-muted focus:outline-none focus-visible:border-[var(--field-focus-border)] focus-visible:shadow-[var(--field-focus-ring)] ${query ? 'border-[var(--field-border-filled)]' : 'border-[var(--field-border)]'}`}
      />
      {query && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setQuery('');
            setOpen(false);
            inputRef.current?.focus();
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg"
        >
          <Icon path={CLEAR_ICON} className="w-4 h-4" />
        </button>
      )}
      {open && q && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-96 overflow-y-auto rounded-[var(--radius-card)] border border-border-soft bg-bg shadow-raised">
          {!hasResults && <p className="px-4 py-6 text-center text-muted text-[length:var(--fs-body)]">No matches for &ldquo;{query}&rdquo;.</p>}

          {moduleMatches.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1 text-[length:var(--fs-caption-upper)] uppercase tracking-wide text-muted">Modules</p>
              {moduleMatches.map((m) => (
                <button
                  key={m.moduleId}
                  onClick={() => go(`/${m.moduleSlug}`)}
                  className="w-full flex items-center justify-between gap-2 px-4 py-2 text-left hover:bg-surface"
                >
                  <span className="text-fg truncate">{m.module}</span>
                  <span className="text-muted text-[length:var(--fs-caption)] shrink-0">{m.screenCount} screens</span>
                </button>
              ))}
            </div>
          )}

          {screenMatches.length > 0 && (
            <div className="border-t border-border-soft">
              <p className="px-4 pt-3 pb-1 text-[length:var(--fs-caption-upper)] uppercase tracking-wide text-muted">Screens</p>
              {screenMatches.map((r) => (
                <button
                  key={r.routeId}
                  onClick={() => go(r.path)}
                  className="w-full flex items-center justify-between gap-2 px-4 py-2 text-left hover:bg-surface"
                >
                  <span className="text-fg truncate">{r.screenName}</span>
                  <span className="text-muted text-[length:var(--fs-caption)] shrink-0">{r.screenId}</span>
                </button>
              ))}
            </div>
          )}

          {recordResults.length > 0 && (
            <div className="border-t border-border-soft">
              <p className="px-4 pt-3 pb-1 text-[length:var(--fs-caption-upper)] uppercase tracking-wide text-muted">Records</p>
              {recordResults.map((r) => (
                <button
                  key={r.key}
                  onClick={() => go(r.path)}
                  className="w-full flex items-center justify-between gap-2 px-4 py-2 text-left hover:bg-surface"
                >
                  <span className="text-fg truncate">
                    {r.label} <span className="text-muted text-[length:var(--fs-caption)]">· {r.kind}</span>
                  </span>
                  <span className="text-muted text-[length:var(--fs-caption)] shrink-0">{r.sub}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
