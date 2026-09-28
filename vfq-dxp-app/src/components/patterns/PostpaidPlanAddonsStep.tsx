import { useEffect, useRef, useState } from 'react';
import * as mockDataEngine from '../../engines/mockDataEngine';
import { Badge } from '../primitives/Badge';
import { Input } from '../primitives/Input';
import { Radio } from '../primitives/Radio';
import { AddonsPicker } from '../domain/AddonsPicker';
import { BillLimitEditor } from '../domain/BillLimitEditor';
import { Drawer } from '../primitives/Drawer';
import { Icon } from '../primitives/Icon';
import { monthlyCharges, formatQar, VAT_RATE } from '../../engines/postpaidPricing';

const CHEVRON_RIGHT = 'M9 18l6-6-6-6';

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
function closestPlans<T extends { name: string }>(query: string, plans: T[], limit = 5): T[] {
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

interface PostpaidPlan {
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
}

interface Discount {
  addonDiscountId: string;
  addonType: string;
  name: string;
  description: string;
  price: number;
  category: string;
  planId: string;
}

interface AddonProduct {
  productId: string;
  type: string;
  mrcQAR: number;
}

/** Discount types that require a supporting ID captured here and a document
 * uploaded later at the CAF step (2026-09-28 request) - not a file upload
 * here, just the reference number the CAF attachment will be matched to. */
const SUPPORTING_ID_DISCOUNT_TYPES = new Set(['MADA Discount', 'B2B2C Discount']);

interface PostpaidPlanAddonsStepProps {
  selectedProductId: string | undefined;
  onSelectProduct: (productId: string) => void;
  discountId: string | undefined;
  onSelectDiscount: (discountId: string | undefined) => void;
  addonIds: string[];
  onAddonsChange: (ids: string[]) => void;
  discountSupportingId: string | undefined;
  onDiscountSupportingIdChange: (id: string) => void;
  billLimit: number | undefined;
  onBillLimitChange: (value: number, pass: boolean) => void;
  /** Agent 360... no - Agent 360 doesn't apply here; this is BR-076's
   * eligibility-derived default (EligibilityGateStep), shown read-only so
   * the agent sees what limit this activation was pre-qualified against. */
}

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
type PlanGroupKey = 'specials' | 'for-you' | 'standard';

const PLAN_GROUPS: { key: PlanGroupKey; label: string; describe: string }[] = [
  { key: 'specials', label: "Today's Special Promotions", describe: 'Promoted this month' },
  { key: 'for-you', label: 'Offers for this QID', describe: "Matched to this customer's QID" },
  { key: 'standard', label: 'Standard BAU Catalogue', describe: 'The full RED range' },
];

function planGroupOf(p: { popular?: boolean; commitmentMonths?: number }): PlanGroupKey {
  if (p.popular) return 'specials';
  if (p.commitmentMonths) return 'for-you';
  return 'standard';
}

// "RED Plan" & "Eligible Discounts" - Mobile Postpaid's Plan & Add-ons step
// (SCR-156, reference 12-step flow position 5). Plan tiers use the evidenced
// "Postpaid Red <price> Promotion" naming family (field-inventory.md's
// Pre-to-Post guided-journey Plan step, stage-k-remining.md) rather than
// inventing a naming scheme - the specific price/data/speed values per tier
// aren't individually evidenced beyond that naming pattern, so they're
// representative demo catalogue entries like the rest of products.json.
// Discounts read the (previously unused) "Discount" category of
// addons-discounts.json, reusing the same Loyalty Discount concept/rate
// already evidenced there (ADO-7103) rather than inventing new discount
// types this app has no evidence for.
export function PostpaidPlanAddonsStep({
  selectedProductId,
  onSelectProduct,
  discountId,
  onSelectDiscount,
  addonIds,
  onAddonsChange,
  discountSupportingId,
  onDiscountSupportingIdChange,
  billLimit,
  onBillLimitChange,
}: PostpaidPlanAddonsStepProps) {
  const [plans, setPlans] = useState<PostpaidPlan[]>([]);
  const [addonProducts, setAddonProducts] = useState<AddonProduct[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  // The plan whose details are open, or null. Holds the plan OBJECT rather
  // than an id, so the drawer cannot render a heading for one plan and
  // figures for another.
  const [detailPlan, setDetailPlan] = useState<PostpaidPlan | null>(null);
  const [planSearch, setPlanSearch] = useState('');
  // Type-ahead suggestions dropdown (2026-09-28), separate from the substring
  // filter below - see CompanySearchInput.tsx for the same combobox shape
  // (click-outside close, listbox/option roles).
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Name OR price. The price side matches the raw number anywhere in the
  // figure, so "35" finds 350 - narrowing as the agent types rather than
  // requiring the exact charge.
  const visiblePlans = plans.filter((p) => {
    const q = planSearch.trim().toLowerCase();
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || String(p.mrcQAR).includes(q);
  });

  const suggestions = closestPlans(planSearch, plans);

  useEffect(() => {
    if (!searchOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [searchOpen]);

  useEffect(() => {
    mockDataEngine.list<PostpaidPlan & AddonProduct>('products').then((all) => {
      setPlans(all.filter((p) => p.type === 'Postpaid Plan').sort((a, b) => a.mrcQAR - b.mrcQAR));
      setAddonProducts(all.filter((p) => p.type === 'Add-on'));
    });
  }, []);

  useEffect(() => {
    if (!selectedProductId) {
      setDiscounts([]);
      return;
    }
    mockDataEngine
      .list<Discount>('addons-discounts')
      .then((all) => setDiscounts(all.filter((d) => d.category === 'Discount' && d.planId === selectedProductId)));
  }, [selectedProductId]);

  const selectedPlan = plans.find((p) => p.productId === selectedProductId);
  const selectedDiscount = discounts.find((d) => d.addonDiscountId === discountId);
  const requiresSupportingId = selectedDiscount ? SUPPORTING_ID_DISCOUNT_TYPES.has(selectedDiscount.addonType) : false;

  // Switching to a discount that doesn't need one (or to no discount at all)
  // invalidates whatever ID was captured for a previous MADA/B2B2C pick - the
  // same "an edit invalidates a stale link" reasoning CompanySearchInput and
  // IdLookupStep apply to their own committed values.
  useEffect(() => {
    if (!requiresSupportingId && discountSupportingId) onDiscountSupportingIdChange('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discountId]);

  const addonsMonthlyQar = addonProducts.filter((a) => addonIds.includes(a.productId)).reduce((sum, a) => sum + a.mrcQAR, 0);
  // One itemisation, shared with Checkout and with the order payload - see
  // engines/postpaidPricing.ts for why that is a module and not three copies.
  // No device instalment here: this step has not reached Device & DOI yet, so
  // the figure it shows is the service subtotal, and Checkout adds the
  // instalment once there is one.
  const charges = selectedPlan
    ? monthlyCharges({
        planQar: selectedPlan.mrcQAR,
        discountRate: selectedDiscount?.price,
        addonsQar: addonsMonthlyQar,
      })
    : undefined;

  return (
    <div className="space-y-6">
      {/* One column, three sections in order: plan, add-ons, discounts
          (2026-09-26). This was a two-column grid with the plan tiers on the
          left and discounts + add-ons on the right, held in alignment by a
          subgrid so both headers shared a row. Stacking makes that machinery
          unnecessary - there is no second column left to align to - so it is
          gone rather than left in place doing nothing.
          
          The order is the order the agent decides in: which plan, then what to
          add to it, then what comes off the price. Discounts last because a
          discount applies to the total the first two produce. */}
      <div className="space-y-6">
        {/* 1. Plan tiers */}
        <div className="space-y-4">
          <div>
            <h3 className="text-fg font-semibold text-[length:var(--fs-body-lg)]">RED Plan</h3>
            <p className="text-muted text-[length:var(--fs-caption)]">Select your plan</p>
          </div>
          {/* Search by plan NAME or PRICE (2026-09-27), narrowing the grouped
              list below as the agent types. The type-ahead dropdown added
              2026-09-28 is a separate, faster path on top of that same box:
              closest-match suggestions the agent can click straight into a
              selection without scanning the grouped list at all - useful once
              typos or partial names stop substring-matching anything. */}
          <div ref={searchRef} className="relative">
            <Input
              aria-label="Search plans by name or price"
              role="combobox"
              aria-expanded={searchOpen}
              aria-controls="plan-search-listbox"
              autoComplete="off"
              placeholder="Search plans by name or price"
              value={planSearch}
              onChange={(e) => {
                setPlanSearch(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
            />
            {searchOpen && planSearch.trim() && (
              <ul
                id="plan-search-listbox"
                role="listbox"
                aria-label="Plan suggestions"
                className="absolute z-50 top-full left-0 right-0 mt-1 max-h-72 overflow-y-auto rounded-[var(--field-radius)] border border-border-soft bg-bg shadow-raised py-1 divide-y divide-[var(--field-divider)]"
              >
                {suggestions.map((p) => (
                  <li
                    key={p.productId}
                    role="option"
                    aria-selected={selectedProductId === p.productId}
                    onClick={() => {
                      onSelectProduct(p.productId);
                      setPlanSearch(p.name);
                      setSearchOpen(false);
                    }}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 cursor-pointer hover:bg-surface"
                  >
                    <span className="text-fg text-[length:var(--fs-body)] truncate">{p.name}</span>
                    <span className="text-muted text-[length:var(--fs-caption)] shrink-0">QAR {p.mrcQAR}/mo</span>
                  </li>
                ))}
                {suggestions.length === 0 && (
                  <li className="px-4 py-2.5 text-muted text-[length:var(--fs-caption)]">No matching plans.</li>
                )}
              </ul>
            )}
          </div>
          {visiblePlans.length === 0 && (
            <p className="text-muted text-[length:var(--fs-body)]">No plans match that search.</p>
          )}
          {PLAN_GROUPS.map(({ key, label, describe }) => {
            const group = visiblePlans.filter((p) => planGroupOf(p) === key);
            if (group.length === 0) return null;
            return (
              <div key={key} className="space-y-3">
                <div>
                  <h4 className="text-fg font-medium text-[length:var(--fs-body)]">{label}</h4>
                  <p className="text-muted text-[length:var(--fs-caption)]">{describe}</p>
                </div>
                <div className="space-y-3">
            {group.map((p) => {
              const selected = selectedProductId === p.productId;
              return (
                // The row is a DIV wrapping a label and a button, not one big
                // label. A <button> inside a <label> is still part of that
                // label's activation target, so the details chevron would have
                // selected the plan on its way to opening the drawer - the
                // agent asks "what is in this?" and the app answers by
                // choosing it for them. Splitting them keeps the whole card
                // clickable for selection while the chevron does only its own
                // job.
                <div
                  key={p.productId}
                  className={`flex items-start gap-3 rounded-[var(--radius-card)] border p-4 ${
                    selected ? 'border-[var(--field-card-selected)] bg-[var(--field-card-selected-bg)]' : 'border-border-soft hover:border-[var(--field-card-selected)]'
                  }`}
                >
                  <label className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer">
                  <Radio
                    name="postpaid-plan"
                    className="mt-1"
                    checked={selected}
                    onChange={() => onSelectProduct(p.productId)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 min-w-0">
                        {/* font-bold, not font-medium: the plan name is the
                            thing being chosen between, so it should carry the
                            same weight as the price beside it rather than
                            read lighter than it. */}
                        <span className="text-fg font-bold truncate">{p.name}</span>
                        {p.popular && <Badge variant="accent">POPULAR</Badge>}
                      </span>
                      <span className="text-fg font-semibold shrink-0">QAR {p.mrcQAR}/mo</span>
                    </div>
                    {/* Allowances as a table, per the 2026-09-26 asset: a
                        header row of labels over a row of values, with the
                        columns ruled apart. It was three loose divs in a
                        grid, each stacking its own label over its own value -
                        the same information, but with nothing tying "Data" to
                        the figure under it except proximity, and no cue that
                        the three are one set being compared across plans.
                        
                        A real table also makes it navigable: each value
                        announces with its column header rather than as a bare
                        "30 GB". Borders use the app's own --border-soft rather
                        than the asset's full grid, which is a spreadsheet's
                        chrome.

                        BORDERED ON ALL FOUR SIDES as of 2026-09-26, per the
                        asset - it previously bordered only between rows/
                        columns, open on its own perimeter. The outer border
                        lives on the wrapping div rather than the <table>
                        itself: a border on <table> draws outside its cells'
                        padding, so the header text would sit flush against
                        it, which is why the wrapper also carries the padding
                        this is now bordered enough to need. overflow-hidden
                        clips the header's bottom rule to the wrapper's
                        rounded corners instead of the rule poking past them
                        square. */}
                    <div className="mt-2 rounded-[var(--radius-sm)] border border-border-soft overflow-hidden">
                      <table className="w-full text-[length:var(--fs-caption)] table-fixed">
                        <thead>
                          <tr className="border-b border-border-soft">
                            {['Data', 'Voice', 'Speed'].map((h, i) => (
                              <th
                                key={h}
                                scope="col"
                                className={`text-muted uppercase tracking-wide font-normal text-left px-3 py-1.5 ${
                                  i > 0 ? 'border-l border-border-soft' : ''
                                }`}
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            {[
                              p.dataAllowanceGB ? `${p.dataAllowanceGB} GB` : 'Unlimited',
                              p.minutesAllowance,
                              p.speedTier,
                            ].map((v, i) => (
                              <td
                                key={v}
                                className={`text-fg px-3 py-1.5 ${i > 0 ? 'border-l border-border-soft' : ''}`}
                              >
                                {v}
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  </label>
                  <button
                    type="button"
                    onClick={() => setDetailPlan(p)}
                    aria-label={`View details for ${p.name}`}
                    className="shrink-0 -mr-1 mt-0.5 p-1.5 rounded-[var(--radius-button)] text-muted
                      hover:text-fg hover:bg-surface
                      focus:outline-none focus-visible:shadow-[var(--field-focus-ring)]"
                  >
                    <Icon path={CHEVRON_RIGHT} className="w-5 h-5" />
                  </button>
                </div>
              );
            })}
                </div>
              </div>
            );
          })}
          {plans.length === 0 && <p className="text-muted">No Postpaid Plan products in the mock catalogue.</p>}
        </div>

        {/* 2. Add-ons, between plan and discounts. It used to sit UNDER the
            discounts in the right-hand column, i.e. after the thing it is
            priced into. AddonsPicker renders its own "Add-ons (optional)"
            heading. */}
        <AddonsPicker selectedIds={addonIds} onChange={onAddonsChange} />

        {/* 2b. Bill Limit, re-added 2026-09-28 as an editable add-on
            defaulted from the selected plan's MRC. It was removed from this
            step entirely on 2026-09-25 when the Billing step it lived beside
            went away (see NewPostpaidWizard's note on that removal) - this
            does not restore the Billing step, just gives the agent back a
            way to cap the line's monthly charge, now scoped to Plan &
            Add-ons where the figure it defaults from lives. Hidden until a
            plan is chosen, same as Eligible Discounts below it, since there
            is no MRC to default from before then. */}
        {selectedPlan && (
          <BillLimitEditor product="Mobile" value={billLimit ?? selectedPlan.mrcQAR} onChange={onBillLimitChange} />
        )}

        {/* 3. Discounts last: a discount comes off the total the plan and
            add-ons above it produce. */}
        <div className="space-y-4">
          <div>
            <h3 className="text-fg font-semibold text-[length:var(--fs-body-lg)]">Eligible Discounts</h3>
          </div>
          <div className="space-y-4">
            {!selectedProductId ? (
              <p className="text-muted text-[length:var(--fs-caption)]">Select a plan to see eligible discounts.</p>
            ) : (
              <div className="space-y-2">
                <label
                  className={`flex items-center justify-between gap-2 rounded-[var(--radius-card)] border p-3 cursor-pointer ${
                    !discountId ? 'border-[var(--field-card-selected)] bg-[var(--field-card-selected-bg)]' : 'border-border-soft hover:border-[var(--field-card-selected)]'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Radio name="postpaid-discount" checked={!discountId} onChange={() => onSelectDiscount(undefined)} />
                    <span>
                      <span className="text-fg">No discount</span>
                      <span className="block text-[length:var(--fs-caption)] text-muted">Continue without a discount</span>
                    </span>
                  </span>
                  <span className="text-muted">-</span>
                </label>
                {discounts.map((d) => (
                  <label
                    key={d.addonDiscountId}
                    className={`flex items-center justify-between gap-2 rounded-[var(--radius-card)] border p-3 cursor-pointer ${
                      discountId === d.addonDiscountId ? 'border-[var(--field-card-selected)] bg-[var(--field-card-selected-bg)]' : 'border-border-soft hover:border-[var(--field-card-selected)]'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Radio
                        name="postpaid-discount"
                        checked={discountId === d.addonDiscountId}
                        onChange={() => onSelectDiscount(d.addonDiscountId)}
                      />
                      <span>
                        <span className="text-fg">{d.name}</span>
                        <span className="block text-[length:var(--fs-caption)] text-muted">{d.description}</span>
                      </span>
                    </span>
                    <span className="text-success font-medium shrink-0">{Math.round(d.price * 100)}%</span>
                  </label>
                ))}
                {discounts.length === 0 && (
                  <p className="text-muted text-[length:var(--fs-caption)]">No discounts configured for this plan.</p>
                )}
                {/* MADA/B2B2C discounts need a supporting ID captured here
                    (2026-09-28 request) - the ID this discount will be
                    matched against, not the document itself. The document
                    photo/scan is uploaded later at the CAF step, same as
                    every other identity attachment in this app; this field
                    exists so that later step has something to attach it to. */}
                {requiresSupportingId && (
                  <Input
                    label="Supporting ID"
                    placeholder={
                      selectedDiscount?.addonType === 'MADA Discount'
                        ? 'MADA card / reference number'
                        : 'Sponsor / employer reference ID'
                    }
                    value={discountSupportingId ?? ''}
                    onChange={(e) => onDiscountSupportingIdChange(e.target.value)}
                    helperText="The supporting document is uploaded later, at the CAF step."
                  />
                )}
            </div>
          )}
          </div>
        </div>
      </div>

      {selectedPlan && charges && (
        <div className="rounded-[var(--radius-card)] border border-border-soft bg-bg p-4 flex items-start justify-between flex-wrap gap-4">
          {/* Left: an itemised breakdown under a label, per the 2026-09-26
              asset. Was one run-on caption line - "Live Cart Total · Base plan
              QAR 500/mo · Loyalty Discount (-15%) · Add-ons QAR 50/mo" - where
              the middot-joined items ran together as prose and the label sat
              inline with the first of them. A stacked label over one line per
              charge reads as a summary; the label also drops "Live Cart Total",
              which described the widget rather than its contents. */}
          {/* A two-column table, per the 2026-09-26 asset. These were inline
              "label value" sentences, so each amount started wherever its own
              label happened to end - QAR 750, -15% and QAR 50 at three
              different x positions, which is the one thing a column of figures
              must not do. A real <table> rather than stacked divs: it IS
              tabular, and scope="row" makes each amount announce with the
              charge it belongs to instead of as a loose number.
              
              Width is fixed rather than fitted to content so the right column
              does not move as the rows change - adding an add-on or a discount
              would otherwise re-align every amount above it. */}
          <table className="w-[17rem] text-[length:var(--fs-caption)]">
            <caption className="text-fg-2 text-[length:var(--fs-caption)] font-semibold uppercase tracking-wide text-left pb-1">
              Monthly summary
            </caption>
            <tbody className="divide-y divide-border-soft">
              {[
                ['Plan', formatQar(charges.planQar)],
                // The RATE moves into the label and the AMOUNT into the value,
                // so the value column is money throughout and therefore adds
                // up. It read "-15%", which told the agent the rate but left
                // them to work out what it was worth against a 750 plan - and
                // put a percentage in a column of currency.
                ...(selectedDiscount
                  ? [
                      [
                        `${selectedDiscount.name} (${Math.round(Math.abs(selectedDiscount.price) * 100)}%)`,
                        `-${formatQar(charges.discountQar)}`,
                      ],
                    ]
                  : []),
                ...(charges.addonsQar > 0 ? [['Add-ons', formatQar(charges.addonsQar)]] : []),
                // VAT last and always shown, even at zero: a tax line that
                // appears only sometimes reads as a surcharge the agent has
                // triggered. It is charged on the net of everything above it,
                // which is why it cannot simply be a footnote on the total.
                [`VAT (${Math.round(VAT_RATE * 100)}%)`, formatQar(charges.vatQar)],
              ].map(([label, value]) => (
                <tr key={label}>
                  <th scope="row" className="text-fg-2 font-normal text-left py-1.5 pr-4">
                    {label}
                  </th>
                  <td className="text-fg font-medium text-right py-1.5">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Right: label above the figure, not beside it, per the asset - and
              "/mo" set small against the amount so the number carries the
              weight rather than the unit. text-right so the stack aligns to
              the card's edge instead of to its own longest line. */}
          <div className="text-right">
            <p className="text-fg-2 text-[length:var(--fs-caption)]">Total monthly</p>
            <p className="text-accent font-bold text-[length:var(--fs-h3)] leading-tight">
              {formatQar(charges.totalQar)}
              <span className="text-[length:var(--fs-caption)] font-bold">/mo</span>
            </p>
          </div>
        </div>
      )}

      {/* Plan details, on demand. A drawer rather than a modal: it is reference
          material read while choosing, so it slides in beside the list instead
          of covering it and forcing a dismissal to compare the next tier.
          
          Everything in it is real catalogue data. commitmentMonths in
          particular is on every seeded plan and was displayed nowhere - the
          cards show data/voice/speed only, so the contract term the customer is
          signing up to was the one figure an agent could not see. */}
      <Drawer
        open={detailPlan !== null}
        onClose={() => setDetailPlan(null)}
        title={detailPlan?.name ?? 'Plan details'}
      >
        {detailPlan && (
          <dl className="divide-y divide-border-soft">
            {[
              ['Monthly charge', `QAR ${detailPlan.mrcQAR}/mo`],
              ['Data', detailPlan.dataAllowanceGB ? `${detailPlan.dataAllowanceGB} GB` : 'Unlimited'],
              ['Voice', detailPlan.minutesAllowance],
              ['Speed', detailPlan.speedTier],
              [
                'Commitment',
                detailPlan.commitmentMonths ? `${detailPlan.commitmentMonths} months` : 'No commitment',
              ],
              ['Product code', detailPlan.productId],
            ].map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-4 py-3">
                <dt className="text-fg-2 text-[length:var(--fs-caption)]">{label}</dt>
                <dd className="text-fg font-medium text-right">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </Drawer>
    </div>
  );
}
