export interface AccountRecord {
  accountId: string;
  customerId: string;
  accountType: string;
  billingProfileId: string;
}

export interface BillingProfileRecord {
  billingProfileId: string;
  accountId: string;
  name: string;
  billingCycle: string;
  billingAddress: string;
  billMedium: string;
  billingContactName: string;
  billingContactEmail: string;
}

export interface ContactRecord {
  contactRecordId: string;
  customerId: string;
  firstName: string;
  middleName?: string;
  lastName: string;
}

export interface CustomerRecord {
  customerId: string;
  segment: string;
}

export interface NewBillingAccountValue {
  primaryContactId?: string;
  hasSecondaryContact?: boolean;
  secondaryContactName?: string;
  useSameAddress?: boolean;
  newStreet?: string;
  newArea?: string;
  newBuilding?: string;
  preferredInvoiceRecipient?: string;
  /** Auto-computed from computeBillCycleDay(); only overridable for a VIP
   * segment - see that function's own note on the evidenced vs. assumed
   * halves of this rule. */
  billCycleDay?: number;
  billCycleOverride?: boolean;
  /** Only the last 4 digits and a generated token ever persist here - see
   * tokenizeCard()'s own note on why the full number is never stored. */
  cardLast4?: string;
  cardToken?: string;
  profileName?: string;
  billMedia?: string;
  billingSchedule?: string;
}

export interface BillingAccountValue {
  /** Set when the agent picked an account already on file. Mutually
   * exclusive with `creatingNew`. */
  selectedProfileId?: string;
  creatingNew?: boolean;
  newAccount?: NewBillingAccountValue;
  /** Set by BillingAccountAutoResolver: the customer this value was resolved
   * for ('new' when there is no customer record yet). */
  autoResolvedFor?: string;
}

/**
 * "Bill Cycle" (2026-09-28 request): "VIP customers default to the 7th of
 * every month. All other customer segments are assigned to either the 1st
 * or 15th, depending on which date is closer to the three-day submission
 * window."
 *
 * EVIDENCED HALF: business-rules.json's "Default Postpaid Billing Cycle
 * Rule" confirms postpaid profiles default to automatic 1st/15th cycles.
 * ASSUMED HALF: no rule in the corpus defines a "VIP" customer segment or a
 * 7th-of-month VIP default - customers.json's own `segment` values are only
 * ever "Consumer"/"Enterprise" in this app's seed data. Implemented exactly
 * as directed, gated on `segment === 'VIP'` so it activates the moment a
 * VIP-segmented customer record exists, without inventing one now.
 */
export function computeBillCycleDay(segment: string | undefined, asOf: Date): number {
  if (segment === 'VIP') return 7;
  const submissionWindowEnd = new Date(asOf);
  submissionWindowEnd.setDate(submissionWindowEnd.getDate() + 3);
  const day = submissionWindowEnd.getDate();
  return Math.abs(day - 1) <= Math.abs(day - 15) ? 1 : 15;
}

export function ordinal(day: number): string {
  if (day === 1) return '1st';
  if (day === 15) return '15th';
  if (day === 7) return '7th';
  return `${day}th`;
}

/**
 * "Validation of payment details ... is required for successful processing,
 * with only the last four digits of the card and a generated token number
 * stored for security" (2026-09-28) - the raw number this function receives
 * is never returned or stored anywhere past this call, matching that rule.
 *
 * UNEVIDENCED: no payment gateway is named anywhere in this corpus. The
 * screenshot accompanying this request said "Gatan gateway simulation" -
 * kept verbatim in the token prefix and the field's own helper text as a
 * demo label, not a real integration.
 */
export function tokenizeCard(cardNumber: string): { last4: string; token: string } | null {
  const digits = cardNumber.replace(/\D/g, '');
  if (digits.length < 12) return null;
  const last4 = digits.slice(-4);
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 10; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
  return { last4, token: `GATAN-${suffix}` };
}

export const INVOICE_RECIPIENTS = [
  { value: 'Primary Contact', label: 'Primary Contact' },
  { value: 'Secondary Contact', label: 'Secondary Contact' },
];

export const BILL_MEDIA_OPTIONS = [
  { value: 'Email', label: 'Email' },
  { value: 'Paper Bill', label: 'Paper Bill' },
  { value: 'SMS', label: 'SMS' },
];

export const BILLING_SCHEDULE_OPTIONS = [
  { value: 'Immediate', label: 'Immediate' },
  { value: 'Next Cycle', label: 'Next Cycle' },
];

/** Same gate the wizard's own isValid reads - kept alongside the component so
 * the two cannot drift apart. */
export function isBillingAccountValid(value: BillingAccountValue): boolean {
  if (value.selectedProfileId) return true;
  if (!value.creatingNew) return false;
  const a = value.newAccount ?? {};
  if (!a.primaryContactId) return false;
  if (a.hasSecondaryContact && !a.secondaryContactName?.trim()) return false;
  if (!(a.useSameAddress ?? true)) {
    if (!a.newStreet?.trim() || !a.newArea?.trim() || !a.newBuilding?.trim()) return false;
  }
  if (!a.preferredInvoiceRecipient) return false;
  if (!a.cardToken) return false;
  if (!a.profileName?.trim()) return false;
  return true;
}
