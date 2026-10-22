import type { GuidedContactValue } from '../../components/patterns/guidedContactModel';
import { isValidEmail, isValidAltPhone } from '../../components/patterns/guidedContactModel';
import { ageOn, MINIMUM_AGE } from '../../engines/eligibilityEngine';

/**
 * ACTUAL USER - who will really use the line when it is not the customer who owns it (a parent buys, the daughter uses the SIM).
 * The customer stays the primary owner and signs the CAF; the actual user is identified like the primary (ID type, scan, MOI, email,
 * phone) and is named on the Supplementary Form.
 *
 * `choice` absent means the default: the primary customer uses the line.
 *
 * The eligibility checks are NOT run for an actual user, because the primary customer stays accountable for the MSISDN and the connection
 * counts against the primary customer's own limit: Number of Connections, HRN, and the Collections, Grey List and Security blacklists.
 * The one rule that applies to the actual user is age: only someone under 18 can be added (see actualUserAgeProblem).
 */
export interface ActualUserValue {
  choice?: 'primary' | 'other';
  /** The actual user's identification and contact details - the same value Customer Identification produces for the primary. */
  identity?: GuidedContactValue;
}

export const isOtherUser = (v: ActualUserValue | undefined): boolean => v?.choice === 'other';

/** The actual user's details once they are complete: identified (MOI), a valid email, an alternate phone only if it is valid. */
export function actualUserIdentity(v: ActualUserValue | undefined): GuidedContactValue | undefined {
  const i = v?.identity;
  if (!isOtherUser(v) || !i?.moiResult) return undefined;
  if (!isValidEmail(i.email)) return undefined;
  if (i.altPhone && !isValidAltPhone(i.altPhone)) return undefined;
  return i;
}

/**
 * Why this person cannot be the actual user on age, or undefined when they can: only customers below 18 may be added; 18 and over are not
 * allowed. A date of birth that is not on record cannot be judged, so it blocks too (unknown stays unknown).
 */
export function actualUserAgeProblem(identity: GuidedContactValue | undefined, asOf: Date = new Date()): string | undefined {
  const dob = identity?.moiResult?.dob;
  if (!identity?.moiResult) return undefined;
  const age = ageOn(dob, asOf);
  if (age === undefined) return 'The date of birth is not on record, so the age cannot be checked. An actual user must be under 18.';
  return age >= MINIMUM_AGE ? `Only customers under ${MINIMUM_AGE} can be added as an actual user. This customer is ${age}.` : undefined;
}

/** The step may continue when the primary customer uses the line, or the actual user is fully identified and is not the primary themself. */
export function isActualUserValid(v: ActualUserValue | undefined, primaryIdNumber?: string): boolean {
  if (!isOtherUser(v)) return true;
  const i = actualUserIdentity(v);
  if (!i) return false;
  if (actualUserAgeProblem(i)) return false;
  return !sameId(i.idNumber, primaryIdNumber);
}

/** The actual user cannot be the primary customer: the same ID number means "the primary customer uses the line". */
export const sameId = (a?: string, b?: string): boolean => Boolean(a && b) && a!.replace(/\s/g, '').toUpperCase() === b!.replace(/\s/g, '').toUpperCase();

/** What the Supplementary Form shows about the actual user (label/value rows), or none when the primary customer uses the line. */
export function supplementaryRows(v: ActualUserValue | undefined): { label: string; value: string }[] {
  const i = actualUserIdentity(v);
  if (!i) return [];
  return [
    { label: 'Actual user', value: i.moiResult?.name ?? '-' },
    { label: i.idType ? `${i.idType} number` : 'ID number', value: i.idNumber ?? '-' },
    { label: 'Nationality', value: i.moiResult?.nationality ?? '-' },
    { label: 'Date of birth', value: i.moiResult?.dob ?? '-' },
    { label: 'Email', value: i.email ?? '-' },
    ...(i.altPhone ? [{ label: 'Alternate phone', value: i.altPhone }] : []),
  ];
}

/**
 * For an actual user who is already a customer: the contact details the agent confirmed or changed, to write back to their record so the
 * record and the Supplementary Form agree. Only what differs from the record is returned; nothing for a new person.
 */
export function contactUpdateFor(v: ActualUserValue | undefined): { customerId: string; patch: { email?: string } } | undefined {
  const i = actualUserIdentity(v);
  const m = i?.moiResult;
  if (!i || !m?.customerId || m.isNewCustomer) return undefined;
  const patch: { email?: string } = {};
  if (i.email && i.email !== m.email) patch.email = i.email;
  return Object.keys(patch).length ? { customerId: m.customerId, patch } : undefined;
}

/**
 * Which customer the simulated card reader presents for the actual user: the first customer under 18, other than the primary, holding an
 * unexpired QID with a real QID number (11-14 digits). By rule, not by name.
 */
export function pickDemoReaderCustomer(
  customers: { customerId: string; dob?: string }[],
  docs: { customerId: string; documentType: string; documentNumber: string; expiryDate?: string }[],
  primaryCustomerId: string | undefined,
  asOf: Date = new Date()
): string | undefined {
  return customers.find((c) => {
    if (c.customerId === primaryCustomerId) return false;
    const age = ageOn(c.dob, asOf);
    if (age === undefined || age >= MINIMUM_AGE) return false;
    return docs.some(
      (d) => d.customerId === c.customerId && d.documentType === 'QID' && /^\d{11,14}$/.test(d.documentNumber) && (!d.expiryDate || new Date(d.expiryDate) >= asOf)
    );
  })?.customerId;
}
