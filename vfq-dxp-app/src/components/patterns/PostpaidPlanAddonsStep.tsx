import { type CustomerBenefit } from '../../engines/customerBenefitEngine';
import { HRN_ADVANCE_QAR } from '../../engines/postpaidPricing';
import { PlanSearchBox } from './PlanSearchBox';
import { PlanTabStrip } from './PlanTabStrip';
import { PlanGroupPanel } from './PlanGroupPanel';
import { PostpaidAddonsPanel } from './PostpaidAddonsPanel';
import { PostpaidDiscountsPanel } from './PostpaidDiscountsPanel';
import { PostpaidMonthlySummary } from './PostpaidMonthlySummary';
import { PlanDetailsDrawer } from './PlanDetailsDrawer';
import { usePostpaidPlanAddons } from './usePostpaidPlanAddons';


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
    selectedDiscount,
    requiresSupportingId,
    handleProofDocFile,
    charges,
  } = usePostpaidPlanAddons({
    selectedProductId,
    discountId,
    onSelectDiscount,
    addonIds,
    discountSupportingId,
    onDiscountSupportingIdChange,
    customerBenefit,
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
        <PlanSearchBox
          searchRef={searchRef}
          searchOpen={searchOpen}
          setSearchOpen={setSearchOpen}
          planSearch={planSearch}
          setPlanSearch={setPlanSearch}
          suggestions={suggestions}
          selectedProductId={selectedProductId}
          onSelectProduct={onSelectProduct}
        />

        {plans.length === 0 ? (
          <p className="text-muted">No Postpaid Plan products in the mock catalogue.</p>
        ) : (
          <>
            {/* Tab strip - same active-tab treatment (red text + underline)
                MsisdnPicker's Free/Star/Reserved tabs already use, so the one
                tabbed control pattern in this app looks the same everywhere
                it appears. Count badges are plan-group tabs only: Add-ons and
                Eligible Discounts are single choices, not a list with a size. */}
            <PlanTabStrip
              planGroupTabs={planGroupTabs}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              groupPlans={groupPlans}
              addonIds={addonIds}
            />

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

            {/* Add-ons panel */}
            {activeTab === 'addons' && (
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
            )}

            {/* Eligible Discounts panel */}
            {activeTab === 'discounts' && (
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
              />
            )}
          </>
        )}
      </div>

      {selectedPlan && charges && <PostpaidMonthlySummary charges={charges} selectedDiscount={selectedDiscount} />}

      {/* Plan details, on demand. A drawer rather than a modal: it is reference
          material read while choosing, so it slides in beside the list instead
          of covering it and forcing a dismissal to compare the next tier.
          
          Everything in it is real catalogue data. commitmentMonths in
          particular is on every seeded plan and was displayed nowhere - the
          cards show data/voice/speed only, so the contract term the customer is
          signing up to was the one figure an agent could not see. */}
      <PlanDetailsDrawer detailPlan={detailPlan} onClose={() => setDetailPlan(null)} />
    </div>
  );
}
