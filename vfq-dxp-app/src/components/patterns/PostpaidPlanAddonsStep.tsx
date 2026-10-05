import { useEffect, useMemo, useRef, useState } from 'react';
import * as mockDataEngine from '../../engines/mockDataEngine';
import { discountsForCustomer, type CustomerBenefit } from '../../engines/customerBenefitEngine';
import { Badge } from '../primitives/Badge';
import { Button } from '../primitives/Button';
import { Input } from '../primitives/Input';
import { AddonsPicker } from '../domain/AddonsPicker';
import { BillLimitEditor } from '../domain/BillLimitEditor';
import { Drawer } from '../primitives/Drawer';
import { Icon } from '../primitives/Icon';
import { CARD_HIGHLIGHT, CARD_IDLE, CARD_SELECTED, ICON_CARD, OfferArtwork, POSTPAID_PILL, STAR_ICON, planFeatureRows } from './offerCardParts';
import { monthlyCharges, formatQar, VAT_RATE, HRN_ADVANCE_QAR } from '../../engines/postpaidPricing';
import { SearchField } from '../../components/primitives/SearchField';
import { CHECK, closestPlans, SUPPORTING_ID_DISCOUNT_TYPES, PROOF_DOCUMENT_MAX_BYTES, PROOF_DOCUMENT_ACCEPT, formatDocSize, PLAN_GROUPS, planGroupOf } from './postpaidPlanModel';
import type { PostpaidPlan, Discount, AddonProduct, PlanGroupKey, TabKey } from './postpaidPlanModel';
import { DiscountCard } from './DiscountCard';


interface PostpaidPlanAddonsStepProps {
  selectedProductId: string | undefined;
  onSelectProduct: (productId: string) => void;
  /** Clicking the already-selected plan card unselects it. Omit to make a chosen plan sticky. */
  onDeselectProduct?: () => void;
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
  /** Benefit the agent accepted on Customer Identification (office ID confirmed): the plan's matching discount is applied automatically. */
  customerBenefit?: 'mada' | 'b2b2c' | 'retired' | 'none';
  /** Benefits the customer's record lists (see customerBenefitEngine). Only discounts they unlock are offered; undefined = customer not known, nothing is filtered. */
  customerBenefits?: CustomerBenefit[];
  /** Who the customer is, for deciding which add-ons they are eligible for. */
  customerContext?: { nationality?: string; customerType?: string; idType?: string };
  /** The proof document a MADA/B2B2C discount requires before finalisation
   * (2026-09-28) - a single file, distinct from the CAF step's own signed-
   * paperwork upload. Undefined until one is attached. */
  discountProofDocument: { fileName: string; sizeBytes: number } | undefined;
  onDiscountProofDocumentChange: (doc: { fileName: string; sizeBytes: number } | undefined) => void;
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
  onDeselectProduct,
  discountId,
  onSelectDiscount,
  addonIds,
  onAddonsChange,
  discountSupportingId,
  onDiscountSupportingIdChange,
  billLimit,
  onBillLimitChange,
  requiresHrnAdvance,
  customerBenefit,
  customerBenefits,
  customerContext,
  discountProofDocument,
  onDiscountProofDocumentChange,
}: PostpaidPlanAddonsStepProps) {
  const [plans, setPlans] = useState<PostpaidPlan[]>([]);
  const [addonProducts, setAddonProducts] = useState<AddonProduct[]>([]);
  const [planDiscounts, setPlanDiscounts] = useState<Discount[]>([]);
  const discounts = useMemo(
    () => discountsForCustomer(planDiscounts, customerBenefits, customerBenefit && customerBenefit !== 'none' ? customerBenefit : undefined),
    [planDiscounts, customerBenefits, customerBenefit]
  );
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
      setPlanDiscounts([]);
      return;
    }
    mockDataEngine
      .list<Discount>('addons-discounts')
      .then((all) => setPlanDiscounts(all.filter((d) => d.category === 'Discount' && d.planId === selectedProductId)));
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
  // Accepted benefit -> its discount on the chosen plan, applied once (the agent
  // can still change it afterwards). Retired: ADO-7114..7117 (demo catalogue entries, see their _note).
  const benefitType = customerBenefit === 'mada' ? 'MADA Discount' : customerBenefit === 'b2b2c' ? 'B2B2C Discount' : customerBenefit === 'retired' ? 'Retired Discount' : undefined;
  const benefitAppliedFor = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!benefitType || discountId || !selectedProductId || benefitAppliedFor.current === selectedProductId) return;
    const match = discounts.find((d) => d.addonType === benefitType);
    if (match) {
      benefitAppliedFor.current = selectedProductId; // once per plan: choosing "No discount" afterwards sticks
      onSelectDiscount(match.addonDiscountId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [benefitType, selectedProductId, discounts, discountId]);
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
          <SearchField
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {groupPlans(activeTab as PlanGroupKey).map((p) => {
                      const selected = selectedProductId === p.productId;
                      // Card per plan: name, price, bill limit, one Select button.
                      // The full allowance table, benefits and contract term live in
                      // the details drawer ("View details", which stops propagation
                      // so opening it never selects the plan), so the cards stay
                      // comparable at a glance.
                      // The limit shown is what the Bill Limit editor will start at
                      // for this plan (its MRC), or the agent's own figure once this
                      // plan is the selected one.
                      // Whole card selects; clicking it again unselects.
                      const toggle = () => (selected && onDeselectProduct ? onDeselectProduct() : onSelectProduct(p.productId));
                      const shownLimit = selected ? billLimit ?? p.mrcQAR : p.mrcQAR;
                      return (
                        <div
                          key={p.productId}
                          role="button"
                          tabIndex={0}
                          aria-pressed={selected}
                          onClick={toggle}
                          onKeyDown={(e) => {
                            if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                              e.preventDefault();
                              toggle();
                            }
                          }}
                          className={`relative flex flex-col gap-3 rounded-[var(--radius-card)] border p-5 cursor-pointer transition-colors focus:outline-none focus-visible:shadow-[var(--focus-ring)] ${
                            selected ? CARD_SELECTED : p.popular ? CARD_HIGHLIGHT : CARD_IDLE
                          }`}
                        >
                          {/* Same card as Recommended offers: the flag (hidden, not removed, when absent so
                              titles line up) on the left, the service on the right. */}
                          <div className="flex items-center justify-between gap-3">
                            <span
                              className={`inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-accent text-white px-2.5 py-0.5 text-[length:var(--fs-tag)] font-medium ${p.popular ? '' : 'invisible'}`}
                              aria-hidden={!p.popular}
                            >
                              <Icon path={STAR_ICON} className="w-3 h-3" />
                              Popular
                            </span>
                            <span className={`rounded-[var(--radius-pill)] px-2.5 py-0.5 text-[length:var(--fs-tag)] font-medium ${POSTPAID_PILL}`}>Postpaid</span>
                          </div>
                          <OfferArtwork />
                          <div className="flex-1 space-y-2">
                            <p className="text-fg font-bold text-[length:var(--fs-h5)] leading-snug pr-20">{p.name}</p>
                            <p className="text-accent pt-1">
                              <span className="text-[length:var(--fs-body)] font-semibold">QAR </span>
                              <span className="text-[length:var(--fs-h3)] font-bold">{p.mrcQAR}</span>
                              <span className="text-fg-2 text-[length:var(--fs-caption)]"> /month</span>
                            </p>
                            <ul className="space-y-1.5">
                              {[...planFeatureRows(p), { icon: ICON_CARD, text: `Bill limit: QR ${shownLimit}` }].map((f) => (
                                <li key={f.text} className="flex items-center gap-2 text-fg-2 text-[length:var(--fs-caption)]">
                                  <Icon path={f.icon} className="w-4 h-4 shrink-0 text-accent" />
                                  {f.text}
                                </li>
                              ))}
                            </ul>
                            {/* Pre-bundled eligible offer (2026-09-28) - stated on the
                                card itself, since choosing one skips straight to
                                Number Selection with no further chance to review
                                add-ons/discount for THIS plan. */}
                            {p.preBundledOffer && (
                              <p className="text-[length:var(--fs-caption)] text-accent">
                                Pre-bundled offer - selecting this skips add-ons/discount and goes straight to Number Selection.
                              </p>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-3 pt-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetailPlan(p);
                              }}
                              aria-label={`View details for ${p.name}`}
                              className="inline-flex items-center gap-1 rounded-[var(--radius-button)] text-fg hover:text-accent focus:outline-none focus-visible:shadow-[var(--focus-ring)] text-[length:var(--fs-caption)] font-medium"
                            >
                              View details
                              <Icon path="M9 18l6-6-6-6" className="w-4 h-4" />
                            </button>
                            {/* Presentational: the card is the control, so this must not take focus or fire a second toggle. */}
                            <Button variant={selected ? 'primary-rect' : 'ghost-rect'} tabIndex={-1} aria-hidden className="pointer-events-none">
                              {selected ? 'Selected' : 'Select plan'}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
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
                  <AddonsPicker
                    selectedIds={addonIds}
                    onChange={onAddonsChange}
                    hideHeader
                    eligibilityContext={{ planId: selectedProductId, ...customerContext }}
                  />
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
                  {/* Same card standard as the plan and add-on cards (shared idle / selected states, texture, tick).
                      Single choice: "No discount" is selected whenever no discount is, and clicking a selected
                      discount again clears it back to "No discount" - the same outcomes the radios gave. */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <DiscountCard
                      title="No discount"
                      description="Continue without a discount"
                      value="-"
                      selected={!discountId}
                      onToggle={() => onSelectDiscount(undefined)}
                    />
                    {discounts.map((d) => (
                      <DiscountCard
                        key={d.addonDiscountId}
                        title={d.name}
                        description={d.description}
                        value={`${Math.round(d.price * 100)}%`}
                        selected={discountId === d.addonDiscountId}
                        onToggle={() => onSelectDiscount(discountId === d.addonDiscountId ? undefined : d.addonDiscountId)}
                      />
                    ))}
                  </div>
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
                          <div className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg px-3 py-2">
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

      {selectedPlan && charges && (
        // Left accent bar (2026-09-28 mockup) - the one box on this step that
        // is a running total rather than a choice to make, so it reads as a
        // callout the same way Checkout's own "Due today" panel does, not as
        // a fourth option card.
        <div className="rounded-[var(--radius-card)] border border-[var(--field-card-border)] border-l-4 border-l-accent bg-bg p-4 flex items-start justify-between flex-wrap gap-4">
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
