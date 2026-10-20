import type { EntityKind } from '../../engines/mockDataEngine';
import { ordinal, profilePatchFromEdit } from '../../components/patterns/billingAccountModel';
import type { BillingAccountValue } from '../../components/patterns/billingAccountModel';

/** What the customer's billing account is for: decides the account's type. */
export type BillingAccountKind = 'Consumer Mobile Postpaid' | 'Consumer Fixed Line (GigaHome)';

/**
 * Makes the billing account of an order real, and returns the billing profile the order is billed to.
 *
 * An existing account the agent (or the auto-resolver) selected is reused as it is. When the customer has none, the
 * journey has built a NEW one (`creatingNew`); this writes it - an `accounts` row and its `billing-profiles` row,
 * flagged `isDefault` unless the agent unticked "primary payment profile" - so it exists for Customer 360 and the next order, instead of only being named on the order.
 * Returns undefined when there is neither, which the order records as no billing profile.
 *
 * A customer who has no record yet (a new customer known only to NAS) gets the rows keyed by their ID number; the
 * journey creates no customer record, so Customer 360 will not list them until one exists.
 */
export async function persistBillingAccount(
  billing: BillingAccountValue | undefined,
  ctx: {
    createRecord: (kind: EntityKind, record: Record<string, unknown>) => Promise<void>;
    /** Saves an edited billing address onto the selected account's profile. Without it an edit stays on the order's draft only. */
    updateRecord?: (kind: EntityKind, idField: string, id: string, patch: Record<string, unknown>) => Promise<void>;
    kind: BillingAccountKind;
    customerId?: string;
    idNumber?: string;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    /** The address the bill goes to, as a line. */
    addressLine?: string;
    /** The credit limit set for a new postpaid account. */
    creditLimitQar?: number;
  }
): Promise<string | undefined> {
  if (billing?.selectedProfileId) {
    // The agent edited the selected account: what they changed is saved on that account's profile.
    if (billing.editingProfileId === billing.selectedProfileId && billing.newAccount && ctx.updateRecord) {
      const patch = profilePatchFromEdit(billing.newAccount);
      if (Object.keys(patch).length) await ctx.updateRecord('billing-profiles', 'billingProfileId', billing.selectedProfileId, patch);
    }
    return billing.selectedProfileId;
  }
  const fresh = billing?.creatingNew ? billing.newAccount : undefined;
  if (!fresh) return undefined;
  const stamp = Date.now().toString().slice(-6);
  const accountId = `ACC-${stamp}`;
  const billingProfileId = `BILL-${stamp}`;
  await ctx.createRecord('accounts', {
    accountId,
    customerId: ctx.customerId,
    idNumber: ctx.idNumber,
    accountType: ctx.kind,
    status: 'Active',
    billingProfileId,
  });
  await ctx.createRecord('billing-profiles', {
    billingProfileId,
    accountId,
    name: fresh.profileName ?? `${ctx.contactName ?? 'Customer'} - ${ctx.kind === 'Consumer Mobile Postpaid' ? 'Postpaid' : 'Fixed Line'}`,
    // The first profile a customer has is their primary payment profile; the agent can untick it when they already have one.
    isDefault: fresh.primaryPaymentProfile ?? true,
    billingCycle: fresh.billCycleDay ? `Monthly - Day ${fresh.billCycleDay}` : 'Monthly',
    billCycleLabel: fresh.billCycleDay ? ordinal(fresh.billCycleDay) : undefined,
    billingType: fresh.billingMode ?? 'Arrears',
    billingAddress: ctx.addressLine,
    billMedium: fresh.billMedia ?? 'Email',
    billingSchedule: fresh.billingSchedule,
    autoPayStatus: fresh.cardToken ? 'Enrolled' : 'Not enrolled',
    paymentMethod: fresh.cardToken ? 'Card on file' : undefined,
    cardLast4: fresh.cardLast4,
    collectionStatus: 'Good Standing',
    creditLimitQAR: ctx.creditLimitQar,
    promiseToPayStatus: 'None',
    billingContactName: ctx.contactName,
    billingContactPhone: ctx.contactPhone,
    billingContactEmail: ctx.contactEmail,
    previousOutstandingQAR: 0,
  });
  return billingProfileId;
}
