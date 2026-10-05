export type ServiceJourney =
  | 'new-prepaid'
  | 'new-postpaid'
  | 'mnp-postpaid'
  | 'mnp-prepaid'
  | 'new-fixed-line'
  | 'new-fwa';

export const SERVICE_JOURNEYS: { key: ServiceJourney; label: string; description: string; route?: string }[] = [
  { key: 'new-prepaid', label: 'New Prepaid', description: 'Activate a new prepaid SIM and starter bundle', route: '/mobile-prepaid/new-prepaid-tablet-step-1-contact-id-capture' },
  { key: 'new-postpaid', label: 'New Postpaid', description: 'Activate a new postpaid line with plan and SIM' },
  { key: 'mnp-postpaid', label: 'MNP Postpaid', description: 'Port a number in onto a postpaid plan', route: '/mnp-fnp-porting/mnp-wizard-step-contact' },
  { key: 'mnp-prepaid', label: 'MNP Prepaid', description: 'Port a number in onto a prepaid plan', route: '/mnp-fnp-porting/mnp-wizard-step-contact' },
  { key: 'new-fixed-line', label: 'New Fixed Line', description: 'Activate a new fixed line service', route: '/fixed-line-fibre/new-fixed-line-wizard-contact-step' },
  { key: 'new-fwa', label: 'New FWA', description: 'Activate a new Fixed Wireless Access service', route: '/fwa-5g-home/new-fwa-tile-home-screen' },
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
};

export const journeyLabel = (k: ServiceJourney | undefined) => SERVICE_JOURNEYS.find((j) => j.key === k)?.label;

/** Only New Postpaid continues inside this wizard (its fulfilment steps are the
 * ones below); every other journey continues in its own existing wizard. */
export const continuesHere = (k: ServiceJourney | undefined) => k === 'new-postpaid';
