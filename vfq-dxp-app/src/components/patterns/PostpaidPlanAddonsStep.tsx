import { useEffect, useState } from 'react';
import * as mockDataEngine from '../../engines/mockDataEngine';
import { Badge } from '../primitives/Badge';
import { Radio } from '../primitives/Radio';
import { AddonsPicker } from '../domain/AddonsPicker';

interface PostpaidPlan {
  productId: string;
  name: string;
  type: string;
  mrcQAR: number;
  dataAllowanceGB: number | null;
  minutesAllowance: string;
  speedTier: string;
  popular?: boolean;
}

interface Discount {
  addonDiscountId: string;
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

interface PostpaidPlanAddonsStepProps {
  selectedProductId: string | undefined;
  onSelectProduct: (productId: string) => void;
  discountId: string | undefined;
  onSelectDiscount: (discountId: string | undefined) => void;
  addonIds: string[];
  onAddonsChange: (ids: string[]) => void;
  /** Agent 360... no - Agent 360 doesn't apply here; this is BR-076's
   * eligibility-derived default (EligibilityGateStep), shown read-only so
   * the agent sees what limit this activation was pre-qualified against. */
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
}: PostpaidPlanAddonsStepProps) {
  const [plans, setPlans] = useState<PostpaidPlan[]>([]);
  const [addonProducts, setAddonProducts] = useState<AddonProduct[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);

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
  const addonsMonthlyQar = addonProducts.filter((a) => addonIds.includes(a.productId)).reduce((sum, a) => sum + a.mrcQAR, 0);
  const totalMonthly = selectedPlan
    ? Math.round(selectedPlan.mrcQAR * (1 + (selectedDiscount?.price ?? 0)) + addonsMonthlyQar)
    : undefined;

  return (
    <div className="space-y-6">
      {/* Two explicit rows - header, then content - that each column adopts as
          a subgrid, so the headers share one row and the cards below them start
          at the same y in both columns. The left header is two lines ("RED
          Plan" + "Select your plan") and the right is one, so columns sized
          independently would each start their cards wherever their own header
          happened to end. A spacer in the short header would align today's
          pixels and drift the moment either heading wraps or gains a line. */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] lg:grid-rows-[auto_auto] gap-6">
        {/* Left column: plan tiers */}
        <div className="grid gap-4 lg:row-span-2 lg:grid-rows-subgrid">
          <div>
            <h3 className="text-fg font-semibold text-[length:var(--fs-body-lg)]">RED Plan</h3>
            <p className="text-muted text-[length:var(--fs-caption)]">Select your plan</p>
          </div>
          <div className="space-y-3">
            {plans.map((p) => {
              const selected = selectedProductId === p.productId;
              return (
                <label
                  key={p.productId}
                  className={`flex items-start gap-3 rounded-[var(--radius-card)] border p-4 cursor-pointer ${
                    selected ? 'border-[var(--field-card-selected)] bg-[var(--field-card-selected-bg)]' : 'border-border-soft hover:border-[var(--field-card-selected)]'
                  }`}
                >
                  <Radio
                    name="postpaid-plan"
                    className="mt-1"
                    checked={selected}
                    onChange={() => onSelectProduct(p.productId)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="text-fg font-medium truncate">{p.name}</span>
                        {p.popular && <Badge variant="accent">POPULAR</Badge>}
                      </span>
                      <span className="text-fg font-semibold shrink-0">QAR {p.mrcQAR}/mo</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mt-2">
                      <div>
                        <div className="text-muted text-[length:var(--fs-caption)] uppercase tracking-wide">Data</div>
                        <div className="text-fg text-[length:var(--fs-caption)]">
                          {p.dataAllowanceGB ? `${p.dataAllowanceGB} GB` : 'Unlimited'}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted text-[length:var(--fs-caption)] uppercase tracking-wide">Voice</div>
                        <div className="text-fg text-[length:var(--fs-caption)]">{p.minutesAllowance}</div>
                      </div>
                      <div>
                        <div className="text-muted text-[length:var(--fs-caption)] uppercase tracking-wide">Speed</div>
                        <div className="text-fg text-[length:var(--fs-caption)]">{p.speedTier}</div>
                      </div>
                    </div>
                  </div>
                </label>
              );
            })}
            {plans.length === 0 && <p className="text-muted">No Postpaid Plan products in the mock catalogue.</p>}
          </div>
        </div>

        {/* Right column: discounts, add-ons */}
        <div className="grid gap-4 lg:row-span-2 lg:grid-rows-subgrid">
          <div>
            <h3 className="text-fg font-semibold text-[length:var(--fs-body-lg)]">Eligible Discounts</h3>
          </div>
          {/* Both blocks share the content row - a subgrid column spanning two
              rows must have exactly two children, or the extra ones spill into
              implicit rows the parent knows nothing about. */}
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
            </div>
          )}
            <AddonsPicker selectedIds={addonIds} onChange={onAddonsChange} />
          </div>
        </div>
      </div>

      {selectedPlan && (
        <div className="rounded-[var(--radius-card)] border border-border-soft bg-bg p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="text-fg-2 text-[length:var(--fs-caption)]">
            Live Cart Total · Base plan <span className="text-fg font-medium">QAR {selectedPlan.mrcQAR}/mo</span>
            {selectedDiscount && <span> · {selectedDiscount.name} ({Math.round(selectedDiscount.price * 100)}%)</span>}
            {addonsMonthlyQar > 0 && <span> · Add-ons QAR {addonsMonthlyQar}/mo</span>}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-fg-2 text-[length:var(--fs-caption)]">Total Monthly</span>
            <span className="text-accent font-bold text-[length:var(--fs-h4)]">QAR {totalMonthly}/mo</span>
          </div>
        </div>
      )}
    </div>
  );
}
