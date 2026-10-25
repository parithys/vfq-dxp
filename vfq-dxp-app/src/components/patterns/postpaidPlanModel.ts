export const CHECK = 'M20 6L9 17l-5-5';

// Small Levenshtein distance for typo-tolerant ranking - the app has no fuzzy-
// search dependency, and plan names are short enough that a plain O(n*m) DP
// table is cheap.
function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

// Closest-match suggestions for the type-ahead dropdown (2026-09-28): a
// prefix or substring hit ranks first (score 0/1) exactly like the list
// filter below it; anything else ranks by edit distance so a mistyped plan
// name ("Postpaid Re 550") still surfaces its nearest neighbour instead of an
// empty dropdown.
export function closestPlans<T extends { name: string }>(query: string, plans: T[], limit = 5): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return plans
    .map((p) => {
      const name = p.name.toLowerCase();
      const score = name.startsWith(q) ? 0 : name.includes(q) ? 1 : 2 + levenshtein(q, name) / Math.max(q.length, name.length);
      return { plan: p, score };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((r) => r.plan);
}

export interface PostpaidPlan {
  productId: string;
  name: string;
  type: string;
  mrcQAR: number;
  dataAllowanceGB: number | null;
  minutesAllowance: string;
  speedTier: string;
  /** Contract term. On every seeded plan; surfaced only in the details
   * drawer, since it is the one figure the cards have no room for. */
  commitmentMonths?: number;
  popular?: boolean;
  /** Listed on the Offers tab (without necessarily carrying the Popular badge). */
  offer?: boolean;
  /** False keeps a plan in the catalogue (existing orders, discounts, assets) but out of the plan picker. */
  listed?: boolean;
  /** Promotional price: `mrcQAR` is charged for `promoMonths` months, then `originalMrcQAR`. */
  originalMrcQAR?: number;
  promoMonths?: number;
  /** Plan facts to list on the card, in order, instead of the ones derived from the allowance fields. */
  features?: string[];
  /** Speed and Fair Usage Policy lines for the plan's details drawer. */
  fup?: string[];
  /** Free bundles/benefits included with the plan (2026-09-28 request) -
   * app-level demo data, no evidenced per-plan benefits field existed before
   * (see products.json's own note on these entries). */
  benefits?: string[];
  /**
   * True for a plan that already comes with its add-ons/discount decided
   * (2026-09-28 "pre-bundled eligible offers"). Selecting one auto-advances
   * past the rest of THIS step straight to Number Selection - see
   * NewPostpaidWizard's autoAdvanceWhen on the 'plan' step, which is where
   * that skip actually happens; this component only renders a note saying so.
   */
  preBundledOffer?: boolean;
}

export interface Discount {
  addonDiscountId: string;
  addonType: string;
  name: string;
  description: string;
  price: number;
  category: string;
  planId: string;
}

export interface AddonProduct {
  productId: string;
  name: string;
  type: string;
  mrcQAR: number;
}

/**
 * Discount types that require a supporting ID here, before finalisation (no proof document is collected at this step; CAF has a
 * signed-paperwork upload of its own, which is a different artefact). Exported so NewPostpaidWizard's
 * pendingApproval computation reads the SAME set rather than duplicating the
 * two literal strings.
 */
export const SUPPORTING_ID_DISCOUNT_TYPES = new Set(['MADA Discount', 'B2B2C Discount']);


/**
 * The three offer groups, renamed 2026-09-28 to "Today's Special Promotions",
 * "Offers for this QID" and "Standard BAU Catalogue" per that day's request -
 * this only relabels the three groups introduced 2026-09-27; membership is
 * still DERIVED from catalogue data, not a new hand-maintained field:
 * `popular` already exists on products.json and already drove the POPULAR
 * badge, and commitmentMonths is the only other commercial axis the catalogue
 * carries. So:
 *
 *   Today's Special Promotions - flagged `popular` in the catalogue
 *   Offers for this QID        - carries a commitment (the plans a discount attaches to)
 *   Standard BAU Catalogue     - everything else
 *
 * Deliberately derived rather than invented: no per-QID offer-eligibility
 * field exists in the corpus (eligibilityEngine.ts computes customer
 * eligibility outcomes - age, ID type, and the like - not plan-level offer
 * matching), and adding one would have meant assigning every plan to a group
 * by guesswork. If the business later supplies a real per-QID offer feed,
 * this is the one function to change.
 */
/** 'special' is the contextual Special Discount tab (MADA / Retired / B2B2C): not a catalogue group, it lists the plans that carry the customer's accepted discount. */
export type PlanGroupKey = 'specials' | 'for-you' | 'standard' | 'special';

export const PLAN_GROUPS: { key: PlanGroupKey; label: string }[] = [
  { key: 'specials', label: 'Offers' },
  { key: 'for-you', label: 'Plans' },
  { key: 'standard', label: 'Standard BAU Catalogue' },
];

/** The one name of the special-discount tab, whichever of the three types the customer holds (the type itself is not shown). */
export const SPECIAL_OFFERS_TAB_LABEL = 'Special Offers';

export const SPECIAL_DISCOUNT_TYPE: Record<'mada' | 'b2b2c' | 'retired', { addonType: string }> = {
  mada: { addonType: 'MADA Discount' },
  b2b2c: { addonType: 'B2B2C Discount' },
  retired: { addonType: 'Retired Discount' },
};

/** The addon types that are a Special Discount (MADA / B2B2C / Retired): one is held by the customer, chosen at Customer Identification. */
export const SPECIAL_DISCOUNT_ADDON_TYPES: ReadonlySet<string> = new Set(Object.values(SPECIAL_DISCOUNT_TYPE).map((t) => t.addonType));

/** The label every Special Discount card carries on the plan step: the customer's own type is not shown, only that they hold one. */
export const SPECIAL_DISCOUNT_CARD_TITLE = 'Special Discount';

/**
 * The discounts to offer once the Special Discount chosen at Customer Identification is known: of the three special types only that one
 * stays (a customer holds one), and every other discount (Loyalty, ...) is untouched. `chosen` undefined = nothing chosen / not known here:
 * the list is returned as it is.
 */
export function discountsForSpecialType<T extends { addonType: string }>(discounts: T[], chosen: keyof typeof SPECIAL_DISCOUNT_TYPE | undefined): T[] {
  if (!chosen) return discounts;
  const keep = SPECIAL_DISCOUNT_TYPE[chosen].addonType;
  return discounts.filter((d) => !SPECIAL_DISCOUNT_ADDON_TYPES.has(d.addonType) || d.addonType === keep);
}

export function planGroupOf(p: { popular?: boolean; offer?: boolean; commitmentMonths?: number }): PlanGroupKey {
  if (p.popular || p.offer) return 'specials';
  if (p.commitmentMonths) return 'for-you';
  return 'standard';
}

/**
 * A plan-group key, or one of this step's other two tabs (2026-09-28 tabbed
 * redesign - replaces the previous single stacked column of plan groups,
 * Add-ons and Eligible Discounts with one tab strip covering all of them).
 * "describe" subtitles the stacked layout used per section are gone: the
 * active tab's own label already names the section, so repeating it as a
 * second line under the tab strip would say the same thing twice.
 */
export type TabKey = PlanGroupKey | 'addons' | 'discounts';
