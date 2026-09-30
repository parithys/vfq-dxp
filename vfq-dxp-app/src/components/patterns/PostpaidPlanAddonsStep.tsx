import { useEffect, useRef, useState } from 'react';
import * as mockDataEngine from '../../engines/mockDataEngine';
import { Badge } from '../primitives/Badge';
import { Button } from '../primitives/Button';
import { Input } from '../primitives/Input';
import { Radio } from '../primitives/Radio';
import { AddonsPicker } from '../domain/AddonsPicker';
import { BillLimitEditor } from '../domain/BillLimitEditor';
import { Drawer } from '../primitives/Drawer';
import { Icon } from '../primitives/Icon';
import { monthlyCharges, formatQar, VAT_RATE, HRN_ADVANCE_QAR } from '../../engines/postpaidPricing';

const CHEVRON_RIGHT = 'M9 18l6-6-6-6';
const CHECK = 'M20 6L9 17l-5-5';

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
  name: string;
  type: string;
  mrcQAR: number;
}

/**
 * Discount types that require a supporting ID AND a proof document here
 * (2026-09-28 request supersedes the original "document uploaded later at
 * the CAF step" note below - the proof itself now moves to this step,
 * required before finalisation; CAF still gets a signed-paperwork upload of
 * its own, which is a different artefact). Exported so NewPostpaidWizard's
 * pendingApproval computation reads the SAME set rather than duplicating the
 * two literal strings.
 */
export const SUPPORTING_ID_DISCOUNT_TYPES = new Set(['MADA Discount', 'B2B2C Discount']);

const PROOF_DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;
const PROOF_DOCUMENT_ACCEPT = '.pdf,.jpg,.jpeg,.png';

function formatDocSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

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
  /** From eligibility - true for an HRN (High Risk Nationality) customer
   * (2026-09-28 request: "show 'Please collect QAR [configurable amount]
   * from the customer.'"). */
  requiresHrnAdvance: boolean;
  /** The proof document a MADA/B2B2C discount requires before finalisation
   * (2026-09-28) - a single file, distinct from the CAF step's own signed-
   * paperwork upload. Undefined until one is attached. */
  discountProofDocument: { fileName: string; sizeBytes: number } | undefined;
  onDiscountProofDocumentChange: (doc: { fileName: string; sizeBytes: number } | undefined) => void;
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

const PLAN_GROUPS: { key: PlanGroupKey; label: string }[] = [
  { key: 'specials', label: 'Offers' },
  { key: 'for-you', label: 'Other Plans' },
  { key: 'standard', label: 'Standard BAU Catalogue' },
];

function planGroupOf(p: { popular?: boolean; commitmentMonths?: number }): PlanGroupKey {
  if (p.popular) return 'specials';
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
type TabKey = PlanGroupKey | 'addons' | 'discounts';

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
  requiresHrnAdvance,
  discountProofDocument,
  onDiscountProofDocumentChange,
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
  const [proofDocError, setProofDocError] = useState<string | null>(null);
  const proofDocRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('specials');
  // Set once, the moment the catalogue first has something in it - not on
  // every load, which would snap the agent back to the first tab if the
  // catalogue ever refetched while they were on "Add-ons". Guards against
  // landing on an empty "Today's Special Promotions" tab when nothing in the
  // catalogue happens to be flagged popular.
  const defaultTabSet = useRef(false);

  // Name OR price. The price side matches the raw number anywhere in the
  // figure, so "35" finds 350 - narrowing as the agent types rather than
  // requiring the exact charge.
  const visiblePlans = plans.filter((p) => {
    const q = planSearch.trim().toLowerCase();
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || String(p.mrcQAR).includes(q);
  });
  // Tabs themselves are stable while the agent types a search - built from
  // the FULL catalogue, not the filtered one, so a query that empties the
  // active tab's matches doesn't also make its own tab disappear out from
  // under it. Each tab's CONTENT still reads the filtered list below.
  const planGroupTabs = PLAN_GROUPS.filter((g) => plans.some((p) => planGroupOf(p) === g.key));
  const groupPlans = (key: PlanGroupKey) => visiblePlans.filter((p) => planGroupOf(p) === key);

  useEffect(() => {
    if (defaultTabSet.current || plans.length === 0) return;
    defaultTabSet.current = true;
    const firstNonEmpty = PLAN_GROUPS.find((g) => plans.some((p) => planGroupOf(p) === g.key));
    if (firstNonEmpty) setActiveTab(firstNonEmpty.key);
  }, [plans]);

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
  // "Offers" is the specials group (2026-09-30 rule): every plan there is
  // pre-bundled, so it gets the same add-ons/discounts lockout a plan
  // individually flagged `preBundledOffer` already got - see the two panels
  // below. Derived from the group rather than a second per-plan flag: the
  // business rule is "this WHOLE TAB is pre-bundled", not "some plans in it
  // are", and planGroupOf is already the one place that decides tab
  // membership.
  const isOffersPlan = selectedPlan ? planGroupOf(selectedPlan) === 'specials' : false;
  const preBundled = Boolean(selectedPlan?.preBundledOffer) || isOffersPlan;
  const selectedDiscount = discounts.find((d) => d.addonDiscountId === discountId);
  const requiresSupportingId = selectedDiscount ? SUPPORTING_ID_DISCOUNT_TYPES.has(selectedDiscount.addonType) : false;

  // Switching to a discount that doesn't need one (or to no discount at all)
  // invalidates whatever ID and proof document were captured for a previous
  // MADA/B2B2C pick - the same "an edit invalidates a stale link" reasoning
  // CompanySearchInput and IdLookupStep apply to their own committed values.
  useEffect(() => {
    if (requiresSupportingId) return;
    if (discountSupportingId) onDiscountSupportingIdChange('');
    if (discountProofDocument) onDiscountProofDocumentChange(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discountId]);

  // Max ONE discount, and it is scoped to the plan it was picked against
  // (Discount.planId) - so a plan change retires whatever discount the
  // PREVIOUS plan had, rather than leaving a stale id in the order that no
  // longer names a discount on the current plan at all (Checkout/the order
  // payload read `discountId` directly, so an orphaned one would silently
  // ride along with the new plan). The radio group already guarantees at
  // most one discount for a GIVEN plan; this is what still guarantees it
  // across a plan switch. Keyed on the previous product id, not just "did a
  // discount exist", so it fires only on an actual plan change, not on
  // mount.
  const prevProductId = useRef(selectedProductId);
  useEffect(() => {
    if (prevProductId.current !== selectedProductId) {
      prevProductId.current = selectedProductId;
      if (discountId) onSelectDiscount(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProductId]);

  const handleProofDocFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > PROOF_DOCUMENT_MAX_BYTES) {
      setProofDocError(`${file.name} is ${formatDocSize(file.size)}. The limit is 5 MB.`);
      return;
    }
    setProofDocError(null);
    onDiscountProofDocumentChange({ fileName: file.name, sizeBytes: file.size });
    if (proofDocRef.current) proofDocRef.current.value = '';
  };

  const selectedAddons = addonProducts.filter((a) => addonIds.includes(a.productId));
  const addonsMonthlyQar = selectedAddons.reduce((sum, a) => sum + a.mrcQAR, 0);
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
      {/* HRN collection message (2026-09-28 request), shown regardless of
          which plan is chosen - it is a fact about the CUSTOMER (nationality-
          derived, per BR-112), not about the plan. The amount is the one
          centralised constant (postpaidPricing.ts) rather than a value typed
          here, so "configurable" means changing that one line, not hunting
          for every place QAR 100 appears. */}
      {requiresHrnAdvance && (
        <div className="rounded-[var(--radius-card)] border border-accent/40 bg-surface-warm p-4">
          <p className="text-fg font-medium">Please collect QAR {HRN_ADVANCE_QAR} from the customer.</p>
        </div>
      )}
      {/* Tabbed (2026-09-28 mockup, replacing the stacked layout the
          2026-09-26 asset had asked for): plan groups, Add-ons and Eligible
          Discounts are all panels of ONE tab strip now, rather than three-
          then-more sections stacked one under another. The agent still
          decides in the same order - which plan, then what to add, then what
          comes off the price - but reaches each as a tab instead of a scroll
          position. Switching tabs never changes which plan/add-ons/discount
          is actually selected; it only changes which panel is showing. */}
      <div className="space-y-4">
        <div>
          <h3 className="text-fg font-semibold text-[length:var(--fs-body-lg)]">RED Plan</h3>
          <p className="text-muted text-[length:var(--fs-caption)]">Select your plan</p>
        </div>
        {/* Search by plan NAME or PRICE (2026-09-27), narrowing whichever
            plan-group tab is active. The type-ahead dropdown added
            2026-09-28 is a separate, faster path on top of that same box:
            closest-match suggestions the agent can click straight into a
            selection without switching tabs at all. */}
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

        {plans.length === 0 ? (
          <p className="text-muted">No Postpaid Plan products in the mock catalogue.</p>
        ) : (
          <>
            {/* Tab strip - same active-tab treatment (red text + underline)
                MsisdnPicker's Free/Star/Reserved tabs already use, so the one
                tabbed control pattern in this app looks the same everywhere
                it appears. Count badges are plan-group tabs only: Add-ons and
                Eligible Discounts are single choices, not a list with a size. */}
            <div className="flex gap-1 border-b border-border-soft overflow-x-auto">
              {planGroupTabs.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-2 px-3 py-1.5 text-[length:var(--fs-body)] border-b-2 -mb-px whitespace-nowrap ${
                    activeTab === key ? 'border-accent text-accent font-medium' : 'border-transparent text-fg-2'
                  }`}
                >
                  {label}
                  <Badge variant="accent">{groupPlans(key).length}</Badge>
                </button>
              ))}
              <button
                onClick={() => setActiveTab('addons')}
                className={`px-3 py-1.5 text-[length:var(--fs-body)] border-b-2 -mb-px whitespace-nowrap ${
                  activeTab === 'addons' ? 'border-accent text-accent font-medium' : 'border-transparent text-fg-2'
                }`}
              >
                {addonIds.length > 0 ? `Add-ons (${addonIds.length} selected)` : 'Add-ons (optional)'}
              </button>
              <button
                onClick={() => setActiveTab('discounts')}
                className={`px-3 py-1.5 text-[length:var(--fs-body)] border-b-2 -mb-px whitespace-nowrap ${
                  activeTab === 'discounts' ? 'border-accent text-accent font-medium' : 'border-transparent text-fg-2'
                }`}
              >
                Eligible Discounts
              </button>
            </div>

            {/* Plan-group panel */}
            {planGroupTabs.some((g) => g.key === activeTab) && (
              <div className="space-y-3">
                {groupPlans(activeTab as PlanGroupKey).length === 0 ? (
                  <p className="text-muted text-[length:var(--fs-body)]">No plans match that search.</p>
                ) : (
                  groupPlans(activeTab as PlanGroupKey).map((p) => {
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
                            {/* Allowances and benefits side by side (2026-09-28
                                request) - one column each rather than stacked, so
                                "what it includes" and "what's free with it" read as
                                two halves of the same fact instead of one under the
                                other. Single column when there are no benefits to
                                show beside it: the table still gets the full width
                                rather than leaving an empty second column. */}
                            <div
                              className={`mt-2 grid gap-3 ${
                                p.benefits && p.benefits.length > 0 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'
                              }`}
                            >
                              {/* Allowances as a table, per the 2026-09-26 asset: a
                                  header row of labels over a row of values, with the
                                  columns ruled apart. A real table makes it navigable:
                                  each value announces with its column header rather
                                  than as a bare "30 GB". */}
                              <div className="rounded-[var(--radius-sm)] border border-border-soft overflow-hidden self-start">
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
                              {/* Free bundles/benefits (2026-09-28 request) - only
                                  rendered when the catalogue actually carries any, so a
                                  plan with none does not show an empty second column. */}
                              {p.benefits && p.benefits.length > 0 && (
                                <ul className="space-y-0.5">
                                  {p.benefits.map((b) => (
                                    <li key={b} className="flex items-start gap-1.5 text-[length:var(--fs-caption)] text-fg-2">
                                      <Icon path={CHECK} className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
                                      {b}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            {/* Pre-bundled eligible offer (2026-09-28) - stated on the
                                card itself, since choosing one skips straight to
                                Number Selection with no further chance to review
                                add-ons/discount for THIS plan. */}
                            {p.preBundledOffer && (
                              <p className="mt-2 text-[length:var(--fs-caption)] text-accent">
                                Pre-bundled offer - selecting this skips add-ons/discount and goes straight to Number Selection.
                              </p>
                            )}
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
                  })
                )}
              </div>
            )}

            {/* Add-ons panel */}
            {activeTab === 'addons' &&
              (preBundled ? (
                <div className="rounded-[var(--radius-card)] border border-[var(--warn)] bg-[color-mix(in_oklab,var(--warn),var(--bg)_92%)] px-4 py-3">
                  <p className="text-fg font-semibold text-[length:var(--fs-body)]">Add-ons unavailable for this plan</p>
                  <p className="text-[var(--warn-text)] text-[length:var(--fs-caption)] mt-1">
                    The selected plan is pre-bundled and already includes its extras, so it does not accept add-ons.
                    Choose another plan to add extras.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <AddonsPicker selectedIds={addonIds} onChange={onAddonsChange} hideHeader />
                  {/* Bill Limit, re-added 2026-09-28 as an editable add-on
                      defaulted from the selected plan's MRC - lives in this
                      same tab since it is scoped to the figure it defaults
                      from. Hidden until a plan is chosen, same as Eligible
                      Discounts, since there is no MRC to default from before
                      then. */}
                  {selectedPlan && (
                    <BillLimitEditor product="Mobile" value={billLimit ?? selectedPlan.mrcQAR} onChange={onBillLimitChange} />
                  )}
                </div>
              ))}

            {/* Eligible Discounts panel */}
            {activeTab === 'discounts' &&
              (!selectedProductId ? (
                <p className="text-muted text-[length:var(--fs-caption)]">Select a plan to see eligible discounts.</p>
              ) : preBundled ? (
                // A pre-bundled plan already comes with its own offer decided
                // - either individually flagged (PostpaidPlan.preBundledOffer)
                // or, as of 2026-09-30, simply because it lives on the Offers
                // tab (isOffersPlan). A flagged plan is reached at all only by
                // walking back to a tab the wizard's autoAdvanceWhen already
                // carried the agent past once; an Offers-tab plan without that
                // flag stays on this step normally, it just has nothing to
                // choose on this panel. Either way this explains why, rather
                // than showing a "No discount" picker with nothing behind it.
                <div className="rounded-[var(--radius-card)] border border-[var(--warn)] bg-[color-mix(in_oklab,var(--warn),var(--bg)_92%)] px-4 py-3">
                  <p className="text-fg font-semibold text-[length:var(--fs-body)]">Discounts unavailable for this plan</p>
                  <p className="text-[var(--warn-text)] text-[length:var(--fs-caption)] mt-1">
                    The selected plan is pre-bundled and already includes its offer, so it does not accept extra
                    discounts. Choose another plan to apply a discount.
                  </p>
                </div>
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
                  {/* MADA/B2B2C discounts need a supporting ID AND a proof
                      document here (2026-09-28 direction, superseding the
                      original "uploaded later at CAF" plan) - required before
                      the order can be finalised; NewPostpaidWizard routes the
                      order to pending approval regardless, per that same
                      request ("approval workflow remains pending"). */}
                  {requiresSupportingId && (
                    <div className="space-y-2">
                      <Input
                        label="Supporting ID"
                        required
                        placeholder={
                          selectedDiscount?.addonType === 'MADA Discount'
                            ? 'MADA card / reference number'
                            : 'Sponsor / employer reference ID'
                        }
                        value={discountSupportingId ?? ''}
                        onChange={(e) => onDiscountSupportingIdChange(e.target.value)}
                        helperText="Required, along with a proof document below, before this order can be finalised."
                      />
                      <div>
                        <p className="text-[length:var(--fs-label)] text-fg-2 mb-1">Proof document</p>
                        {discountProofDocument ? (
                          <div className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-border-soft bg-bg px-3 py-2">
                            <span className="min-w-0 text-[length:var(--fs-body)] text-fg truncate">
                              {discountProofDocument.fileName}
                              <span className="text-muted"> · {formatDocSize(discountProofDocument.sizeBytes)}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => onDiscountProofDocumentChange(undefined)}
                              className="shrink-0 text-[length:var(--fs-caption)] text-muted hover:text-danger underline"
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <>
                            <input
                              ref={proofDocRef}
                              type="file"
                              accept={PROOF_DOCUMENT_ACCEPT}
                              className="sr-only"
                              onChange={(e) => handleProofDocFile(e.target.files?.[0])}
                            />
                            <Button variant="ghost-rect" onClick={() => proofDocRef.current?.click()}>
                              Browse…
                            </Button>
                          </>
                        )}
                        {proofDocError && <p className="text-danger text-[length:var(--fs-caption)] mt-1">{proofDocError}</p>}
                      </div>
                    </div>
                  )}
                </div>
              ))}
          </>
        )}
      </div>

      {/* "Clearly summarise the selected plan, benefits, and add-ons"
          (2026-09-28) - descriptive, not financial: the Monthly summary table
          just below already covers the money side (plan/discount/add-ons/VAT/
          total); this covers WHAT was chosen rather than what it costs, so an
          agent reading the two together gets the full picture without either
          one trying to do the other's job. */}
      {selectedPlan && (
        <div className="rounded-[var(--radius-card)] border border-border-soft bg-surface p-4 space-y-3">
          <h4 className="text-fg font-medium text-[length:var(--fs-body)]">What's included</h4>
          <div>
            <p className="text-fg font-semibold">{selectedPlan.name}</p>
            {selectedPlan.benefits && selectedPlan.benefits.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {selectedPlan.benefits.map((b) => (
                  <li key={b} className="flex items-start gap-1.5 text-[length:var(--fs-caption)] text-fg-2">
                    <Icon path={CHECK} className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
                    {b}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="text-muted text-[length:var(--fs-caption)] uppercase tracking-wide">Add-ons</p>
            <p className="text-fg text-[length:var(--fs-body)]">
              {selectedAddons.length > 0 ? selectedAddons.map((a) => a.name).join(', ') : 'None selected - optional'}
            </p>
          </div>
        </div>
      )}

      {selectedPlan && charges && (
        // Left accent bar (2026-09-28 mockup) - the one box on this step that
        // is a running total rather than a choice to make, so it reads as a
        // callout the same way Checkout's own "Due today" panel does, not as
        // a fourth option card.
        <div className="rounded-[var(--radius-card)] border border-border-soft border-l-4 border-l-accent bg-bg p-4 flex items-start justify-between flex-wrap gap-4">
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
        {/* Benefits are a LIST, not a single label/value pair, so they sit
            below the dl rather than inside it (2026-09-28). */}
        {detailPlan?.benefits && detailPlan.benefits.length > 0 && (
          <div className="pt-3">
            <p className="text-fg-2 text-[length:var(--fs-caption)] mb-1.5">Included benefits</p>
            <ul className="space-y-1">
              {detailPlan.benefits.map((b) => (
                <li key={b} className="flex items-start gap-1.5 text-[length:var(--fs-body)] text-fg">
                  <Icon path={CHECK} className="w-4 h-4 text-success shrink-0 mt-0.5" />
                  {b}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Drawer>
    </div>
  );
}
