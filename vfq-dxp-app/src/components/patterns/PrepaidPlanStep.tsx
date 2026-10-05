import { useEffect, useState } from 'react';
import * as mockDataEngine from '../../engines/mockDataEngine';
import { Badge } from '../primitives/Badge';
import { Radio } from '../primitives/Radio';

interface PrepaidPlan {
  productId: string;
  name: string;
  type: string;
  starterPackChargeQAR: number;
  dataAllowanceGB: number | null;
  minutesAllowance: string;
  packValidityDays: number | null;
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

interface PrepaidPlanStepProps {
  selectedProductId: string | undefined;
  onSelectProduct: (productId: string) => void;
  discountId: string | undefined;
  onSelectDiscount: (discountId: string | undefined) => void;
}

// MPRA_001_QPC_01–04 (Product Catalogue and Cart: prepaid plan/add-on
// selection, cart build, special discount) - the prepaid counterpart of
// PostpaidPlanAddonsStep. No Bill Limit / add-ons picker here: BR-002/BR-005
// exclude credit limit and bill cycle entirely from Prepaid Activation, and
// prepaid has no evidenced telco add-on catalogue distinct from the starter
// pack itself, so this step is deliberately a plan + discount picker only,
// not a re-skin of the postpaid step with unused fields hidden.
export function PrepaidPlanStep({ selectedProductId, onSelectProduct, discountId, onSelectDiscount }: PrepaidPlanStepProps) {
  const [plans, setPlans] = useState<PrepaidPlan[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);

  useEffect(() => {
    mockDataEngine.list<PrepaidPlan>('products').then((all) => {
      setPlans(all.filter((p) => p.type === 'Prepaid Plan').sort((a, b) => a.starterPackChargeQAR - b.starterPackChargeQAR));
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
  const netStarterPack = selectedPlan ? Math.round(selectedPlan.starterPackChargeQAR * (1 + (selectedDiscount?.price ?? 0))) : undefined;

  return (
    <div className="space-y-6">
      {/* Header row + content row, adopted as a subgrid by both columns so the
          pack cards and the discount cards start at the same y despite the left
          heading carrying a second line and the right not - same reasoning as
          PostpaidPlanAddonsStep, which has the identical pairing. */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] lg:grid-rows-[auto_auto] gap-6">
        <div className="grid gap-4 lg:row-span-2 lg:grid-rows-subgrid">
          <div>
            <h3 className="text-fg font-semibold text-[length:var(--fs-body-lg)]">Prepaid Pack</h3>
            <p className="text-muted text-[length:var(--fs-caption)]">Select a starter pack, or continue SIM-only</p>
          </div>
          <div className="space-y-3">
            {plans.map((p) => {
              const selected = selectedProductId === p.productId;
              return (
                <label
                  key={p.productId}
                  className={`flex items-start gap-3 rounded-[var(--radius-card)] border p-4 cursor-pointer ${
                    selected ? 'border-[var(--field-card-selected)] bg-[var(--field-card-selected-bg)] shadow-[var(--shadow-selected-ring)]' : 'border-[var(--field-card-border)] bg-bg hover:border-[var(--field-card-hover-border)] hover:ring-1 hover:ring-inset hover:ring-[var(--field-card-hover-border)] hover:bg-[var(--field-card-hover-bg)]'
                  }`}
                >
                  <Radio
                    name="prepaid-plan"
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
                      <span className="text-fg font-semibold shrink-0">QAR {p.starterPackChargeQAR}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mt-2">
                      <div>
                        <div className="text-muted text-[length:var(--fs-caption)] uppercase tracking-wide">Data</div>
                        <div className="text-fg text-[length:var(--fs-caption)]">
                          {p.dataAllowanceGB ? `${p.dataAllowanceGB} GB` : '-'}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted text-[length:var(--fs-caption)] uppercase tracking-wide">Voice</div>
                        <div className="text-fg text-[length:var(--fs-caption)]">{p.minutesAllowance}</div>
                      </div>
                      <div>
                        <div className="text-muted text-[length:var(--fs-caption)] uppercase tracking-wide">Validity</div>
                        <div className="text-fg text-[length:var(--fs-caption)]">
                          {p.packValidityDays ? `${p.packValidityDays} days` : '-'}
                        </div>
                      </div>
                    </div>
                  </div>
                </label>
              );
            })}
            {plans.length === 0 && <p className="text-muted">No Prepaid Plan products in the mock catalogue.</p>}
          </div>
        </div>

        <div className="grid gap-4 lg:row-span-2 lg:grid-rows-subgrid">
          <div>
            <h3 className="text-fg font-semibold text-[length:var(--fs-body-lg)]">Eligible Discounts</h3>
          </div>
          {!selectedProductId ? (
            <p className="text-muted text-[length:var(--fs-caption)]">Select a pack to see eligible discounts.</p>
          ) : (
            <div className="space-y-2">
              <label
                className={`flex items-center justify-between gap-2 rounded-[var(--radius-card)] border p-3 cursor-pointer ${
                  !discountId ? 'border-[var(--field-card-selected)] bg-[var(--field-card-selected-bg)] shadow-[var(--shadow-selected-ring)]' : 'border-[var(--field-card-border)] bg-bg hover:border-[var(--field-card-hover-border)] hover:ring-1 hover:ring-inset hover:ring-[var(--field-card-hover-border)] hover:bg-[var(--field-card-hover-bg)]'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Radio name="prepaid-discount" checked={!discountId} onChange={() => onSelectDiscount(undefined)} />
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
                    discountId === d.addonDiscountId ? 'border-[var(--field-card-selected)] bg-[var(--field-card-selected-bg)] shadow-[var(--shadow-selected-ring)]' : 'border-[var(--field-card-border)] bg-bg hover:border-[var(--field-card-hover-border)] hover:ring-1 hover:ring-inset hover:ring-[var(--field-card-hover-border)] hover:bg-[var(--field-card-hover-bg)]'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Radio
                      name="prepaid-discount"
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
                <p className="text-muted text-[length:var(--fs-caption)]">No discounts configured for this pack.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {selectedPlan && (
        <div className="rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="text-fg-2 text-[length:var(--fs-caption)]">
            {selectedPlan.name}
            {selectedDiscount && <span> · {selectedDiscount.name} ({Math.round(selectedDiscount.price * 100)}%)</span>}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-fg-2 text-[length:var(--fs-caption)]">Starter Pack Charge</span>
            <span className="text-accent font-bold text-[length:var(--fs-h4)]">QAR {netStarterPack}</span>
          </div>
        </div>
      )}
    </div>
  );
}
