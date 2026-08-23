import { NavLink } from 'react-router-dom';
import { getAllModules } from '../engines/configEngine';

// Primary navigation = the 16 modules per frontend-architecture.md §9. Always
// lists all 16 (module names are information architecture, not an access grant) —
// RBAC gates screens *within* a module and action buttons, not the module list
// itself, since gating the sidebar by sparse RBAC evidence (145 entries across
// 213 screens) would render it near-empty for most personas. See personaEngine.ts.
export function Sidebar() {
  const modules = getAllModules();
  return (
    <nav className="w-64 shrink-0 border-r border-border-soft bg-bg h-full overflow-y-auto">
      <div className="px-4 py-4">
        <NavLink
          to="/"
          className="block text-[length:var(--fs-h5)] font-medium text-accent mb-4"
        >
          VFQ DXP
        </NavLink>
      </div>
      <ul>
        {modules.map((m) => (
          <li key={m.moduleId}>
            <NavLink
              to={`/${m.moduleSlug}`}
              className={({ isActive }) =>
                `block px-4 py-2 text-[length:var(--fs-body)] border-l-2 ${
                  isActive ? 'border-accent bg-surface-warm text-accent font-medium' : 'border-transparent text-fg-2 hover:bg-surface hover:text-fg'
                }`
              }
            >
              {m.module}
              <span className="ml-2 text-[length:var(--fs-caption)] text-muted">{m.screenCount}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
