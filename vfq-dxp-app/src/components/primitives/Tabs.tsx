import { useState } from 'react';
import { Icon } from './Icon';
import type { ReactNode } from 'react';

export interface TabItem {
  key: string;
  label: string;
  content: ReactNode;
  /** SVG path for the icon rail (24px grid). Falls back to a list icon. */
  icon?: string;
}

// Backs Customer 360 / Account 360 (Pattern 3) per component-catalogue.md §1.
// `orientation` defaults to the original horizontal underline tab-bar (every
// existing consumer keeps that look unchanged) - 'vertical' renders the same
// tokens/states (border-accent/text-accent active, border-transparent/text-fg-2
// idle) as a left-hand nav list instead, for consumers with many tabs where a
// side list reads better than a wide underline bar.
export function Tabs({
  items,
  defaultKey,
  orientation = 'horizontal',
  rail = false,
  activeKey,
  onChange,
}: {
  items: TabItem[];
  defaultKey?: string;
  orientation?: 'horizontal' | 'vertical';
  /** Vertical only: the numbered step-rail look used by the guided wizards (stacked rows, number badge, warm active row). */
  rail?: boolean;
  /** Controlled active tab - pass alongside onChange when a parent needs to
   * know/drive which tab is active (e.g. to reflect it in a breadcrumb).
   * Omit both for the original self-managed behavior. */
  activeKey?: string;
  onChange?: (key: string) => void;
}) {
  const [uncontrolledActive, setUncontrolledActive] = useState(defaultKey ?? items[0]?.key);
  const active = activeKey ?? uncontrolledActive;
  const setActive = onChange ?? setUncontrolledActive;
  const activeItem = items.find((i) => i.key === active);

  if (orientation === 'vertical' && rail) {
    return (
      <div className="flex flex-col lg:flex-row items-stretch">
        <IconRail items={items} active={active} onSelect={setActive} />
        <div className="@container flex-1 min-w-0 w-full p-8">{activeItem?.content}</div>
      </div>
    );
  }

  if (orientation === 'vertical') {
    return (
      <div className="flex gap-6 items-start">
        <div className="w-56 shrink-0 rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg overflow-hidden">
          {items.map((item) => (
            <button
              key={item.key}
              onClick={() => setActive(item.key)}
              className={`block w-full text-left px-4 py-2.5 text-[length:var(--fs-body)] border-l-2 transition-colors
                ${active === item.key ? 'border-accent text-accent font-medium bg-surface' : 'border-transparent text-fg-2 hover:text-fg hover:bg-surface'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex-1 min-w-0">{activeItem?.content}</div>
      </div>
    );
  }

  return (
    <div>
      {/* Scrolls sideways rather than wrapping when there are more tabs than the width allows. */}
      <div className="flex gap-1 border-b border-border-soft overflow-x-auto">
        {items.map((item) => (
          <button
            key={item.key}
            onClick={() => setActive(item.key)}
            className={`px-4 py-2 text-[length:var(--fs-body)] border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0
              ${active === item.key ? 'border-accent text-accent font-medium' : 'border-transparent text-fg-2 hover:text-fg'}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="pt-4">{activeItem?.content}</div>
    </div>
  );
}

const FALLBACK_ICON = 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01';
const PANEL_ICON = 'M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5z M9 4v16';
const RAIL_KEY = 'vfq-rail-expanded';

/**
 * Vertical icon rail, flush against the left / top / bottom of its area (the page supplies no padding around it).
 * Collapsed (the default) it shows icons only; hovering an item - or focusing it - reveals ITS label over the
 * content without moving anything. The toggle at the top pins the rail open so every label is shown in place;
 * that choice is remembered.
 */
function IconRail({ items, active, onSelect }: { items: TabItem[]; active: string | undefined; onSelect: (key: string) => void }) {
  const [expanded, setExpanded] = useState(() => localStorage.getItem(RAIL_KEY) === '1');
  const toggle = () =>
    setExpanded((v) => {
      localStorage.setItem(RAIL_KEY, v ? '0' : '1');
      return !v;
    });
  const row = 'h-12 flex items-center';
  return (
    <nav
      aria-label="Customer sections"
      className={`shrink-0 self-stretch border-b lg:border-b-0 lg:border-r border-[var(--field-card-border)] bg-bg ${expanded ? 'lg:w-64' : 'lg:w-16'}`}
    >
      <div className="lg:sticky lg:top-0">
        <button
          type="button"
          onClick={toggle}
          aria-label={expanded ? 'Collapse sections' : 'Expand sections'}
          title={expanded ? 'Collapse sections' : 'Expand sections'}
          className={`${row} w-full border-b border-border-soft text-fg-2 hover:bg-surface focus:outline-none focus-visible:shadow-[var(--focus-ring)] ${expanded ? 'justify-end px-5' : 'justify-center'}`}
        >
          <Icon path={PANEL_ICON} className="w-5 h-5" />
        </button>
        <ol className="flex lg:block overflow-x-auto lg:overflow-visible">
          {items.map((item) => {
            const isActive = active === item.key;
            return (
              <li key={item.key} aria-current={isActive ? 'step' : undefined} className="group relative shrink-0">
                <button
                  type="button"
                  onClick={() => onSelect(item.key)}
                  aria-label={item.label}
                  className={`${row} w-12 lg:w-full border-l-2 transition-colors focus:outline-none focus-visible:shadow-[var(--focus-ring)] ${
                    isActive ? 'bg-surface-warm border-l-accent text-accent' : 'border-l-transparent text-fg-2 hover:bg-surface hover:text-fg'
                  } ${expanded ? 'lg:px-5 lg:gap-3' : 'justify-center'}`}
                >
                  <Icon path={item.icon ?? FALLBACK_ICON} className="w-5 h-5 shrink-0" />
                  {expanded && <span className={`hidden lg:inline min-w-0 truncate text-[length:var(--fs-body)] ${isActive ? 'font-semibold text-fg' : 'font-medium text-fg'}`}>{item.label}</span>}
                </button>
                {!expanded && (
                  // Overlay label: absolutely positioned from the item's own left edge, over the page, so the layout
                  // never shifts. Shown on hover or keyboard focus of THIS item only.
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none absolute left-0 top-0 z-30 hidden lg:flex h-12 items-center gap-3 pl-[18px] pr-5 whitespace-nowrap rounded-r-[var(--radius-sm)] border border-l-0 border-[var(--field-card-border)] shadow-raised text-[length:var(--fs-body)] opacity-0 transition-opacity duration-100 group-hover:opacity-100 group-focus-within:opacity-100 ${
                      isActive ? 'bg-surface-warm text-fg font-semibold' : 'bg-bg text-fg font-medium'
                    }`}
                  >
                    <Icon path={item.icon ?? FALLBACK_ICON} className={`w-5 h-5 shrink-0 ${isActive ? 'text-accent' : 'text-fg-2'}`} />
                    {item.label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
