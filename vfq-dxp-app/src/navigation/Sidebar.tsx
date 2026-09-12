import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Icon } from '../components/primitives/Icon';
import { VodafoneMark } from '../components/primitives/VodafoneMark';
import { Tooltip } from '../components/primitives/Tooltip';
import { TooltipGroup } from '../components/primitives/TooltipContext';
import { useSidebarStore } from '../stores/sidebarStore';

const DASHBOARD_ICON = 'M4 4h7v7H4z M13 4h7v4h-7z M13 11h7v9h-7z M4 14h7v6H4z';
const PANEL_TOGGLE_ICON = 'M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5z M9 4v16';

// Customer -> Product -> Action redesign (reference/.knowledge has no
// evidenced IA for this — supplied directly by the user): the sidebar no
// longer lists implementation modules. It lists the six primary workspaces
// that can never grow past six, however many journeys/screens are added
// behind them — new journeys become actions inside Customer 360's product
// tabs, not new sidebar entries. The 16 legacy module routes still exist
// (see router.tsx) for direct-link/QA access; they're just not linked here.
const PRIMARY_NAV = [
  { to: '/', label: 'Dashboard', end: true, icon: DASHBOARD_ICON },
  {
    to: '/customer-search',
    label: 'Customer Search',
    icon: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.3-4.3',
  },
  {
    to: '/sales',
    label: 'Sales',
    icon: 'M4 16l6-6 4 4 6-8 M14 6h6v6',
  },
  {
    to: '/support',
    label: 'Support',
    icon: 'M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z M12 9v3 M12 15h.01',
  },
  {
    to: '/orders',
    label: 'Orders',
    icon: 'M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1z M6 6h12v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z M9 13l2 2 4-4',
  },
  {
    to: '/administration',
    label: 'Administration',
    icon: 'M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6z M9.5 12l2 2 3-3',
  },
] as const;

// Collapsible per the provided design: collapsing shrinks the rail to icons
// only (persisted via sidebarStore).
//
// Below `md:`, the sidebar instead renders as an off-canvas drawer (see
// `mobileOpen` in sidebarStore) that's always shown expanded — the desktop
// `collapsed` icon-rail preference only applies to the persistent md:+ rail.
export function Sidebar() {
  const { collapsed: collapsedPref, toggleCollapsed, mobileOpen, closeMobile } = useSidebarStore();
  const location = useLocation();

  // Below `md:`, the sidebar is an off-canvas drawer — close it automatically
  // whenever the route changes so it doesn't stay open over the new screen.
  useEffect(() => {
    closeMobile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // The mobile drawer ignores the desktop collapse preference (it's always
  // shown fully expanded); only the md:+ in-flow rail respects it.
  const collapsed = mobileOpen ? false : collapsedPref;

  return (
    <>
      {/* Mobile-only backdrop: sits below the drawer, above the page content,
          and is only present in the DOM/visible when the drawer is open. */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}
      <nav
        className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-200 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } md:static md:inset-auto md:z-auto md:translate-x-0 md:transition-[width] md:duration-150 shrink-0 border-r border-white/10 bg-[var(--charcoal-panel)] h-full overflow-y-auto ${
          collapsed ? 'md:w-16' : 'md:w-64'
        }`}
      >
      {/* Mobile drawer always renders the expanded header/nav regardless of
          the desktop `collapsed` preference — collapsing to icon-only only
          makes sense for the persistent in-flow rail at md:+. */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-white/10 md:hidden">
        <NavLink to="/" className="flex items-center gap-2 min-w-0">
          <VodafoneMark className="w-7 h-7 shrink-0" />
          <span className="text-[length:var(--fs-h5)] font-bold text-white truncate">vodafone</span>
        </NavLink>
        <button
          onClick={closeMobile}
          aria-label="Close navigation"
          className="text-white/60 hover:text-white shrink-0"
        >
          <Icon path={PANEL_TOGGLE_ICON} className="w-4.5 h-4.5" />
        </button>
      </div>
      {!collapsed && (
        <div className="hidden md:flex items-center justify-between h-16 px-4 border-b border-white/10">
          <NavLink to="/" className="flex items-center gap-2 min-w-0">
            <VodafoneMark className="w-7 h-7 shrink-0" />
            <span className="text-[length:var(--fs-h5)] font-bold text-white truncate">vodafone</span>
          </NavLink>
          <Tooltip content="Collapse navigation" placement="bottom">
            <button
              onClick={toggleCollapsed}
              aria-label="Collapse navigation"
              className="text-white/60 hover:text-white shrink-0"
            >
              <Icon path={PANEL_TOGGLE_ICON} className="w-4.5 h-4.5" />
            </button>
          </Tooltip>
        </div>
      )}
      {collapsed && (
        <div className="hidden md:flex items-center justify-center h-16 border-b border-white/10">
          <Tooltip content="Expand navigation" placement="right">
            <button onClick={toggleCollapsed} aria-label="Expand navigation" className="text-white/60 hover:text-white">
              <Icon path={PANEL_TOGGLE_ICON} className="w-4.5 h-4.5" />
            </button>
          </Tooltip>
        </div>
      )}
      <TooltipGroup>
        <ul className="py-1.5 space-y-0.5">
          {PRIMARY_NAV.map((item) => (
            <li key={item.to}>
              <Tooltip content={item.label} placement="right" disabled={!collapsed}>
                <NavLink
                  to={item.to}
                  end={'end' in item ? item.end : false}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 h-11 mx-2 rounded-[var(--radius-sm)] text-[length:var(--fs-body)] ${collapsed ? 'justify-center px-2' : 'px-4'} ${
                      isActive ? 'bg-accent text-accent-on font-medium shadow-[var(--shadow-brand)]' : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`
                  }
                >
                  <Icon path={item.icon} className="w-4.5 h-4.5 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              </Tooltip>
            </li>
          ))}
        </ul>
      </TooltipGroup>
    </nav>
    </>
  );
}
