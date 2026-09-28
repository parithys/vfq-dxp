/**
 * The customer fields these checks read - a structural shape rather than an
 * import of the full CustomerRecord, so both that type and the narrower local
 * records the wizard steps declare satisfy it without either being widened.
 */
export interface CustomerForEligibility {
  customerId: string;
  idType?: string;
  dob?: string;
  blacklisted: boolean;
  blacklistReason?: string;
  blacklistCategory?: 'collections' | 'security';
}

/**
 * What a failed check DOES, which is not the same as whether it passed. The
 * 2026-09-25 eligibility matrix defines four distinct outcomes and only one of
 * them stops the journey:
 *
 *   - 'hard-stop'        the journey cannot continue at this counter.
 *   - 'soft-stop'        this product cannot be issued; a fallback exists.
 *   - 'approval-routing' not a failure - the order diverts for approval and
 *                        proceeds once granted.
 *   - 'pass'             the check is satisfied.
 *
 * Collapsing these into a boolean is what the step did before, which is why a
 * line-cap breach and a security block were indistinguishable on screen.
 */
export type EligibilityOutcome = 'pass' | 'hard-stop' | 'soft-stop' | 'approval-routing';

export interface EligibilityCheck {
  id: string;
  /** Row heading - the check's NAME, matching the matrix's "Eligibility Check" column. */
  label: string;
  passed: boolean;
  outcome: EligibilityOutcome;
  message: string;
}

export interface IdentityDocForEligibility {
  documentType?: string;
  documentNumber?: string;
  /** Seeded 2026-09-25 - see identity-documents.json's _expiryNote. */
  expiryDate?: string;
  docStatus?: string;
}

export interface DealForEligibility {
  customerId?: string;
  status?: string;
  /** Seeded 2026-09-25 - see commitment-penalties.json's _blockingNote. */
  blocksNewConnection?: boolean;
}

export interface EligibilityContext {
  customer: CustomerForEligibility;
  doc?: IdentityDocForEligibility;
  deals: DealForEligibility[];
  /** Outstanding balance for the collections message, in QAR. */
  outstandingQar: number;
  /** Postpaid line cap for this customer, from the line-cap rules. */
  lineCapReached: boolean;
  /**
   * The line-cap rule's OWN message (BR-288/BR-347 in ruleEngine.ts), which
   * already states the customer's actual active-connections count against
   * the cap - e.g. "1/2 postpaid mobile lines used (expat cap)" or "Qatari
   * nationals have no line cap." Passed through rather than recomputed here:
   * the count and the cap the Active Lines check must report are exactly
   * what that rule already worked out, and restating the arithmetic in a
   * second place risks the two disagreeing.
   */
  activeLinesDetail: string;
}

/**
 * ID types that divert to the CBM / exception-approval workflow rather than
 * being sold directly.
 *
 * SPECIFIED 2026-09-25, replacing an assumption. This previously listed
 * Diplomatic ID and Other ID, guessed from their non-MOI validationPath and
 * flagged in this comment as needing confirmation. The actual rule is the
 * near-inverse: a postpaid connection may be sold directly only against a
 * valid QID or Diplomatic ID; Passport, GCC ID and other exception
 * identification must go through CBM approval.
 *
 * Kept as a check rather than removed now that the postpaid ID Type selector
 * only offers QID and Diplomatic ID: the other journeys share this engine and
 * still accept the wider set, and a customer can reach eligibility with a
 * Passport on record through them.
 */
const EXCEPTION_ROUTED_ID_TYPES = new Set(['Passport', 'GCC ID', 'Other ID']);

const MINIMUM_AGE = 18;

/** Whole years between a date of birth and `asOf`. */
export function ageOn(dob: string | undefined, asOf: Date): number | undefined {
  if (!dob) return undefined;
  const born = new Date(dob);
  if (Number.isNaN(born.getTime())) return undefined;
  let age = asOf.getFullYear() - born.getFullYear();
  const beforeBirthday =
    asOf.getMonth() < born.getMonth() ||
    (asOf.getMonth() === born.getMonth() && asOf.getDate() < born.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// The seven checks of the 2026-09-25 eligibility matrix, in its order, with
// its wording. Every check returns a row either way - a passed check states
// what it verified rather than staying silent, so the agent can see that all
// seven actually ran.
//
// `asOf` is injected rather than read from the clock inside, so expiry and age
// are testable and so the whole result is a pure function of its inputs.
export function evaluateEligibilityChecks(ctx: EligibilityContext, asOf: Date): EligibilityCheck[] {
  const { customer, doc, deals, outstandingQar, lineCapReached, activeLinesDetail } = ctx;
  const checks: EligibilityCheck[] = [];

  // 1. ID validity / expiry.
  const expiry = doc?.expiryDate;
  if (expiry) {
    const expired = new Date(expiry).getTime() < asOf.getTime();
    checks.push({
      id: 'id-validity',
      label: 'ID Validity',
      passed: !expired,
      outcome: expired ? 'hard-stop' : 'pass',
      message: expired
        ? `This ID expired on ${formatDate(expiry)}. Please request a valid, unexpired ID to continue.`
        : `Valid through ${formatDate(expiry)}`,
    });
  } else {
    // No expiry on the record is NOT a pass. Saying "ID verified" with nothing
    // to verify against is the false confirmation this app avoids elsewhere.
    checks.push({
      id: 'id-validity',
      label: 'ID Validity',
      passed: false,
      outcome: 'approval-routing',
      message: 'No expiry date on file for this document - manual validity check required before issue.',
    });
  }

  // 2. Age.
  const age = ageOn(customer.dob, asOf);
  const underage = age !== undefined && age < MINIMUM_AGE;
  checks.push({
    id: 'age',
    label: 'Age Check',
    passed: !underage,
    // Under-18 was a HARD STOP until 2026-09-27, when the annotated
    // walkthrough reclassified it as "Approval required - Under 18 approval".
    // That is a real behavioural change, not a wording one: an under-age
    // applicant now reaches the rest of the journey behind an approval task
    // instead of ending at this counter.
    outcome: underage ? 'approval-routing' : 'pass',
    message: underage
      ? 'MOI records indicate this applicant is under 18. An approval task has been raised - the connection can proceed once approved.'
      // The age itself, per 2026-09-26 direction. An agent judging a
      // borderline applicant against the document in their hand needs the
      // number the check used, not just its verdict. Falls back to the plain
      // wording when dob is absent, since "age is undefined years" is worse
      // than saying less.
      : age === undefined
        ? 'Age verified - eligible to proceed'
        : `Customer's age is ${age} years - eligible to proceed`,
  });

  // 3. ID-type exception routing. Not a failure - a diversion.
  const routed = EXCEPTION_ROUTED_ID_TYPES.has(doc?.documentType ?? customer.idType ?? '');
  checks.push({
    id: 'id-type-routing',
    label: 'ID Type',
    passed: !routed,
    outcome: routed ? 'approval-routing' : 'pass',
    message: routed
      ? 'This ID type cannot be sold directly. Routing to CBM approval workflow.'
      : 'Accepted ID type - eligible to proceed',
  });

  // 4/5. The blacklist splits by CATEGORY, because the two halves do different
  // things: a collections block stops postpaid only and offers prepaid, while a
  // security block ends the interaction. One boolean could not express that.
  const blocked = Boolean(customer.blacklisted);
  const category = customer.blacklistCategory;
  const collectionsBlocked = blocked && category === 'collections';
  const securityBlocked = blocked && category === 'security';

  checks.push({
    id: 'blacklist-collections',
    label: 'Collections Check',
    passed: !collectionsBlocked,
    outcome: collectionsBlocked ? 'soft-stop' : 'pass',
    message: collectionsBlocked
      ? `This account has an outstanding balance of QR ${outstandingQar}. Postpaid cannot be issued. Prepaid is available on this QID.`
      : 'No collections block on this account',
  });

  checks.push({
    id: 'blacklist-security',
    // Label/pass-message reverted to "Security Check" / "No security block on
    // this account" (2026-09-28), matching the reference eligibility panel
    // exactly. This reverses the 2026-09-27 rename to "Corporate Security
    // Blacklist" - the fail MESSAGE still names the corporate security
    // blacklist explicitly (and that exact phrase is what the hard-stop
    // exception pattern names), so which list blocked the customer is still
    // on screen; only the row's own title changed back.
    label: 'Security Check',
    passed: !securityBlocked,
    outcome: securityBlocked ? 'hard-stop' : 'pass',
    message: securityBlocked
      ? 'This customer is on the corporate security blacklist and is restricted from new connections. No further action available at this counter.'
      : 'No security block on this account',
  });

  // A blacklisted customer whose category is absent is treated as a hard stop
  // rather than sliding through both rows above: the block is real, only its
  // classification is missing, and guessing the lenient branch would issue a
  // connection the registry says to withhold.
  if (blocked && category !== 'collections' && category !== 'security') {
    checks.push({
      id: 'blacklist-unclassified',
      label: 'Blacklist Check',
      passed: false,
      outcome: 'hard-stop',
      message: `This customer is blacklisted (${customer.blacklistReason ?? 'reason not recorded'}) and the block is unclassified - escalate before issuing.`,
    });
  }

  // 6. Deals.
  const blockingDeal = deals.find((d) => d.customerId === customer.customerId && d.blocksNewConnection);
  checks.push({
    id: 'deals',
    label: 'Deals Check',
    passed: !blockingDeal,
    outcome: blockingDeal ? 'hard-stop' : 'pass',
    message: blockingDeal
      ? 'An existing deal on this account prevents this connection.'
      : 'No blocking deal conflicts',
  });

  // 7. Active lines. A diversion, not a stop - the order proceeds once the
  // approval task is granted, so this deliberately does NOT hard-stop even
  // though the underlying cap rule reports `pass: false`.
  checks.push({
    id: 'active-lines',
    // 2026-09-28: reports the customer's ACTUAL active-connections count
    // against the cap (activeLinesDetail), not just a pass/fail verdict -
    // "Within permitted active line count" said nothing an agent could check
    // the reasoning behind.
    label: 'Active Lines',
    passed: !lineCapReached,
    outcome: lineCapReached ? 'approval-routing' : 'pass',
    message: lineCapReached
      ? `${activeLinesDetail} An approval task has been raised - the connection can proceed once approved.`
      : activeLinesDetail,
  });

  return checks;
}

/** Any hard stop means the journey halts on the Eligibility step. */
export function hasHardStop(checks: EligibilityCheck[]): boolean {
  return checks.some((c) => c.outcome === 'hard-stop');
}
