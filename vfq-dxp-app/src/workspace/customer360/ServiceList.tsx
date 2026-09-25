import { useEffect, useRef } from 'react';
import { Badge } from '../../components/primitives/Badge';
import type { CustomerService } from '../../engines/customerServicesEngine';

interface ServiceListProps {
  services: CustomerService[];
  /** The service a deep link asked for, highlighted and scrolled to. */
  selectedRef?: string;
  emptyMessage: string;
}

// The customer's actual services for one tab, above that tab's action groups.
//
// These tabs were action CATALOGUES only: Mobile said "1 active postpaid line
// on file" without saying which line, and Fibre & Home listed no services at
// all. So a link that opened a tab had nothing to land on, and an agent had no
// way to see what the customer actually holds.
//
// The selected row is marked with the same --field-card-selected treatment the
// choice cards use, so "this is the one you clicked" reads the same way here
// as it does in the wizards.
export function ServiceList({ services, selectedRef, emptyMessage }: ServiceListProps) {
  const selectedEl = useRef<HTMLLIElement>(null);

  // A deep-linked service can be below the fold on a long tab. Scrolled only
  // when one is actually selected, and only on mount/change - never on every
  // render, which would fight the agent's own scrolling.
  useEffect(() => {
    if (!selectedRef || !selectedEl.current) return;
    selectedEl.current.scrollIntoView({ block: 'nearest' });
  }, [selectedRef]);

  if (services.length === 0) {
    return <p className="text-fg-2 text-[length:var(--fs-body)] mb-4">{emptyMessage}</p>;
  }

  return (
    <ul className="mb-6 space-y-2">
      {services.map((service) => {
        const selected = service.ref === selectedRef;
        return (
          <li
            key={service.ref}
            ref={selected ? selectedEl : undefined}
            aria-current={selected ? 'true' : undefined}
            className={`flex items-center justify-between gap-3 rounded-[var(--radius-card)] border p-3 ${
              selected
                ? 'border-[var(--field-card-selected)] bg-[var(--field-card-selected-bg)]'
                : 'border-border-soft bg-bg'
            }`}
          >
            <span className="min-w-0">
              <span className="block text-fg text-[length:var(--fs-body)] font-semibold truncate">{service.label}</span>
              <span className="block text-muted text-[length:var(--fs-caption)] truncate">{service.identifier}</span>
            </span>
            <span className="flex items-center gap-2 shrink-0">
              {/* Source statuses are not one vocabulary - 'Active' from
                  installed assets, 'active subscription' / 'Try & Buy trial' /
                  'Home Move / TON' from GigaHome - so the raw value is shown
                  rather than normalised into a status that was never recorded.
                  Only a literal 'Active' gets the success variant. */}
              {service.status && (
                <Badge variant={service.status === 'Active' ? 'success' : 'filled-neutral'}>{service.status}</Badge>
              )}
              {selected && <Badge variant="outlined-red">Selected</Badge>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
