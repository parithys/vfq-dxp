import { SegmentedTabs } from '../primitives/SegmentedTabs';
import type { PlanGroupKey, TabKey } from './postpaidPlanModel';

interface PlanTabStripProps {
  planGroupTabs: { key: PlanGroupKey; label: string }[];
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
}

/** The Offers / Plans switch: the shared segmented tab strip bound to the plan groups. */
export function PlanTabStrip({ planGroupTabs, activeTab, setActiveTab }: PlanTabStripProps) {
  return <SegmentedTabs items={planGroupTabs} active={activeTab as PlanGroupKey} onChange={setActiveTab} />;
}
