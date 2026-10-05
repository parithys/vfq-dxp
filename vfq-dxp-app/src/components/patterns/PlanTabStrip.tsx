import { Badge } from '../primitives/Badge';
import type { PostpaidPlan, PlanGroupKey, TabKey } from './postpaidPlanModel';

interface PlanTabStripProps {
  planGroupTabs: { key: PlanGroupKey; label: string }[];
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  groupPlans: (key: PlanGroupKey) => PostpaidPlan[];
  addonIds: string[];
}

export function PlanTabStrip({ planGroupTabs, activeTab, setActiveTab, groupPlans, addonIds }: PlanTabStripProps) {
  return (
    <div className="flex gap-1 border-b border-border-soft overflow-x-auto">
      {planGroupTabs.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => setActiveTab(key)}
          className={`flex items-center gap-2 px-3 py-1.5 text-[length:var(--fs-body)] border-b-2 -mb-px whitespace-nowrap ${
            activeTab === key ? 'border-accent text-accent font-medium' : 'border-transparent text-fg-2'
          }`}
        >
          {label}
          <Badge variant="accent">{groupPlans(key).length}</Badge>
        </button>
      ))}
      <button
        onClick={() => setActiveTab('addons')}
        className={`px-3 py-1.5 text-[length:var(--fs-body)] border-b-2 -mb-px whitespace-nowrap ${
          activeTab === 'addons' ? 'border-accent text-accent font-medium' : 'border-transparent text-fg-2'
        }`}
      >
        {addonIds.length > 0 ? `Add-ons (${addonIds.length} selected)` : 'Add-ons (optional)'}
      </button>
      <button
        onClick={() => setActiveTab('discounts')}
        className={`px-3 py-1.5 text-[length:var(--fs-body)] border-b-2 -mb-px whitespace-nowrap ${
          activeTab === 'discounts' ? 'border-accent text-accent font-medium' : 'border-transparent text-fg-2'
        }`}
      >
        Eligible Discounts
      </button>
    </div>
  );
}
