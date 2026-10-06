import type { PlanGroupKey, TabKey } from './postpaidPlanModel';

interface PlanTabStripProps {
  planGroupTabs: { key: PlanGroupKey; label: string }[];
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
}

export function PlanTabStrip({ planGroupTabs, activeTab, setActiveTab }: PlanTabStripProps) {
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
        </button>
      ))}
    </div>
  );
}
