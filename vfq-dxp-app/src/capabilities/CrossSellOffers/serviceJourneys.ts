export type ServiceJourney =
  | 'new-prepaid'
  | 'new-postpaid'
  | 'mnp-postpaid'
  | 'mnp-prepaid'
  | 'new-fixed-line'
  | 'new-fwa'
  | 'pre-to-post'
  | 'post-to-post';

export const SERVICE_JOURNEYS: { key: ServiceJourney; label: string; description: string; route?: string }[] = [
  { key: 'new-prepaid', label: 'New Prepaid', description: 'Activate a new prepaid SIM and starter bundle', route: '/mobile-prepaid/new-prepaid' },
  { key: 'new-postpaid', label: 'New Postpaid', description: 'Activate a new postpaid line with plan and SIM', route: '/mobile/start-connection' },
  { key: 'mnp-postpaid', label: 'MNP Postpaid', description: 'Port a number in onto a postpaid plan', route: '/mnp-fnp-porting/mnp-wizard-step-contact' },
  { key: 'mnp-prepaid', label: 'MNP Prepaid', description: 'Port a number in onto a prepaid plan', route: '/mnp-fnp-porting/mnp-wizard-step-contact' },
  { key: 'new-fixed-line', label: 'New Fixed Line', description: 'Activate a new fixed line service', route: '/fixed-line-fibre/new-fixed-line-wizard-contact-step' },
  { key: 'new-fwa', label: 'New FWA', description: 'Activate a new Fixed Wireless Access service', route: '/fwa-5g-home/new-fwa-tile-home-screen' },
  { key: 'pre-to-post', label: 'Prepaid to Postpaid', description: 'Migrate a prepaid line onto a postpaid plan', route: '/pre-to-post-migration/postpaid-contact-wizard-step-pre-to-post' },
  // No postpaid plan-change wizard is built yet; this is the catalogue's closest screen (SCR-172, Promotion Upgrades picker),
  // which the router shows as "not yet built" until it is registered. Point it at the real wizard when there is one.
  { key: 'post-to-post', label: 'Postpaid to Postpaid Upgrade', description: 'Move a postpaid line to a plan with a higher monthly fee', route: '/mobile-postpaid/promotion-upgrades-picker-modal' },
];

/** Offer-card service pill colours, one per service so the type reads at a glance. Self-contained
 * tint + dark text pairs (each text/background >= 4.5:1), so they hold in the dark theme too. Red is
 * left out: it already marks the Recommended flag and the selected card. */
export const JOURNEY_PILL: Record<ServiceJourney, string> = {
  'new-postpaid': 'bg-[var(--tint-blue-bg)] text-[var(--tint-blue-fg)]',
  'new-prepaid': 'bg-[var(--tint-green-bg)] text-[var(--tint-green-fg)]',
  'mnp-postpaid': 'bg-[var(--tint-teal-bg)] text-[var(--tint-teal-fg)]',
  'mnp-prepaid': 'bg-[var(--tint-amber-bg)] text-[var(--tint-amber-fg)]',
  'new-fixed-line': 'bg-[var(--tint-pink-bg)] text-[var(--tint-pink-fg)]',
  'new-fwa': 'bg-[var(--tint-indigo-bg)] text-[var(--tint-indigo-fg)]',
  'pre-to-post': 'bg-[var(--tint-green-bg)] text-[var(--tint-green-fg)]',
  'post-to-post': 'bg-[var(--tint-indigo-bg)] text-[var(--tint-indigo-fg)]',
};

/** The five types the Offers step groups its cards under, in display order. */
export type OfferTypeKey = 'new-prepaid' | 'new-postpaid' | 'new-mnp' | 'new-home' | 'pre-to-post-upgrade' | 'post-to-post-upgrade';

export const OFFER_TYPES: { key: OfferTypeKey; label: string; empty: string }[] = [
  { key: 'new-prepaid', label: 'New Prepaid', empty: 'No New Prepaid offers for this customer.' },
  { key: 'new-postpaid', label: 'New Postpaid', empty: 'No New Postpaid offers for this customer.' },
  { key: 'new-mnp', label: 'New MNP', empty: 'No New MNP offers for this customer.' },
  { key: 'new-home', label: 'New Home', empty: 'No New Home offers for this customer.' },
  { key: 'pre-to-post-upgrade', label: 'Prepaid to Postpaid Upgrade', empty: 'No Prepaid to Postpaid Upgrade offers for this customer.' },
  { key: 'post-to-post-upgrade', label: 'Postpaid to Postpaid Upgrade', empty: 'No Postpaid to Postpaid Upgrade offers for this customer.' },
];

/** Which type an offer's journey belongs to. New Prepaid is its own type, listed only on the New Prepaid journey's Offers step. */
const OFFER_TYPE_OF_JOURNEY: Partial<Record<ServiceJourney, OfferTypeKey>> = {
  'new-prepaid': 'new-prepaid',
  'new-postpaid': 'new-postpaid',
  'mnp-postpaid': 'new-mnp',
  'mnp-prepaid': 'new-mnp',
  'new-fixed-line': 'new-home',
  'new-fwa': 'new-home',
  'pre-to-post': 'pre-to-post-upgrade',
  'post-to-post': 'post-to-post-upgrade',
};

export const offerTypeOf = (journey: ServiceJourney | undefined) => (journey ? OFFER_TYPE_OF_JOURNEY[journey] : undefined);

export const journeyLabel = (k: ServiceJourney | undefined) => SERVICE_JOURNEYS.find((j) => j.key === k)?.label;

/** The journey (or journeys) the Offers step belongs to: New Postpaid by default. A wizard that holds several products
 * passes all of them, because accepting an offer for any of them continues in that same wizard. */
export type OfferJourneys = ServiceJourney | readonly ServiceJourney[];
const includes = (here: OfferJourneys, k: ServiceJourney) => (typeof here === 'string' ? here === k : here.includes(k));

/** An offer for one of the wizard's own journeys continues inside it; every other journey continues in its own wizard. */
export const continuesHere = (k: ServiceJourney | undefined, here: OfferJourneys = 'new-postpaid') => k !== undefined && includes(here, k);

/** True when accepting an offer for this journey leads somewhere: it continues in this wizard or hands off to a route. */
export const hasDestination = (k: ServiceJourney | undefined, here: OfferJourneys = 'new-postpaid') =>
  continuesHere(k, here) || Boolean(SERVICE_JOURNEYS.find((j) => j.key === k)?.route);

/** The Offers-step sections shown for a journey: New Prepaid's own section only appears where prepaid is one of its journeys. */
export const offerTypesFor = (here: OfferJourneys = 'new-postpaid') => OFFER_TYPES.filter((t) => t.key !== 'new-prepaid' || includes(here, 'new-prepaid'));
