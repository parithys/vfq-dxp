import { useEffect, useState } from 'react';
import * as mockDataEngine from '../../../engines/mockDataEngine';

interface InstalledAsset {
  productServiceName: string;
  status: string;
}

// SCR-075: Connection Details Popup — a shared pre-journey guardrail reused
// identically across FWA, MNP, Postpaid Cross-Sales, and Pre-to-Post
// journeys (screens.md, 6 source documents), not a Pre-to-Post-exclusive
// screen. Shows Prepaid/Postpaid connection counts before the agent proceeds
// (BR-211: 2+ postpaid connections triggers a credit-policy advisory).
export function ConnectionDetailsPopup() {
  const [assets, setAssets] = useState<InstalledAsset[]>([]);

  useEffect(() => {
    mockDataEngine.list<InstalledAsset>('installed-assets').then(setAssets);
  }, []);

  const postpaidCount = assets.filter((a) => /postpaid/i.test(a.productServiceName)).length;
  const prepaidCount = assets.filter((a) => /prepaid/i.test(a.productServiceName)).length;

  return (
    <div className="p-8 max-w-md">
      <h1 className="text-[length:var(--fs-h3)] font-medium text-fg mb-1">Connection Details</h1>
      <div className="rounded-[var(--radius-card)] border border-border-soft bg-bg p-4 mt-4 space-y-2">
        <p className="text-fg">Total Number of Prepaid Connections: {prepaidCount}</p>
        <p className="text-fg">Total Number of Postpaid Connections: {postpaidCount}</p>
      </div>
      {postpaidCount >= 2 && (
        <p className="text-[length:var(--fs-caption)] text-danger mt-3">
          Advisory: 2 or more postpaid connections on this account — review credit policy before proceeding.
        </p>
      )}
    </div>
  );
}
