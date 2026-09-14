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
  moiValidationStatus?: string;
  hrnAdvancePaymentRequired?: boolean;
  activePostpaidLines?: number;
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

export type CustomerSearchField = 'mobile' | 'qid' | 'customerNumber' | 'accountNumber' | 'name' | 'email' | 'serviceId';

export interface CustomerSearchResult {
  customer: CustomerRecord;
  matchedOn: CustomerSearchField[];
}

// Universal lookup shared by Customer Search, Support's "create ticket for a
// customer" flow, and Orders — built once rather than re-implemented per
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
}

// Read-side aggregation — no unified "Customer 360" entity exists in the mock
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
  ]);

  const customer = customers.find((c) => c.customerId === customerId);
  if (!customer) return undefined;

  const customerAccounts = accounts.filter((a) => a.customerId === customerId);
  const accountIds = new Set(customerAccounts.map((a) => a.accountId));
  const billingProfileIds = new Set(customerAccounts.map((a) => a.billingProfileId).filter(Boolean));
  const customerOrders = orders.filter((o) => o.customerId === customerId);
  const orderIds = new Set(customerOrders.map((o) => o.orderId));
  const customerMsisdns = new Set(customerOrders.map((o) => o.msisdn).filter(Boolean));

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
  };
}

function formatBillPeriod(period: unknown): string {
  const match = /^(\d{4})-(\d{2})$/.exec(String(period ?? ''));
  if (!match) return String(period ?? '—');
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
}

// Shared by the Billing tab (full detail) and the Customer 360 header's KPI
// strip (headline numbers only) — one source of truth for "what does this
// customer currently owe" rather than two divergent calculations.
export function computeBillingSummary(data: Customer360Data): BillingSummary {
  const creditLimit = data.creditLimits[0];
  const latestBill = [...data.bills].sort((a, b) =>
    String(a.billPeriod ?? '').localeCompare(String(b.billPeriod ?? '')),
  ).at(-1);

  const billedTotal = data.bills
    .filter((b) => b.status === 'billed')
    .reduce((sum, b) => sum + Number(b.totalAmount ?? 0), 0);
  const paidTotal = data.payments.reduce((sum, p) => sum + Number(p.amountQar ?? 0), 0);
  const outstanding = Math.max(0, billedTotal - paidTotal);

  return {
    creditLimit,
    latestBill,
    billedTotal,
    paidTotal,
    outstanding,
    formattedBillPeriod: latestBill ? formatBillPeriod(latestBill.billPeriod) : '—',
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
