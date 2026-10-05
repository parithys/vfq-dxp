import { useEffect, useRef, useState } from 'react';
import { Button } from '../primitives/Button';
import { evaluateRule, isHrnNationality } from '../../engines/ruleEngine';
import { useNotificationStore } from '../../stores/notificationStore';
import { evaluateEligibilityChecks, hasHardStop, type EligibilityCheck } from '../../engines/eligibilityEngine';
import * as mockDataEngine from '../../engines/mockDataEngine';
import { callService, ServiceError, type FailureKind, type ServiceName } from '../../engines/serviceCall';
import { TechnicalFailure } from '../patterns/ValidationStatus';
import type { EligibilityResult, CustomerRecord, IdentityDocRecord } from './eligibilityTypes';
import { buildEligibilityRows } from './eligibilityRowsModel';
import { EligibilityChecksList } from './EligibilityRows';


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
   * Pattern 2 (Approval Workflow), rendered as a "Proceed to Approval" button
   * when an approval-routing check applies and nothing harder blocks the
   * order (2026-09-28). Omit to render no button at all - NewPrepaidWizard's
   * separate Eligibility step still relies on the plain-text routing message
   * below rather than this action.
   */
  onProceedToApproval?: () => void;
  /** Set false to skip the dark "Eligibility confirmed" toast on a clean pass (New Connection shows only the Existing customer toast). Defaults to true. */
  announcePass?: boolean;
  /** New Customer journey: check whoever this ID belongs to as a genuine new customer. */
  asNewCustomer?: boolean;
  /** Journey started from Customer 360: check this customer (and their own ID document), whatever ID the scan returned. */
  asCustomerId?: string;
  /**
   * Pattern 3 (Alternative Product), rendered as a "Switch to Prepaid" button
   * when a collections block soft-stops the order (2026-09-28). Only makes
   * sense for `journeyType: 'postpaid'` - Prepaid customers hitting this same
   * collections block have no "switch to Prepaid" to offer, since that is
   * already the product they are on.
   */
  onSwitchToPrepaid?: () => void;
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
export function EligibilityGateStep({
  idNumber,
  onResult,
  result,
  journeyType = 'postpaid',
  onProceedToApproval,
  onSwitchToPrepaid,
  announcePass = true,
  asNewCustomer = false,
  asCustomerId,
}: EligibilityGateStepProps) {
  // A cached result for THIS identity. Computed during render rather than in
  // an effect so the first paint on re-entry already shows the rows.
  const cached = result && idNumber && result.idNumber === idNumber ? result : undefined;

  // undefined = still resolving, null = no customer for this identity,
  // object = resolved. One piece of state rather than a customer record plus a
  // separate check list, because a cached result carries the checks and the
  // HRN flag but not the customer row they came from - and the render only
  // ever needed those two things.
  const [resolved, setResolved] = useState<
    { checks: EligibilityCheck[]; hrnFlag: boolean; nationality?: string; existing?: boolean } | null | undefined
  >(cached
      ? { checks: cached.checks, hrnFlag: cached.requiresHrnAdvance, nationality: cached.nationality, existing: cached.isExistingCustomer }
      : undefined
  );
  const pushToast = useNotificationStore((s) => s.pushToast);
  // A failure to RUN the checks (a lookup or the eligibility service failed) is not a
  // verdict: it leaves eligibility UNRESOLVED - neither eligible nor ineligible - with
  // Retry, then a controlled recovery once attempts are spent. Continue stays
  // unavailable because no result is ever reported.
  const [failure, setFailure] = useState<{ service: ServiceName; kind: FailureKind; attempts: number } | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const attemptsRef = useRef<{ id: string; n: number }>({ id: '', n: 0 });

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
     try {
      const docs = await callService('moi', () => mockDataEngine.list<IdentityDocRecord>('identity-documents'));
      let doc: IdentityDocRecord | undefined = asCustomerId
        ? (docs.find((d) => d.customerId === asCustomerId) ?? docs.find((d) => d.documentNumber === idNumber))
        : docs.find((d) => d.documentNumber === idNumber);
      // Known to NAS but with no customer record = a NEW customer. Nothing on
      // file to block them: no blacklist, no lines, no deals, no balance.
      let nasCustomer: CustomerRecord | undefined;
      if (!doc) {
        const nas = (
          await callService('nas', () =>
            mockDataEngine.list<{ documentNumber: string; documentType?: string; expiryDate?: string; nationality: string; dob?: string }>('nas-records')
          )
        ).find((r) => r.documentNumber === idNumber);
        if (nas) {
          doc = { documentNumber: nas.documentNumber, customerId: '', documentType: nas.documentType, expiryDate: nas.expiryDate };
          nasCustomer = { customerId: '', idType: nas.documentType, dob: nas.dob, nationality: nas.nationality, blacklisted: false };
        }
      }
      if (!doc) {
        if (!cancelled) {
          setResolved(null);
          onResult(undefined);
        }
        return;
      }
      const customers = await callService('customer-lookup', () => mockDataEngine.list<CustomerRecord>('customers'));
      const match = nasCustomer ?? customers.find((c) => c.customerId === doc.customerId) ?? null;
      if (cancelled) return;
      // The identity points at a customer record the lookup cannot return: a lookup
      // failure to retry, not "no customer" and not "new".
      if (!match) throw new ServiceError('customer-lookup', 'partial');
      // A record without the details the checks need cannot be judged either way.
      if (!match.nationality || (!nasCustomer && !match.dob)) throw new ServiceError('customer-lookup', 'partial');
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
      // Derived from nationality (VFQ list in ruleEngine.ts), not read from a
      // per-record flag, so a NAS-only new customer is classified too.
      // The QAR 100 advance applies to new AND existing customers (VFQ business,
      // 2026-10-02). What differs: an existing customer gets no separate
      // "Non-HRN new account" row (that check is for new accounts), and neither
      // is ever told they are HRN - see buildEligibilityRows.
      const isExistingCustomer = !nasCustomer && !asNewCustomer;
      const hrnFlag = isHrnNationality(match.nationality);
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
      const [deals, bills] = await callService('eligibility', () =>
        Promise.all([
          mockDataEngine.list<{ customerId?: string; status?: string; blocksNewConnection?: boolean }>('commitment-penalties'),
          mockDataEngine.list<{ customerId?: string; totalAmount?: number; status?: string }>('bills'),
        ])
      );
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
          lineCapHardStop: Boolean(lineCap.hardStop),
          // The line-cap rule's own message already has the count - see the
          // note on EligibilityContext.activeLinesDetail.
          activeLinesDetail: lineCap.message ?? '',
        },
        new Date()
      );

      attemptsRef.current = { id: idNumber, n: 0 };
      setFailure(null);
      setRetrying(false);
      setResolved({ checks: resolvedChecks, hrnFlag, nationality: match.nationality, existing: isExistingCustomer });
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
      if (!hardStop && !softStop && announcePass) {
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
        isExistingCustomer,
        nationality: match.nationality,
        defaultCreditLimitQar: creditLimitAmount,
        // The checks above ran on the real record whoever the journey treats the person as;
        // a New Customer journey just does not carry that customer's id forward.
        customerId: nasCustomer || asNewCustomer ? undefined : match.customerId,
        idNumber,
      });
      void creditLimit;
     } catch (err) {
      if (cancelled) return;
      const e = err instanceof ServiceError ? err : new ServiceError('eligibility', 'unexpected');
      attemptsRef.current = { id: idNumber, n: attemptsRef.current.id === idNumber ? attemptsRef.current.n + 1 : 1 };
      setFailure({ service: e.service, kind: e.kind, attempts: attemptsRef.current.n });
      setRetrying(false);
      setResolved(undefined);
      onResult(undefined);
     }
    })();
    return () => {
      cancelled = true;
    };
    // onResult is deliberately excluded: NewPostpaidWizard passes a fresh
    // inline arrow function on every render, so including it here retriggers
    // this effect every time onResult fires - an infinite update loop caught
    // live via the ErrorBoundary ("Maximum update depth exceeded").
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idNumber, journeyType, cached, retryNonce]);

  // Nothing to show before an identity is resolved - this panel lives
  // permanently inside the Contact step now (2026-09-28, no more separate
  // Eligibility step to mount a HEADLESS instance ahead of), so there is no
  // "go back and complete Contact first" to say: the agent is already there,
  // simply not far enough into it yet for eligibility to have anything to
  // report. Silence is the correct state, same as the clean-pass case below.
  if (!idNumber) return null;
  if (failure || retrying) {
    return (
      <TechnicalFailure
        service={failure?.service ?? 'eligibility'}
        kind={failure?.kind ?? 'unexpected'}
        attempts={failure?.attempts ?? 0}
        retrying={retrying}
        onRetry={() => {
          setRetrying(true);
          setRetryNonce((n) => n + 1);
        }}
        exhaustedHint="Eligibility has not been checked, so this order cannot continue. Use Save & Exit to resume later."
      />
    );
  }
  if (resolved === undefined) {
    return <p className="text-muted text-[length:var(--fs-body)]">Checking eligibility…</p>;
  }
  if (resolved === null) {
    return <p className="text-danger text-[length:var(--fs-body)]">No customer record found for this identity - cannot evaluate eligibility.</p>;
  }

  const { checks, hrnFlag, nationality, existing } = resolved;
  const hardStop = hasHardStop(checks);
  const softStop = checks.some((c) => c.outcome === 'soft-stop');
  const routed = checks.filter((c) => c.outcome === 'approval-routing');

  // Folding HRN into the same list rather than rendering it as a separate
  // block below is what keeps the panel reading as a single report - it was
  // previously a lone card floating under the seven, which implied it was an
  // eighth verdict. See buildEligibilityRows' own note on why this
  // construction lives there now, not inline here.
  const rows = buildEligibilityRows(checks, hrnFlag, nationality, journeyType, existing);

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

  // NOTHING rendered on a clean pass (2026-09-28: "advance automatically
  // without showing pass indicators"). This panel now lives inside the
  // Contact step rather than a separate Eligibility step the wizard could
  // skip past, so a clean run has to be silence here, not even a one-line
  // confirmation - the toast pushed above already told the agent it cleared,
  // and Continue simply becomes available. Any text here, however muted,
  // is still a pass indicator the agent has to read past.
  if (unresolved.length === 0) return null;

  return (
    <div className="space-y-3">
      <EligibilityChecksList rows={unresolved} />

      {/* Pattern 1: Hard Stop. No button of any kind - "no option to proceed"
          means exactly that, not a disabled one sitting here as a tease. */}
      {hardStop && (
        <p className="text-danger text-[length:var(--fs-caption)]">
          This journey cannot continue for this customer - resolve the blocking check above before retrying.
        </p>
      )}
      {/* Pattern 3: Alternative Product. Only a collections soft-stop reaches
          here (the engine's only 'soft-stop' outcome), and only Postpaid has
          an alternative to offer - a Prepaid customer hitting the same block
          has nowhere else to switch to. onSwitchToPrepaid is left unset by
          NewPrepaidWizard for exactly that reason, so the button is absent
          there even though the message above still applies. */}
      {!hardStop && softStop && (
        <div className="space-y-2">
          <p className="text-[var(--warn-text)] text-[length:var(--fs-caption)]">
            A {journeyType === 'prepaid' ? 'prepaid' : 'postpaid'} connection cannot be issued for this customer - see the
            fallback offered above.
          </p>
          {onSwitchToPrepaid && (
            <Button variant="secondary-rect" compact onClick={onSwitchToPrepaid}>
              Switch to Prepaid
            </Button>
          )}
        </div>
      )}
      {/* Pattern 2: Approval Workflow. "Proceed to Approval" replaces the
          ordinary Continue action for this order - the wizard still gathers
          plan/number/SIM/CAF/payment normally, but the order that eventually
          submits is held for approval rather than completing outright (see
          NewPostpaidWizard's pendingApproval). The plain-text fallback below
          the button covers NewPrepaidWizard, whose separate Eligibility step
          still auto-advances on its own rather than taking this action. */}
      {!hardStop && !softStop && routed.length > 0 && (
        <div className="space-y-2">
          {onProceedToApproval && (
            <Button variant="primary-rect" compact onClick={onProceedToApproval}>
              Proceed to Approval
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
