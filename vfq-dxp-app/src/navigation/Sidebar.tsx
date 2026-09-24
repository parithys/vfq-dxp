import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Icon } from '../components/primitives/Icon';
import { VodafoneMark } from '../components/primitives/VodafoneMark';
import { Tooltip } from '../components/primitives/Tooltip';
import { TooltipGroup } from '../components/primitives/TooltipContext';
import { useSidebarStore } from '../stores/sidebarStore';
import { usePersonaStore } from '../stores/personaStore';
import { resolveNavFor } from '../engines/navigationEngine';
import { NAV_MANIFEST } from './navManifest';
import type { NavKey } from './navManifest';
import { NavFlyout } from './NavFlyout';

/** How long the flyout survives the pointer leaving it. Enough to cross the
 * icon→panel corner on a diagonal without the menu snapping shut; short
 * enough that it doesn't linger over the page after you've moved on. */
const FLYOUT_CLOSE_DELAY = 140;

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
    expandNavGroup,
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

  // Reveal the group that owns the route when you arrive from OUTSIDE the rail
  // — a breadcrumb, a dashboard quick action, a reload on a deep link. Landing
  // on /mobile/sim-device with Mobile shut would hide where you are.
  //
  // Resolved against the STATIC manifest, not the role-filtered `navItems`.
  // navItems comes from resolveNavFor, which returns [] until loadConfig()
  // resolves, so on a cold deep-link load this effect ran once against an
  // empty array, found no owner, and — keyed on pathname, which never changes
  // — never ran again. The group stayed shut on exactly the arrival it exists
  // for. The manifest is a module constant, so it is always populated.
  // Expanding a group the role cannot reach is harmless: its row isn't
  // rendered, so the key is inert.
  //
  // Deliberately an effect keyed on pathname alone, rather than deriving
  // `expanded = isOpen || childActive`. That derivation was the previous
  // behaviour and it made a group impossible to CLOSE while you stood on one
  // of its children: the toggle flipped the stored key and the derivation
  // forced it straight back open. Adding expandedNavKeys to the deps here
  // would reintroduce exactly that — collapse, effect fires, re-opens.
  //
  // expandNavGroup, not toggleNavGroup: an effect must be idempotent. See the
  // store — StrictMode's double invocation made the toggle open the group and
  // then immediately close it.
  useEffect(() => {
    const owner = NAV_MANIFEST.find((i) => i.children?.some((c) => c.to === location.pathname));
    if (owner) expandNavGroup(owner.key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // The mobile drawer ignores the desktop collapse preference (it's always
  // shown fully expanded); only the md:+ in-flow rail respects it.
  const collapsed = mobileOpen ? false : collapsedPref;

  // Which parent's children are floating beside the collapsed rail, and which
  // button they hang off. The anchor element is held in STATE, not a ref, so
  // sliding straight from one parent icon to another re-measures the position
  // instead of leaving the panel pinned beside the first icon.
  const [flyout, setFlyout] = useState<{ key: NavKey; anchor: HTMLElement } | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }, []);

  const openFlyout = useCallback(
    (key: NavKey, anchor: HTMLElement) => {
      cancelClose();
      setFlyout({ key, anchor });
    },
    [cancelClose]
  );

  const closeFlyoutSoon = useCallback(
    (key: NavKey) => {
      cancelClose();
      // Closes only if THIS key is still the open one. Leaving Mobile fires
      // mouseleave after entering Fibre & Home fires mouseenter, so an
      // unconditional close would shut the menu the pointer just arrived at.
      closeTimer.current = setTimeout(
        () => setFlyout((f) => (f?.key === key ? null : f)),
        FLYOUT_CLOSE_DELAY
      );
    },
    [cancelClose]
  );

  const closeFlyout = useCallback(() => {
    cancelClose();
    setFlyout(null);
  }, [cancelClose]);

  // Expanding the rail re-homes the children into the rail itself, and the
  // anchor the panel was measured against moves. Drop it rather than leave a
  // duplicate menu floating over the now-open group.
  useEffect(() => {
    if (!collapsed) closeFlyout();
  }, [collapsed, closeFlyout]);

  useEffect(() => cancelClose, [cancelClose]);

  const flyoutItem = flyout ? navItems.find((i) => i.key === flyout.key) : undefined;

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
            const expanded = expandedNavKeys.includes(item.key);
            // A leaf parent is `end`-matched per the manifest. Parents WITH
            // children no longer link at all, so NavLink's old prefix-matching
            // problem (both /fibre-home and /fibre-home/relocation lighting up
            // as red pills) can't arise.
            const parentEnd = item.end ?? hasChildren;
            const exactlyActive = location.pathname === item.to;
            // A parent with children is a DISCLOSURE, not a destination: one
            // click opens or closes its sub-menu and nothing else. Only a
            // sub-menu item navigates.
            //
            // So it renders as a <button>, not a link. That is the whole fix
            // rather than an `e.preventDefault()` on a NavLink: an <a href>
            // advertises a destination the keyboard, the screen reader and
            // cmd-click all believe, and it is what put `aria-current="page"`
            // and a real `href="/fibre-home"` on a control that must not
            // navigate. A <button aria-expanded> states what it actually does.
            //
            // The whole row stays one hit target — icon, label and chevron
            // alike. The chevron used to be a separate 14px button, which left
            // dead space between it and the label.
            const rowClass = `flex-1 min-w-0 flex items-center gap-2.5 h-11 mx-2 rounded-[var(--radius-sm)] text-[length:var(--fs-body)] ${collapsed ? 'justify-center px-2' : 'px-4'} `;
            const activeClass = 'bg-accent text-accent-on font-medium shadow-[var(--shadow-brand)]';
            // Open group holding the active child: a quiet tint, so the group
            // reads as "you are in here" without competing with the child's
            // own accent marker.
            const inGroupClass = 'bg-white/8 text-white font-medium';
            const idleClass = 'hover:bg-white/10 hover:text-white text-white/70';
            const body = (
              <>
                <Icon path={item.icon} className="w-4.5 h-4.5 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
                {hasChildren && !collapsed && (
                  <Icon
                    path={CHEVRON_DOWN}
                    className={`w-3.5 h-3.5 shrink-0 ml-auto opacity-70 transition-transform ${expanded ? 'rotate-180' : ''}`}
                  />
                )}
              </>
            );
            return (
              <li key={item.key}>
                <div className="flex items-center">
                  {/* A parent's tooltip is suppressed in the collapsed rail:
                      its flyout already names the group in the panel header,
                      and two overlays on one hover is one too many. Leaf icons
                      keep theirs — they have no panel. */}
                  <Tooltip content={item.label} placement="right" disabled={!collapsed || hasChildren}>
                    {hasChildren ? (
                      <button
                        type="button"
                        onMouseEnter={(e) => {
                          if (collapsed) openFlyout(item.key, e.currentTarget);
                        }}
                        onMouseLeave={() => {
                          if (collapsed) closeFlyoutSoon(item.key);
                        }}
                        onClick={() => {
                          // Hover peeks at the children; the click commits to
                          // the expanded rail, where they live permanently. A
                          // pure toggle would be a dead icon in the collapsed
                          // rail — the sub-menu has nowhere in-rail to render.
                          if (collapsed) {
                            closeFlyout();
                            toggleCollapsed();
                            if (!expanded) toggleNavGroup(item.key);
                            return;
                          }
                          toggleNavGroup(item.key);
                        }}
                        aria-expanded={collapsed ? undefined : expanded}
                        // The line root (/mobile) is still a real page, reached
                        // from a child's breadcrumb. Keep marking the row when
                        // you are standing on it so a deep link isn't orphaned
                        // in the rail.
                        className={rowClass + (exactlyActive ? activeClass : childActive ? inGroupClass : idleClass)}
                      >
                        {body}
                      </button>
                    ) : (
                      <NavLink
                        to={item.to}
                        end={parentEnd}
                        className={({ isActive }) => rowClass + (isActive ? activeClass : idleClass)}
                      >
                        {body}
                      </NavLink>
                    )}
                  </Tooltip>
                </div>
                {/* Children are not rendered IN the collapsed rail — 64px of
                    icon has no room for them. They aren't unreachable there:
                    hovering the parent icon floats the same list beside the
                    rail (NavFlyout), and clicking expands the rail to show it
                    inline.
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
    {collapsed && flyout && flyoutItem?.children?.length ? (
      <NavFlyout
        // Remount when the parent changes so the panel re-measures from its
        // own content height rather than animating between two anchors.
        key={flyout.key}
        item={flyoutItem}
        anchor={flyout.anchor}
        currentPath={location.pathname}
        onPointerEnter={cancelClose}
        onPointerLeave={() => closeFlyoutSoon(flyout.key)}
        onDismiss={closeFlyout}
      />
    ) : null}
    </>
  );
}
