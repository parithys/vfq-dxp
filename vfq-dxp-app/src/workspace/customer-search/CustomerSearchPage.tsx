import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchCustomers, toActiveCustomerSummary, type CustomerSearchResult } from '../../engines/customer360Engine';
import { useActiveCustomerStore } from '../../stores/activeCustomerStore';
import { Badge } from '../../components/primitives/Badge';
import { Icon } from '../../components/primitives/Icon';

const SEARCH_ICON = 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.3-4.3';
const CLEAR_ICON = 'M18 6L6 18 M6 6l12 12';

const MATCH_LABEL: Record<string, string> = {
  mobile: 'Mobile',
  qid: 'QID',
  customerNumber: 'Customer #',
  accountNumber: 'Account #',
  name: 'Name',
  email: 'Email',
  serviceId: 'Service ID',
};

// The new primary entry point (replaces browsing a module to find a
// customer-adjacent screen): one box, instant results, matched-field badges
// so an agent can see *why* a result surfaced. Debounced rather than
// submit-on-Enter since the requirement is an "instant lookup" experience.
export function CustomerSearchPage() {
  const navigate = useNavigate();
  const setActiveCustomer = useActiveCustomerStore((s) => s.setActiveCustomer);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CustomerSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const handle = setTimeout(async () => {
      const matches = await searchCustomers(query);
      setResults(matches);
      setSearching(false);
    }, 220);
    return () => clearTimeout(handle);
  }, [query]);

  // Product decision (2026-09-15, overrides the BRSD's own CUS-001-CAM-04-A/
  // BR-01 framing, which reads as gating Customer 360 *entry* itself): a
  // plain lookup is read-only and shouldn't require an ID scan up front.
  // BR-01 verification still gates every actual mutation - Customer360Layout
  // (Edit profile), ContactSection, AddressSection, and BillingAccountPage
  // each carry their own independent useVerificationGate() at the point an
  // agent tries to change something, so this file no longer needs to gate
  // navigation at all.
  const openCustomer = (result: CustomerSearchResult) => {
    setActiveCustomer(toActiveCustomerSummary(result.customer));
    // Origin recorded so the rail keeps Customer Search lit on the record
    // screen, which has no nav destination of its own.
    navigate(`/customer/${result.customer.customerId}`, { state: { navKey: 'customer-search' } });
  };

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-[length:var(--fs-h3)] font-medium text-fg mb-1">Customer Search</h1>
      <p className="text-fg-2 mb-6">Look up a customer by mobile number, QID, customer number, account number, name, email, or service ID.</p>

      <div className="relative mb-2">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
          <Icon path={SEARCH_ICON} className="w-4.5 h-4.5" />
        </span>
        <input
          autoFocus
          aria-label="Customer search query"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. 28512345678, +97455512001, CUST-1003, fatima.alkuwari@example.qa…"
          className={`w-full rounded-[var(--field-radius)] border bg-bg pl-10 pr-10 py-3 text-fg text-[length:var(--fs-body-lg)] placeholder:text-muted focus:outline-none focus-visible:border-[var(--field-focus-border)] focus-visible:shadow-[var(--field-focus-ring)] ${query ? 'border-[var(--field-border-filled)]' : 'border-[var(--field-border)]'}`}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg"
          >
            <Icon path={CLEAR_ICON} className="w-4 h-4" />
          </button>
        )}
      </div>

      {!query.trim() && (
        <p className="text-muted text-[length:var(--fs-caption)] mt-3">Start typing - results appear instantly as you type.</p>
      )}

      {query.trim() && (
        <div className="mt-4 space-y-2">
          {searching && <p className="text-muted text-[length:var(--fs-body)]">Searching…</p>}
          {!searching && results.length === 0 && (
            <div className="rounded-[var(--radius-card)] border border-border-soft bg-bg p-6 text-center">
              <p className="text-fg font-medium mb-1">Customer Data Not Found</p>
              <p className="text-fg-2 text-[length:var(--fs-caption)]">No customer record matches “{query}”. Check the ID/number, or try searching by name or email instead.</p>
            </div>
          )}
          {!searching &&
            results.map(({ customer, matchedOn }) => (
              <button
                key={customer.customerId}
                onClick={() => openCustomer({ customer, matchedOn })}
                className="w-full text-left rounded-[var(--radius-card)] border border-border-soft bg-bg p-4 hover:shadow-raised hover:border-accent transition-all flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-fg text-[length:var(--fs-body-lg)] truncate">{customer.name}</span>
                    {customer.blacklisted && <Badge variant="danger">Blacklisted</Badge>}
                  </div>
                  <div className="text-fg-2 text-[length:var(--fs-caption)]">
                    {customer.customerId} · {customer.idType} {customer.qid} · {customer.segment}
                    {customer.phone ? ` · ${customer.phone}` : ''}
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {matchedOn.map((field) => (
                    <Badge key={field} variant="outlined-red">
                      {MATCH_LABEL[field] ?? field}
                    </Badge>
                  ))}
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
