import { NavLink } from 'react-router-dom';
import { getAllModules } from '../engines/configEngine';
import { Icon } from '../components/primitives/Icon';
import { VodafoneMark } from '../components/primitives/VodafoneMark';
import { Tooltip } from '../components/primitives/Tooltip';
import { TooltipGroup } from '../components/primitives/TooltipContext';
import { useSidebarStore } from '../stores/sidebarStore';

const DASHBOARD_ICON = 'M4 4h7v7H4z M13 4h7v4h-7z M13 11h7v9h-7z M4 14h7v6H4z';
const PANEL_TOGGLE_ICON = 'M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5z M9 4v16';

// Hand-authored per-module icon set — there's no icon set evidenced anywhere
// in the corpus, so these are a reasonable contextual reading of each module
// name (e.g. a funnel for Lead Management, a SIM card for SIM & Number
// Management). Shown at all times (collapsed and expanded), unlike the
// monogram badge this replaces which only appeared collapsed.
const MODULE_ICONS: Record<string, string> = {
  'MOD-lead-management': 'M3 5h18 M6 12h12 M10 19h4',
  'MOD-mobile-postpaid': 'M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M9 8h6 M9 11h6 M9 14h3 M11 18h2',
  'MOD-mobile-prepaid': 'M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M13 7l-4 6h3l-1 5 4-6h-3z',
  'MOD-pre-to-post-migration': 'M17 2l4 4-4 4 M3 6h18 M7 22l-4-4 4-4 M21 18H3',
  'MOD-mnp-fnp-porting': 'M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4 M16 17l5-5-5-5 M21 12H9',
  'MOD-fixed-line-fibre': 'M5 4l3-1 2 5-2 1a11 11 0 0 0 6 6l1-2 5 2-1 3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
  'MOD-fwa-5g-home': 'M4 11l8-7 8 7 M6 10v10h12V10 M9.5 14a3.5 3.5 0 0 1 5 0 M12 17h.01',
  'MOD-enterprise-iot-b2b': 'M4 21V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v16 M12 21V9a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v12 M7 7h2 M7 11h2 M7 15h2 M15 12h2 M15 16h2',
  'MOD-billing-adjustments': 'M6 3h12a1 1 0 0 1 1 1v16l-3-2-3 2-3-2-3 2-3-2V4a1 1 0 0 1 1-1z M9 8h6 M9 12h6 M9 16h3',
  'MOD-order-management': 'M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1z M6 6h12v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z M9 13l2 2 4-4',
  'MOD-identity-customer-management': 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z M8.5 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M6 17c.4-1.8 1.8-3 2.5-3s2.1 1.2 2.5 3 M14 9h5 M14 13h5',
  'MOD-sim-number-management': 'M8 3h6l4 4v13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M9 11h6 M9 14h6 M9 17h3',
  'MOD-trouble-ticketing-complaints': 'M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z M12 9v3 M12 15h.01',
  'MOD-access-roles-approval-governance': 'M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6z M9.5 12l2 2 3-3',
  'MOD-caf-attachments-forms': 'M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8z M14 3v5h5 M9 13h6 M9 16h6',
  'MOD-platform-governance-architecture':
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v3 M12 19v3 M4.2 4.2l2.1 2.1 M17.7 17.7l2.1 2.1 M2 12h3 M19 12h3 M4.2 19.8l2.1-2.1 M17.7 6.3l2.1-2.1',
};

// Primary navigation = Dashboard (the default landing page, not one of the
// evidenced 16 modules) + the 16 modules per frontend-architecture.md §9.
// Always lists all 16 modules (module names are information architecture,
// not an access grant) — RBAC gates screens *within* a module and action
// buttons, not the module list itself, since gating the sidebar by sparse
// RBAC evidence (145 entries across 213 screens) would render it near-empty
// for most personas. See personaEngine.ts.
//
// Collapsible per the provided design: collapsing shrinks the rail to icons/
// monograms only (persisted via sidebarStore) — the nav items, routes, RBAC
// badges, and everything else are unchanged, only their presentation toggles.
export function Sidebar() {
  const modules = getAllModules();
  const { collapsed, toggleCollapsed } = useSidebarStore();

  return (
    <nav
      className={`shrink-0 border-r border-border-soft bg-bg h-full overflow-y-auto transition-[width] duration-150 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {!collapsed && (
        <div className="flex items-center justify-between h-16 px-4 border-b border-border-soft">
          <NavLink to="/" className="flex items-center gap-2 min-w-0">
            <VodafoneMark className="w-7 h-7 shrink-0" />
            <span className="text-[length:var(--fs-h5)] font-bold text-fg truncate">vodafone</span>
          </NavLink>
          <Tooltip content="Collapse navigation" placement="bottom">
            <button
              onClick={toggleCollapsed}
              aria-label="Collapse navigation"
              className="text-muted hover:text-fg shrink-0"
            >
              <Icon path={PANEL_TOGGLE_ICON} className="w-4.5 h-4.5" />
            </button>
          </Tooltip>
        </div>
      )}
      {collapsed && (
        <div className="flex items-center justify-center h-16 border-b border-border-soft">
          <Tooltip content="Expand navigation" placement="right">
            <button onClick={toggleCollapsed} aria-label="Expand navigation" className="text-muted hover:text-fg">
              <Icon path={PANEL_TOGGLE_ICON} className="w-4.5 h-4.5" />
            </button>
          </Tooltip>
        </div>
      )}
      <TooltipGroup>
        <ul className="py-1.5 space-y-0.5">
          <li>
            <Tooltip content="Dashboard" placement="right" disabled={!collapsed}>
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `flex items-center gap-2.5 h-12 text-[length:var(--fs-body)] border-l-2 ${collapsed ? 'justify-center px-2' : 'px-4'} ${
                    isActive ? 'border-accent bg-surface-warm text-accent font-medium' : 'border-transparent text-fg-2 hover:bg-surface hover:text-fg'
                  }`
                }
              >
                <Icon path={DASHBOARD_ICON} className="w-4 h-4 shrink-0" />
                {!collapsed && 'Dashboard'}
              </NavLink>
            </Tooltip>
          </li>
          {modules.map((m) => (
            <li key={m.moduleId}>
              <Tooltip content={m.module} placement="right" disabled={!collapsed}>
                <NavLink
                  to={`/${m.moduleSlug}`}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 h-12 text-[length:var(--fs-body)] border-l-2 ${collapsed ? 'justify-center px-2' : 'px-4'} ${
                      isActive ? 'border-accent bg-surface-warm text-accent font-medium' : 'border-transparent text-fg-2 hover:bg-surface hover:text-fg'
                    }`
                  }
                >
                  <Icon path={MODULE_ICONS[m.moduleId] ?? DASHBOARD_ICON} className="w-4.5 h-4.5 shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="truncate">{m.module}</span>
                      <span className="ml-auto pl-2 shrink-0 text-[length:var(--fs-caption)] text-muted">{m.screenCount}</span>
                    </>
                  )}
                </NavLink>
              </Tooltip>
            </li>
          ))}
        </ul>
      </TooltipGroup>
    </nav>
  );
}
