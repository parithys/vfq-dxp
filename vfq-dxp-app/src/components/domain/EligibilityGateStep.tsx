import { useEffect, useState } from 'react';
import { Badge } from '../primitives/Badge';
import { Icon } from '../primitives/Icon';
import { evaluateRule } from '../../engines/ruleEngine';
import { useNotificationStore } from '../../stores/notificationStore';
import {
  evaluateEligibilityChecks,
  hasHardStop,
  type EligibilityCheck,
  type EligibilityOutcome,
} from '../../engines/eligibilityEngine';
import * as mockDataEngine from '../../engines/mockDataEngine';

// Row treatment per outcome, for the divided-list layout adopted 2026-09-25.
//
// Each row is a tinted band in ONE bordered panel rather than its own card:
// the seven checks are a single report, and eight separate cards with gaps
// between them read as eight unrelated results.
const ROW_TONE: Record<RowTone, string> = {
  pass: 'bg-[color-mix(in_oklab,var(--success),var(--bg)_94%)]',
  'hard-stop': 'bg-[color-mix(in_oklab,var(--danger),var(--bg)_94%)]',
  'soft-stop': 'bg-[color-mix(in_oklab,var(--warn),var(--bg)_94%)]',
  'approval-routing': 'bg-surface',
  advisory: 'bg-surface',
};

const ICON_TONE: Record<RowTone, string> = {
  pass: 'text-success',
  'hard-stop': 'text-danger',
  'soft-stop': 'text-[var(--warn-text)]',
  'approval-routing': 'text-muted',
  advisory: 'text-muted',
};

// Circled glyphs, so the outcome is legible without relying on colour alone -
// SC 1.4.1. A tick, a cross, a warning triangle and a clock are four distinct
// shapes, not four shades of one.
const ROW_ICON: Record<RowTone, string> = {
  pass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M8.4 12.3l2.4 2.4 4.8-5.2',
  'hard-stop': 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M15 9l-6 6 M9 9l6 6',
  'soft-stop': 'M12 3l9 16H3l9-16z M12 10v4 M12 17h.01',
  'approval-routing': 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3.2 2',
  advisory: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 11v5 M12 7.5h.01',
};

// The right-hand pill. "Passed" is the attached layout's wording; the other
// three say what actually happens, because "Failed" would be wrong for a
// diversion that lets the order proceed once approved.
const STATUS_LABEL: Record<RowTone, string> = {
  pass: 'Passed',
  'hard-stop': 'Failed',
  'soft-stop': 'Blocked',
  'approval-routing': 'Approval required',
  advisory: 'For information',
};

const STATUS_BADGE: Record<RowTone, 'success' | 'danger' | 'warning' | 'filled-neutral'> = {
  pass: 'success',
  'hard-stop': 'danger',
  'soft-stop': 'warning',
  'approval-routing': 'filled-neutral',
  advisory: 'filled-neutral',
};

/**
 * 'advisory' is not an eligibility outcome - it is the HRN classification,
 * which reports a property of the customer rather than passing or failing.
 * It shares the row layout so the panel reads as one list, but it is never
 * counted as a check.
 */
type RowTone = EligibilityOutcome | 'advisory';

interface EligibilityRow {
  id: string;
  title: string;
  detail: string;
  tone: RowTone;
}

export interface EligibilityResult {
  /**
   * Whether the journey may continue. False for a hard stop AND for a soft
   * stop: a collections block means postpaid cannot be issued, so continuing
   * would create exactly the order the rule withholds. See the note on
   * `hardStop` for why the two are still distinguished.
   */
  pass: boolean;
  /** Any 'hard-stop' outcome - the journey ends at this counter. */
  hardStop: boolean;
  /** Any 'soft-stop' - this product is unavailable but a fallback exists. */
  softStop: boolean;
  /** Every check that ran, for display and for downstream steps. */
  checks: EligibilityCheck[];
  blacklisted: boolean;
  blacklistReason?: string;
  lineCapExceeded: boolean;
  requiresHrnAdvance: boolean;
  defaultCreditLimitQar: number;
  customerId?: string;
  /**
   * The resolved customer's nationality, which the HRN row names.
   *
   * On the result rather than recomputed at render because this step is
   * one-shot: re-entering it reuses the cached result without re-reading the
   * customer, so anything the display needs has to survive in here. Without
   * it the HRN row silently fell back to the unqualified wording the moment
   * the agent walked back to this step - correct on first arrival, degraded
   * on every return, which is the worst kind of bug to notice.
   */
  nationality?: string;
  /**
   * The ID number these checks were run against. Lets a re-entry to this step
   * tell a still-valid cached result from a stale one: change the ID on the
   * Contact step and the cached eligibility no longer describes the person in
   * front of the agent, so it must be recomputed rather than reused.
   */
  idNumber: string;
}

interface CustomerRecord {
  customerId: string;
  idType?: string;
  dob?: string;
  nationality: string;
  blacklisted: boolean;
  blacklistReason?: string;
  blacklistCategory?: 'collections' | 'security';
  hrnAdvancePaymentRequired?: boolean;
  activePostpaidLines?: number;
  activePrepaidLines?: number;
}

interface IdentityDocRecord {
  documentNumber: string;
  customerId: string;
  documentType?: string;
  expiryDate?: string;
  docStatus?: string;
}

interface EligibilityGateStepProps {
  idNumber: string | undefined;
  onResult: (result: EligibilityResult | undefined) => void;
  /**
   * A result already computed earlier in this journey, from the wizard draft.
   *
   * The eligibility check is a ONE-TIME task: leaving the step and coming
   * back re-mounts this component, and without this it would re-read four
   * datasets and flash "Checking eligibility..." before redrawing the same
   * seven rows. Passing the previous result back in lets the step render
   * immediately from it.
   *
   * Reused only when its `idNumber` still matches - see EligibilityResult.
   */
  result?: EligibilityResult;
  /**
   * Evaluate but render NOTHING.
   *
   * Mounted this way inside the Contact step, the checks run the moment MOI
   * resolves, so `values.eligibility` already exists by the time the agent
   * presses Continue. That is what lets the wizard SKIP the Eligibility step
   * outright on a clean run (2026-09-27: "do not display an Eligibility page
   * or tab and proceed directly to the next step") rather than showing it
   * briefly and auto-advancing out of it.
   */
  headless?: boolean;
  // Defaults to 'postpaid' so the existing New Postpaid Activation call site
  // is unaffected. 'prepaid' switches the line-cap check from BR-288
  // (postpaid-specific expat-QID cap of 2) to BR-347 (the Mobile Prepaid
  // Activation BRSD's own BR-003 - Passport/GCC ID capped at 2 prepaid
  // lines, Qatari unrestricted, expat QID capped at 5 combined
  // postpaid+prepaid lines), and hides the HRN-advance-payment banner and
  // credit-limit badge, since MPRA_001_CAM_04 and MPRA_001_ECC_03/BAM_01
  // explicitly exclude both from the Prepaid Activation journey. The HRN
  // flag itself is still derived and returned on the result
  // (MPRA_001_CAM_03) - it's just never displayed as a payment prompt here.
  journeyType?: 'postpaid' | 'prepaid';
}

// Gate 2 of the reference activation flow: blacklist + connection-limit +
// HRN-advance-payment checks, run once the customer's identity is resolved
// from Contact/MOI (Gate 1). Re-looks up the customer via the same
// identity-documents -> customers chain IdLookupStep uses, since MOI results
// don't carry a customerId forward. BR-113/BR-288/BR-187/BR-076 - see
// ruleEngine.ts for the evidenced business-rules.json citations.
export function EligibilityGateStep({ idNumber, onResult, result, journeyType = 'postpaid', headless = false }: EligibilityGateStepProps) {
  // A cached result for THIS identity. Computed during render rather than in
  // an effect so the first paint on re-entry already shows the rows.
  const cached = result && idNumber && result.idNumber === idNumber ? result : undefined;

  // undefined = still resolving, null = no customer for this identity,
  // object = resolved. One piece of state rather than a customer record plus a
  // separate check list, because a cached result carries the checks and the
  // HRN flag but not the customer row they came from - and the render only
  // ever needed those two things.
  const [resolved, setResolved] = useState<
    { checks: EligibilityCheck[]; hrnFlag: boolean; nationality?: string } | null | undefined
  >(cached
      ? { checks: cached.checks, hrnFlag: cached.requiresHrnAdvance, nationality: cached.nationality }
      : undefined
  );
  const pushToast = useNotificationStore((s) => s.pushToast);

  useEffect(() => {
    // The one-time guarantee. Nothing is re-read and onResult is not called
    // again - the draft already holds exactly this result.
    if (cached) return;
    if (!idNumber) {
      setResolved(undefined);
      onResult(undefined);
      return;
    }
    let cancelled = false;
    (async () => {
      const docs = await mockDataEngine.list<IdentityDocRecord>('identity-documents');
      const doc = docs.find((d) => d.documentNumber === idNumber);
      if (!doc) {
        if (!cancelled) {
          setResolved(null);
          onResult(undefined);
        }
        return;
      }
      const customers = await mockDataEngine.list<CustomerRecord>('customers');
      const match = customers.find((c) => c.customerId === doc.customerId) ?? null;
      if (cancelled) return;
      if (!match) {
        setResolved(null);
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
      // Still computed though the Credit limit ROW was removed from this step
      // on 2026-09-25: the amount is not display-only. DeviceInstallmentStep
      // reads defaultCreditLimitQar off this result to judge instalment
      // affordability, so dropping it from the result would silently change
      // that step's behaviour rather than just hide a row.
      const creditLimit = evaluateRule('BR-076', { hrnFlag });
      const creditLimitAmount = hrnFlag ? 50 : 1000;

      // The seven matrix checks. Deals and the outstanding balance are the
      // only extra reads: the line cap comes from the rule already evaluated
      // above, so the cap logic stays in one place rather than being restated
      // inside the eligibility engine.
      const [deals, bills] = await Promise.all([
        mockDataEngine.list<{ customerId?: string; status?: string; blocksNewConnection?: boolean }>('commitment-penalties'),
        mockDataEngine.list<{ customerId?: string; totalAmount?: number; status?: string }>('bills'),
      ]);
      if (cancelled) return;
      const outstandingQar = bills
        .filter((b) => b.customerId === match.customerId && b.status !== 'Paid')
        .reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0);

      const resolvedChecks = evaluateEligibilityChecks(
        {
          customer: match,
          doc,
          deals,
          outstandingQar,
          lineCapReached: !lineCap.pass,
        },
        new Date()
      );

      setResolved({ checks: resolvedChecks, hrnFlag, nationality: match.nationality });
      const hardStop = hasHardStop(resolvedChecks);
      const softStop = resolvedChecks.some((c) => c.outcome === 'soft-stop');
      // Confirmation toast on a clear pass (2026-09-25). It is pushed HERE,
      // in the branch that computes the result, for two reasons:
      //
      // - The step auto-advances the moment it clears, so this component is
      //   unmounting as the agent reads it. A message rendered inside the
      //   step would vanish with it; a toast outlives the step and follows
      //   them to Address.
      // - The cached path returns before this point, so re-entering the step
      //   cannot re-announce a check it did not re-run.
      //
      // Keyed on the identity so a recompute after an ID change replaces the
      // previous confirmation rather than stacking a second one.
      if (!hardStop && !softStop) {
        pushToast('success', 'Eligibility confirmed', {
          key: `eligibility-${idNumber}`,
          detail: `Customer is eligible for a ${journeyType === 'prepaid' ? 'prepaid' : 'postpaid'} connection. Continuing to the next step.`,
        });
      }

      onResult({
        // Soft stop blocks too - see the note on EligibilityResult.pass.
        pass: !hardStop && !softStop,
        hardStop,
        softStop,
        checks: resolvedChecks,
        blacklisted: !blacklist.pass,
        blacklistReason: match.blacklistReason,
        lineCapExceeded: !lineCap.pass,
        requiresHrnAdvance: hrnFlag,
        nationality: match.nationality,
        defaultCreditLimitQar: creditLimitAmount,
        customerId: match.customerId,
        idNumber,
      });
      void creditLimit;
    })();
    return () => {
      cancelled = true;
    };
    // onResult is deliberately excluded: NewPostpaidWizard passes a fresh
    // inline arrow function on every render, so including it here retriggers
    // this effect every time onResult fires - an infinite update loop caught
    // live via the ErrorBoundary ("Maximum update depth exceeded").
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idNumber, journeyType, cached]);

  if (!idNumber) {
    return <p className="text-muted text-[length:var(--fs-body)]">Complete the Contact step first - eligibility depends on the validated identity.</p>;
  }
  // After the hooks, so evaluation still happens - only the output is
  // suppressed. Returning early here (not before the hooks) keeps hook order
  // identical between headless and visible mounts.
  if (headless) return null;

  if (resolved === undefined) {
    return <p className="text-muted text-[length:var(--fs-body)]">Checking eligibility…</p>;
  }
  if (resolved === null) {
    return <p className="text-danger text-[length:var(--fs-body)]">No customer record found for this identity - cannot evaluate eligibility.</p>;
  }

  const { checks, hrnFlag, nationality } = resolved;
  const hrn = evaluateRule('BR-187', { hrnFlag });
  const hardStop = hasHardStop(checks);
  const softStop = checks.some((c) => c.outcome === 'soft-stop');
  const routed = checks.filter((c) => c.outcome === 'approval-routing');

  // One list, built from the checks plus the HRN advisory. Folding HRN in here
  // rather than rendering it as a separate block below is what keeps the panel
  // reading as a single report - it was previously a lone card floating under
  // the seven, which implied it was an eighth verdict.
  const rows: EligibilityRow[] = [
    ...checks.map((check) => ({ id: check.id, title: check.label, detail: check.message, tone: check.outcome })),
    ...(journeyType !== 'prepaid'
      ? [
          {
            id: 'hrn',
            title: hrnFlag ? 'HRN (High Network Risk)' : 'Non-HRN new account',
            // Names the nationality the classification was made on, per
            // 2026-09-26 direction - "not a high-risk nationality" alone does
            // not say which nationality was assessed, and that is the whole
            // input to the rule. Falls back to the unqualified wording when
            // the record carries no nationality, rather than printing
            // "undefined Citizen".
            detail:
              (hrnFlag ? hrn.message : undefined) ??
              (nationality
                ? `${nationality} Citizen - not a high-risk nationality`
                : 'Not a high-risk nationality'),
            // HRN is amber because an advance payment is outstanding, but it
            // is NOT a soft stop: the product can still be issued.
            tone: (hrnFlag ? 'soft-stop' : 'pass') as RowTone,
          },
        ]
      : []),
  ];

  // ONLY the rows that did not pass (2026-09-27). A clean run is not reported
  // here at all - the step is skipped outright by the wizard (see
  // NewPostpaidWizard's `skip`), so eight green "Passed" rows the agent had to
  // read past and then dismiss are gone. What remains on screen is only ever
  // something that needs a decision.
  //
  // "Did not pass" deliberately includes approval-routing as well as the two
  // stops. Routing is not a failure, but it IS a diversion the agent must know
  // about - an under-18 applicant silently proceeding behind an approval task
  // nobody mentioned would be worse than one extra screen.
  const unresolved = rows.filter((row) => row.tone !== 'pass');

  // Defensive: the wizard skips this step when everything passes, so reaching
  // here with nothing unresolved means the two disagreed. Say so rather than
  // rendering an empty card.
  if (unresolved.length === 0) {
    return (
      <p className="text-muted text-[length:var(--fs-body)]">
        All eligibility checks passed - continuing to the next step.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-fg-2 text-[length:var(--fs-body)]">
        {unresolved.length === 1
          ? 'One eligibility check needs attention before this order can proceed.'
          : `${unresolved.length} eligibility checks need attention before this order can proceed.`}
      </p>
      <ul className="rounded-[var(--radius-card)] border border-border-soft overflow-hidden divide-y divide-border-soft">
        {unresolved.map((row) => (
          <li key={row.id} className={`flex items-start gap-3 px-4 py-3 ${ROW_TONE[row.tone]}`}>
            <Icon path={ROW_ICON[row.tone]} className={`w-5 h-5 shrink-0 mt-0.5 ${ICON_TONE[row.tone]}`} />
            <div className="min-w-0 flex-1">
              <p className="text-fg font-semibold text-[length:var(--fs-body)]">{row.title}</p>
              {/* The RESULT, not a static description of what the check does.
                  A passed check states what it verified ("valid through
                  30/11/2029", "1/2 lines used") and a failed one states what
                  to do about it - boilerplate would waste the line. */}
              <p className="text-fg-2 text-[length:var(--fs-caption)] leading-snug">{row.detail}</p>
            </div>
            <span className="shrink-0">
              <Badge variant={STATUS_BADGE[row.tone]}>{STATUS_LABEL[row.tone]}</Badge>
            </span>
          </li>
        ))}
      </ul>

      {hardStop && (
        <p className="text-danger text-[length:var(--fs-caption)]">
          This journey cannot continue for this customer - resolve the blocking check above before retrying.
        </p>
      )}
      {!hardStop && softStop && (
        <p className="text-[var(--warn-text)] text-[length:var(--fs-caption)]">
          A {journeyType === 'prepaid' ? 'prepaid' : 'postpaid'} connection cannot be issued for this customer - see the
          fallback offered above.
        </p>
      )}
      {!hardStop && !softStop && routed.length > 0 && (
        <p className="text-fg-2 text-[length:var(--fs-caption)]">
          {routed.length === 1 ? 'One check routes' : `${routed.length} checks route`} this order for approval. The
          journey continues; the order completes once approval is granted.
        </p>
      )}
    </div>
  );
}
