import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink } from 'react-router-dom';
import { Icon } from '../components/primitives/Icon';
import type { NavItem } from './navManifest';

/** Distance between the rail's right edge and the panel. It is padding on the
 * wrapper rather than an offset on the panel, so the pointer crosses no dead
 * gap on its way from the icon into the menu — the single most common way a
 * flyout like this "flickers shut while I was reaching for it". */
const BRIDGE = 8;
const VIEWPORT_MARGIN = 8;
/** The panel's own top padding + header height (measured: 8 + 28), so the
 * FIRST CHILD ROW lines up with the icon that opened it rather than the
 * panel's top edge sitting level with it. */
const HEADER_LIFT = 36;

interface NavFlyoutProps {
  item: NavItem;
  /** The collapsed rail button this menu belongs to. Measured, not styled. */
  anchor: HTMLElement;
  currentPath: string;
  /** Pointer entered the panel — cancel any pending close. */
  onPointerEnter: () => void;
  /** Pointer left the panel — start the close delay. */
  onPointerLeave: () => void;
  /** Escape, or a child was chosen. */
  onDismiss: () => void;
}

// Collapsed-rail sub-menu: hovering a parent icon floats its children to the
// right of the rail, titled with the parent's label.
//
// It exists because collapsing the rail to icons leaves a parent with nowhere
// to put its children — before this, the only way to reach Mobile › SIM &
// Device from the icon rail was to expand the whole rail first. The panel is
// the collapsed counterpart of the in-rail disclosure list, not a second
// navigation model: same manifest, same children, same order.
//
// Portal-rendered to document.body for the same reason Tooltip is: the rail is
// `overflow-y-auto`, so an in-tree panel would be clipped at the rail's 64px
// width and would also add horizontal scroll to the rail itself.
//
// Pointer-only, deliberately. Portaled content keeps its DOM tab order (end of
// body), not its React-tree order, so a keyboard user tabbing off the parent
// button would land on the next rail icon, not in here — revealing menu items
// that focus can't reach. Keyboard and screen-reader users get the parent
// button's click behaviour instead (expand the rail, open the group inline),
// which is fully traversable. Nothing here is reachable only by hover.
export function NavFlyout({
  item,
  anchor,
  currentPath,
  onPointerEnter,
  onPointerLeave,
  onDismiss,
}: NavFlyoutProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; bridge: number } | null>(null);

  // useLayoutEffect, not useEffect: this measures the panel and then moves it.
  // In an effect that runs after paint, the panel would be visible for one
  // frame at its unmeasured position and visibly jump.
  useLayoutEffect(() => {
    const place = () => {
      const a = anchor.getBoundingClientRect();
      const panel = panelRef.current;
      const h = panel?.offsetHeight ?? 0;
      const w = panel?.offsetWidth ?? 0;
      const top = Math.min(
        Math.max(a.top - HEADER_LIFT, VIEWPORT_MARGIN),
        Math.max(window.innerHeight - h - VIEWPORT_MARGIN, VIEWPORT_MARGIN)
      );
      // Gap measured from the RAIL's edge, not the button's. The button is
      // inset (`mx-2`), so anchoring to it put the panel flush against the
      // rail with no visible separation. The wrapper still starts at the
      // button's edge and absorbs the difference as padding, which is what
      // keeps the pointer path unbroken.
      const rail = anchor.closest('nav')?.getBoundingClientRect();
      const bridge = Math.max((rail?.right ?? a.right) - a.right, 0) + BRIDGE;
      // No flip to the left side: the rail is pinned to the viewport's left
      // edge, so "right" can only overflow on a viewport narrower than the
      // panel, where the flyout doesn't render at all (the rail is a drawer
      // below md:). Clamping is enough.
      const left = Math.min(a.right, Math.max(window.innerWidth - w - bridge - VIEWPORT_MARGIN, 0));
      setPos({ top, left, bridge });
    };
    place();
    // The rail scrolls independently of the page, so a scroll anywhere can
    // move the anchor out from under the panel. Capture phase catches both.
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [anchor]);

  useLayoutEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onDismiss]);

  return createPortal(
    <div
      className="fixed z-50"
      style={{
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        paddingLeft: pos?.bridge ?? BRIDGE,
        // Measured on the first commit at (0,0); hidden until placed so it is
        // never seen in the corner. `visibility`, not conditional rendering —
        // the panel has to be in the DOM to have a height to measure.
        visibility: pos ? 'visible' : 'hidden',
      }}
      onMouseEnter={onPointerEnter}
      onMouseLeave={onPointerLeave}
    >
      <div
        ref={panelRef}
        role="group"
        aria-label={item.label}
        className="min-w-52 py-2 rounded-[var(--radius-card)] border border-[var(--nav-border)] bg-[var(--nav-bg)] shadow-[var(--elev-raised)]"
      >
        {/* The parent's label as a quiet heading — the icon that opened this
            carries no visible text, so without it the panel is a list of
            categories with no statement of what they are categories OF
            ("Support" appears under both product lines). It also replaces the
            row's hover tooltip, which the Sidebar suppresses for these rows so
            the two don't stack up on each other. */}
        <p className="px-3 pb-1.5 text-[length:var(--fs-caption)] text-[var(--nav-section)]">{item.label}</p>
        <ul>
          {item.children!.map((child) => (
            <li key={child.key}>
              <NavLink
                to={child.to}
                onClick={onDismiss}
                className={`flex items-center gap-2.5 h-9 px-3 text-[length:var(--fs-body)] ${
                  currentPath === child.to
                    ? 'bg-[var(--nav-active-bg)] text-[var(--nav-active-fg)] font-medium'
                    : 'text-[var(--nav-fg-muted)] hover:bg-[var(--nav-hover-bg)] hover:text-[var(--nav-fg)]'
                }`}
              >
                <Icon path={child.icon} className="w-4 h-4 shrink-0" />
                <span className="truncate">{child.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body
  );
}
