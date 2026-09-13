import { Link, useLocation } from 'react-router-dom';
import { getAllModules, getAllRoutes } from '../engines/configEngine';

// Derived automatically from the route's module -> screen path, not hand-authored
// per screen, per frontend-architecture.md §9.
export function Breadcrumbs() {
  const location = useLocation();
  const [, moduleSlug, screenSlug] = location.pathname.split('/');
  if (!moduleSlug) return null;

  const module = getAllModules().find((m) => m.moduleSlug === moduleSlug);
  const route = screenSlug ? getAllRoutes().find((r) => r.path === location.pathname) : undefined;

  return (
    <div className="flex items-center gap-2 px-6 py-3 text-[length:var(--fs-caption)] text-muted border-b border-border-soft bg-bg">
      <Link to="/" className="text-fg">
        Dashboard
      </Link>
      {module && (
        <>
          <span>/</span>
          <Link to={`/${module.moduleSlug}`} className="hover:text-fg">
            {module.module}
          </Link>
        </>
      )}
      {route && (
        <>
          <span>/</span>
          <span className="text-fg">{route.screenName}</span>
        </>
      )}
    </div>
  );
}
