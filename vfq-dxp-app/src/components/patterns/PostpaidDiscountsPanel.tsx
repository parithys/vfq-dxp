import { Button } from '../primitives/Button';
import { Input } from '../primitives/Input';
import { SPECIAL_DISCOUNT_ADDON_TYPES, SPECIAL_DISCOUNT_CARD_TITLE, type Discount } from './postpaidPlanModel';
import { DiscountCard } from './DiscountCard';

interface PostpaidDiscountsPanelProps {
  selectedProductId: string | undefined;
  preBundled: boolean;
  discountId: string | undefined;
  onSelectDiscount: (discountId: string | undefined) => void;
  discounts: Discount[];
  selectedDiscount: Discount | undefined;
  /** Where the plan's discounts are in loading; on error the agent can retry or continue without one. */
  discountsState?: 'loading' | 'error' | 'ready';
  onRetryDiscounts?: () => void;
}

export function PostpaidDiscountsPanel({
  selectedProductId,
  preBundled,
  discountId,
  onSelectDiscount,
  discounts,
  selectedDiscount,
  discountsState = 'ready',
  onRetryDiscounts,
}: PostpaidDiscountsPanelProps) {
  return (!selectedProductId ? (
        <p className="text-muted text-[length:var(--fs-caption)]">Select a plan to see eligible discounts.</p>
      ) : discountsState === 'loading' ? (
        <p className="text-muted text-[length:var(--fs-caption)]">Loading discounts…</p>
      ) : discountsState === 'error' ? (
        <div role="alert" className="rounded-[var(--radius-card)] border border-[var(--warn)] bg-tone-warn-soft px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[var(--warn-text)] text-[length:var(--fs-body)]">Discounts could not be loaded. You can continue without one.</p>
          <Button variant="tertiary" compact onClick={onRetryDiscounts}>
            Retry
          </Button>
        </div>
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
        <div className="rounded-[var(--radius-card)] border border-[var(--warn)] bg-tone-warn-soft px-4 py-3">
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
          {discounts.length === 0 ? (
            <div className="rounded-[var(--radius-card)] border border-border-soft bg-surface px-4 py-6 text-center">
              <p className="text-fg-2 text-[length:var(--fs-body)]">No discounts available for this plan</p>
            </div>
          ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(max(15rem,calc((100%-2rem)/3)),1fr))] gap-4">
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
                title={SPECIAL_DISCOUNT_ADDON_TYPES.has(d.addonType) ? SPECIAL_DISCOUNT_CARD_TITLE : d.name}
                description={d.description}
                value={`${Math.round(d.price * 100)}%`}
                selected={discountId === d.addonDiscountId}
                onToggle={() => onSelectDiscount(discountId === d.addonDiscountId ? undefined : d.addonDiscountId)}
              />
            ))}
          </div>
          )}
        </div>
      ));
}
