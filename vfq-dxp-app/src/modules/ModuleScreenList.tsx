import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getAllModules, getAllRoutes } from '../engines/configEngine';
import { MODULE_DESCRIPTIONS } from '../engines/moduleDescriptions';
import { usePersonaStore } from '../stores/personaStore';
import { screensVisibleFor } from '../engines/personaEngine';
import { groupRoutesByFeature } from '../engines/screenGrouping';
import { Badge } from '../components/primitives/Badge';
import { Icon } from '../components/primitives/Icon';
import { getScreenComponent } from './screenRegistry';
import type { Route } from '../types/config';

const ICONS = {
  chevronLeft: 'M15 18l-6-6 6-6',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.3-4.3',
  openArrow: 'M7 17L17 7 M7 7h10v10',
};

type Filter = 'all' | 'built' | 'not-built' | 'not-rbac';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'built', label: 'Built' },
  { key: 'not-built', label: 'Not built' },
  { key: 'not-rbac', label: 'Not RBAC-evidenced' },
];

interface Enriched {
  route: Route;
  permissionLevel: string | null | undefined;
  built: boolean;
}

// Secondary navigation = a module's screens (frontend-architecture.md §9).
// Screen-level RBAC is surfaced as a badge (permission level, or "not
// evidenced") rather than hiding the row outright — see personaEngine.ts's
// design note on why the sidebar/screen list itself isn't RBAC-gated.
//
// Screens are grouped under their sub-module/feature via
// screenGrouping.ts — real evidence (traceability-matrix.md) where it
// exists, a keyword heuristic otherwise (~25% of screens have real
// evidence; see that file's header comment for the coverage caveat and a
// concrete example of evidence overriding the "obvious" grouping). Anything
// neither evidenced nor heuristically matched falls into "Other Screens"
// rather than being silently dropped or force-fit.
export function ModuleScreenList() {
  const { moduleSlug } = useParams();
  const activePersonaId = usePersonaStore((s) => s.activePersonaId);
  const module = getAllModules().find((m) => m.moduleSlug === moduleSlug);
  const routes = getAllRoutes().filter((r) => r.module === module?.module);
  const withAccess = screensVisibleFor(activePersonaId, routes);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  if (!module) {
    return <div className="p-8 text-fg-2">Module not found.</div>;
  }

  const enrichedByScreenId = new Map<string, Enriched>(
    withAccess.map(({ route, permissionLevel }) => [
      route.screenId,
      { route, permissionLevel, built: Boolean(getScreenComponent(route.screenId)) },
    ])
  );

  const catalogued = enrichedByScreenId.size;
  const built = [...enrichedByScreenId.values()].filter((e) => e.built).length;
  const notBuilt = catalogued - built;
  const rbacEvidenced = [...enrichedByScreenId.values()].filter((e) => e.permissionLevel).length;

  const passesFilters = (e: Enriched) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || e.route.screenName.toLowerCase().includes(q) || e.route.screenId.toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (filter === 'built') return e.built;
    if (filter === 'not-built') return !e.built;
    if (filter === 'not-rbac') return !e.permissionLevel;
    return true;
  };

  const { groups, ungrouped } = groupRoutesByFeature(module, routes);
  const visibleCount = [...enrichedByScreenId.values()].filter(passesFilters).length;

  const renderCard = (route: Route) => {
    const e = enrichedByScreenId.get(route.screenId);
    if (!e || !passesFilters(e)) return null;
    return (
      <Link
        key={route.routeId}
        to={route.path}
        className="group rounded-[var(--radius-card)] border border-border-soft bg-bg p-5 hover:shadow-raised hover:border-accent transition-all"
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="font-medium text-fg text-[length:var(--fs-body-lg)]">{route.screenName}</div>
          <Icon path={ICONS.openArrow} className="w-4 h-4 text-muted shrink-0 mt-1 group-hover:text-accent transition-colors" />
        </div>
        <div className="text-accent text-[length:var(--fs-micro)] font-semibold uppercase tracking-wide mb-3">
          {route.screenId} · {route.screenType}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={e.built ? 'success' : 'filled-neutral'}>{e.built ? 'Built' : 'Not built'}</Badge>
          <Badge variant={e.permissionLevel ? 'outlined-red' : 'filled-neutral'}>{e.permissionLevel ?? 'Not RBAC-evidenced'}</Badge>
        </div>
      </Link>
    );
  };

  return (
    <div className="p-8">
      <div className="flex items-start justify-between gap-4 mb-1">
        <h1 className="text-[length:var(--fs-h3)] font-medium text-fg">{module.module}</h1>
        <Link
          to="/"
          className="shrink-0 flex items-center gap-1 rounded-[var(--radius-pill)] border border-border-soft px-3 py-1.5 text-[length:var(--fs-caption)] text-fg-2 hover:bg-surface hover:text-fg"
        >
          <Icon path={ICONS.chevronLeft} className="w-3.5 h-3.5" />
          All modules
        </Link>
      </div>
      <p className="text-fg-2 mb-6">
        {module.screenCount} screens evidenced in this module. {MODULE_DESCRIPTIONS[module.module] ?? ''}
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="rounded-[var(--radius-card)] border border-border-soft bg-bg p-4">
          <div className="text-[length:var(--fs-h4)] font-bold text-accent">{catalogued}</div>
          <div className="text-[length:var(--fs-caption)] text-muted">Catalogued screens</div>
        </div>
        <div className="rounded-[var(--radius-card)] border border-border-soft bg-bg p-4">
          <div className="text-[length:var(--fs-h4)] font-bold text-success">{built}</div>
          <div className="text-[length:var(--fs-caption)] text-muted">Built</div>
        </div>
        <div className="rounded-[var(--radius-card)] border border-border-soft bg-bg p-4">
          <div className="text-[length:var(--fs-h4)] font-bold text-fg-2">{notBuilt}</div>
          <div className="text-[length:var(--fs-caption)] text-muted">Not built</div>
        </div>
        <div className="rounded-[var(--radius-card)] border border-border-soft bg-bg p-4">
          <div className="text-[length:var(--fs-h4)] font-bold text-accent">{rbacEvidenced}</div>
          <div className="text-[length:var(--fs-caption)] text-muted">RBAC-evidenced</div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
            <Icon path={ICONS.search} className="w-4 h-4" />
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search screen ID or name…"
            className="w-full rounded-[var(--radius-pill)] border border-border-soft bg-bg pl-9 pr-3 py-2 text-fg text-[length:var(--fs-body)] placeholder:text-muted focus:outline-none focus-visible:shadow-[var(--focus-ring)]"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-[var(--radius-pill)] border px-3 py-1.5 text-[length:var(--fs-caption)] ${
                filter === f.key ? 'border-accent bg-accent text-accent-on' : 'border-border-soft text-fg-2 hover:bg-surface'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="sm:ml-auto text-[length:var(--fs-caption)] text-muted">{visibleCount} screens</span>
      </div>

      {groups.map(({ subModule, feature, routes: featureRoutes }) => {
        const cards = featureRoutes.map(renderCard).filter(Boolean);
        if (cards.length === 0) return null;
        return (
          <div key={`${subModule}::${feature}`} className="mb-6">
            <h2 className="text-[length:var(--fs-h5)] font-medium text-fg-2 mb-1">{subModule}</h2>
            <p className="mb-3 text-[length:var(--fs-caption)] text-muted">{feature}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{cards}</div>
          </div>
        );
      })}

      {(() => {
        const cards = ungrouped.map(renderCard).filter(Boolean);
        if (cards.length === 0) return null;
        return (
          <div className="mb-6">
            <h2 className="text-[length:var(--fs-h5)] font-medium text-fg-2 mb-1">Other Screens</h2>
            <p className="mb-3 text-[length:var(--fs-caption)] text-muted">
              Not evidenced or heuristically matched to a sub-module/feature above.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{cards}</div>
          </div>
        );
      })()}

      {visibleCount === 0 && <div className="px-4 py-6 text-center text-muted">No screens match this search/filter.</div>}
    </div>
  );
}
