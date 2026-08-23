import { useParams, Link } from 'react-router-dom';
import { getAllModules, getAllRoutes } from '../engines/configEngine';
import { usePersonaStore } from '../stores/personaStore';
import { screensVisibleFor } from '../engines/personaEngine';
import { Badge } from '../components/primitives/Badge';
import { getScreenComponent } from './screenRegistry';

// Secondary navigation = a module's screens (frontend-architecture.md §9).
// Screen-level RBAC is surfaced as a badge (permission level, or "not
// evidenced") rather than hiding the row outright — see personaEngine.ts's
// design note on why the sidebar/screen list itself isn't RBAC-gated.
export function ModuleScreenList() {
  const { moduleSlug } = useParams();
  const activePersonaId = usePersonaStore((s) => s.activePersonaId);
  const module = getAllModules().find((m) => m.moduleSlug === moduleSlug);
  const routes = getAllRoutes().filter((r) => r.module === module?.module);
  const withAccess = screensVisibleFor(activePersonaId, routes);

  if (!module) {
    return <div className="p-8 text-fg-2">Module not found.</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-[length:var(--fs-h3)] font-medium text-fg mb-1">{module.module}</h1>
      <p className="text-fg-2 mb-6">{module.screenCount} screens evidenced in this module.</p>

      {module.subModules.map((sub) => (
        <div key={sub.subModule} className="mb-6">
          <h2 className="text-[length:var(--fs-h5)] font-medium text-fg-2 mb-2">{sub.subModule}</h2>
          {sub.features.map((f) => (
            <div key={f.feature} className="mb-2 text-[length:var(--fs-caption)] text-muted">
              {f.feature}
            </div>
          ))}
        </div>
      ))}

      <div className="rounded-[var(--radius-card)] border border-border-soft divide-y divide-border-soft">
        {withAccess.map(({ route, permissionLevel }) => {
          const built = Boolean(getScreenComponent(route.screenId));
          return (
            <Link
              key={route.routeId}
              to={route.path}
              className="flex items-center justify-between px-4 py-3 hover:bg-surface"
            >
              <div>
                <div className="text-fg">{route.screenName}</div>
                <div className="text-[length:var(--fs-caption)] text-muted">
                  {route.screenId} · {route.screenType}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {built && <Badge variant="success">Built</Badge>}
                <Badge variant={permissionLevel ? 'outlined-red' : 'filled-neutral'}>
                  {permissionLevel ?? 'Not RBAC-evidenced'}
                </Badge>
              </div>
            </Link>
          );
        })}
        {withAccess.length === 0 && <div className="px-4 py-6 text-center text-muted">No screens in this module.</div>}
      </div>
    </div>
  );
}
