import { CARD_SELECTED, CARD_IDLE } from '../primitives/offerCardParts';
import { useEffect, useState } from 'react';
import * as mockDataEngine from '../../engines/mockDataEngine';
import { Badge } from '../primitives/Badge';
import { Radio } from '../primitives/Radio';
import { Checkbox } from '../primitives/Checkbox';

interface PrepaidPlan {
  productId: string;
  name: string;
  type: string;
  starterPackChargeQAR: number;
  dataAllowanceGB: number | null;
  minutesAllowance: string;
  packValidityDays: number | null;
  popular?: boolean;
  /** When present, the pack is offered only to these customer segments (MPRA_001_QPC_02); absent = every segment. */
  eligibleSegments?: string[];
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
  /** The customer's segment, from eligibility. Packs restricted to other segments are not offered. A new customer with none on record is treated as Consumer. */
  segment?: string;
  /** The add-ons chosen for this pack (optional) and the change handler. Omitted, the add-ons section is not shown. */
  addonIds?: string[];
  onSelectAddons?: (ids: string[]) => void;
  selectedProductId: string | undefined;
  onSelectProduct: (productId: string) => void;
  discountId: string | undefined;
  onSelectDiscount: (discountId: string | undefined) => void;
}

// MPRA_001_QPC_01-03 (prepaid plan/add-on selection, special discount) - the prepaid counterpart of
// PostpaidPlanAddonsStep. Packs are filtered by the customer's segment (QPC_02), the agent may add the pack's
// optional add-ons, and may pick a prepaid-specific discount for the chosen pack (QPC_03). No Bill Limit here:
// BR-002/BR-005 exclude credit limit and bill cycle from Prepaid Activation.
export function PrepaidPlanStep({ selectedProductId, onSelectProduct, discountId, onSelectDiscount, segment, addonIds = [], onSelectAddons }: PrepaidPlanStepProps) {
  const [plans, setPlans] = useState<PrepaidPlan[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [addons, setAddons] = useState<Discount[]>([]);
  const customerSegment = segment ?? 'Consumer';

  useEffect(() => {
    mockDataEngine.list<PrepaidPlan>('products').then((all) => {
      setPlans(
        all
          .filter((p) => p.type === 'Prepaid Plan' && (!p.eligibleSegments || p.eligibleSegments.includes(customerSegment)))
          .sort((a, b) => a.starterPackChargeQAR - b.starterPackChargeQAR)
      );
    });
  }, [customerSegment]);

  useEffect(() => {
    if (!selectedProductId) {
      setDiscounts([]);
      setAddons([]);
      return;
    }
    mockDataEngine.list<Discount>('addons-discounts').then((all) => {
      setDiscounts(all.filter((d) => d.category === 'Discount' && d.planId === selectedProductId));
      setAddons(all.filter((d) => d.category === 'Paid Add-on' && d.planId === selectedProductId));
    });
  }, [selectedProductId]);

  const selectedPlan = plans.find((p) => p.productId === selectedProductId);
  const selectedDiscount = discounts.find((d) => d.addonDiscountId === discountId);
  const chosenAddons = addons.filter((a) => addonIds.includes(a.addonDiscountId));
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
            <p className="text-muted text-[length:var(--fs-caption)]">Select a starter pack. For a SIM without a bundle, choose New Prepaid Standard SIM.</p>
          </div>
          <div className="space-y-3">
            {plans.map((p) => {
              const selected = selectedProductId === p.productId;
              return (
                <label
                  key={p.productId}
                  className={`flex items-start gap-3 rounded-[var(--radius-card)] border p-4 cursor-pointer ${
                    selected ? CARD_SELECTED : CARD_IDLE
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
            {plans.length === 0 && <p className="text-muted">No Prepaid Plan products are available right now.</p>}
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
                  !discountId ? CARD_SELECTED : CARD_IDLE
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
                    discountId === d.addonDiscountId ? CARD_SELECTED : CARD_IDLE
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

      {selectedPlan && onSelectAddons && addons.length > 0 && (
        <section aria-labelledby="prepaid-addons" className="space-y-2">
          <h3 id="prepaid-addons" className="text-fg font-semibold text-[length:var(--fs-body-lg)]">
            Add-ons <span className="text-muted font-normal text-[length:var(--fs-caption)]">(optional)</span>
          </h3>
          {addons.map((a) => {
            const checked = addonIds.includes(a.addonDiscountId);
            return (
              <label
                key={a.addonDiscountId}
                className={`flex items-center justify-between gap-3 rounded-[var(--radius-card)] border p-3 cursor-pointer ${checked ? CARD_SELECTED : CARD_IDLE}`}
              >
                <span className="flex items-center gap-3">
                  <Checkbox
                    checked={checked}
                    onChange={(e) =>
                      onSelectAddons(e.target.checked ? [...addonIds, a.addonDiscountId] : addonIds.filter((id) => id !== a.addonDiscountId))
                    }
                  />
                  <span>
                    <span className="text-fg">{a.name}</span>
                    <span className="block text-[length:var(--fs-caption)] text-muted">{a.description}</span>
                  </span>
                </span>
                <span className="text-fg font-medium shrink-0">QAR {a.price}</span>
              </label>
            );
          })}
        </section>
      )}

      {selectedPlan && (
        <div className="card p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="text-fg-2 text-[length:var(--fs-caption)]">
            {selectedPlan.name}
            {selectedDiscount && <span> · {selectedDiscount.name} ({Math.round(selectedDiscount.price * 100)}%)</span>}
            {chosenAddons.length > 0 && <span> · {chosenAddons.map((a) => a.name).join(', ')} (QAR {chosenAddons.reduce((t, a) => t + a.price, 0)})</span>}
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
