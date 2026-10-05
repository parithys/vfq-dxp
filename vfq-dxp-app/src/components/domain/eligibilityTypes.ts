import { type EligibilityCheck } from '../../engines/eligibilityEngine';

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

export interface CustomerRecord {
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

export interface IdentityDocRecord {
  documentNumber: string;
  customerId: string;
  documentType?: string;
  expiryDate?: string;
  docStatus?: string;
}
