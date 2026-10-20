/**
 * A credit limit change is not applied by the agent: it is REQUESTED, and the relevant team (Credit Control) approves or rejects it. The request is an
 * order of this type in the approval queue; approving it applies the new limit (see applyCreditLimitChange), rejecting it leaves the limit as it was.
 */
export const CREDIT_LIMIT_CHANGE_ORDER_TYPE = 'Credit Limit Change';

export interface CreditLimitChangeOrder {
  orderType?: unknown;
  customerId?: unknown;
  requestedCreditLimitQar?: unknown;
  accountId?: unknown;
}

/** The change a Credit Limit Change order asks for, or undefined when the order is not one (or is missing what it needs). */
export const creditLimitChangeOf = (o: CreditLimitChangeOrder): { customerId: string; creditLimitQar: number; accountId?: string } | undefined =>
  o.orderType === CREDIT_LIMIT_CHANGE_ORDER_TYPE && typeof o.customerId === 'string' && typeof o.requestedCreditLimitQar === 'number'
    ? { customerId: o.customerId, creditLimitQar: o.requestedCreditLimitQar, accountId: typeof o.accountId === 'string' ? o.accountId : undefined }
    : undefined;

interface Deps {
  list: (kind: 'credit-limits') => Promise<{ id: string; customerId?: string }[]>;
  updateRecord: (kind: 'credit-limits', idField: string, id: string, patch: Record<string, unknown>) => Promise<void>;
  createRecord: (kind: 'credit-limits', record: Record<string, unknown>) => Promise<void>;
}

/** Writes the approved limit: onto the customer's credit-limit record, or a new one when they have none. */
export async function applyCreditLimitChange(change: { customerId: string; creditLimitQar: number; accountId?: string }, deps: Deps, today = new Date().toISOString().slice(0, 10)): Promise<void> {
  const existing = (await deps.list('credit-limits')).find((r) => r.customerId === change.customerId);
  if (existing) await deps.updateRecord('credit-limits', 'id', existing.id, { creditLimitQar: change.creditLimitQar, lastUpdated: today });
  else await deps.createRecord('credit-limits', { id: `CRL-${Date.now().toString().slice(-6)}`, customerId: change.customerId, accountId: change.accountId, creditLimitQar: change.creditLimitQar, lastUpdated: today });
}
