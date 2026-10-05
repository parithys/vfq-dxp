import type { PostpaidPlan, PlanGroupKey, TabKey } from './postpaidPlanModel';
import { PostpaidPlanCard } from './PostpaidPlanCard';

interface PlanGroupPanelProps {
  groupPlans: (key: PlanGroupKey) => PostpaidPlan[];
  activeTab: TabKey;
  selectedProductId: string | undefined;
  billLimit: number | undefined;
  onSelectProduct: (productId: string) => void;
  onDeselectProduct?: () => void;
  setDetailPlan: (plan: PostpaidPlan) => void;
}

export function PlanGroupPanel({
  groupPlans,
  activeTab,
  selectedProductId,
  billLimit,
  onSelectProduct,
  onDeselectProduct,
  setDetailPlan,
}: PlanGroupPanelProps) {
  return (
    <div className="space-y-3">
      {groupPlans(activeTab as PlanGroupKey).length === 0 ? (
        <p className="text-muted text-[length:var(--fs-body)]">No plans match that search.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {groupPlans(activeTab as PlanGroupKey).map((p) => (
          <PostpaidPlanCard
            key={p.productId}
            p={p}
            selectedProductId={selectedProductId}
            billLimit={billLimit}
            onSelectProduct={onSelectProduct}
            onDeselectProduct={onDeselectProduct}
            setDetailPlan={setDetailPlan}
          />
        ))}
        </div>
      )}
    </div>
  );
}
