import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { searchCustomers, toActiveCustomerSummary, type CustomerSearchResult } from '../../engines/customer360Engine';
import { useCustomerContext } from '../../stores/customerContextStore';
import { Badge } from '../../components/primitives/Badge';
import { SearchField } from '../../components/primitives/SearchField';
import { Button } from '../../components/primitives/Button';
import { Icon } from '../../components/primitives/Icon';
import { PageHeader } from '../../components/patterns/PageHeader';


const MATCH_LABEL: Record<string, string> = {
  mobile: 'Mobile',
  qid: 'QID',
  customerNumber: 'Customer #',
  accountNumber: 'Account #',
  name: 'Name',
  email: 'Email',
  serviceId: 'Service ID',
  idDocument: 'ID number',
};

// The new primary entry point (replaces browsing a module to find a
// customer-adjacent screen): one box, matched-field badges so an agent can
// see *why* a result surfaced. 2026-10-01: searches on Enter, and only once
// at least MIN_QUERY_LENGTH characters have been typed - it used to search
// as you typed (debounced), which fired on one- and two-character fragments.
const MIN_QUERY_LENGTH = 3;

/**
 * Marks the part of `text` that the agent typed, so the reason a result matched
 * is visible. A name is matched word by word (the search itself requires every
 * typed word to appear in the name, in any order); identifiers are matched as
 * the whole typed string, which is how the search matches them.
 */
function Highlight({ text, query, words }: { text: string | undefined; query: string; words?: boolean }) {
  const value = text ?? '';
  const needles = (words ? query.trim().split(/\s+/) : [query.trim()]).filter(Boolean);
  if (!value || needles.length === 0) return <>{value}</>;
  const pattern = new RegExp(`(${needles.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return (
    <>
      {value.split(pattern).map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded-sm bg-[var(--highlight-bg)] text-inherit px-0.5 -mx-0.5">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

export function CustomerSearchPage() {
  const navigate = useNavigate();
  const setActiveCustomer = useCustomerContext((s) => s.setActiveCustomer);
  // The Dashboard search hands its text over here, so it opens already searched.
  const locationState = useLocation().state as { query?: string; newTicket?: boolean } | null;
  const handedOver = locationState?.query ?? '';
  // Arrived from a "New Ticket" button: the customer opened next starts on the "How can we help today?" search.
  const newTicket = Boolean(locationState?.newTicket);
  const [query, setQuery] = useState(handedOver);
  // The query the results on screen belong to - set only by pressing Enter.
  const [submitted, setSubmitted] = useState(handedOver.length >= MIN_QUERY_LENGTH ? handedOver : '');
  const [results, setResults] = useState<CustomerSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const trimmed = query.trim();
  const canSearch = trimmed.length >= MIN_QUERY_LENGTH;
  // Results are stale the moment the text no longer matches what was searched.
  const showingResults = submitted !== '' && trimmed === submitted;

  const runSearch = () => {
    // Nothing runs for empty / too-short text, or while a search is already in flight (repeat clicks and
    // Enter presses are ignored until it finishes).
    if (!canSearch || searching) return;
    setSubmitted(trimmed);
  };

  useEffect(() => {
    if (!submitted) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    searchCustomers(submitted).then((matches) => {
      if (cancelled) return;
      setResults(matches);
      setSearching(false);
    });
    return () => {
      cancelled = true;
    };
  }, [submitted]);

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
    navigate(`/customer/${result.customer.customerId}`, { state: { navKey: 'customer-search', ...(newTicket ? { newTicket: true } : {}) } });
  };

  return (
    <div className="p-8 w-full">
      <PageHeader title={<>Customer Search</>} description={<>Look up a customer by mobile number, QID, customer number, account number, name, email, or service ID.</>} />

      {/* Field and Search button on one row (the field shrinks, the button keeps its width); Enter in the
          field and the button run the same search. The text stays in the field after a search. */}
      <form
        role="search"
        aria-label="Customer search"
        className="flex items-stretch gap-3 mb-2"
        onSubmit={(e) => {
          e.preventDefault();
          runSearch();
        }}
      >
        <SearchField
          autoFocus
          aria-label="Customer search query"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              runSearch();
            }
          }}
          placeholder="e.g. 28512345678, 55512001, CUST-1003"
          onClear={() => {
            setQuery('');
            setSubmitted('');
          }}
          wrapperClassName="flex-1 min-w-0"
        />
        <Button type="submit" variant="primary-rect" disabled={!canSearch || searching} aria-busy={searching} className="shrink-0">
          {searching ? (
            <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <Icon path="M21 21l-4.3-4.3 M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z" className="w-4 h-4" />
          )}
          {searching ? 'Searching…' : 'Search'}
        </Button>
      </form>

      {!showingResults && (
        <p className="text-muted text-[length:var(--fs-caption)] mt-3">
          {canSearch
            ? 'Press Enter or Search to search.'
            : `Enter at least ${MIN_QUERY_LENGTH} characters, then press Enter or Search to see results.`}
        </p>
      )}

      {showingResults && (
        <div className="mt-4 space-y-2">
          {searching && <p className="text-muted text-[length:var(--fs-body)]">Searching…</p>}
          {!searching && results.length === 0 && (
            <div className="rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg p-6 text-center">
              <p className="text-fg font-medium mb-1">Customer Data Not Found</p>
              <p className="text-fg-2 text-[length:var(--fs-caption)]">No customer record matches “{submitted}”. Check the ID/number, or try searching by name or email instead.</p>
            </div>
          )}
          {!searching &&
            results.map(({ customer, matchedOn, matchedDocumentNumber }) => (
              <button
                key={customer.customerId}
                onClick={() => openCustomer({ customer, matchedOn })}
                className="w-full text-left rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg p-4 hover:border-[var(--field-card-hover-border)] hover:ring-1 hover:ring-inset hover:ring-[var(--field-card-hover-border)] hover:bg-[var(--field-card-hover-bg)] transition-all flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-fg text-[length:var(--fs-body-lg)] truncate"><Highlight text={customer.name} query={submitted} words />
                    </span>
                    {customer.blacklisted && <Badge variant="danger">Blacklisted</Badge>}
                  </div>
                  <div className="text-fg-2 text-[length:var(--fs-caption)]">
                    <Highlight text={customer.customerId} query={submitted} /> · {customer.idType} <Highlight text={customer.qid} query={submitted} /> · {customer.segment}
                    {customer.phone ? <> · <Highlight text={customer.phone} query={submitted} /></> : null}
                    {matchedDocumentNumber ? <> · ID document <Highlight text={matchedDocumentNumber} query={submitted} /></> : null}
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
