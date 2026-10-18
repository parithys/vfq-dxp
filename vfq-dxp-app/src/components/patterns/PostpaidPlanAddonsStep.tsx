import { type CustomerBenefit } from '../../engines/customerBenefitEngine';
import { HRN_ADVANCE_QAR } from '../../engines/postpaidPricing';
import { Icon } from '../primitives/Icon';
import { CHECK } from './postpaidPlanModel';
import { PlanSearchBox } from './PlanSearchBox';
import { PlanTabStrip } from './PlanTabStrip';
import { PlanGroupPanel } from './PlanGroupPanel';
import { PostpaidAddonsPanel } from './PostpaidAddonsPanel';
import { PostpaidDiscountsPanel } from './PostpaidDiscountsPanel';
import { PostpaidMonthlySummary } from './PostpaidMonthlySummary';
import { PlanDetailsDrawer } from './PlanDetailsDrawer';
import { usePostpaidPlanAddons } from './usePostpaidPlanAddons';


interface PostpaidPlanAddonsStepProps {
  /** 'plan': choose the plan only. 'extras': the chosen plan's add-ons, bill limit, discounts and monthly summary. Default 'all' (both together). */
  mode?: 'all' | 'plan' | 'extras';
  selectedProductId: string | undefined;
  onSelectProduct: (productId: string) => void;
  /** Clicking the already-selected plan card unselects it. Omit to make a chosen plan sticky. */
  onDeselectProduct?: () => void;
  discountId: string | undefined;
  onSelectDiscount: (discountId: string | undefined) => void;
  addonIds: string[];
  onAddonsChange: (ids: string[]) => void;
  /** Told where the selected plan came from (OFFER / PLAN) and what an offer bundles. */
  onSelectionChange?: (sel: { source: 'OFFER' | 'PLAN' | undefined; bundled: string[] }) => void;
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
  /** The Special Discount chosen on Customer Identification (accepted or not): names the contextual third tab. */
  specialDiscountType?: 'mada' | 'b2b2c' | 'retired';
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
  mode = 'all',
  selectedProductId,
  onSelectProduct,
  onDeselectProduct,
  discountId,
  onSelectDiscount,
  addonIds,
  onAddonsChange,
  onSelectionChange,
  discountSupportingId,
  onDiscountSupportingIdChange,
  billLimit,
  onBillLimitChange,
  requiresHrnAdvance,
  customerBenefit,
  specialDiscountType,
  customerBenefits,
  customerContext,
  discountProofDocument,
  onDiscountProofDocumentChange,
}: PostpaidPlanAddonsStepProps) {
  const {
    plans,
    discounts,
    detailPlan,
    setDetailPlan,
    planSearch,
    setPlanSearch,
    searchOpen,
    setSearchOpen,
    searchRef,
    proofDocError,
    proofDocRef,
    activeTab,
    setActiveTab,
    planGroupTabs,
    groupPlans,
    suggestions,
    selectedPlan,
    preBundled,
    selectionSource,
    bundledItems,
    selectedAddons,
    resetNotice,
    discountsState,
    retryDiscounts,
    selectedDiscount,
    requiresSupportingId,
    handleProofDocFile,
    charges,
  } = usePostpaidPlanAddons({
    selectedProductId,
    discountId,
    onSelectDiscount,
    addonIds,
    onAddonsChange,
    onSelectionChange,
    discountSupportingId,
    onDiscountSupportingIdChange,
    customerBenefit,
    specialDiscountType,
    customerBenefits,
    discountProofDocument,
    onDiscountProofDocumentChange,
  });

  return (
    <div className="space-y-6">
      {/* HRN collection message (2026-09-28 request), shown regardless of
          which plan is chosen - it is a fact about the CUSTOMER (nationality-
          derived, per BR-112), not about the plan. The amount is the one
          centralised constant (postpaidPricing.ts) rather than a value typed
          here, so "configurable" means changing that one line, not hunting
          for every place QAR 100 appears. */}
      {requiresHrnAdvance && (
        <div className="rounded-[var(--radius-card)] border border-accent-border bg-surface-warm p-4">
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
        {mode !== 'extras' && plans.length === 0 ? (
          <p className="text-muted">No Postpaid Plan products are available right now.</p>
        ) : (
          <>
            {/* Tab strip - same active-tab treatment (red text + underline)
                MsisdnPicker's Free/Star/Reserved tabs already use, so the one
                tabbed control pattern in this app looks the same everywhere
                it appears. Count badges are plan-group tabs only: Add-ons and
                Eligible Discounts are single choices, not a list with a size. */}
            {mode !== 'extras' && (
              <>
            <PlanTabStrip
              planGroupTabs={planGroupTabs}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            />

            {/* Search by plan NAME or PRICE (2026-09-27), under the tabs and scoped to whichever plan-group tab is
                active: it narrows that tab's cards, and the type-ahead dropdown added 2026-09-28 suggests that tab's
                plans only (closest match, one click to select). */}
            <PlanSearchBox
                searchRef={searchRef}
                searchOpen={searchOpen}
                setSearchOpen={setSearchOpen}
                planSearch={planSearch}
                setPlanSearch={setPlanSearch}
                suggestions={suggestions}
                selectedProductId={selectedProductId}
                onSelectProduct={onSelectProduct}
                scopeLabel={planGroupTabs.find((g) => g.key === activeTab)?.label}
                onPickResult={(plan) => {
                  // A result is always on the tab being shown: select it, clear the filter and bring its card into view.
                  onSelectProduct(plan.productId);
                  setPlanSearch('');
                  setSearchOpen(false);
                  window.setTimeout(() => {
                    const el = document.getElementById(`plan-card-${plan.productId}`);
                    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el?.classList.add('ring-4', 'ring-accent-border');
                    window.setTimeout(() => el?.classList.remove('ring-4', 'ring-accent-border'), 1800);
                  }, 80);
                }}
              />

            {/* The plan was changed: what was chosen for the previous plan is gone. */}
            {resetNotice && (
              <p role="status" className="rounded-[var(--radius-card)] border border-[var(--info-border)] bg-tone-info-soft px-4 py-3 text-[length:var(--fs-body)] text-fg">
                Add-ons and discounts were reset for the new plan.
              </p>
            )}

            {/* Plan-group panel */}
            {planGroupTabs.some((g) => g.key === activeTab) && (
              <PlanGroupPanel
                groupPlans={groupPlans}
                activeTab={activeTab}
                selectedProductId={selectedProductId}
                billLimit={billLimit}
                onSelectProduct={onSelectProduct}
                onDeselectProduct={onDeselectProduct}
                setDetailPlan={setDetailPlan}
              />
            )}

            {/* An offer bundles its extras: shown read-only, never selectable. */}

              </>
            )}

            {/* The selected plan's own add-ons and discounts, directly below the plans: only this plan's, optional,
                and reset when another plan is chosen. Every other plan stays a plain card. */}
            {/* The plan carried over from the previous step, for context while choosing extras. */}
            {mode === 'extras' && selectedPlan && (
              <section aria-label="Selected plan" className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 space-y-2">
                    <span className="inline-flex rounded-[var(--radius-pill)] bg-[var(--tint-pink-bg)] px-2.5 py-0.5 text-[var(--tint-pink-fg)] text-[length:var(--fs-tag)] font-semibold uppercase tracking-wide">
                      Selected plan
                    </span>
                    <h3 className="text-fg font-bold text-[length:var(--fs-h4)] leading-snug">{selectedPlan.name}</h3>
                  </div>
                  <div className="card px-4 py-2.5 text-right shadow-[var(--shadow-icon-tile)]">
                    <p className="text-muted text-[length:var(--fs-tag)] font-semibold uppercase tracking-wide">Monthly plan</p>
                    <p className="text-fg">
                      <span className="text-[length:var(--fs-body)]">QAR </span>
                      <span className="text-[length:var(--fs-h3)] font-bold">{selectedPlan.mrcQAR}</span>
                      <span className="text-fg-2 text-[length:var(--fs-caption)]"> /month{selectedPlan.promoMonths ? ` for ${selectedPlan.promoMonths} months` : ''}</span>
                    </p>
                  </div>
                </div>
                {/* Plain bullet lists, no boxes: the plan's benefits and what the offer includes, side by side in one row. */}
                {(() => {
                  const benefits = (selectedPlan.features?.length
                    ? selectedPlan.features
                    : [selectedPlan.dataAllowanceGB ? `${selectedPlan.dataAllowanceGB} GB data` : 'Unlimited data', selectedPlan.minutesAllowance].filter(Boolean)
                  ) as string[];
                  const included = selectedPlan.benefits ?? [];
                  const columns: { title: string; items: string[] }[] = [
                    { title: 'Benefits', items: benefits },
                    ...(included.length > 0 ? [{ title: 'Included in this offer', items: included }] : []),
                  ];
                  return (
                    <div className={`grid grid-cols-1 gap-x-8 gap-y-5 ${columns.length > 1 ? 'sm:grid-cols-2' : ''}`}>
                      {columns.map((c) => (
                        <div key={c.title} className="space-y-2.5">
                          <p className="text-accent font-bold text-[length:var(--fs-caption)] uppercase tracking-wide">{c.title}</p>
                          <ul className="space-y-2">
                            {c.items.map((f) => (
                              <li key={f} className="flex items-start gap-2.5 text-fg text-[length:var(--fs-body)]">
                                <Icon path={CHECK} className="w-4 h-4 shrink-0 text-accent mt-1" />
                                {f}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </section>
            )}
            {mode === 'extras' && !selectedPlan && (
              <p className="text-muted text-[length:var(--fs-body)]">Select a plan first - its add-ons, bill limit and discounts appear here.</p>
            )}
            {mode === 'extras' && selectionSource === 'OFFER' && (
              <p className="rounded-[var(--radius-card)] border border-border-soft bg-surface px-4 py-3 text-fg-2 text-[length:var(--fs-body)]">
                This plan is an offer: its add-ons and discounts are bundled, so there is nothing to choose here. Continue to review the monthly summary.
              </p>
            )}
            {mode !== 'plan' && selectionSource === 'PLAN' && selectedPlan && (
              <section
                aria-label={`Add-ons and discounts for ${selectedPlan.name}`}
                className="rounded-[var(--radius-card-lg)] border border-[var(--field-card-border)] bg-bg p-5 space-y-5"
              >
                <header>
                  <p className="text-muted text-[length:var(--fs-tag)] font-semibold uppercase tracking-wide">Optional services</p>
                  <h3 className="text-fg font-bold text-[length:var(--fs-h5)]">Add-ons and discounts</h3>
                  <p className="text-fg-2 text-[length:var(--fs-caption)]">Select any additional services required for this connection.</p>
                </header>
                <PostpaidAddonsPanel
                  preBundled={preBundled}
                  addonIds={addonIds}
                  onAddonsChange={onAddonsChange}
                  selectedProductId={selectedProductId}
                  customerContext={customerContext}
                  selectedPlan={selectedPlan}
                  billLimit={billLimit}
                  onBillLimitChange={onBillLimitChange}
                />
                <div className="space-y-3">
                  <h4 className="text-fg font-semibold text-[length:var(--fs-body)]">
                    Eligible discounts <span className="text-muted font-normal">(optional)</span>
                  </h4>
                  <PostpaidDiscountsPanel
                    selectedProductId={selectedProductId}
                    preBundled={preBundled}
                    discountId={discountId}
                    onSelectDiscount={onSelectDiscount}
                    discounts={discounts}
                    selectedDiscount={selectedDiscount}
                    requiresSupportingId={requiresSupportingId}
                    discountSupportingId={discountSupportingId}
                    onDiscountSupportingIdChange={onDiscountSupportingIdChange}
                    discountProofDocument={discountProofDocument}
                    onDiscountProofDocumentChange={onDiscountProofDocumentChange}
                    proofDocRef={proofDocRef}
                    proofDocError={proofDocError}
                    handleProofDocFile={handleProofDocFile}
                    discountsState={discountsState}
                    onRetryDiscounts={retryDiscounts}
                  />
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {mode !== 'plan' && selectedPlan && charges && <PostpaidMonthlySummary
          charges={charges}
          selectedDiscount={selectedDiscount}
          bundledItems={bundledItems}
          addedAddons={selectionSource === 'PLAN' ? selectedAddons.map((a) => ({ name: a.name, mrcQAR: a.mrcQAR })) : []}
        />}

      {/* Plan details, on demand. A drawer rather than a modal: it is reference
          material read while choosing, so it slides in beside the list instead
          of covering it and forcing a dismissal to compare the next tier.
          
          Everything in it is real catalogue data. commitmentMonths in
          particular is on every seeded plan and was displayed nowhere - the
          cards show data/voice/speed only, so the contract term the customer is
          signing up to was the one figure an agent could not see. */}
      <PlanDetailsDrawer detailPlan={detailPlan} onClose={() => setDetailPlan(null)} selectedProductId={selectedProductId} onSelectProduct={onSelectProduct} />
    </div>
  );
}
