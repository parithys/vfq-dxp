import { Badge } from '../primitives/Badge';
import { Icon } from '../primitives/Icon';

const CHECK = 'M20 6L9 17l-5-5';

/**
 * Read-only summary of what an offer already bundles (add-ons and discounts), so the agent can confirm it with the
 * customer. Nothing here is selectable: an offer takes no extras. Renders nothing when the offer bundles nothing.
 */
export function IncludedInOfferCard({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-label="Included in this offer" className="rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg p-4">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-fg font-semibold text-[length:var(--fs-body-lg)]">Included in this offer</h3>
        <Badge variant="success">Read-only</Badge>
      </div>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-2 text-fg text-[length:var(--fs-body)]">
            <Icon path={CHECK} className="w-4 h-4 shrink-0 text-success" />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
