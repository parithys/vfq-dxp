import { useState } from 'react';
import type { ReactNode } from 'react';

export interface TabItem {
  key: string;
  label: string;
  content: ReactNode;
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
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <ol className="w-full lg:w-72 shrink-0 self-start lg:sticky lg:top-8 lg:max-h-[calc(100vh-8rem)] overflow-y-auto rounded-[var(--radius-card)] border border-[var(--field-card-border)] divide-y divide-border-soft bg-bg">
          {items.map((item, i) => {
            const isActive = active === item.key;
            return (
              <li key={item.key} aria-current={isActive ? 'step' : undefined}>
                <button
                  type="button"
                  onClick={() => setActive(item.key)}
                  className={`w-full flex items-center gap-3 px-4 py-4 border-l-2 text-left transition-colors focus:outline-none focus-visible:shadow-[var(--focus-ring)] ${
                    isActive ? 'bg-surface-warm border-l-accent' : 'border-l-transparent hover:bg-surface'
                  }`}
                >
                  <span
                    className={`flex items-center justify-center w-7 h-7 rounded-[var(--radius-circle)] text-[length:var(--fs-caption)] font-medium shrink-0 ${
                      isActive ? 'bg-accent text-accent-on' : 'bg-light-neutral text-muted'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className={`min-w-0 text-fg ${isActive ? 'font-semibold' : 'font-medium'}`}>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <div className="@container flex-1 min-w-0 w-full">{activeItem?.content}</div>
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
