import { useState } from 'react';
import type { ReactNode } from 'react';

export interface TabItem {
  key: string;
  label: string;
  content: ReactNode;
}

// Backs Customer 360 / Account 360 (Pattern 3) per component-catalogue.md §1.
export function Tabs({ items, defaultKey }: { items: TabItem[]; defaultKey?: string }) {
  const [active, setActive] = useState(defaultKey ?? items[0]?.key);
  const activeItem = items.find((i) => i.key === active);
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
