import type { QidImageUploadValue } from '../domain/qidImageUploadModel';
import type { QidType } from '../domain/QidInput';

/** A customer record that shares the scanned ID with others - offered to the agent to choose from. */
export interface DuplicateCandidate {
  customerId: string;
  name: string;
  dob: string;
}

export interface MoiResult {
  /** Mobile number and notification language on the customer record - shown by
   * the verify-then-fetch flow only. */
  phone?: string;
  preferredLanguage?: string;
  name: string;
  /** Set when the ID resolved to an existing Vodafone customer (Siebel); absent for a NAS-only new customer. */
  customerId?: string;
  /** The registry's own name parts, when it returns them. The Contact step prefers these over splitting `name` by position, so a middle name of several tokens is never guessed at. */
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dob: string;
  nationality: string;
  email?: string;
  /** Where `email` came from: Siebel for an existing customer, NAS for a new one. */
  emailSource?: 'Siebel' | 'NAS' | 'Billing Profile';
  /** No customer record exists for this ID - details come from NAS, not Siebel. */
  isNewCustomer?: boolean;
  // Added 2026-09-24 so Gender can be registry-sourced. It has to be: the
  // identity fields are non-editable, and a mandatory field with no source
  // and no way to type into it would block Continue forever. customers.json
  // has carried `gender` all along; only MoiResult was not passing it on.
  gender?: string;
  // The sponsoring employer, when the registry has one on file. Added
  // 2026-09-26 so B2B2C can be DERIVED rather than ticked: the Contact step's
  // "B2B2C Order" checkbox was removed, and this is what replaces it.
  //
  // Strictly this is not MOI data - an employment relationship is not held by
  // the interior ministry - but it travels with the customer record the lookup
  // resolves, and inventing a second round trip to a system this app has no
  // evidence of would be pretending to know more about the integration than
  // the corpus says. Named companyName to match the field it comes from.
  companyName?: string;
  /**
   * The employer's row in `enterprise-accounts`, resolved here rather than by
   * the Contact step.
   *
   * Resolved at the same point the customer is, because this is where the data
   * layer already is - GuidedContactStep is a pure presentational component
   * with no state, no effects and no dataset reads, and giving it one just to
   * turn a name into an id would change its character for no gain. Carrying
   * the id matters because a NAME is not a link: two Lulu branches share a CR
   * prefix and differ only by suffix, so downstream needs the id to know which
   * account sponsors the line.
   */
  companyAccountId?: string;
  /** The occupation on the registry record, when it holds one. */
  occupation?: string;
  /**
   * The scanned document's own expiry date (ISO), not a customer-record field -
   * it comes off the `identity-documents` match, not `customers`. This is the
   * same date eligibilityEngine already reads off that record to run its ID
   * validity check; it just never travelled any further than that engine
   * until now. See identity-documents.json's `_expiryNote` for why the field
   * exists on that dataset at all.
   */
  expiryDate?: string;
  /**
   * When this lookup last resolved (ISO), stamped by runMoiValidation below.
   * Evidenced as "MOI Update Time" on the backend Contact/Account record
   * across multiple guided-journey walkthroughs (e.g. "MOI Update Time
   * 8/18/2025 03:58:20") - not previously carried into this app. Overwritten
   * on every fresh validation, so it always reads the latest one, not the
   * first.
   */
  moiUpdateTime?: string;
}

// TWO, per 2026-09-28 direction ("Allow a maximum of two scanning attempts").
// Was four, from the reference asset's "Scan Attempts: 0 / 4".
//
// Both attempts pass over the reader; after the second the scanner locks and
// the manual fallback opens. Nothing in the UI names this number or shows a
// count - see the scanner block below.
export const MAX_SCAN_ATTEMPTS = 2;

// The original budget, still used by the eight journeys that lead with a type
// selector rather than auto-detection.
export const LEGACY_MAX_SCAN_ATTEMPTS = 4;

/**
 * ID types with a physical card the reader can capture, and therefore the
 * scan-first workflow: both faces in one operation, the number read off the
 * document, a four-attempt budget and a manual fallback behind it.
 *
 * Diplomatic ID joined QID on 2026-09-25 - a postpaid connection may be sold
 * directly against either, so both get the same process rather than QID
 * getting a scanner and its equal being typed in by hand.
 *
 * All four supported ID types (Qatar ID, Passport, GCC ID, Diplomatic ID) are scanned before the
 * journey can proceed (2026-10-04): the number is read from the scan, not typed in.
 */
export { SCANNABLE_ID_TYPES } from '../../data/idTypes';

export type IdLookupValue = {
  idType?: QidType;
  idNumber?: string;
  moiResult?: MoiResult;
  qidScans?: QidImageUploadValue;
  /** verifyThenFetch only: the expiry read off the scan (DD/MM/YYYY), editable so the agent can correct it after comparing with the card. */
  scannedExpiry?: string;
  /** The number was typed after the scan budget ran out, not read from a scan: the order needs Store Manager approval. */
  manualEntry?: boolean;
};

// ISO (YYYY-MM-DD) -> DD/MM/YYYY, the format the card shows and the field takes.
// Simulated OCR misread for the blurred first pass: swaps look-alike digits
// (3/8, 1/7, 0/6), guaranteed to differ from the real number.
export const misread = (n: string) => {
  const swap: Record<string, string> = { '3': '8', '8': '3', '1': '7', '7': '1', '0': '6', '6': '0' };
  const i = [...n].findIndex((c) => c in swap);
  if (i < 0) return n.slice(0, -1) + (n.endsWith('9') ? '8' : '9');
  return n.slice(0, i) + swap[n[i]] + n.slice(i + 1);
};

export const isoToDmy = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
};

/**
 * Which identity documents the reader can resolve a scan to.
 *  - The customer's own documents (journey opened from Customer 360): the one of the type the agent selected, never a
 *    different one - a customer who also holds a QID must not have it substituted for the Passport that was chosen.
 *    With no selection (scan-first flow) their QID is preferred where they hold one.
 *  - Otherwise every document of a detectable type.
 */
export function selectScanCandidates<D extends { documentType: string }>({
  docs,
  ownDocs,
  chosenType,
  detectable,
}: {
  docs: D[];
  ownDocs: D[] | undefined;
  chosenType: string | undefined;
  detectable: readonly string[];
}): D[] {
  if (!ownDocs) return docs.filter((d) => detectable.includes(d.documentType));
  if (chosenType) return ownDocs.filter((d) => d.documentType === chosenType);
  return [...ownDocs].sort((a, b) => Number(b.documentType === 'QID') - Number(a.documentType === 'QID'));
}
