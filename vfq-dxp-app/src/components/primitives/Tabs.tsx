import { useState } from 'react';
import type { ReactNode } from 'react';

export interface TabItem {
  key: string;
  label: string;
  content: ReactNode;
}

// Backs Customer 360 / Account 360 (Pattern 3) per component-catalogue.md §1.
// `orientation` defaults to the original horizontal underline tab-bar (every
// existing consumer keeps that look unchanged) — 'vertical' renders the same
// tokens/states (border-accent/text-accent active, border-transparent/text-fg-2
// idle) as a left-hand nav list instead, for consumers with many tabs where a
// side list reads better than a wide underline bar.
export function Tabs({
  items,
  defaultKey,
  orientation = 'horizontal',
}: {
  items: TabItem[];
  defaultKey?: string;
  orientation?: 'horizontal' | 'vertical';
}) {
  const [active, setActive] = useState(defaultKey ?? items[0]?.key);
  const activeItem = items.find((i) => i.key === active);

  if (orientation === 'vertical') {
    return (
      <div className="flex gap-6 items-start">
        <div className="w-56 shrink-0 rounded-[var(--radius-card)] border border-border-soft bg-bg overflow-hidden">
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
      <div className="flex gap-1 border-b border-border-soft">
        {items.map((item) => (
          <button
            key={item.key}
            onClick={() => setActive(item.key)}
            className={`px-4 py-2 text-[length:var(--fs-body)] border-b-2 -mb-px transition-colors
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
