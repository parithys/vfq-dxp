import { useEffect, useState } from 'react';
import { CreditCheckPanel } from '../domain/CreditCheckPanel';
import { evaluateRule } from '../../engines/ruleEngine';
import * as mockDataEngine from '../../engines/mockDataEngine';

interface Product {
  productId: string;
  name: string;
  type: string;
  mrcQAR: number;
  speedTierMbps?: number;
  fupGB?: number;
  iptvIncluded?: boolean;
  lockInMonths?: number;
  disconnectionFeeSchedule?: string;
  disconnectionFeeQAR?: number;
}

interface BillingProfile {
  billingProfileId: string;
  customerId?: string;
  collectionStatus: string;
}

interface ProductPlanStepProps {
  planType: string;
  selectedProductId: string | undefined;
  onSelect: (productId: string) => void;
  /** Only Fixed Line/Fibre plans surface the unresolved credit-check conflict
   * (conflict-report.md Conflict 1) - no equivalent conflict is evidenced for
   * other product types, so this defaults off. */
  showCreditCheck?: boolean;
  creditCheckAcknowledged?: boolean;
  onAcknowledgeCreditCheck?: (v: boolean) => void;
  onCreditCheckResult?: (pass: boolean) => void;
}

// SCR-046/SCR-080/SCR-156: Plan step - FLD-282: "Please Select a Plan." -
// searchable catalog grid of promotions, shared across New Fixed Line, New FWA,
// and New Postpaid wizards (Pattern 1). Fixed Line's variant additionally
// surfaces the unresolved fibre outstanding-dues threshold conflict via
// CreditCheckPanel rather than silently picking a number.
export function ProductPlanStep({
  planType,
  selectedProductId,
  onSelect,
  showCreditCheck = false,
  creditCheckAcknowledged = false,
  onAcknowledgeCreditCheck,
  onCreditCheckResult,
}: ProductPlanStepProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [billingProfile, setBillingProfile] = useState<BillingProfile | null>(null);

  useEffect(() => {
    mockDataEngine.list<Product>('products').then((all) => setProducts(all.filter((p) => p.type === planType)));
    if (showCreditCheck) {
      mockDataEngine.list<BillingProfile>('billing-profiles').then((all) => setBillingProfile(all[0] ?? null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planType]);

  useEffect(() => {
    if (showCreditCheck && selectedProductId && billingProfile) {
      onCreditCheckResult?.(evaluateRule('BR-FIBRE-OUTSTANDING-THRESHOLD', { collectionStatus: billingProfile.collectionStatus }).pass);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProductId, billingProfile]);

  return (
    <div className="space-y-4">
      <p className="text-fg-2 text-[length:var(--fs-caption)]">Please Select a Plan.</p>
      <div className="grid grid-cols-1 gap-3">
        {products.map((p) => (
          <button
            key={p.productId}
            onClick={() => onSelect(p.productId)}
            className={`text-left rounded-[var(--radius-card)] border p-4 ${
              selectedProductId === p.productId ? 'border-[var(--field-card-selected)] bg-[var(--field-card-selected-bg)]' : 'border-border-soft hover:border-[var(--field-card-selected)]'
            }`}
          >
            <div className="flex justify-between">
              <span className="text-fg font-medium">{p.name}</span>
              <span className="text-fg">QR {p.mrcQAR}/mo</span>
            </div>
            <div className="text-[length:var(--fs-caption)] text-muted mt-1">
              {p.speedTierMbps && `${p.speedTierMbps}Mbps · `}
              {p.fupGB && `${p.fupGB}GB FUP · `}
              {p.iptvIncluded !== undefined && `IPTV ${p.iptvIncluded ? 'included' : 'not included'} · `}
              {p.lockInMonths && `${p.lockInMonths}-month lock-in`}
            </div>
            {(p.disconnectionFeeSchedule || p.disconnectionFeeQAR) && (
              <div className="text-[length:var(--fs-caption)] text-muted">
                Early disconnection fee: {p.disconnectionFeeSchedule ?? `QR ${p.disconnectionFeeQAR}`}
              </div>
            )}
          </button>
        ))}
        {products.length === 0 && <p className="text-muted">No {planType} products in the mock catalogue.</p>}
      </div>

      {showCreditCheck && selectedProductId && billingProfile && (
        <CreditCheckPanel
          collectionStatus={billingProfile.collectionStatus}
          acknowledged={creditCheckAcknowledged}
          onAcknowledge={onAcknowledgeCreditCheck!}
        />
      )}
    </div>
  );
}
