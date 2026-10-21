import type { EntityKind } from '../../engines/mockDataEngine';
import { actualUserIdentity, contactUpdateFor, supplementaryRows } from './actualUserModel';
import type { ActualUserValue } from './actualUserModel';

type UpdateRecord = (kind: EntityKind, idField: string, id: string, patch: Record<string, unknown>) => Promise<void>;

/** What the order records about the line's actual user (nothing when the primary customer uses it). The Supplementary Form was signed with the CAF. */
export function actualUserOrderFields(v: ActualUserValue | undefined): Record<string, unknown> {
  const i = actualUserIdentity(v);
  if (!i) return {};
  return {
    actualUser: {
      name: i.moiResult?.name,
      customerId: i.moiResult?.isNewCustomer ? undefined : i.moiResult?.customerId,
      isNewCustomer: Boolean(i.moiResult?.isNewCustomer),
      idType: i.idType,
      idNumber: i.idNumber,
      nationality: i.moiResult?.nationality,
      dob: i.moiResult?.dob,
      email: i.email,
      alternatePhone: i.altPhone,
    },
    supplementaryForm: { signedWithCaf: true, rows: supplementaryRows(v) },
  };
}

/** An actual user who is already a customer keeps the email the agent confirmed or changed on their own record. Returns whether anything was written. */
export async function saveActualUserContact(v: ActualUserValue | undefined, updateRecord: UpdateRecord | undefined): Promise<boolean> {
  const update = contactUpdateFor(v);
  if (!update || !updateRecord) return false;
  await updateRecord('customers', 'customerId', update.customerId, update.patch);
  return true;
}
