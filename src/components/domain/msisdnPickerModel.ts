import { isQatarMobileLocalNumber } from '../primitives/countryDialCodes';

export interface MsisdnRecord {
  msisdn: string;
  category: string;
  status: string;
  priceQAR: number;
  valueTier?: string;
  /** Who holds the reservation, on a Reserved record. */
  reservedBy?: string;
  /** When the reservation was made (ISO), on a Reserved record. */
  reservedAt?: string;
}

/**
 * The three tabs, which do NOT all filter on the same axis - and that is the
 * point rather than an inconsistency.
 *
 * 'Free' and 'Star' are now PRICE BANDS (2026-09-28 direction: "show only
 * numbers priced from QAR 0 up to, but not including, QAR 1,000" under Free -
 * the ceiling itself moved to QAR 1,500 on 2026-09-30), not the stored
 * `category` field - see FREE_NUMBER_PRICE_CEILING_QAR (postpaidPricing.ts)
 * for why this is also a correctness fix, not just a rename: star-number-
 * tiers.json's own lowest tier starts at 1000
 * (STAR-TIER-01, valueRangeMin 1000), so a handful of seeded numbers
 * category='Star' priced 300-900 already matched no tier at all - "Not
 * banded" on a number that was never going to be. Pricing the tabs
 * themselves means those numbers now land where they actually behave: no
 * lock-in, no tier, same as every other number under 1000. 'Reserved' is a
 * STATUS and cuts across both bands, so a reserved Star number appears there
 * rather than falling out of the UI entirely - which is what happened when
 * Reserved numbers were simply hidden.
 */
export type NumberTab = 'Free' | 'Star' | 'Reserved';

export const TAB_LABELS: Record<NumberTab, string> = {
  Free: 'Free Numbers',
  Star: 'Star Numbers',
  Reserved: 'Reserved Numbers',
};

/**
 * Tab ORDER is fixed for every channel as of 2026-09-28: Free, Star,
 * Reserved. This replaces the channel-based order used until then (Retail -
 * Reserved, Star, Free; Tablet/field - Free, Star, Reserved), which existed
 * so a retail agent working a number the customer already held would see it
 * first. That job now belongs to the auto-select-on-load effect below
 * instead of the tab ORDER itself - an agent whose customer holds a reserved
 * number lands on the Reserved tab regardless of channel, while the tabs
 * themselves stay in one predictable order for everyone.
 */
// Reserved, Star, Free (VFQ business, 2026-10-02) - reversing the 2026-09-28 Free, Star, Reserved order.
export const TAB_ORDER: NumberTab[] = ['Reserved', 'Star', 'Free'];

/**
 * The Number Management Portal's own tab order: Star, Free, Reserved. Only the portal uses it; every journey keeps TAB_ORDER above.
 */
export const PORTAL_TAB_ORDER: NumberTab[] = ['Star', 'Free', 'Reserved'];

/** The Retail Sales persona (personas.json ROLE-01): Reserved opens first when numbers are held, and is hidden - Star opens instead - when none are. */
export const RETAIL_SALES_PERSONA_ID = 'ROLE-01';

/**
 * Qatar MSISDNs are stored E.164 (+9743300...) but shown as the bare 8-digit
 * local number: every number in this picker is Qatari, so the country code is
 * the same eleven characters on every row and carries no information the agent
 * is choosing between. Grouped 4+4, which is how they are read aloud.
 */
export function toLocalMsisdn(msisdn: string): string {
  const local = msisdn.replace(/[\s-]/g, '').replace(/^\+?974/, '');
  return /^\d{8}$/.test(local) ? `${local.slice(0, 4)} ${local.slice(4)}` : msisdn;
}

/**
 * How many numbers one agent may hold at a time (2026-09-28 direction).
 * Applied to the action that creates a hold, not to selecting one already
 * held - re-picking your own reservation is not a new one.
 */
export const MAX_RESERVATIONS_PER_AGENT = 2;

/** How many numbers are shown at once before Next/Previous: 20, four rows of five (was 10, 2026-10-04). */
export const PAGE_SIZE = 20;
/** Free numbers are compact one-line cards in three columns: 20 rows of 3 per page. */
export const FREE_PAGE_SIZE = 60;

/**
 * Sort orders, offered on Free and Star, NOT Reserved.
 *
 * Both bands now have real price spread to sort by: Star is 1000 and up,
 * and Free (2026-09-28's price-band split moved the 300-900 rows that used
 * to read category='Star' in here) runs 0-999 - no longer the flat QAR 0 list
 * it used to be, so a price sort is no longer a no-op there either. Reserved
 * stays excluded: it is a short held-numbers list an agent scans rather than
 * ranks, capped at MAX_RESERVATIONS_PER_AGENT, where a sort control would
 * answer a question nobody asks of it.
 *
 * Reserved therefore sorts by NUMBER_ASC implicitly, with no control on
 * screen. An earlier revision showed the dropdown everywhere on the
 * reasoning that a control changing its options per tab is hard to trust; the
 * better answer is not to show a control that cannot act.
 */
export type SortKey = 'price-desc' | 'price-asc' | 'number-asc' | 'number-desc';

// Both directions for BOTH keys. Offering "Number: ascending" without its
// descending counterpart made the one key asymmetric against the other - price
// had two directions and number one - so the menu implied number order was
// somehow one-way.
export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'number-asc', label: 'Number: ascending' },
  { value: 'number-desc', label: 'Number: descending' },
];

/**
 * Free's own sort menu (2026-09-30), number-only - deliberately NOT the same
 * four options Star offers. Every Free number is free to the customer
 * regardless of its catalogue price (see showSort's own note below), so a
 * price sort here would rank rows by a figure the customer never pays -
 * exactly the reasoning that kept Free without a sort control at all until
 * now. Restricted to a subset of SORT_OPTIONS rather than a second literal
 * list, so the wording can never drift from Star's.
 */
/** Star's sort menu: price only (the Free tab keeps the number sorts). */
export const STAR_SORT_OPTIONS = SORT_OPTIONS.filter((o) => o.value === 'price-desc' || o.value === 'price-asc');

export const FREE_SORT_OPTIONS = SORT_OPTIONS.filter((o) => o.value === 'number-asc' || o.value === 'number-desc');

export const SORTERS: Record<SortKey, (a: MsisdnRecord, b: MsisdnRecord) => number> = {
  // Ties broken by number, so a page of equally-priced numbers holds a stable
  // order instead of reshuffling on every render.
  'price-desc': (a, b) => b.priceQAR - a.priceQAR || a.msisdn.localeCompare(b.msisdn),
  'price-asc': (a, b) => a.priceQAR - b.priceQAR || a.msisdn.localeCompare(b.msisdn),
  'number-asc': (a, b) => a.msisdn.localeCompare(b.msisdn),
  'number-desc': (a, b) => b.msisdn.localeCompare(a.msisdn),
};


// ranking, not the alphabet. Values not listed here sort after everything
// that is.

// A full Qatar MSISDN: +974 followed by an 8-digit mobile local number
// (isQatarMobileLocalNumber - same leading-digit rule GuidedContactStep's
// isValidAltPhone uses) - stricter than that general validator since a
// number being reserved here must be a complete, dialable MSISDN with the
// +974 prefix present, not any alternate-contact phone shape.
export function isValidMsisdn(raw: string): boolean {
  const digits = raw.replace(/[\s-]/g, '');
  return digits.startsWith('+974') && isQatarMobileLocalNumber(digits.slice(4));
}

export const STAT_ICONS = {
  wallet: 'M3 6h15a3 3 0 0 1 3 3v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z M3 6a2 2 0 0 1 2-2h11 M16 13h5',
  tag: 'M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z M7.5 7.5h.01',
  lock: 'M6 11h12v10H6z M8 11V8a4 4 0 0 1 8 0v3 M12 15v2',
};

/** Price ranges for the Star tab's filter (QAR). `max` is inclusive; Infinity is open-ended. */
export interface PriceRange {
  key: string;
  label: string;
  min: number;
  max: number;
}
export const PRICE_RANGES: PriceRange[] = [
  { key: 'under-5000', label: 'Under QAR 5K', min: 0, max: 4999 },
  { key: '5000-9999', label: 'QAR 5K \u2013 9.9K', min: 5000, max: 9999 },
  { key: '10000-24999', label: 'QAR 10K \u2013 24.9K', min: 10000, max: 24999 },
  { key: '25000-50000', label: 'QAR 25K \u2013 50K', min: 25000, max: 50000 },
  { key: 'above-50000', label: 'Above QAR 50K', min: 50001, max: Infinity },
];
export const inPriceRange = (priceQar: number, r: PriceRange) => priceQar >= r.min && priceQar <= r.max;
