import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPersona } from '../engines/configEngine';
import { usePersonaStore } from '../stores/personaStore';
import { useAuthStore } from '../stores/authStore';
import { useActiveCustomerStore } from '../stores/activeCustomerStore';
import { useRegionStore, REGIONS } from '../stores/regionStore';
import { canUseFeature } from '../engines/personaEngine';
import * as mockDataEngine from '../engines/mockDataEngine';
import { SearchField } from '../components/primitives/SearchField';
import { DashboardZone } from './dashboard/DashboardZone';
import { useZoneMetrics } from './dashboard/useZoneMetrics';
import { customerOpsSpec, productWorkSpec } from './dashboard/zoneSpecs';
import { layoutFor, productZoneVariantFor } from './dashboard/dashboardLayout';


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
  const navigate = useNavigate();
  const [customerQuery, setCustomerQuery] = useState('');
  const activePersonaId = usePersonaStore((s) => s.activePersonaId);
  const persona = getPersona(activePersonaId);
  const profileName = useAuthStore((s) => s.profile?.name);
  const recentCustomerIds = useActiveCustomerStore((s) => s.recentCustomerIds);
  const regionId = useRegionStore((s) => s.regionId);
  const [recentCustomers, setRecentCustomers] = useState<CustomerRecord[]>([]);

  // Greeting uses the signed-in person's first name, falling back to the role
  // label when no profile has resolved yet.
  const firstName = profileName?.split(' ')[0] ?? persona?.name ?? 'there';
  // Auto-detected from the signed-in agent's own persona record - see
  // dashboardLayout.ts's header note on why there is no agent-facing override
  // of this any more (Focus, removed 2026-09-27).
  const approach = persona?.approach ?? 'Customer-First';
  const layout = layoutFor(approach, firstName);
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

  // A Hybrid role always has two zones (dashboardLayout.ts no longer offers a
  // way to collapse to one), so this is just "does this approach have one
  // zone or two" now, not a Focus-dependent computation.
  const framing = layout.zones.length > 1 ? 'one-of-two' : 'primary';
  const specFor = (id: string, compact: boolean) =>
    id === 'customer-ops'
      ? customerOpsSpec(m, { compact, framing, regional, regionLabel, recentCustomers })
      : productWorkSpec(m, { variant, compact, framing, regionLabel, regional });

  const twoUp = layout.zones.filter((z) => z.size === 'half').length === 2;

  // Joined rather than concatenated in the markup: the region scoping notice
  // used to be appended to the subtitle with a leading space, which now that
  // most approaches carry no subtitle would have opened the line with one.
  // Both parts are optional, and for most roles neither is present.
  const headerNote = [layout.subtitle, regional ? `Scoped to ${regionLabel}.` : undefined]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="p-8">
      {/* The heading owns the gap to whatever follows when there is no note
          under it, so removing the note does not pull the search bar up
          against the greeting. No Focus control sits beside it any more
          (removed 2026-09-27) - see dashboardLayout.ts's header note - so
          this is just the heading now, not a row splitting space with a
          control that no longer exists. */}
      <h1 className={`text-[length:var(--fs-h3)] font-medium text-fg ${headerNote ? 'mb-1' : 'mb-6'}`}>
        {layout.heading}
      </h1>
      {headerNote && <p className="text-fg-2 mb-6">{headerNote}</p>}

      {/* Customer search is the entry point for customer-centric work, so it
          only leads for roles that hold it. */}
      {canUseFeature(activePersonaId, 'workspace.customer-search') && (
        <SearchField
          aria-label="Search a customer"
          value={customerQuery}
          onChange={(e) => setCustomerQuery(e.target.value)}
          // Clicking (or tabbing into) the box opens Customer Search, which is where the lookup runs.
          onClick={() => navigate('/customer-search', { state: { query: customerQuery.trim() } })}
          onFocus={() => navigate('/customer-search', { state: { query: customerQuery.trim() } })}
          onKeyDown={(e) => {
            // Hands the typed text to Customer Search, which runs it.
            if (e.key === 'Enter') navigate('/customer-search', { state: { query: customerQuery.trim() } });
          }}
          onClear={() => setCustomerQuery('')}
          placeholder="Search a customer by mobile, QID, account number…"
          wrapperClassName="mb-8"
        />
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
    </div>
  );
}
