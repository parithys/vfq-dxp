import { EmptyState } from '../primitives/EmptyState';
import { defaultBillLimitQar } from '../../engines/postpaidPricing';
import { addonChargeNowQar } from '../../engines/addonCategories';
import { type CustomerBenefit } from '../../engines/customerBenefitEngine';
import { BillLimitEditor } from '../domain/BillLimitEditor';
import { PlanSearchBox } from './PlanSearchBox';
import type { AddonPricing } from '../../engines/addonCategories';
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
  /** Told which tab a plan was chosen from (Offers, Plans, Special Offers ...), so the journey can route by it. */
  onPlanTabChange?: (tab: string) => void;
  /** Clicking the already-selected plan card unselects it. Omit to make a chosen plan sticky. */
  onDeselectProduct?: () => void;
  discountId: string | undefined;
  onSelectDiscount: (discountId: string | undefined) => void;
  addonIds: string[];
  onAddonsChange: (ids: string[]) => void;
  /** Told where the selected plan came from (OFFER / PLAN) and what an offer bundles. */
  onSelectionChange?: (sel: { source: 'OFFER' | 'PLAN' | undefined; bundled: string[] }) => void;
  billLimit: number | undefined;
  onBillLimitChange: (value: number, pass: boolean) => void;
  /** The credit limit the bill limit may not exceed. */
  billLimitMax?: number;
  /** The Paid / Free add-on filter, owned by the step's header (see postpaidExtrasStep). */
  addonPricing?: AddonPricing;
  onAddonPricingChange?: (pricing: AddonPricing) => void;
  /** Agent 360... no - Agent 360 doesn't apply here; this is BR-076's
   * eligibility-derived default (EligibilityGateStep), shown read-only so
   * the agent sees what limit this activation was pre-qualified against. */
  /** Benefit the agent accepted on Customer Verification (office ID confirmed): the plan's matching discount is applied automatically. */
  customerBenefit?: 'mada' | 'b2b2c' | 'retired' | 'none';
  /** The Special Discount chosen on Customer Verification (accepted or not): names the contextual third tab. */
  specialDiscountType?: 'mada' | 'b2b2c' | 'retired' | 'none';
  /** Benefits the customer's record lists (see customerBenefitEngine). Only discounts they unlock are offered; undefined = customer not known, nothing is filtered. */
  customerBenefits?: CustomerBenefit[];
  /** Who the customer is, for deciding which add-ons they are eligible for. */
  customerContext?: { nationality?: string; customerType?: string; idType?: string };
  /** A plan not offered: the line's current plan, when the journey changes it. */
  hiddenProductId?: string;
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
  onPlanTabChange,
  onDeselectProduct,
  discountId,
  onSelectDiscount,
  addonIds,
  onAddonsChange,
  onSelectionChange,
  billLimit,
  onBillLimitChange,
  billLimitMax,
  addonPricing,
  onAddonPricingChange,
  customerBenefit,
  specialDiscountType,
  customerBenefits,
  customerContext,
  hiddenProductId,
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
    plansLoaded,
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
    charges,
  } = usePostpaidPlanAddons({
    selectedProductId,
    discountId,
    onSelectDiscount,
    addonIds,
    onAddonsChange,
    onSelectionChange,
    customerBenefit,
    specialDiscountType,
    customerBenefits,
    customerNationality: customerContext?.nationality,
    hiddenProductId,
  });

  // Choosing a plan also records the tab it was chosen from.
  const selectPlan = (productId: string) => {
    onSelectProduct(productId);
    onPlanTabChange?.(activeTab);
  };
  return (
    <div className="space-y-6">
      {/* The HRN advance ("Please collect QAR ... from the customer") is shown once, on Customer Verification, and not repeated here. */}
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
          plansLoaded ? <EmptyState compact message="No postpaid plans are available right now." /> : <p className="text-muted" role="status">Loading plans…</p>
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
                onSelectProduct={selectPlan}
                scopeLabel={planGroupTabs.find((g) => g.key === activeTab)?.label}
                onPickResult={(plan) => {
                  // A result is always on the tab being shown: select it, clear the filter and bring its card into view.
                  selectPlan(plan.productId);
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
                onSelectProduct={selectPlan}
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
              <section aria-label="Add-ons" className="space-y-4">
                {/* The Add-ons page shows the add-ons and the bill limit only: the plan chosen (its name, "Selected Plan", monthly price,
                    benefits and what an offer includes) is not repeated here - it is on the plan step and in the Summary. */}
                {selectionSource === 'PLAN' && (
                  <div className="space-y-3 min-w-0">
                    <PostpaidAddonsPanel
                      preBundled={preBundled}
                      addonIds={addonIds}
                      onAddonsChange={onAddonsChange}
                      selectedProductId={selectedProductId}
                      customerContext={customerContext}
                      selectedPlan={selectedPlan}
                      billLimit={billLimit}
                      onBillLimitChange={onBillLimitChange}
                      billLimitMax={billLimitMax}
                      addonPricing={addonPricing}
                      onAddonPricingChange={onAddonPricingChange}
                      hideBillLimit
                    />
                  </div>
                )}
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
                aria-label={`Eligible discounts for ${selectedPlan.name}`}
                className="border-t border-[var(--field-card-border)] pt-6"
              >
                <div className="space-y-3">
                  <h4 className="text-fg font-semibold text-[length:var(--fs-body-lg)]">
                    Eligible Discounts
                  </h4>
                  <PostpaidDiscountsPanel
                    selectedProductId={selectedProductId}
                    preBundled={preBundled}
                    discountId={discountId}
                    onSelectDiscount={onSelectDiscount}
                    discounts={discounts}
                    discountsState={discountsState}
                    onRetryDiscounts={retryDiscounts}
                  />
                </div>
              </section>
            )}
            {/* The bill limit, after the add-ons and the eligible discounts, full width under a separator and without a box: it is a spending control for the
                whole plan, not one of the add-ons. */}
            {mode === 'extras' && selectedPlan && selectionSource === 'PLAN' && !preBundled && (
              <div className="border-t border-[var(--field-card-border)] pt-6">
                <BillLimitEditor product="Mobile" layout="row" bare value={billLimit ?? defaultBillLimitQar(selectedPlan.mrcQAR, billLimitMax)} onChange={onBillLimitChange} maxLimit={billLimitMax} />
              </div>
            )}
          </>
        )}
      </div>

      {mode !== 'plan' && selectedPlan && charges && <PostpaidMonthlySummary
          charges={charges}
          selectedDiscount={selectedDiscount}
          bundledItems={bundledItems}
          addedAddons={selectionSource === 'PLAN' ? selectedAddons.map((a) => ({ name: addonChargeNowQar(a) !== a.mrcQAR ? `${a.name} (Months 1\u20133)` : a.name, mrcQAR: addonChargeNowQar(a) })) : []}
        />}

      {/* Plan details, on demand. A drawer rather than a modal: it is reference
          material read while choosing, so it slides in beside the list instead
          of covering it and forcing a dismissal to compare the next tier.
          
          Everything in it is real catalogue data. commitmentMonths in
          particular is on every seeded plan and was displayed nowhere - the
          cards show data/voice/speed only, so the contract term the customer is
          signing up to was the one figure an agent could not see. */}
      <PlanDetailsDrawer detailPlan={detailPlan} onClose={() => setDetailPlan(null)} selectedProductId={selectedProductId} onSelectProduct={selectPlan} />
    </div>
  );
}
