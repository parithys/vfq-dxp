import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../../components/primitives/Button';
import { Icon } from '../../../components/primitives/Icon';
import { Select } from '../../../components/primitives/Select';
import { buildNewTicketRecord } from '../../../data/reference/ticketReferenceData';
import { TicketCreationModal } from '../../../modules/trouble-ticketing-complaints/screens/TicketCreationModal';
import type { NewTicketValue } from '../../../modules/trouble-ticketing-complaints/screens/TicketCreationModal';
import { useEntityStore } from '../../../stores/entityStore';
import type { Customer360Data } from '../../../engines/customer360Engine';
import type { CustomerService } from '../../../engines/customerServicesEngine';
import { IC, IconTile, Pill, SearchBox } from '../sections/C360Kit';
import { QueryPreviewModal } from './QueryPreviewModal';
import { QUERY_SERVICE_TYPES, TICKET_ISSUE_TYPES, deriveQueryServiceType, matchRanges, queryKeywords, routeTicket, searchQueryIssues, serviceTypeLabel, useQueryIssueCatalogue } from './queryFlowModel';
import type { QueryIssue } from './queryFlowModel';

const BACK_ICON = 'M19 12H5 M12 19l-7-7 7-7';
const CHEVRON_RIGHT = 'M9 18l6-6-6-6';

const categoryTone = (c: string | undefined) => (/network/i.test(c ?? '') ? 'red' : c ? 'blue' : 'grey');
const PENDING = 'Category pending';

/** The issue name with every matched keyword wrapped in <mark> (the app's search-match highlight). */
function Highlighted({ text, keywords }: { text: string; keywords: string[] }) {
  const ranges = matchRanges(text, keywords) ?? [];
  const parts: React.ReactNode[] = [];
  let pos = 0;
  ranges.forEach(([a, b], i) => {
    if (a > pos) parts.push(text.slice(pos, a));
    parts.push(
      <mark key={i} className="rounded-[var(--radius-sm)] bg-[var(--highlight-bg)] text-inherit font-semibold">
        {text.slice(a, b)}
      </mark>
    );
    pos = b;
  });
  if (pos < text.length) parts.push(text.slice(pos));
  return <>{parts}</>;
}

function Banner({ tone, children }: { tone: 'info' | 'success' | 'warn'; children: React.ReactNode }) {
  const bg = tone === 'info' ? 'bg-[color-mix(in_oklab,var(--signal-blue),var(--bg)_90%)] text-[var(--signal-blue)]' : tone === 'success' ? 'bg-[color-mix(in_oklab,var(--success),var(--bg)_90%)] text-success' : 'bg-[var(--warn-bg)] text-[var(--warn-text)]';
  return <p className={`rounded-[var(--radius-card)] px-4 py-3 text-[length:var(--fs-body)] ${bg}`}>{children}</p>;
}

/**
 * Customer 360's "How can we help today?" journey: find the customer's issue, confirm its category and service type,
 * preview the account facts that matter, then close the interaction or raise a trouble ticket - all without leaving
 * the customer.
 */
export function QueryFlowCard({
  data,
  services,
  onTicketCreated,
  focusSignal = 0,
}: {
  data: Customer360Data;
  services: CustomerService[];
  onTicketCreated?: (ticket: Record<string, unknown>) => void;
  /** Bumped by "New Ticket" elsewhere: returns to the search step, focuses the box and brings the card into view. */
  focusSignal?: number;
}) {
  const catalogue = useQueryIssueCatalogue();
  const createRecord = useEntityStore((s) => s.createRecord);
  const [query, setQuery] = useState('');
  const [issue, setIssue] = useState<QueryIssue | null>(null);
  const [msisdnRef, setMsisdnRef] = useState('');
  const [manualType, setManualType] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [note, setNote] = useState<string | undefined>();

  const cardRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!focusSignal || !catalogue) return;
    setIssue(null);
    setPreviewOpen(false);
    setCreating(false);
    const t = window.setTimeout(() => {
      cardRef.current?.scrollIntoView({ block: 'center' });
      cardRef.current?.querySelector('input')?.focus();
    }, 50);
    return () => window.clearTimeout(t);
  }, [focusSignal, catalogue]);

  const keywords = useMemo(() => queryKeywords(query), [query]);
  const results = useMemo(() => (catalogue ? searchQueryIssues(catalogue.issues, query) : []), [catalogue, query]);
  const lines = useMemo(() => services.filter((s) => s.tab === 'mobile' || s.tab === 'fibre'), [services]);
  const service = lines.find((s) => s.ref === msisdnRef);
  const derivedType = issue ? deriveQueryServiceType(issue, service) : undefined;
  const serviceType = derivedType ?? (manualType || undefined);
  const routing = issue ? routeTicket(issue, data.customer, (data.contacts[0] as { preferredLanguage?: string } | undefined)?.preferredLanguage) : undefined;

  const reset = (message?: string) => {
    setQuery('');
    setIssue(null);
    setMsisdnRef('');
    setManualType('');
    setPreviewOpen(false);
    setCreating(false);
    setNote(message);
  };

  const createTicket = async (value: NewTicketValue) => {
    const ticketId = `TT-${Date.now().toString().slice(-6)}`;
    const record = buildNewTicketRecord({ ticketId, ...value, createdBy: 'AGENT-VINODHINIR' });
    await createRecord('trouble-tickets', record);
    onTicketCreated?.(record);
    reset(`Ticket ${ticketId} was created for "${issue?.name}".`);
  };

  if (!catalogue) return null;

  return (
    <section ref={cardRef} className="rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg p-5 space-y-4" aria-label="How can we help today?">
      {!issue ? (
        <>
          <div>
            <h2 className="text-fg font-bold text-[length:var(--fs-h4)]">How can we help today?</h2>
            <p className="text-fg-2 text-[length:var(--fs-body)] mt-1">Search for customer issues, queries or requests.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <SearchBox value={query} onChange={(v) => { setQuery(v); setNote(undefined); }} placeholder="Search for customer issues, queries or requests" />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[length:var(--fs-caption)]">
            <span className="text-muted">Examples:</span>
            {catalogue.examples.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => { setQuery(e); setNote(undefined); }}
                className="rounded-[var(--radius-pill)] border border-[var(--field-card-border)] bg-bg px-3 py-1 text-fg-2 hover:bg-surface focus:outline-none focus-visible:shadow-[var(--focus-ring)]"
              >
                {e}
              </button>
            ))}
          </div>
          {note && <Banner tone="success">{note}</Banner>}
          {query.trim() && (
            <div aria-live="polite">
              <p className="text-fg font-semibold text-[length:var(--fs-body)] mb-2">Query Issues ({results.length})</p>
              {results.length === 0 ? (
                <p className="text-muted text-[length:var(--fs-body)]">No Query Issues match "{query.trim()}". Try fewer or different keywords.</p>
              ) : (
                <ul className="rounded-[var(--radius-card)] border border-[var(--field-card-border)] divide-y divide-border-soft overflow-hidden">
                  {results.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => setIssue(r)}
                        className="w-full flex flex-wrap items-center gap-3 px-4 py-2.5 text-left hover:bg-surface focus:outline-none focus-visible:shadow-[var(--focus-ring)]"
                      >
                        <span className="flex-1 min-w-48 text-fg text-[length:var(--fs-body)]"><Highlighted text={r.name} keywords={keywords} /></span>
                        {r.serviceType && <Pill tone="blue">{serviceTypeLabel(r.serviceType)}</Pill>}
                        <Pill tone={categoryTone(r.category)}>{r.category ?? PENDING}</Pill>
                        <Icon path={CHEVRON_RIGHT} className="w-4 h-4 text-fg shrink-0" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center gap-1.5 text-accent font-medium text-[length:var(--fs-body)] hover:underline focus:outline-none focus-visible:shadow-[var(--focus-ring)] rounded-[var(--radius-sm)]"
          >
            <Icon path={BACK_ICON} className="w-4 h-4" />
            Back to Search
          </button>

          <div className="grid grid-cols-1 @4xl:grid-cols-2 gap-4 items-stretch">
          <div className="rounded-[var(--radius-card)] border border-[var(--field-card-border)] p-4 space-y-3">
            <h3 className="text-fg font-semibold text-[length:var(--fs-body-lg)]">Selected Query Issue</h3>
            <div className="flex items-center gap-3">
              <IconTile icon={IC.phone} tone="red" />
              <span className="text-fg font-bold text-[length:var(--fs-h5)]">{issue.name}</span>
            </div>
            <dl className="grid grid-cols-1 sm:grid-cols-[12rem_1fr] gap-x-4 gap-y-2 items-center text-[length:var(--fs-body)]">
              <dt className="text-fg-2">Query Category</dt>
              <dd><Pill tone={categoryTone(issue.category)}>{issue.category ?? PENDING}</Pill></dd>
              <dt className="text-fg-2">Query Issue</dt>
              <dd className="text-fg">{issue.name}</dd>
            </dl>
            {issue.category ? <Banner tone="success">Query Category is auto-derived based on predefined mapping.</Banner> : <Banner tone="warn">No Query Category is mapped for this issue yet.</Banner>}
          </div>

          <div className="rounded-[var(--radius-card)] border border-[var(--field-card-border)] p-4 space-y-3">
            <h3 className="text-fg font-semibold text-[length:var(--fs-body-lg)]">Query Service Type</h3>
            {service && <Banner tone="info">MSISDN is selected. Query Service Type is auto-derived.</Banner>}
            <Select
              label="Selected MSISDN"
              value={msisdnRef}
              onChange={(e) => setMsisdnRef(e.target.value)}
              options={[{ value: '', label: 'Not selected' }, ...lines.map((l) => ({ value: l.ref, label: `${l.identifier} (${l.status ?? 'Active'})` }))]}
            />
            {service ? (
              <div className="flex flex-col gap-1">
                <span className="text-[length:var(--fs-label)] text-fg-2">Query Service Type</span>
                <div className="rounded-[var(--field-radius)] border border-[var(--field-border-disabled)] bg-[var(--field-bg-disabled)] px-3 py-2 text-[length:var(--fs-body)] text-muted">
                  {derivedType ?? 'Not derivable for this line - choose below'}
                </div>
              </div>
            ) : null}
            {(!service || !derivedType) && (
              <>
                {!service && <Banner tone="warn">If MSISDN is not selected, please choose the Query Service Type.</Banner>}
                <Select
                  label="Query Service Type"
                  value={manualType}
                  onChange={(e) => setManualType(e.target.value)}
                  placeholder="Select Query Service Type"
                  options={QUERY_SERVICE_TYPES.map((t) => ({ value: t, label: t }))}
                />
              </>
            )}
            <div className="flex justify-end">
              <Button variant="primary-rect" disabled={!serviceType} onClick={() => setPreviewOpen(true)}>
                Preview Details
              </Button>
            </div>
          </div>
          </div>

          {serviceType && (
            <QueryPreviewModal
              open={previewOpen}
              issue={issue}
              serviceType={serviceType}
              service={service}
              data={data}
              services={services}
              catalogue={catalogue}
              onClose={() => setPreviewOpen(false)}
              onCloseInteraction={() => reset('Interaction closed without raising a ticket.')}
              onCreateTicket={() => {
                setPreviewOpen(false);
                setCreating(true);
              }}
            />
          )}
          {creating && serviceType && (
            <TicketCreationModal
              open
              onClose={() => setCreating(false)}
              onSubmit={createTicket}
              initialCustomerId={data.customer.customerId}
              initialIssueType={TICKET_ISSUE_TYPES.includes(serviceType) ? serviceType : ''}
              initialActualIssue={issue.ticketActualIssue ?? ''}
              initialQueue={routing?.queue}
              routingNote={routing?.basis}
              severity={issue.severity}
            />
          )}
        </>
      )}
    </section>
  );
}
