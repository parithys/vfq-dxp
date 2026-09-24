import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getPersona } from '../engines/configEngine';
import { usePersonaStore } from '../stores/personaStore';
import { useAuthStore } from '../stores/authStore';
import { useActiveCustomerStore } from '../stores/activeCustomerStore';
import { useRegionStore, REGIONS } from '../stores/regionStore';
import { canUseFeature } from '../engines/personaEngine';
import * as mockDataEngine from '../engines/mockDataEngine';
import { Icon } from '../components/primitives/Icon';
import { DashboardZone } from './dashboard/DashboardZone';
import { FocusControl } from './dashboard/FocusControl';
import { useZoneMetrics } from './dashboard/useZoneMetrics';
import { customerOpsSpec, productWorkSpec } from './dashboard/zoneSpecs';
import { focusFromParam, layoutFor, productZoneVariantFor } from './dashboard/dashboardLayout';

const SEARCH_ICON = 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.3-4.3';

interface CustomerRecord {
  customerId: string;
  name: string;
  segment: string;
}

// ONE dashboard route for all 26 roles. Approach chooses which zone(s) render
// and in what order (dashboardLayout); the zones themselves are data
// (zoneSpecs) rendered by one component (DashboardZone).
//
// The whole point is that this is not four dashboards. A Hybrid role's Focus
// control re-orders and re-sizes the same two zones - it does not navigate, and
// because useZoneMetrics loads every kind on mount it cannot refetch either.
export function Dashboard() {
  const [params, setParams] = useSearchParams();
  const activePersonaId = usePersonaStore((s) => s.activePersonaId);
  const persona = getPersona(activePersonaId);
  const profileName = useAuthStore((s) => s.profile?.name);
  const recentCustomerIds = useActiveCustomerStore((s) => s.recentCustomerIds);
  const regionId = useRegionStore((s) => s.regionId);
  const [recentCustomers, setRecentCustomers] = useState<CustomerRecord[]>([]);



  // Greeting uses the signed-in person's first name, falling back to the role
  // label when no profile has resolved yet.
  const firstName = profileName?.split(' ')[0] ?? persona?.name ?? 'there';
  const approach = persona?.approach ?? 'Customer-First';
  const focus = focusFromParam(params.get('focus'));
  const layout = layoutFor(approach, focus, firstName);
  const variant = productZoneVariantFor(persona);
  const regionLabel = REGIONS.find((r) => r.id === regionId)?.label ?? 'Vodafone Qatar';
  // Only an oversight role is scoped to a region; everyone else sees the
  // national rollup and the real directory count.
  const regional = persona?.capabilities.includes('agent-oversight') ?? false;
  const m = useZoneMetrics(regional ? regionId : 'NATIONAL');

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

  const setFocus = (next: string) => {
    const p = new URLSearchParams(params);
    p.set('focus', next);
    setParams(p, { replace: true });
  };

  // A Hybrid role always has two zones, so its zones keep their two-zone
  // framing regardless of which one Focus has enlarged.
  const framing = layout.zones.length > 1 ? 'one-of-two' : 'primary';
  const specFor = (id: string, compact: boolean) =>
    id === 'customer-ops'
      ? customerOpsSpec(m, { compact, framing, regional, regionLabel, recentCustomers })
      : productWorkSpec(m, { variant, compact, framing, regionLabel, regional });

  const twoUp = layout.zones.filter((z) => z.size === 'half').length === 2;

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-1">
        <h1 className="text-[length:var(--fs-h3)] font-medium text-fg">{layout.heading}</h1>
        {layout.showFocusControl && <FocusControl focus={focus} onChange={setFocus} />}
      </div>
      <p className="text-fg-2 mb-6">
        {layout.subtitle}
        {regional && ` Scoped to ${regionLabel}.`}
      </p>

      {/* Customer search is the entry point for customer-centric work, so it
          only leads for roles that hold it. */}
      {canUseFeature(activePersonaId, 'workspace.customer-search') && (
        <Link
          to="/customer-search"
          className="flex items-center gap-3 rounded-[var(--radius-pill)] border border-border-soft bg-bg px-5 py-3.5 mb-8 max-w-xl text-muted hover:border-accent hover:text-fg transition-colors"
        >
          <Icon path={SEARCH_ICON} className="w-5 h-5" />
          <span className="text-[length:var(--fs-body)]">Search a customer by mobile, QID, name, or account number…</span>
        </Link>
      )}

      <div className={twoUp ? 'grid grid-cols-1 xl:grid-cols-2 gap-8' : 'space-y-8'}>
        {layout.zones.map((zone) => (
          <DashboardZone
            key={zone.id}
            spec={specFor(zone.id, zone.size === 'half')}
            size={zone.size}
            readOnly={layout.readOnly}
            loading={m.loading}
            errors={m.errors}
          />
        ))}
      </div>

      {layout.showFocusControl && (
        <p className="mt-8 rounded-[var(--radius-card)] border border-border-soft bg-surface px-4 py-3 text-fg-2 text-[length:var(--fs-caption)]">
          This is the same dashboard route rendered for one role. Switching Focus re-orders and re-sizes the same two
          zones - it doesn't navigate to a different screen or reload different data.
        </p>
      )}
    </div>
  );
}
