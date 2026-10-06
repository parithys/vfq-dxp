import { ID_TYPES } from '../../../data/idTypes';
import type { SummaryField } from '../../../components/patterns/wizard/stepSummary';

// What the running Summary panel shows for each New Connection step once it is completed. Every field reads the
// journey's own draft values (the same object the steps write to); labels that are stored as ids are resolved from the
// data set they came from.

type Values = Record<string, unknown>;
const at = (values: Values, ...path: string[]): unknown => path.reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Values)[k] : undefined), values);

const idTypeLabels = Object.fromEntries(ID_TYPES.map((t) => [t.type, t.label]));
const qar = (n: unknown) => (typeof n === 'number' ? `QAR ${n.toLocaleString('en-GB')}` : undefined);

export const contactSummary: SummaryField[] = [
  { key: 'idType', label: 'ID Type', type: 'select', options: idTypeLabels, value: (v) => at(v, 'contact', 'idType') },
  { key: 'idNumber', label: 'ID Number', type: 'text', sensitive: true, value: (v) => at(v, 'contact', 'idNumber') },
  { key: 'firstName', label: 'First Name', type: 'text', value: (v) => at(v, 'contact', 'firstName') },
  { key: 'middleName', label: 'Middle Name(s)', type: 'text', optional: true, value: (v) => at(v, 'contact', 'middleName') },
  { key: 'lastName', label: 'Last Name', type: 'text', value: (v) => at(v, 'contact', 'lastName') },
  { key: 'dob', label: 'Date of Birth', type: 'text', value: (v) => at(v, 'contact', 'dob') },
  { key: 'nationality', label: 'Nationality', type: 'text', value: (v) => at(v, 'contact', 'nationality') },
  { key: 'gender', label: 'Gender', type: 'text', value: (v) => at(v, 'contact', 'gender') },
  { key: 'mobile', label: 'Mobile Number', type: 'text', optional: true, value: (v) => at(v, 'contact', 'mobileNumber') },
  { key: 'altPhone', label: 'Alternate Number', type: 'text', optional: true, value: (v) => at(v, 'contact', 'altPhone') },
  { key: 'email', label: 'Email', type: 'text', optional: true, value: (v) => at(v, 'contact', 'email') },
  // The form shows English when none was chosen (it is not stored until changed), so the summary does too.
  { key: 'language', label: 'Preferred Language', type: 'text', value: (v) => at(v, 'contact', 'language') ?? 'English' },
  {
    key: 'customerType',
    label: 'Customer Type',
    type: 'select',
    options: { none: 'Standard', b2b2c: 'B2B2C (employer sponsored)', retired: 'Retired', mada: 'MADA' },
    optional: true,
    value: (v) => at(v, 'customerType', 'type'),
  },
  { key: 'employer', label: 'Employer', type: 'text', optional: true, value: (v) => at(v, 'contact', 'companyName') },
];

export const crossSalesSummary: SummaryField[] = [
  {
    key: 'decision',
    label: 'Recommended offer',
    type: 'select',
    options: { accepted: 'Accepted', declined: 'Declined', none: 'No offer available' },
    value: (v) => at(v, 'crossSales', 'decision'),
  },
  { key: 'offer', label: 'Offer', type: 'text', optional: true, value: (v) => at(v, 'crossSales', 'offerName') },
];

export const planSummary: SummaryField[] = [
  { key: 'plan', label: 'Plan', type: 'select', labelFrom: { kind: 'products', idField: 'productId', labelField: 'name' }, value: (v) => at(v, 'productId') },
  { key: 'addons', label: 'Add-ons', type: 'multi', optional: true, labelFrom: { kind: 'products', idField: 'productId', labelField: 'name' }, value: (v) => at(v, 'addonIds') },
  { key: 'discount', label: 'Discount', type: 'select', optional: true, labelFrom: { kind: 'addons-discounts', idField: 'addonDiscountId', labelField: 'name' }, value: (v) => at(v, 'discountId') },
  { key: 'billLimit', label: 'Bill Limit', type: 'text', optional: true, value: (v) => at(v, 'billLimit') },
];

export const addressSummary: SummaryField[] = [
  { key: 'zone', label: 'Zone', type: 'text', optional: true, value: (v) => at(v, 'address', 'zone') },
  { key: 'street', label: 'Street No.', type: 'text', optional: true, value: (v) => at(v, 'address', 'streetNo') },
  { key: 'building', label: 'Building No.', type: 'text', optional: true, value: (v) => at(v, 'address', 'buildingNo') },
  { key: 'floor', label: 'Floor', type: 'text', optional: true, value: (v) => at(v, 'address', 'floor') },
  { key: 'unit', label: 'Flat / Unit', type: 'text', optional: true, value: (v) => at(v, 'address', 'aptFlatUnit') },
  { key: 'area', label: 'Area / City', type: 'text', optional: true, value: (v) => at(v, 'address', 'area') },
  { key: 'line', label: 'Address Line', type: 'text', optional: true, value: (v) => at(v, 'address', 'addressLine') },
  { key: 'kahramaa', label: 'Kahramaa ID', type: 'text', optional: true, sensitive: true, value: (v) => at(v, 'address', 'kahramaaId') },
];

export const billingAccountSummary: SummaryField[] = [
  {
    key: 'account',
    label: 'Billing Account',
    type: 'select',
    labelFrom: { kind: 'billing-profiles', idField: 'billingProfileId', labelField: 'name' },
    value: (v) => at(v, 'billingAccount', 'selectedProfileId'),
    when: (v) => !at(v, 'billingAccount', 'creatingNew'),
  },
  { key: 'profileName', label: 'New Profile Name', type: 'text', value: (v) => at(v, 'billingAccount', 'newAccount', 'profileName'), when: (v) => Boolean(at(v, 'billingAccount', 'creatingNew')) },
  { key: 'billMedia', label: 'Bill Medium', type: 'text', optional: true, value: (v) => at(v, 'billingAccount', 'newAccount', 'billMedia'), when: (v) => Boolean(at(v, 'billingAccount', 'creatingNew')) },
  { key: 'schedule', label: 'Billing Schedule', type: 'text', optional: true, value: (v) => at(v, 'billingAccount', 'newAccount', 'billingSchedule'), when: (v) => Boolean(at(v, 'billingAccount', 'creatingNew')) },
  { key: 'cycleDay', label: 'Bill Cycle Day', type: 'text', optional: true, value: (v) => at(v, 'billingAccount', 'newAccount', 'billCycleDay'), when: (v) => Boolean(at(v, 'billingAccount', 'creatingNew')) },
  { key: 'card', label: 'Card', type: 'text', optional: true, sensitive: true, value: (v) => at(v, 'billingAccount', 'newAccount', 'cardLast4'), when: (v) => Boolean(at(v, 'billingAccount', 'creatingNew')) },
];

export const numberSummary: SummaryField[] = [
  { key: 'msisdn', label: 'Mobile Number', type: 'text', value: (v) => at(v, 'msisdn') },
  { key: 'price', label: 'Number Price', type: 'text', optional: true, value: (v) => qar(at(v, 'numberPriceQAR')) },
];

export const simTypeSummary: SummaryField[] = [
  { key: 'simType', label: 'SIM Type', type: 'text', value: (v) => at(v, 'simType', 'simType') },
  { key: 'serial', label: 'SIM Serial Number', type: 'text', optional: true, sensitive: true, value: (v) => at(v, 'simType', 'simSerial') },
  { key: 'iccid', label: 'ICCID', type: 'text', optional: true, sensitive: true, value: (v) => at(v, 'simType', 'simIccid') },
];

export const checkoutSummary: SummaryField[] = [
  { key: 'due', label: 'Total Payable Today', type: 'text', value: (v) => qar(at(v, 'checkoutTotals', 'dueTodayQar')) },
  { key: 'monthly', label: 'Monthly Recurring', type: 'text', value: (v) => qar(at(v, 'checkoutTotals', 'monthlyRecurringQar')) },
];

export const cafSummary: SummaryField[] = [
  { key: 'type', label: 'CAF Type', type: 'text', value: (v) => at(v, 'caf', 'cafType') },
  { key: 'signed', label: 'Signed', type: 'toggle', value: (v) => Boolean(at(v, 'caf', 'signatureDataUrl')) },
];
