import { useEffect, useState } from 'react';
import { Button } from '../../../components/primitives/Button';
import { Icon } from '../../../components/primitives/Icon';
import { OfferDetailsDrawer } from './OfferDetailsDrawer';
import type { OfferProduct } from '../../../components/patterns/offerCardParts';
import { CARD_HIGHLIGHT, CARD_IDLE, CARD_SELECTED, OfferArtwork, STAR_ICON } from '../../../components/patterns/offerCardParts';
import * as mockDataEngine from '../../../engines/mockDataEngine';
import { CARD } from './stepStyles';
import { JOURNEY_PILL, journeyLabel, continuesHere } from './serviceJourneys';
import { HandOff } from './HandOff';
import { offerFeatures, offerHighlight } from './crossSalesModel';
import type { CrossSalesValue, Offer } from './crossSalesModel';

export function CrossSalesStep({
  customerId,
  value,
  onChange,
  onHandOff,
}: {
  customerId: string | undefined;
  value: CrossSalesValue;
  onChange: (v: CrossSalesValue) => void;
  onHandOff: (route: string) => void;
}) {
  const [offers, setOffers] = useState<Offer[] | undefined>();
  // The offer whose comprehensive details are open in the side drawer.
  const [detailOffer, setDetailOffer] = useState<Offer | null>(null);
  const [products, setProducts] = useState<Record<string, OfferProduct>>({});
  useEffect(() => {
    mockDataEngine
      .list<OfferProduct>('products')
      .then((all) => setProducts(Object.fromEntries(all.map((p) => [p.productId, p]))));
  }, []);
  const productNames = Object.fromEntries(Object.entries(products).map(([id, p]) => [id, p.name]));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [all, contacts] = await Promise.all([
        mockDataEngine.list<Offer>('cross-sales-offers'),
        mockDataEngine.list<{ contactRecordId: string; customerId: string }>('customer-contacts'),
      ]);
      const mine = new Set(contacts.filter((c) => c.customerId === customerId).map((c) => c.contactRecordId));
      // Open offers for this customer, for a journey this flow supports.
      const open = all.filter((o) => mine.has(o.contactId) && (o.status === 'Offered' || o.status === 'Interested') && o.serviceJourney);
      if (!cancelled) setOffers(open);
    })();
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  // Nothing on offer is its own outcome, not an empty state to sit in.
  useEffect(() => {
    if (offers && offers.length === 0 && value.decision !== 'none') onChange({ decision: 'none' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offers]);

  if (!offers) return <p className="text-muted text-[length:var(--fs-body)]">Checking for cross-sales offers…</p>;
  if (offers.length === 0) {
    return (
      <div className={CARD}>
        <p className="text-fg font-semibold text-[length:var(--fs-body)]">No cross-sales offer available</p>
        <p className="text-fg-2 text-[length:var(--fs-caption)]">Continue to choose a service from the standard catalogue.</p>
      </div>
    );
  }

  const accepted = offers.find((o) => o.offerId === value.offerId && value.decision === 'accepted');
  // One offer carries the Recommended flag: the best (lowest) priority code, first listed on a tie.
  const recommendedId = [...offers].sort((x, y) => (x.priorityCode ?? 'P9').localeCompare(y.priorityCode ?? 'P9'))[0]?.offerId;
  return (
    <div className="space-y-4">
      {/* One row per service (Postpaid, Prepaid, GigaHome...), in order of first appearance. */}
      <div className="space-y-3" role="radiogroup" aria-label="Offers">
        {[null].map((all) => (
          <ul key={String(all)} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {offers.map((o) => {
          const selected = value.decision === 'accepted' && value.offerId === o.offerId;
          const recommended = o.offerId === recommendedId;
          const perMonth = !(o.serviceJourney === 'new-prepaid' || o.serviceJourney === 'mnp-prepaid');
          const features = offerFeatures(o, products);
          // The whole card is the control: click (or Enter/Space) selects it,
          // and clicking the selected one again clears it.
          const toggle = () =>
            onChange(
              selected
                ? {}
                : { decision: 'accepted', offerId: o.offerId, offerName: o.offerName, journey: o.serviceJourney, linkedProductIds: o.linkedProductIds }
            );
          return (
            <li
              key={o.offerId}
              role="radio"
              aria-checked={selected}
              tabIndex={0}
              onClick={toggle}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggle();
                }
              }}
              className={`relative rounded-[var(--radius-card)] border p-5 flex flex-col gap-3 cursor-pointer transition-colors focus:outline-none focus-visible:shadow-[var(--focus-ring)] ${
                selected ? CARD_SELECTED : recommended ? CARD_HIGHLIGHT : CARD_IDLE
              }`}
            >
              {/* Top row: the Recommended flag on the left, the service on the right. Both
                  always take their space (the flag is hidden, not removed) so every card's
                  title starts at the same height. */}
              <div className="flex items-center justify-between gap-3">
                <span
                  className={`inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-accent text-white px-2.5 py-0.5 text-[length:var(--fs-tag)] font-medium ${recommended ? '' : 'invisible'}`}
                  aria-hidden={!recommended}
                >
                  <Icon path={STAR_ICON} className="w-3 h-3" />
                  Recommended
                </span>
                <span
                  className={`rounded-[var(--radius-pill)] px-2.5 py-0.5 text-[length:var(--fs-tag)] font-medium ${
                    o.serviceJourney ? JOURNEY_PILL[o.serviceJourney] : 'bg-surface text-fg-2'
                  }`}
                >
                  {journeyLabel(o.serviceJourney)}
                </span>
              </div>
              <OfferArtwork />
              <div className="flex-1 space-y-2">
                <p className="text-fg font-bold text-[length:var(--fs-h5)] leading-snug pr-20">{o.offerName}</p>
                <p className="text-fg-2 text-[length:var(--fs-caption)] pr-20">{o.offerDescription}</p>
                <p className="text-accent">
                  <span className="text-[length:var(--fs-body)] font-semibold">QAR </span>
                  <span className="text-[length:var(--fs-h3)] font-bold">{o.monthlyRental}</span>
                  {perMonth && <span className="text-fg-2 text-[length:var(--fs-caption)]"> /month</span>}
                </p>
                <ul className="space-y-1.5">
                  {features.map((f) => (
                    <li key={f.text} className="flex items-center gap-2 text-fg-2 text-[length:var(--fs-caption)]">
                      <Icon path={f.icon} className="w-4 h-4 shrink-0 text-accent" />
                      {f.text}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex items-center justify-between gap-3 pt-1">
                {/* Opens the full offer details in the side drawer; it stops
                    propagation so looking never selects the offer. */}
                <button
                  type="button"
                  aria-label={`View details for ${o.offerName}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDetailOffer(o);
                  }}
                  onKeyDown={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 rounded-[var(--radius-button)] text-fg hover:text-accent focus:outline-none focus-visible:shadow-[var(--focus-ring)] text-[length:var(--fs-caption)] font-medium"
                >
                  View details
                  <Icon path={CHEVRON_RIGHT} className="w-4 h-4" />
                </button>
                {/* Presentational: the card is the control, so the button must not take focus or
                    fire a second toggle. */}
                <Button
                  variant={selected ? 'primary-rect' : 'ghost-rect'}
                  tabIndex={-1}
                  aria-hidden
                  className="pointer-events-none"
                >
                  {selected ? 'Selected' : 'Select offer'}
                </Button>
              </div>
            </li>
          );
        })}
          </ul>
        ))}
      </div>
      {/* The hand-off banner only exists for offers that continue in another journey (MNP, fixed line),
          so rendering it conditionally made the footer and page jump ~120px whenever the selection
          moved between a postpaid offer and one of those. The slot is always present at the banner's
          own height (105px, measured), so nothing below it moves. */}
      <div className="min-h-[105px]">
        {accepted && !continuesHere(accepted.serviceJourney) && accepted.serviceJourney && (
          <HandOff journey={accepted.serviceJourney} onGo={onHandOff} />
        )}
      </div>
      <OfferDetailsDrawer
        offer={detailOffer}
        serviceLabel={journeyLabel(detailOffer?.serviceJourney) ?? '-'}
        fixedService={detailOffer?.serviceJourney === 'new-fixed-line' || detailOffer?.serviceJourney === 'new-fwa'}
        highlight={detailOffer ? offerHighlight(detailOffer, products) : null}
        includedNames={(detailOffer?.linkedProductIds ?? []).map((id) => productNames[id] ?? id)}
        selected={Boolean(detailOffer && value.decision === 'accepted' && value.offerId === detailOffer.offerId)}
        onSelect={() =>
          detailOffer &&
          onChange({
            decision: 'accepted',
            offerId: detailOffer.offerId,
            offerName: detailOffer.offerName,
            journey: detailOffer.serviceJourney,
            linkedProductIds: detailOffer.linkedProductIds,
          })
        }
        onClose={() => setDetailOffer(null)}
      />
    </div>
  );
}

const CHEVRON_RIGHT = 'M9 18l6-6-6-6';
