import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Icon } from '../components/primitives/Icon';
import { VodafoneMark } from '../components/primitives/VodafoneMark';
import { Tooltip } from '../components/primitives/Tooltip';
import { TooltipGroup } from '../components/primitives/TooltipContext';
import { useSidebarStore } from '../stores/sidebarStore';
import { usePersonaStore } from '../stores/personaStore';
import { resolveNavFor } from '../engines/navigationEngine';

const PANEL_TOGGLE_ICON = 'M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5z M9 4v16';
// Points down when collapsed, rotated 180deg to point up when expanded —
// matching the reference disclosure pattern.
const CHEVRON_DOWN = 'M6 9l6 6 6-6';

// The rail is now driven by navManifest.ts, filtered and reordered per role by
// its approach (navigationEngine.resolveNavFor) — the same closed manifest for
// everyone, so a role never sees an item that doesn't belong to its IA.
//
// This replaced a hardcoded six-item array plus a comment asserting the rail
// "can never grow past six". See navManifest.ts for why that cap moved to nine
// (a Hybrid role legitimately spans both halves of the platform) and how the
// load-bearing half of the rule — the manifest being a closed set — is now
// enforced in code rather than by comment.
//
// Items applicable to the role but not yet implemented are styled EXACTLY like
// the rest — no dimming, no disabled state, no special tooltip. They are real
// destinations that navigate and render a Planned page explaining what is
// coming; the page is where that belongs. Dimming them in the rail made a
// planned area read as broken or forbidden rather than forthcoming, and split
// the rail into two visual tiers for a distinction the user does not need while
// navigating.
//
// `implemented` on the manifest is therefore declarative only — it records
// which destinations are placeholder-backed (and pairs with the `planned` copy
// that WorkspaceNotYetBuilt renders). It drives no styling here.

// Collapsible per the provided design: collapsing shrinks the rail to icons
// only (persisted via sidebarStore).
//
// Below `md:`, the sidebar instead renders as an off-canvas drawer (see
// `mobileOpen` in sidebarStore) that's always shown expanded — the desktop
// `collapsed` icon-rail preference only applies to the persistent md:+ rail.
export function Sidebar() {
  const {
    collapsed: collapsedPref,
    toggleCollapsed,
    mobileOpen,
    closeMobile,
    expandedNavKeys,
    toggleNavGroup,
  } = useSidebarStore();
  const activePersonaId = usePersonaStore((s) => s.activePersonaId);
  const location = useLocation();
  const navItems = resolveNavFor(activePersonaId);

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
          {navItems.map((item) => {
            const hasChildren = Boolean(item.children?.length);
            const childActive = item.children?.some((c) => location.pathname === c.to) ?? false;
            const expanded = expandedNavKeys.includes(item.key) || childActive;
            // A parent with children is `end`-matched so it stops claiming the
            // active state once you are inside one of its children. Without
            // this, NavLink's prefix matching lit up BOTH /fibre-home and
            // /fibre-home/relocation — two red pills, and no way to tell which
            // level you were actually on.
            const parentEnd = item.end ?? hasChildren;
            const exactlyActive = location.pathname === item.to;
            // The WHOLE row is one target — label, icon and chevron alike.
            // Previously the chevron was its own <button> and the label was a
            // bare link, so clicking "Mobile" navigated but left the group
            // shut: the only way to reveal the categories was to hit a 14px
            // arrow. Now one click both navigates to the line root and opens
            // the group, and clicking the row again once you are already there
            // collapses it. That keeps a collapse affordance without splitting
            // the row into two hit areas (which also let you click *between*
            // them and get nothing).
            const onParentClick = () => {
              if (!hasChildren) return;
              const isOpen = expandedNavKeys.includes(item.key);
              if (exactlyActive && isOpen) toggleNavGroup(item.key);
              else if (!isOpen) toggleNavGroup(item.key);
            };
            return (
              <li key={item.key}>
                <div className="flex items-center">
                  <Tooltip content={item.label} placement="right" disabled={!collapsed}>
                    <NavLink
                      to={item.to}
                      end={parentEnd}
                      onClick={onParentClick}
                      aria-expanded={hasChildren && !collapsed ? expanded : undefined}
                      className={({ isActive }) =>
                        `flex-1 min-w-0 flex items-center gap-2.5 h-11 mx-2 rounded-[var(--radius-sm)] text-[length:var(--fs-body)] ${collapsed ? 'justify-center px-2' : 'px-4'} ${
                          isActive
                            ? 'bg-accent text-accent-on font-medium shadow-[var(--shadow-brand)]'
                            : expanded && childActive
                              // Open group containing the active child: a quiet
                              // tint, so the group reads as "you are in here"
                              // without competing with the child's own marker.
                              ? 'bg-white/8 text-white font-medium'
                              : 'hover:bg-white/10 hover:text-white text-white/70'
                        }`
                      }
                    >
                      <Icon path={item.icon} className="w-4.5 h-4.5 shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                      {hasChildren && !collapsed && (
                        <Icon
                          path={CHEVRON_DOWN}
                          className={`w-3.5 h-3.5 shrink-0 ml-auto opacity-70 transition-transform ${expanded ? 'rotate-180' : ''}`}
                        />
                      )}
                    </NavLink>
                  </Tooltip>
                </div>
                {/* Children are hidden when collapsed — the icon rail has no
                    room for them, and the parent link still navigates.
                    A single vertical connector line runs behind the group and
                    the active child draws an accent segment over it, instead of
                    each child being its own filled pill: with a pill, a
                    selected child looked identical in weight to a selected
                    top-level item, so the hierarchy was invisible.
                    The label stays white rather than accent-coloured — accent
                    red on the charcoal rail is too low-contrast to read, so the
                    bar carries the accent and the text carries the weight. */}
                {hasChildren && expanded && !collapsed && (
                  <ul className="mt-0.5 ml-[26px] border-l border-white/15">
                    {item.children!.map((child) => (
                      <li key={child.key}>
                        <NavLink
                          to={child.to}
                          className={({ isActive }) =>
                            `flex items-center gap-2.5 h-9 -ml-px pl-4 pr-3 border-l-2 text-[length:var(--fs-caption)] ${
                              isActive
                                ? 'border-accent text-white font-medium'
                                : 'border-transparent text-white/60 hover:text-white hover:border-white/30'
                            }`
                          }
                        >
                          <Icon path={child.icon} className="w-4 h-4 shrink-0" />
                          <span className="truncate">{child.label}</span>
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </TooltipGroup>
    </nav>
    </>
  );
}
