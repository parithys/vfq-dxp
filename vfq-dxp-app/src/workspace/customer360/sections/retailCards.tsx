import { useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from '../../../components/primitives/Icon';

/** Card and row primitives shared by the Retail Sales Agent's Customer 360 tabs. */
export function Card({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg p-4 min-w-0">
      <h3 className="flex items-center gap-3 text-fg font-semibold text-[length:var(--fs-body-lg)] pb-3 mb-1 border-b border-border-soft">
        <Icon path={icon} className="w-5 h-5 shrink-0" />
        {title}
      </h3>
      {children}
    </section>
  );
}

/** A label / value row; a row whose value is absent is not rendered. */
export function Row({ label, value, end = false }: { label: string; value: ReactNode | undefined; end?: boolean }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="grid grid-cols-2 gap-4 py-2 border-b border-border-soft last:border-0 text-[length:var(--fs-body)]">
      <dt className="text-fg-2">{label}</dt>
      <dd className={`text-fg font-medium min-w-0 break-words ${end ? 'text-right' : ''}`}>{value}</dd>
    </div>
  );
}

/** A "View" link that opens its detail under the card's rows. */
export function ViewToggle({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="grid grid-cols-2 gap-4 py-2 border-b border-border-soft last:border-0 text-[length:var(--fs-body)]">
        <dt className="text-fg-2">{label}</dt>
        <dd>
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="text-accent font-semibold hover:underline">
            {open ? 'Hide' : 'View'}
          </button>
        </dd>
      </div>
      {open && <div className="py-3">{children}</div>}
    </>
  );
}
