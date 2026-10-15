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
        <div className="grid grid-cols-[repeat(auto-fill,minmax(max(15rem,calc((100%-2rem)/3)),1fr))] gap-4">
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
