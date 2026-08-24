import { NavLink } from 'react-router-dom';
import { getAllModules } from '../engines/configEngine';
import { Icon } from '../components/primitives/Icon';
import { VodafoneMark } from '../components/primitives/VodafoneMark';
import { useSidebarStore } from '../stores/sidebarStore';

const DASHBOARD_ICON = 'M4 4h7v7H4z M13 4h7v4h-7z M13 11h7v9h-7z M4 14h7v6H4z';
const PANEL_TOGGLE_ICON = 'M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5z M9 4v16';

// Two-letter monogram shown in place of the full module name when the
// sidebar is collapsed — there's no per-module icon set evidenced anywhere
// in the corpus, so this reuses the same initials-badge pattern already
// established for the profile chip (PersonaSwitcher) rather than inventing
// a new icon per module.
function monogram(moduleName: string): string {
  const tokens = moduleName.split(/[\s/&,]+/).filter(Boolean);
  return tokens.slice(0, 2).map((t) => t[0].toUpperCase()).join('');
}

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
      <div className={`flex items-center px-4 py-4 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        <NavLink to="/" className="flex items-center gap-2 min-w-0">
          <VodafoneMark className="w-7 h-7 shrink-0" />
          {!collapsed && <span className="text-[length:var(--fs-h5)] font-bold text-fg truncate">vodafone</span>}
        </NavLink>
        {!collapsed && (
          <button
            onClick={toggleCollapsed}
            aria-label="Collapse navigation"
            className="text-muted hover:text-fg shrink-0"
          >
            <Icon path={PANEL_TOGGLE_ICON} className="w-4.5 h-4.5" />
          </button>
        )}
      </div>
      {collapsed && (
        <div className="flex justify-center pb-2">
          <button onClick={toggleCollapsed} aria-label="Expand navigation" className="text-muted hover:text-fg">
            <Icon path={PANEL_TOGGLE_ICON} className="w-4.5 h-4.5" />
          </button>
        </div>
      )}
      <ul>
        <li>
          <NavLink
            to="/"
            end
            title={collapsed ? 'Dashboard' : undefined}
            className={({ isActive }) =>
              `flex items-center gap-2 py-2 text-[length:var(--fs-body)] border-l-2 ${collapsed ? 'justify-center px-2' : 'px-4'} ${
                isActive ? 'border-accent bg-surface-warm text-accent font-medium' : 'border-transparent text-fg-2 hover:bg-surface hover:text-fg'
              }`
            }
          >
            <Icon path={DASHBOARD_ICON} className="w-4 h-4 shrink-0" />
            {!collapsed && 'Dashboard'}
          </NavLink>
        </li>
      </ul>
      <div className="mx-4 my-2 border-t border-border-soft" />
      <ul>
        {modules.map((m) => (
          <li key={m.moduleId}>
            <NavLink
              to={`/${m.moduleSlug}`}
              title={collapsed ? m.module : undefined}
              className={({ isActive }) =>
                `flex items-center py-2 text-[length:var(--fs-body)] border-l-2 ${collapsed ? 'justify-center px-2' : 'px-4'} ${
                  isActive ? 'border-accent bg-surface-warm text-accent font-medium' : 'border-transparent text-fg-2 hover:bg-surface hover:text-fg'
                }`
              }
            >
              {collapsed ? (
                <span className="w-7 h-7 rounded-full bg-surface-warm text-accent text-[length:var(--fs-micro)] font-semibold flex items-center justify-center shrink-0">
                  {monogram(m.module)}
                </span>
              ) : (
                <>
                  {m.module}
                  <span className="ml-2 text-[length:var(--fs-caption)] text-muted">{m.screenCount}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
