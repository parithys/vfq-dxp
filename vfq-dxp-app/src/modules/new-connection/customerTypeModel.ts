import { callService, ServiceError, type FailureKind } from '../../engines/serviceCall';
import type { CompanySelection } from '../../components/domain/CompanySearchInput';
import type { QidImageUploadValue } from '../../components/domain/qidImageUploadModel';
import { mockDataUrl } from '../../engines/mockDataEngine';

export type CustomerType = 'none' | 'b2b2c' | 'retired' | 'mada';

export interface CustomerTypeValue {
  type?: CustomerType;
  company?: CompanySelection;
  officeId?: QidImageUploadValue;
  /** The agent has reviewed and accepted the supporting document (scanned or uploaded). Cleared by any retake or new upload. */
  officeAccepted?: boolean;
  /** The supporting document was uploaded instead of scanned (file name and size only). */
  evidenceUpload?: { fileName: string; sizeBytes: number };
  /** The agent rejected the benefit: the customer continues as Standard, and an employer on the MOI record no longer makes the order B2B2C. */
  rejected?: boolean;
  /** Retired: result of sending the extracted ID number to the government
   * system once the office ID has been scanned. */
  govValidation?: { status: 'checking' | 'passed' | 'failed' | 'error'; message?: string; kind?: FailureKind };
  /** Failed technical attempts at the government check so far (drives Retry vs. the controlled fallback). */
  govAttempts?: number;
}

/**
 * Sends the ID number extracted from the scan to the government system and
 * reports whether it is a valid retiree. SIMULATED: there is no such service
 * in this app, so it reads public/mock-data/govt-retiree-registry.json after a
 * short delay (see that file's _note).
 */
// How long the simulated government check takes (ms).
const GOVT_VALIDATION_DELAY_MS = 3000;

/** Job title that approves a manually-entered identity. There is no separate "Store Manager" title in the agent directory; Sales Manager is the store-level approver (it already approves MNP port-ins). */
export const STORE_MANAGER_ROLE = 'Sales Manager';

/** Job title that approves an order held for an active-postpaid-line limit. The directory has no "Collection Team" title; Credit Control Agent is its collections role. */
export const COLLECTION_TEAM_ROLE = 'Credit Control Agent';

/**
 * Resolves with a BUSINESS result (the system answered: retiree confirmed or not), or
 * throws ServiceError when the system gave no usable answer (unreachable, timed out,
 * non-OK response, malformed or incomplete body). The caller must never turn a
 * ServiceError into "not a retiree".
 */
export async function validateRetiredWithGovernment(idNumber: string | undefined): Promise<{ status: 'passed' | 'failed'; message: string }> {
  await callService('govt-retiree', async () => {
    await new Promise((r) => setTimeout(r, GOVT_VALIDATION_DELAY_MS));
  }, GOVT_VALIDATION_DELAY_MS + 8000);
  if (!idNumber) return { status: 'failed', message: 'No ID number could be read from the scan.' };
  const data = await callService('govt-retiree', async () => {
    const res = await fetch(mockDataUrl('govt-retiree-registry'));
    if (!res.ok) throw new ServiceError('govt-retiree', 'api');
    let body: { retiredIdNumbers?: unknown };
    try {
      body = (await res.json()) as { retiredIdNumbers?: unknown };
    } catch {
      throw new ServiceError('govt-retiree', 'partial');
    }
    // An answer without the list is incomplete - not "nobody is retired".
    if (!Array.isArray(body.retiredIdNumbers)) throw new ServiceError('govt-retiree', 'partial');
    return body.retiredIdNumbers as string[];
  });
  return data.includes(idNumber)
    ? { status: 'passed', message: 'Retired status validated with the government system.' }
    : { status: 'failed', message: 'This ID number could not be validated as a retired customer with the government system.' };
}

export const TYPE_OPTIONS: { key: CustomerType; label: string; description: string }[] = [
  { key: 'none', label: 'Standard customer', description: 'None of B2B2C, Retired or MADA applies' },
  { key: 'b2b2c', label: 'B2B2C', description: 'Employee of a supported partner company' },
  { key: 'retired', label: 'Retired', description: 'Agent validates the applicable information' },
  { key: 'mada', label: 'MADA', description: 'Agent validates the applicable information' },
];

export const customerTypeLabel = (t: CustomerType | undefined) => TYPE_OPTIONS.find((o) => o.key === t)?.label;

/** A company counts as found and supported when it is in the enterprise-accounts
 * registry; "Add new company" (companyIsNew) is not a supported company. */
export const isCompanySupported = (c: CompanySelection | undefined) => Boolean(c?.companyAccountId) && !c?.companyIsNew;

export function isCustomerTypeValid(v: CustomerTypeValue | undefined): boolean {
  if (!v?.type) return false;
  if (v.type === 'none') return true;
  // Evidence is a scanned OR an uploaded supporting document, and the agent must have accepted it.
  const scanned = Boolean(((v.officeId?.frontScanned && v.officeId?.backScanned) || v.evidenceUpload) && v.officeAccepted);
  if (v.type === 'b2b2c') return isCompanySupported(v.company) && scanned;
  if (v.type === 'retired') return scanned && v.govValidation?.status === 'passed';
  return scanned;
}
