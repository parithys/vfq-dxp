import type { RefObject } from 'react';
import { Button } from '../primitives/Button';
import { Input } from '../primitives/Input';
import { formatDocSize, PROOF_DOCUMENT_ACCEPT } from './postpaidPlanModel';
import type { Discount } from './postpaidPlanModel';
import { DiscountCard } from './DiscountCard';

interface PostpaidDiscountsPanelProps {
  selectedProductId: string | undefined;
  preBundled: boolean;
  discountId: string | undefined;
  onSelectDiscount: (discountId: string | undefined) => void;
  discounts: Discount[];
  selectedDiscount: Discount | undefined;
  requiresSupportingId: boolean;
  discountSupportingId: string | undefined;
  onDiscountSupportingIdChange: (id: string) => void;
  discountProofDocument: { fileName: string; sizeBytes: number } | undefined;
  onDiscountProofDocumentChange: (doc: { fileName: string; sizeBytes: number } | undefined) => void;
  proofDocRef: RefObject<HTMLInputElement | null>;
  proofDocError: string | null;
  handleProofDocFile: (file: File | undefined) => void;
}

export function PostpaidDiscountsPanel({
  selectedProductId,
  preBundled,
  discountId,
  onSelectDiscount,
  discounts,
  selectedDiscount,
  requiresSupportingId,
  discountSupportingId,
  onDiscountSupportingIdChange,
  discountProofDocument,
  onDiscountProofDocumentChange,
  proofDocRef,
  proofDocError,
  handleProofDocFile,
}: PostpaidDiscountsPanelProps) {
  return (!selectedProductId ? (
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
      ));
}
