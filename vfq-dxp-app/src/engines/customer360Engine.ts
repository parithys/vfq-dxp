import * as mockDataEngine from './mockDataEngine';

export interface CustomerRecord {
  customerId: string;
  qid: string;
  idType: 'QID' | 'Passport';
  name: string;
  dob: string;
  nationality: string;
  segment: string;
  email?: string;
  phone?: string;
  preferredLanguage?: string;
  blacklisted: boolean;
  /** Free-text reason, present in customers.json but previously untyped. */
  blacklistReason?: string;
  /**
   * Which KIND of block, seeded 2026-09-25. The eligibility matrix treats a
   * collections block (soft stop for postpaid, prepaid offered) and a security
   * block (hard stop) as different outcomes, which `blacklisted` alone cannot
   * express. Absent means the block is unclassified, which the eligibility
   * engine treats as a hard stop rather than guessing the lenient branch.
   */
  blacklistCategory?: 'collections' | 'security';
  moiValidationStatus?: string;
  hrnAdvancePaymentRequired?: boolean;
  activePostpaidLines?: number;
  /** Present in customers.json all along; the type was simply not carrying it. */
  activePrepaidLines?: number;
  /**
   * The relationship of the line `phone` identifies - i.e. of the single
   * number, not of the customer. Seeded 2026-09-25 because the two line
   * COUNTS above describe a whole customer and so cannot answer "is this
   * number prepaid or postpaid", which is what the queue notification asks:
   * a customer holding both kinds made them report both at once.
   *
   * Absent for a customer with no active lines, which is a real state here -
   * four of the eight seeded customers are registered with no line at all.
   */
  lineType?: 'Prepaid' | 'Postpaid';
  /** DF-DEMO-001-007 completeness (CUS-001-CAM-08) */
  age?: number;
  gender?: string;
}

export interface AccountRecord {
  accountId: string;
  customerId: string;
  accountType: string;
  status: string;
  billingProfileId?: string;
  subAccountIds?: string[];
  parentAccountId?: string;
}

/**
 * Whether the customer HOLDS an account in their own right or sits under
 * someone else's.
 *
 * Read off accounts.json's `parentAccountId`: an account with none is a
 * top-level account, one with a parent is a sub-account. A customer who holds
 * at least one top-level account is the primary holder; one whose accounts are
 * all sub-accounts is a secondary holder on another account.
 *
 * `undefined` for a customer with no accounts at all - that is not "secondary",
 * it is "not an account holder yet", which is exactly the state a new-connection
 * walk-in is in. Claiming either label there would be wrong.
 */
export function accountHolderStatus(accounts: AccountRecord[]): 'Primary' | 'Secondary' | undefined {
  if (accounts.length === 0) return undefined;
  return accounts.some((a) => !a.parentAccountId) ? 'Primary' : 'Secondary';
}

export type CustomerSearchField = 'mobile' | 'qid' | 'customerNumber' | 'accountNumber' | 'name' | 'email' | 'serviceId';

export interface CustomerSearchResult {
  customer: CustomerRecord;
  matchedOn: CustomerSearchField[];
}

// Universal lookup shared by Customer Search, Support's "create ticket for a
// customer" flow, and Orders - built once rather than re-implemented per
// consumer. "Service ID" has no dedicated field on the customer record
// itself; it's matched via installed-assets.serviceId joined back through
// the owning account.
export async function searchCustomers(query: string): Promise<CustomerSearchResult[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const [customers, accounts, installedAssets] = await Promise.all([
    mockDataEngine.list<CustomerRecord>('customers'),
    mockDataEngine.list<AccountRecord>('accounts'),
    mockDataEngine.list<{ accountId: string; serviceId?: string }>('installed-assets'),
  ]);

  const results: CustomerSearchResult[] = [];
  for (const customer of customers) {
    const matched: CustomerSearchField[] = [];
    if (customer.phone?.toLowerCase().includes(q)) matched.push('mobile');
    if (customer.qid?.toLowerCase().includes(q)) matched.push('qid');
    if (customer.customerId.toLowerCase().includes(q)) matched.push('customerNumber');
    if (customer.name?.toLowerCase().includes(q)) matched.push('name');
    if (customer.email?.toLowerCase().includes(q)) matched.push('email');

    const customerAccounts = accounts.filter((a) => a.customerId === customer.customerId);
    if (customerAccounts.some((a) => a.accountId.toLowerCase().includes(q))) matched.push('accountNumber');

    const customerAccountIds = new Set(customerAccounts.map((a) => a.accountId));
    if (installedAssets.some((asset) => customerAccountIds.has(asset.accountId) && asset.serviceId?.toLowerCase().includes(q))) {
      matched.push('serviceId');
    }

    if (matched.length > 0) results.push({ customer, matchedOn: matched });
  }
  return results;
}

export interface Customer360Data {
  customer: CustomerRecord;
  accounts: AccountRecord[];
  billingProfiles: Record<string, unknown>[];
  orders: Record<string, unknown>[];
  bills: Record<string, unknown>[];
  payments: Record<string, unknown>[];
  adjustments: Record<string, unknown>[];
  creditLimits: Record<string, unknown>[];
  deposits: Record<string, unknown>[];
  tickets: Record<string, unknown>[];
  simSwapOrders: Record<string, unknown>[];
  installedAssets: Record<string, unknown>[];
  cafForms: Record<string, unknown>[];
  identityDocuments: Record<string, unknown>[];
  activities: Record<string, unknown>[];
  notifications: Record<string, unknown>[];
  contacts: Record<string, unknown>[];
  addresses: Record<string, unknown>[];
  penalties: Record<string, unknown>[];
  serviceUsage: Record<string, unknown>[];
  inPlatformBalances: Record<string, unknown>[];
  callDetailRecords: Record<string, unknown>[];
  communications: Record<string, unknown>[];
  /** Field-level change history (audit-trail.json), joined by recordId
   * against this customer's own account/contact ids - Customer 360's
   * "Audit Trail" tab. */
  auditTrail: Record<string, unknown>[];
  /** Pre-sale leads (leads.json), joined by mobileNumber against the
   * customer's phone - Customer 360's "Account/Contact Lead" tab. The two
   * seeded leads don't match any of this corpus's customers, so this is
   * legitimately empty today rather than a broken join. */
  leads: Record<string, unknown>[];
  /** Targeted cross-sell offers (cross-sales-offers.json), joined by
   * contactId against this customer's own contact record ids - Customer
   * 360's "Contact/Assets Information" tab. The seeded offers' contactId
   * (CONT-3001) doesn't match this corpus's contactRecordId values
   * (CTC-40xx), so this is legitimately empty today rather than a broken
   * join. */
  crossSalesOffers: Record<string, unknown>[];
  /** Device-on-installment plans (device-installments.json), joined by
   * accountId - also feeds "Contact/Assets Information". */
  deviceInstallments: Record<string, unknown>[];
}

// Read-side aggregation - no unified "Customer 360" entity exists in the mock
// data layer, so this joins across the entity kinds that already carry a
// customerId (orders/bills/payments/adjustments/creditLimits/tickets/
// cafForms/identityDocuments) or an indirect key (accounts.customerId for
// billing profiles/deposits/installed-assets/activities; orders.customerId
// for sim-swap-orders via msisdn and for order-triggered notifications).
export async function getCustomer360(customerId: string): Promise<Customer360Data | undefined> {
  const [
    customers,
    accounts,
    billingProfiles,
    orders,
    bills,
    payments,
    adjustments,
    creditLimits,
    deposits,
    tickets,
    simSwapOrders,
    installedAssets,
    cafForms,
    identityDocuments,
    activities,
    notifications,
    contacts,
    addresses,
    penalties,
    serviceUsage,
    inPlatformBalances,
    callDetailRecords,
    communications,
    auditTrail,
    leads,
    crossSalesOffers,
    deviceInstallments,
  ] = await Promise.all([
    mockDataEngine.list<CustomerRecord>('customers'),
    mockDataEngine.list<AccountRecord>('accounts'),
    mockDataEngine.list<Record<string, unknown>>('billing-profiles'),
    mockDataEngine.list<Record<string, unknown>>('orders'),
    mockDataEngine.list<Record<string, unknown>>('bills'),
    mockDataEngine.list<Record<string, unknown>>('payments'),
    mockDataEngine.list<Record<string, unknown>>('adjustments'),
    mockDataEngine.list<Record<string, unknown>>('credit-limits'),
    mockDataEngine.list<Record<string, unknown>>('consumer-deposits'),
    mockDataEngine.list<Record<string, unknown>>('trouble-tickets'),
    mockDataEngine.list<Record<string, unknown>>('sim-swap-orders'),
    mockDataEngine.list<Record<string, unknown>>('installed-assets'),
    mockDataEngine.list<Record<string, unknown>>('caf-forms'),
    mockDataEngine.list<Record<string, unknown>>('identity-documents'),
    mockDataEngine.list<Record<string, unknown>>('customer-activities'),
    mockDataEngine.list<Record<string, unknown>>('osb-notifications'),
    mockDataEngine.list<Record<string, unknown>>('customer-contacts'),
    mockDataEngine.list<Record<string, unknown>>('addresses'),
    mockDataEngine.list<Record<string, unknown>>('commitment-penalties'),
    mockDataEngine.list<Record<string, unknown>>('service-usage'),
    mockDataEngine.list<Record<string, unknown>>('in-platform-balances'),
    mockDataEngine.list<Record<string, unknown>>('call-detail-records'),
    mockDataEngine.list<Record<string, unknown>>('customer-communications'),
    mockDataEngine.list<Record<string, unknown>>('audit-trail'),
    mockDataEngine.list<Record<string, unknown>>('leads'),
    mockDataEngine.list<Record<string, unknown>>('cross-sales-offers'),
    mockDataEngine.list<Record<string, unknown>>('device-installments'),
  ]);

  const customer = customers.find((c) => c.customerId === customerId);
  if (!customer) return undefined;

  const customerAccounts = accounts.filter((a) => a.customerId === customerId);
  const accountIds = new Set(customerAccounts.map((a) => a.accountId));
  const billingProfileIds = new Set(customerAccounts.map((a) => a.billingProfileId).filter(Boolean));
  const customerOrders = orders.filter((o) => o.customerId === customerId);
  const orderIds = new Set(customerOrders.map((o) => o.orderId));
  const customerMsisdns = new Set(customerOrders.map((o) => o.msisdn).filter(Boolean));
  const customerContacts = contacts.filter((c) => c.customerId === customerId);
  const contactIds = new Set(customerContacts.map((c) => c.contactRecordId));
  const recordIds = new Set([...accountIds, ...contactIds]);

  return {
    customer,
    accounts: customerAccounts,
    billingProfiles: billingProfiles.filter((bp) => billingProfileIds.has(bp.billingProfileId as string)),
    orders: customerOrders,
    bills: bills.filter((b) => b.customerId === customerId),
    payments: payments.filter((p) => p.customerId === customerId),
    adjustments: adjustments.filter((a) => a.customerId === customerId),
    creditLimits: creditLimits.filter((cl) => cl.customerId === customerId),
    deposits: deposits.filter((d) => accountIds.has(d.accountId as string)),
    tickets: tickets.filter((t) => t.customerId === customerId),
    simSwapOrders: simSwapOrders.filter((s) => customerMsisdns.has(s.msisdn as string)),
    installedAssets: installedAssets.filter((ia) => accountIds.has(ia.accountId as string)),
    cafForms: cafForms.filter((f) => f.customerId === customerId),
    identityDocuments: identityDocuments.filter((d) => d.customerId === customerId),
    activities: activities.filter((a) => accountIds.has(a.accountId as string)),
    notifications: notifications.filter((n) => orderIds.has(n.orderId as string)),
    contacts: customerContacts,
    addresses: addresses.filter((a) => a.customerId === customerId),
    penalties: penalties.filter((p) => p.customerId === customerId),
    serviceUsage: serviceUsage.filter((u) => accountIds.has(u.accountId as string)),
    inPlatformBalances: inPlatformBalances.filter((b) => accountIds.has(b.accountId as string)),
    callDetailRecords: callDetailRecords.filter((c) => accountIds.has(c.accountId as string)),
    communications: communications.filter((c) => c.customerId === customerId),
    auditTrail: auditTrail.filter((r) => recordIds.has(r.recordId as string)),
    leads: leads.filter((l) => l.mobileNumber && l.mobileNumber === customer.phone),
    crossSalesOffers: crossSalesOffers.filter((o) => contactIds.has(o.contactId as string)),
    deviceInstallments: deviceInstallments.filter((d) => accountIds.has(d.accountId as string)),
  };
}

function formatBillPeriod(period: unknown): string {
  const match = /^(\d{4})-(\d{2})$/.exec(String(period ?? ''));
  if (!match) return String(period ?? '-');
  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export interface BillingSummary {
  creditLimit: Record<string, unknown> | undefined;
  latestBill: Record<string, unknown> | undefined;
  billedTotal: number;
  paidTotal: number;
  outstanding: number;
  formattedBillPeriod: string;
  /** CUS-001-BIV-04: the most recent payment on file, isolated as its own
   * atomic field rather than requiring the agent to scan the full Payments
   * table for it. */
  previousPayment: Record<string, unknown> | undefined;
}

// CUS-001-BIV-26: hard 12-month boundary on billing history - "now" is the
// fixed session date (2026-09-14) rather than a live Date.now() call, since
// this mock app has no real clock-driven billing cycle.
const BILL_HISTORY_MONTHS = 12;
const SESSION_TODAY = new Date(2026, 8, 14); // 2026-09-14

export function withinBillHistoryWindow(billPeriod: unknown): boolean {
  const match = /^(\d{4})-(\d{2})$/.exec(String(billPeriod ?? ''));
  if (!match) return true; // unparseable period - don't silently hide it
  const period = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  const cutoff = new Date(SESSION_TODAY.getFullYear(), SESSION_TODAY.getMonth() - BILL_HISTORY_MONTHS, 1);
  return period >= cutoff;
}

// Shared by the Billing tab (full detail) and the Customer 360 header's KPI
// strip (headline numbers only) - one source of truth for "what does this
// customer currently owe" rather than two divergent calculations.
export function computeBillingSummary(data: Customer360Data): BillingSummary {
  const creditLimit = data.creditLimits[0];
  const billsInWindow = data.bills.filter((b) => withinBillHistoryWindow(b.billPeriod));
  const latestBill = [...billsInWindow].sort((a, b) =>
    String(a.billPeriod ?? '').localeCompare(String(b.billPeriod ?? '')),
  ).at(-1);
  const previousPayment = [...data.payments].sort((a, b) =>
    String(a.capturedAt ?? '').localeCompare(String(b.capturedAt ?? '')),
  ).at(-1);

  const billedTotal = billsInWindow
    .filter((b) => b.status === 'billed')
    .reduce((sum, b) => sum + Number(b.totalAmount ?? 0), 0);
  const paidTotal = data.payments.reduce((sum, p) => sum + Number(p.amountQar ?? 0), 0);
  const outstanding = Math.max(0, billedTotal - paidTotal);

  return {
    previousPayment,
    creditLimit,
    latestBill,
    billedTotal,
    paidTotal,
    outstanding,
    formattedBillPeriod: latestBill ? formatBillPeriod(latestBill.billPeriod) : '-',
  };
}

export function toActiveCustomerSummary(customer: CustomerRecord) {
  return {
    customerId: customer.customerId,
    name: customer.name,
    qid: customer.qid,
    idType: customer.idType,
    dob: customer.dob,
    nationality: customer.nationality,
    email: customer.email,
    phone: customer.phone,
    segment: customer.segment,
    blacklisted: customer.blacklisted,
  };
}
