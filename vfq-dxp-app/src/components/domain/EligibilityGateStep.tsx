import { useEffect, useState } from 'react';
import { Badge } from '../primitives/Badge';
import { evaluateRule } from '../../engines/ruleEngine';
import * as mockDataEngine from '../../engines/mockDataEngine';

export interface EligibilityResult {
  pass: boolean;
  blacklisted: boolean;
  blacklistReason?: string;
  lineCapExceeded: boolean;
  requiresHrnAdvance: boolean;
  defaultCreditLimitQar: number;
  customerId?: string;
}

interface CustomerRecord {
  customerId: string;
  idType?: string;
  nationality: string;
  blacklisted: boolean;
  blacklistReason?: string;
  hrnAdvancePaymentRequired?: boolean;
  activePostpaidLines?: number;
  activePrepaidLines?: number;
}

interface IdentityDocRecord {
  documentNumber: string;
  customerId: string;
}

interface EligibilityGateStepProps {
  idNumber: string | undefined;
  onResult: (result: EligibilityResult | undefined) => void;
  // Defaults to 'postpaid' so the existing New Postpaid Activation call site
  // is unaffected. 'prepaid' switches the line-cap check from BR-288
  // (postpaid-specific expat-QID cap of 2) to BR-347 (the Mobile Prepaid
  // Activation BRSD's own BR-003 — Passport/GCC ID capped at 2 prepaid
  // lines, Qatari unrestricted, expat QID capped at 5 combined
  // postpaid+prepaid lines), and hides the HRN-advance-payment banner and
  // credit-limit badge, since MPRA_001_CAM_04 and MPRA_001_ECC_03/BAM_01
  // explicitly exclude both from the Prepaid Activation journey. The HRN
  // flag itself is still derived and returned on the result
  // (MPRA_001_CAM_03) — it's just never displayed as a payment prompt here.
  journeyType?: 'postpaid' | 'prepaid';
}

// Gate 2 of the reference activation flow: blacklist + connection-limit +
// HRN-advance-payment checks, run once the customer's identity is resolved
// from Contact/MOI (Gate 1). Re-looks up the customer via the same
// identity-documents -> customers chain IdLookupStep uses, since MOI results
// don't carry a customerId forward. BR-113/BR-288/BR-187/BR-076 — see
// ruleEngine.ts for the evidenced business-rules.json citations.
export function EligibilityGateStep({ idNumber, onResult, journeyType = 'postpaid' }: EligibilityGateStepProps) {
  const [customer, setCustomer] = useState<CustomerRecord | null | undefined>(undefined);

  useEffect(() => {
    if (!idNumber) {
      setCustomer(undefined);
      onResult(undefined);
      return;
    }
    let cancelled = false;
    (async () => {
      const docs = await mockDataEngine.list<IdentityDocRecord>('identity-documents');
      const doc = docs.find((d) => d.documentNumber === idNumber);
      if (!doc) {
        if (!cancelled) {
          setCustomer(null);
          onResult(undefined);
        }
        return;
      }
      const customers = await mockDataEngine.list<CustomerRecord>('customers');
      const match = customers.find((c) => c.customerId === doc.customerId) ?? null;
      if (cancelled) return;
      setCustomer(match);
      if (!match) {
        onResult(undefined);
        return;
      }
      const blacklist = evaluateRule('BR-113', { blacklisted: match.blacklisted, blacklistReason: match.blacklistReason });
      const lineCap =
        journeyType === 'prepaid'
          ? evaluateRule('BR-347', {
              idType: match.idType,
              nationality: match.nationality,
              activePrepaidLines: match.activePrepaidLines ?? 0,
              activePostpaidLines: match.activePostpaidLines ?? 0,
            })
          : evaluateRule('BR-288', {
              nationality: match.nationality,
              activePostpaidLines: match.activePostpaidLines ?? 0,
            });
      const hrnFlag = Boolean(match.hrnAdvancePaymentRequired);
      evaluateRule('BR-187', { hrnFlag });
      const creditLimit = evaluateRule('BR-076', { hrnFlag });
      const creditLimitAmount = hrnFlag ? 50 : 1000;
      onResult({
        pass: blacklist.pass && lineCap.pass,
        blacklisted: !blacklist.pass,
        blacklistReason: match.blacklistReason,
        lineCapExceeded: !lineCap.pass,
        requiresHrnAdvance: hrnFlag,
        defaultCreditLimitQar: creditLimitAmount,
        customerId: match.customerId,
      });
      void creditLimit;
    })();
    return () => {
      cancelled = true;
    };
    // onResult is deliberately excluded: NewPostpaidWizard passes a fresh
    // inline arrow function on every render, so including it here retriggers
    // this effect every time onResult fires — an infinite update loop caught
    // live via the ErrorBoundary ("Maximum update depth exceeded").
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idNumber, journeyType]);

  if (!idNumber) {
    return <p className="text-muted text-[length:var(--fs-body)]">Complete the Contact step first — eligibility depends on the validated identity.</p>;
  }
  if (customer === undefined) {
    return <p className="text-muted text-[length:var(--fs-body)]">Checking eligibility…</p>;
  }
  if (customer === null) {
    return <p className="text-danger text-[length:var(--fs-body)]">No customer record found for this identity — cannot evaluate eligibility.</p>;
  }

  const blacklist = evaluateRule('BR-113', { blacklisted: customer.blacklisted, blacklistReason: customer.blacklistReason });
  const lineCap =
    journeyType === 'prepaid'
      ? evaluateRule('BR-347', {
          idType: customer.idType,
          nationality: customer.nationality,
          activePrepaidLines: customer.activePrepaidLines ?? 0,
          activePostpaidLines: customer.activePostpaidLines ?? 0,
        })
      : evaluateRule('BR-288', { nationality: customer.nationality, activePostpaidLines: customer.activePostpaidLines ?? 0 });
  const hrnFlag = Boolean(customer.hrnAdvancePaymentRequired);
  const hrn = evaluateRule('BR-187', { hrnFlag });
  const credit = evaluateRule('BR-076', { hrnFlag });

  return (
    <div className="space-y-3">
      <div
        className={`rounded-[var(--radius-card)] border p-3 flex items-center gap-2 ${
          blacklist.pass ? 'border-success/30 bg-[color-mix(in_oklab,var(--success),white_92%)]' : 'border-danger/30 bg-[color-mix(in_oklab,var(--danger),white_92%)]'
        }`}
      >
        <Badge variant={blacklist.pass ? 'success' : 'danger'}>Blacklist check</Badge>
        <span className="text-[length:var(--fs-caption)] text-fg">{blacklist.pass ? 'Not on blacklist.' : blacklist.message}</span>
      </div>

      <div
        className={`rounded-[var(--radius-card)] border p-3 flex items-center gap-2 ${
          lineCap.pass ? 'border-success/30 bg-[color-mix(in_oklab,var(--success),white_92%)]' : 'border-danger/30 bg-[color-mix(in_oklab,var(--danger),white_92%)]'
        }`}
      >
        <Badge variant={lineCap.pass ? 'success' : 'danger'}>Connection limit</Badge>
        <span className="text-[length:var(--fs-caption)] text-fg">{lineCap.message}</span>
      </div>

      {journeyType !== 'prepaid' && hrnFlag && (
        <div className="rounded-[var(--radius-card)] border border-[var(--warn)] bg-[color-mix(in_oklab,var(--warn),white_92%)] p-3 flex items-center gap-2">
          <Badge variant="warning">HRN</Badge>
          <span className="text-[length:var(--fs-caption)] text-fg">{hrn.message}</span>
        </div>
      )}

      {journeyType !== 'prepaid' && (
        <div className="rounded-[var(--radius-card)] border border-border-soft bg-surface p-3 flex items-center gap-2">
          <Badge variant="filled-neutral">Credit limit</Badge>
          <span className="text-[length:var(--fs-caption)] text-fg-2">{credit.message}</span>
        </div>
      )}

      {!blacklist.pass || !lineCap.pass ? (
        <p className="text-danger text-[length:var(--fs-caption)]">
          This customer is not eligible for a new {journeyType === 'prepaid' ? 'prepaid' : 'postpaid'} activation — Continue is blocked.
        </p>
      ) : null}
    </div>
  );
}
