import { useEffect, useRef, useState } from 'react';
import { Button } from '../primitives/Button';
import { Drawer } from '../primitives/Drawer';
import { Icon } from '../primitives/Icon';
import { evaluateRule, isHrnNationality } from '../../engines/ruleEngine';
import { useNotificationStore } from '../../stores/notificationStore';
import {
  evaluateEligibilityChecks,
  hasHardStop,
  type EligibilityCheck,
  type EligibilityOutcome,
} from '../../engines/eligibilityEngine';
import * as mockDataEngine from '../../engines/mockDataEngine';
import { callService, ServiceError, type FailureKind, type ServiceName } from '../../engines/serviceCall';
import { TechnicalFailure } from '../patterns/ValidationStatus';

// Row treatment per outcome, for the divided-list layout adopted 2026-09-25.
//
// Each row is a tinted band in ONE bordered panel rather than its own card:
// the seven checks are a single report, and eight separate cards with gaps
// between them read as eight unrelated results.
const ROW_TONE: Record<RowTone, string> = {
  pass: 'bg-[color-mix(in_oklab,var(--success),var(--bg)_94%)]',
  'hard-stop': 'bg-[color-mix(in_oklab,var(--danger),var(--bg)_94%)]',
  'soft-stop': 'bg-[color-mix(in_oklab,var(--warn),var(--bg)_94%)]',
  // Orange wash (distinct from the soft-stop amber): a diversion for approval, not a stop.
  'approval-routing': 'bg-[color-mix(in_oklab,var(--approval-routing),var(--bg)_88%)]',
  advisory: 'bg-surface',
};

const ICON_TONE: Record<RowTone, string> = {
  pass: 'text-success',
  'hard-stop': 'text-danger',
  'soft-stop': 'text-[var(--warn-text)]',
  'approval-routing': 'text-[var(--warn-text)]',
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

/**
 * 'advisory' is not an eligibility outcome - it is the HRN classification,
 * which reports a property of the customer rather than passing or failing.
 * It shares the row layout so the panel reads as one list, but it is never
 * counted as a check.
 */
type RowTone = EligibilityOutcome | 'advisory';

export interface EligibilityRow {
  id: string;
  title: string;
  detail: string;
  tone: RowTone;
}

/**
 * One list, built from the checks plus the HRN advisory - the same
 * construction the main component's own inline panel uses below, extracted
 * (2026-09-28) so the "View eligibility checks" popup can build the exact
 * same rows from a stored EligibilityResult without duplicating this logic a
 * second time and risking the two drifting apart.
 */
export function buildEligibilityRows(
  checks: EligibilityCheck[],
  hrnFlag: boolean,
  nationality: string | undefined,
  journeyType: 'postpaid' | 'prepaid' = 'postpaid',
  existingCustomer = false
): EligibilityRow[] {
  const hrn = evaluateRule('BR-187', { hrnFlag });
  return [
    ...checks.map((check) => {
      // Active Lines has no row heading of its own: the cap message ("Qatari limit of 5 active
      // postpaid lines reached (5 active).") is the title, and any following line is the detail.
      if (check.id === 'active-lines') {
        const [first, ...rest] = check.message.split('\n');
        return { id: check.id, title: first, detail: rest.join('\n'), tone: check.outcome as RowTone };
      }
      return { id: check.id, title: check.label, detail: check.message, tone: check.outcome as RowTone };
    }),
    // The upfront requirement is reported as exactly that - an advance payment -
    // and never as the customer's risk classification. The "Non-HRN new account"
    // pass row belongs to NEW accounts only.
    ...(journeyType !== 'prepaid' && (hrnFlag || !existingCustomer)
      ? [
          {
            id: 'hrn',
            title: hrnFlag ? 'Upfront payment required' : 'Non-HRN new account',
            detail: hrnFlag
              ? hrn.message
                  ? 'An advance payment of QAR 100 is required at checkout.'
                  : 'An advance payment is required at checkout.'
              : nationality
                ? `${nationality} Citizen - not a high-risk nationality`
                : 'Not a high-risk nationality',
            tone: (hrnFlag ? 'advisory' : 'pass') as RowTone,
          },
        ]
      : []),
  ];
}

/** The divided-list row treatment, shared between the inline "needs
 * attention" panel (unresolved rows only) and the "View eligibility checks"
 * popup (every row) - see buildEligibilityRows' own note on why this is one
 * function rather than two near-identical blocks. */
export function EligibilityChecksList({ rows }: { rows: EligibilityRow[] }) {
  return (
    <ul className="rounded-[var(--radius-card)] border border-[var(--field-card-border)] overflow-hidden divide-y divide-border-soft">
      {rows.map((row) => (
        <li key={row.id} className={`flex items-start gap-3 px-4 py-3 ${ROW_TONE[row.tone]}`}>
          <Icon path={ROW_ICON[row.tone]} className={`w-5 h-5 shrink-0 mt-0.5 ${ICON_TONE[row.tone]}`} />
          <div className="min-w-0 flex-1">
            <p className="text-fg font-semibold text-[length:var(--fs-body)]">{row.title}</p>
            {/* The RESULT, not a static description of what the check does -
                see the inline panel's own note on this below. */}
            {row.detail && (
              <p className="text-fg-2 text-[length:var(--fs-caption)] leading-snug whitespace-pre-line">{row.detail}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

// Reference text for the drawer only - the four EligibilityOutcome values
// (RowTone above), named as the checks engine names them, each with a
// plain-language explanation of what it means for the order. Static copy,
// not derived from `rows`: it describes the four possible outcomes in
// general, not which ones this particular customer hit.
export const OUTCOME_LEGEND: { title: string; example: string; detail: string }[] = [
  {
    title: 'Hard Stop',
    example: 'e.g. the customer is on the security blacklist.',
    detail:
      "There's nothing the agent can do here - the order stops. The block has to be resolved somewhere else before trying again.",
  },
  {
    title: 'Soft Stop',
    example: 'e.g. the customer has an unpaid collections balance.',
    detail: "Postpaid isn't available for this customer, but prepaid is. The agent can switch the order to prepaid instead.",
  },
  {
    title: 'Approval Routing',
    example: 'e.g. the customer is under 18.',
    detail: 'Not a failure - the order can go ahead, but a manager has to approve it before it can be completed.',
  },
  {
    title: 'Advisory Only',
    example: 'e.g. the customer is flagged as a High-Risk Nationality (HRN).',
    detail: "Nothing is blocked and the order continues as normal. It's just a note that a different payment or credit rule applies.",
  },
];

function EligibilityOutcomeLegend() {
  return (
    <div className="mt-6 pt-4 border-t border-border-soft">
      <h4 className="text-fg font-semibold text-[length:var(--fs-body)] mb-2">What these outcomes mean</h4>
      <ul className="list-disc pl-5 space-y-2">
        {OUTCOME_LEGEND.map((item) => (
          <li key={item.title} className="text-[length:var(--fs-caption)] leading-snug">
            <span className="font-semibold text-fg">{item.title}</span>{' '}
            <span className="text-fg-2">{item.detail}</span>
            <br />
            <span className="text-muted italic">{item.example}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Footer-left link (2026-09-28: "Add a text link on the left side. On click,
 * open a popup showing all eligibility checks performed and their results.")
 *
 * The inline panel below renders NOTHING once every check passes (a
 * deliberate silence - see its own note on `unresolved.length === 0`), so a
 * clean run leaves no on-screen trace of what actually ran beyond a toast
 * that has already faded. This is the way back to that full list, available
 * regardless of whether anything needs attention.
 */
export function EligibilityChecksLink({
  eligibility,
  journeyType = 'postpaid',
  label = 'View eligibility checks',
}: {
  eligibility: EligibilityResult | undefined;
  journeyType?: 'postpaid' | 'prepaid';
  /** Link text, also used as the drawer title when overridden. */
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!eligibility) return null;
  const rows = buildEligibilityRows(eligibility.checks, eligibility.requiresHrnAdvance, eligibility.nationality, journeyType, eligibility.isExistingCustomer);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[length:var(--fs-caption)] text-link underline
          hover:text-accent-hover focus:outline-none focus-visible:shadow-[var(--focus-ring)]
          rounded-[var(--radius-button)] px-1"
      >
        {label}
      </button>
      <Drawer open={open} onClose={() => setOpen(false)} title={label === 'View eligibility checks' ? 'Eligibility Checks' : label}>
        <EligibilityChecksList rows={rows} />
        <EligibilityOutcomeLegend />
      </Drawer>
    </>
  );
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
  /** The result is for an existing customer's record (not a new customer). */
  isExistingCustomer?: boolean;
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
