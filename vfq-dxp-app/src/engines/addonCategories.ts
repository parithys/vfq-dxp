// The Add-ons page's two levels of navigation: the add-on CATEGORY (Local Data, Local Calls, International Calls, Roaming, Combo, Others) and the
// Free / Paid FILTER, which applies to the category selected. Both are read from the add-on's own record: `addonCategory` (stated on every add-on in
// products.json) and its `pricing`: Free is an add-on stated as included with a plan, Paid every other (a QAR price, or a price the catalogue
// words as TBC / plan-based). An add-on without `pricing` is Free only when priced QAR 0. Nothing is guessed from a name or a description.

export const ADDON_CATEGORIES = ['Local Data', 'Local Calls', 'International Calls', 'Roaming', 'Combo', 'Others'] as const;
export type AddonCategory = (typeof ADDON_CATEGORIES)[number];

export type AddonPricing = 'free' | 'paid';
export const ADDON_PRICING_FILTERS: { key: AddonPricing; label: string }[] = [
  { key: 'free', label: 'Free' },
  { key: 'paid', label: 'Paid' },
];
/** The filter the page opens on: Paid, where nearly every add-on is (Free holds only the add-ons included with a plan). */
export const DEFAULT_ADDON_PRICING: AddonPricing = 'paid';

export interface CategorisedAddon {
  mrcQAR: number;
  addonCategory?: string;
  /** 'free': included with a plan. 'paid': anything else. Omitted: Free only when priced QAR 0. */
  pricing?: 'free' | 'paid';
}

/**
 * The category an add-on is listed under: the one its record states. "Others" is the named bucket for an add-on whose record states none of the
 * five categories, so no add-on drops out of the page.
 */
export function addonCategoryOf(a: CategorisedAddon): AddonCategory {
  return (ADDON_CATEGORIES as readonly string[]).includes(a.addonCategory ?? '') ? (a.addonCategory as AddonCategory) : 'Others';
}

/** Free: stated as included with a plan (or, with no statement, priced QAR 0). */
export const isFreeAddon = (a: CategorisedAddon): boolean => (a.pricing ? a.pricing === 'free' : a.mrcQAR === 0);

/** The add-ons of one category, narrowed by the Free / Paid filter. */
export function addonsFor<T extends CategorisedAddon>(addons: readonly T[], category: AddonCategory, pricing: AddonPricing): T[] {
  return addons.filter((a) => addonCategoryOf(a) === category && (pricing === 'free' ? isFreeAddon(a) : !isFreeAddon(a)));
}

/** How many of the chosen add-ons sit in each category (both Free and Paid), for the category tabs. */
export function selectedPerCategory<T extends CategorisedAddon & { productId: string }>(addons: readonly T[], selectedIds: readonly string[]): Record<AddonCategory, number> {
  const out = Object.fromEntries(ADDON_CATEGORIES.map((c) => [c, 0])) as Record<AddonCategory, number>;
  for (const a of addons) if (selectedIds.includes(a.productId)) out[addonCategoryOf(a)] += 1;
  return out;
}
