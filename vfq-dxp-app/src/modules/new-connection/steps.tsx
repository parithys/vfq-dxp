import { Badge } from '../../components/primitives/Badge';
import { CARD, CARD_SELECTABLE } from './stepStyles';
import { SERVICE_JOURNEYS, continuesHere } from './serviceJourneys';
import type { ServiceJourney } from './serviceJourneys';
import { HandOff } from './HandOff';
import { customerTypeLabel } from './customerTypeModel';
import type { CustomerType } from './customerTypeModel';


// Building blocks for the New Connection journey. Everything here is a
// journey-level decision (who the customer is, which offer, which service);
// the fulfilment steps themselves reuse the shared patterns directly.

/** An identity that resolves to a customer record is ALWAYS an existing customer - including one with no
 * active lines or services. Nothing is announced for it any more (the "Existing customer" toast was
 * removed 2026-10-04): the status shows through the rest of the journey. Kept as a component so its call
 * sites need no change. */
export function CustomerStatusBanner(_props: { customerId: string | undefined }) {
  return null;
}

// ---------------------------------------------------------------- Customer type

export function JourneyStep({
  value,
  onChange,
  onHandOff,
}: {
  value: ServiceJourney | undefined;
  onChange: (v: ServiceJourney) => void;
  onHandOff: (route: string) => void;
}) {
  return (
    <div className="space-y-5">
      <p className="text-fg-2 text-[length:var(--fs-body)]">
        No cross-sales offer is being used, so choose the service from the standard Sales Offers catalogue.
      </p>
      <div role="radiogroup" aria-label="Service journey" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SERVICE_JOURNEYS.map((j) => (
          <div
            key={j.key}
            role="radio"
            aria-checked={value === j.key}
            tabIndex={0}
            onClick={() => onChange(j.key)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onChange(j.key);
              }
            }}
            className={`${CARD_SELECTABLE} cursor-pointer transition-colors focus:outline-none focus-visible:shadow-[var(--focus-ring)] ${value === j.key ? 'border-[var(--field-card-selected)] bg-[var(--field-card-selected-bg)] shadow-[var(--shadow-selected-ring)]' : 'border-[var(--field-card-border)] bg-bg hover:border-[var(--field-card-hover-border)] hover:ring-1 hover:ring-inset hover:ring-[var(--field-card-hover-border)] hover:bg-[var(--field-card-hover-bg)]'}`}
          >
            <span className="block text-fg font-medium text-[length:var(--fs-body)]">{j.label}</span>
            <span className="block text-fg-2 text-[length:var(--fs-caption)]">{j.description}</span>
          </div>
        ))}
      </div>
      {value && !continuesHere(value) && <HandOff journey={value} onGo={onHandOff} />}
    </div>
  );
}

// ---------------------------------------------------------------- Plan source

export function PlanSourceBanner({ offerName, customerType }: { offerName?: string; customerType?: CustomerType }) {
  const special = customerType && customerType !== 'none';
  const isSalesOffer = Boolean(offerName) || special;
  return (
    <div className={`${CARD} mb-5 flex items-center justify-between gap-3`}>
      <div>
        <p className="text-fg font-semibold text-[length:var(--fs-body)]">{isSalesOffer ? 'Sales Offers' : 'General Plan'}</p>
        <p className="text-fg-2 text-[length:var(--fs-caption)]">
          {offerName
            ? `Based on the accepted cross-sales offer: ${offerName}.`
            : special
              ? `Offers for ${customerTypeLabel(customerType)} customers.`
              : 'Standard catalogue plans.'}
        </p>
      </div>
      <Badge variant={isSalesOffer ? 'success' : 'filled-neutral'}>{isSalesOffer ? 'Sales Offer' : 'General'}</Badge>
    </div>
  );
}

// ---------------------------------------------------------------- Eligibility outcomes

// Reference view of what each eligibility outcome covers: the blockers that
// produce it and the message the agent sees. The rows are the REAL checks - each
// one comes from evaluateEligibilityChecks run over a sample customer that
// trips just that check - so this cannot drift from what the engine says.
// The QR amount in the collections message is sample data.
