import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getAllModules, getAllRoutes } from '../engines/configEngine';
import { useActiveCustomerStore } from '../stores/activeCustomerStore';
import { Icon } from '../components/primitives/Icon';
import { NAV_MANIFEST, navItemByPath } from './navManifest';

const CHEVRON_RIGHT = 'M9 18l6-6-6-6';
const ARROW_LEFT = 'M19 12H5 M12 19l-7-7 7-7';

function Crumb() {
  return <Icon path={CHEVRON_RIGHT} className="w-3 h-3 text-muted shrink-0" />;
}

// Derived automatically from the route's module -> screen path, not hand-authored
// per screen, per frontend-architecture.md §9.
export function Breadcrumbs() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeCustomerName = useActiveCustomerStore((s) => s.customer?.name);
  const [, moduleSlug, screenSlug] = location.pathname.split('/');
  if (!moduleSlug) return null;

  const module = getAllModules().find((m) => m.moduleSlug === moduleSlug);
  const route = screenSlug ? getAllRoutes().find((r) => r.path === location.pathname) : undefined;
  // Customer 360 has no legacy module/screenName entry (it's part of the
  // newer primary workspace shell, built after routes.json's module catalogue),
  // so it needs its own crumb rather than falling through to a bare "Dashboard".
  const isCustomer360 = moduleSlug === 'customer' && Boolean(screenSlug);
  // Nav manifest destinations (/products, /products/mobile, /customers,
  // /operations, /leads) are likewise not module slugs, so without this they
  // rendered a bare "Dashboard" crumb. Mirrors the isCustomer360 branch.
  const navItem = navItemByPath(location.pathname);
  const navParent = navItem
    ? NAV_MANIFEST.find((i) => i.children?.some((c) => c.key === navItem.key))
    : undefined;

  return (
    <div className="flex items-center gap-1.5 px-6 py-2.5 text-[length:var(--fs-caption)] text-muted border-b border-border-soft bg-bg">
      {/* Single global back affordance — this bar is the one persistent
       * element mounted above every routed page (App.tsx), so placing it
       * here guarantees it's always in the same spot, rather than the
       * scattered/inconsistent per-page "Go Back" buttons some screens
       * already have buried in their own action rows. Never rendered on the
       * Dashboard itself (component returns null there — see above), which
       * doubles as "nowhere sensible to go back to" for this button too.
       * Styled as a bordered pill in the same caption size/muted tone as the
       * crumb trail beside it, rather than a bare icon circle, so it reads as
       * part of the same navigation component instead of a separate control. */}
      <button
        type="button"
        onClick={() => navigate(-1)}
        aria-label="Go back"
        className="flex items-center gap-1 -ml-1 pl-2 pr-2.5 py-1 rounded-[var(--radius-pill)] border border-border-soft text-muted hover:border-border hover:text-fg transition-colors shrink-0"
      >
        <Icon path={ARROW_LEFT} className="w-3.5 h-3.5" />
        Back
      </button>
      <Link to="/" className="ml-1 text-muted hover:text-fg transition-colors">
        Dashboard
      </Link>
      {navItem && (
        <>
          {navParent && (
            <>
              <Crumb />
              <Link to={navParent.to} className="text-muted hover:text-fg transition-colors">
                {navParent.label}
              </Link>
            </>
          )}
          <Crumb />
          <span className="text-fg font-medium">{navItem.label}</span>
        </>
      )}
      {module && !isCustomer360 && !navItem && (
        <>
          <Crumb />
          <Link to={`/${module.moduleSlug}`} className="text-muted hover:text-fg transition-colors">
            {module.module}
          </Link>
        </>
      )}
      {route && (
        <>
          <Crumb />
          <span className="text-fg font-medium">{route.screenName}</span>
        </>
      )}
      {isCustomer360 && (
        <>
          <Crumb />
          <Link to="/customer-search" className="text-muted hover:text-fg transition-colors">
            Customers
          </Link>
          <Crumb />
          <span className="text-fg font-medium">{activeCustomerName ?? 'Customer 360'}</span>
        </>
      )}
    </div>
  );
}
