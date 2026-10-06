import { AddonsPicker } from '../domain/AddonsPicker';
import { BillLimitEditor } from '../domain/BillLimitEditor';
import type { PostpaidPlan } from './postpaidPlanModel';

interface PostpaidAddonsPanelProps {
  preBundled: boolean;
  addonIds: string[];
  onAddonsChange: (ids: string[]) => void;
  selectedProductId: string | undefined;
  customerContext?: { nationality?: string; customerType?: string; idType?: string };
  selectedPlan: PostpaidPlan | undefined;
  billLimit: number | undefined;
  onBillLimitChange: (value: number, pass: boolean) => void;
}

export function PostpaidAddonsPanel({
  preBundled,
  addonIds,
  onAddonsChange,
  selectedProductId,
  customerContext,
  selectedPlan,
  billLimit,
  onBillLimitChange,
}: PostpaidAddonsPanelProps) {
  return (preBundled ? (
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
            emptyMessage="No add-ons available for this plan"
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
      ));
}
