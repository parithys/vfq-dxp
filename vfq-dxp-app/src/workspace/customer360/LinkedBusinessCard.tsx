import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getLinkedBusiness, type LinkedBusinessLookup } from '../../engines/businessAccountEngine';
import { Icon } from '../../components/primitives/Icon';
import { SegmentBadge } from './Business360Page';

const BUILDING = 'M4 21V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v17 M15 9h4a1 1 0 0 1 1 1v11 M3 21h18 M8 7h3 M8 11h3 M8 15h3';

// On an individual's profile: for a reimbursed (B2B2C) line, the business behind the discount (back to Business 360).
// Nothing renders for a customer with no business link or whose line the company pays directly.
export function LinkedBusinessCard({ customerId }: { customerId: string }) {
  const [result, setResult] = useState<{ id: string; lookup: LinkedBusinessLookup } | undefined>();
  useEffect(() => {
    let cancelled = false;
    void getLinkedBusiness(customerId).then((lookup) => !cancelled && setResult({ id: customerId, lookup }));
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  // A result for a previously viewed customer is never shown against this one.
  const lookup = result?.id === customerId ? result.lookup : undefined;
  if (!lookup || lookup.status === 'none') return null;
  if (lookup.status === 'unresolved') {
    return (
      <div className="mt-4">
        <p role="alert" className="rounded-[var(--radius-card)] bg-warn-bg text-[var(--warn-text)] px-4 py-3 text-[length:var(--fs-body)]">
          This customer is linked to business account {lookup.parentBusinessId}, which could not be found. Check the link before relying on the customer's segment or billing.
        </p>
      </div>
    );
  }
  const { business, segment } = lookup;
  // A company-paid line is the company's, not the employee's: the link does not appear on their profile.
  if (segment === 'EBU') return null;
  return (
    <section aria-label="Linked business" className="mt-4 rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Icon path={BUILDING} className="w-5 h-5 text-accent shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-fg-2 text-[length:var(--fs-caption)]">Linked business</p>
          <Link to={`/customer/${business.enterpriseAccountId}`} className="text-link underline font-semibold text-[length:var(--fs-body)]">
            {business.name} · {business.enterpriseAccountId}
          </Link>
        </div>
        <SegmentBadge segment={segment} />
      </div>
      <p className="text-fg-2 text-[length:var(--fs-caption)] mt-2">
        This line is reimbursed by the company (B2B2C). The discount comes from {business.name}'s B2B2C agreement; billing and ownership stay with this customer, and the bill is sent to them.
      </p>
    </section>
  );
}
