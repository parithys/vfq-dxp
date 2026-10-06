import { ID_TYPES } from '../../../data/idTypes';
import type { SummaryField } from './stepSummary';

// Summary field sets shared by the journeys. Each builder takes the draft-values key the journey stores the step's
// value under, so the same set serves journeys that name it differently.

type Values = Record<string, unknown>;
const at = (values: Values, ...path: string[]): unknown => path.reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Values)[k] : undefined), values);
const idTypeLabels = Object.fromEntries(ID_TYPES.map((t) => [t.type, t.label]));
const qar = (n: unknown) => (typeof n === 'number' ? `QAR ${n.toLocaleString('en-GB')}` : undefined);
const PRODUCT = { kind: 'products', idField: 'productId', labelField: 'name' } as const;

/** The ID-lookup result (ID type and number, and the identity the MOI lookup returned). */
export const identitySummary = (key: string): SummaryField[] => [
  { key: 'idType', label: 'ID Type', type: 'select', options: idTypeLabels, value: (v) => at(v, key, 'idType') },
  { key: 'idNumber', label: 'ID Number', type: 'text', sensitive: true, value: (v) => at(v, key, 'idNumber') },
  { key: 'name', label: 'Name', type: 'text', value: (v) => at(v, key, 'moiResult', 'name') },
  { key: 'dob', label: 'Date of Birth', type: 'text', value: (v) => at(v, key, 'moiResult', 'dob') },
  { key: 'nationality', label: 'Nationality', type: 'text', value: (v) => at(v, key, 'moiResult', 'nationality') },
];

/** The Customer Identification form (GuidedContactStep). */
export const contactFormSummary = (key = 'contact'): SummaryField[] => [
  ...identitySummary(key).slice(0, 2),
  { key: 'firstName', label: 'First Name', type: 'text', value: (v) => at(v, key, 'firstName') },
  { key: 'middleName', label: 'Middle Name(s)', type: 'text', optional: true, value: (v) => at(v, key, 'middleName') },
  { key: 'lastName', label: 'Last Name', type: 'text', value: (v) => at(v, key, 'lastName') },
  { key: 'dob', label: 'Date of Birth', type: 'text', value: (v) => at(v, key, 'dob') },
  { key: 'nationality', label: 'Nationality', type: 'text', value: (v) => at(v, key, 'nationality') },
  { key: 'gender', label: 'Gender', type: 'text', value: (v) => at(v, key, 'gender') },
  { key: 'email', label: 'Email', type: 'text', optional: true, value: (v) => at(v, key, 'email') },
  { key: 'altPhone', label: 'Alternate Number', type: 'text', optional: true, value: (v) => at(v, key, 'altPhone') },
  // The form shows English when none was chosen (it is not stored until changed), so the summary does too.
  { key: 'language', label: 'Preferred Language', type: 'text', value: (v) => at(v, key, 'language') ?? 'English' },
];

/** A typed-in address (ZsbAddressStep). */
export const addressFormSummary = (key = 'address'): SummaryField[] => [
  { key: 'zone', label: 'Zone', type: 'text', optional: true, value: (v) => at(v, key, 'zone') },
  { key: 'street', label: 'Street No.', type: 'text', optional: true, value: (v) => at(v, key, 'streetNo') },
  { key: 'building', label: 'Building No.', type: 'text', optional: true, value: (v) => at(v, key, 'buildingNo') },
  { key: 'floor', label: 'Floor', type: 'text', optional: true, value: (v) => at(v, key, 'floor') },
  { key: 'unit', label: 'Flat / Unit', type: 'text', optional: true, value: (v) => at(v, key, 'aptFlatUnit') },
  { key: 'area', label: 'Area / City', type: 'text', optional: true, value: (v) => at(v, key, 'area') },
  { key: 'line', label: 'Address Line', type: 'text', optional: true, value: (v) => at(v, key, 'addressLine') },
];

/** An address picked from the customer's account (stored as its id). */
export const addressPickSummary = (key = 'addressId'): SummaryField[] => [
  { key: 'address', label: 'Installation Address', type: 'select', labelFrom: { kind: 'addresses', idField: 'id', labelField: 'addressLine1' }, value: (v) => at(v, key) },
];

export const planSummary = (productKey = 'productId'): SummaryField[] => [
  { key: 'plan', label: 'Plan', type: 'select', labelFrom: PRODUCT, value: (v) => at(v, productKey) },
];

/** Postpaid plan with its add-ons, discount and bill limit. */
export const planDetailSummary: SummaryField[] = [
  ...planSummary(),
  { key: 'addons', label: 'Add-ons', type: 'multi', optional: true, labelFrom: PRODUCT, value: (v) => at(v, 'addonIds') },
  { key: 'discount', label: 'Discount', type: 'select', optional: true, labelFrom: { kind: 'addons-discounts', idField: 'addonDiscountId', labelField: 'name' }, value: (v) => at(v, 'discountId') },
  { key: 'billLimit', label: 'Bill Limit', type: 'text', optional: true, value: (v) => qar(at(v, 'billLimit')) },
];

export const numberSummary = (priceKey?: string): SummaryField[] => [
  { key: 'msisdn', label: 'Mobile Number', type: 'text', value: (v) => at(v, 'msisdn') },
  ...(priceKey ? [{ key: 'price', label: 'Number Price', type: 'text' as const, optional: true, value: (v: Values) => qar(at(v, priceKey)) }] : []),
];

/** SIM type chosen in the SIM Type step (value object under `key`). */
export const simTypeFormSummary = (key = 'simType'): SummaryField[] => [
  { key: 'simType', label: 'SIM Type', type: 'text', value: (v) => at(v, key, 'simType') },
  { key: 'serial', label: 'SIM Serial Number', type: 'text', optional: true, sensitive: true, value: (v) => at(v, key, 'simSerial') },
  { key: 'iccid', label: 'ICCID', type: 'text', optional: true, sensitive: true, value: (v) => at(v, key, 'simIccid') },
];

export const cafSummary: SummaryField[] = [
  { key: 'type', label: 'CAF Type', type: 'text', value: (v) => at(v, 'caf', 'cafType') },
  { key: 'signed', label: 'Signed', type: 'toggle', value: (v) => Boolean(at(v, 'caf', 'signatureDataUrl')) },
];

export const commentsSummary: SummaryField[] = [{ key: 'comments', label: 'Comments', type: 'text', optional: true, value: (v) => at(v, 'comments') }];

export const appointmentSummary: SummaryField[] = [
  { key: 'cluster', label: 'Cluster', type: 'text', optional: true, value: (v) => at(v, 'appointment', 'cluster') },
  { key: 'date', label: 'Date', type: 'date', optional: true, value: (v) => at(v, 'appointment', 'date') },
  { key: 'slot', label: 'Time Slot', type: 'text', optional: true, value: (v) => at(v, 'appointment', 'timeSlot') },
];

export const donorSummary: SummaryField[] = [
  { key: 'port', label: 'Port-in Number', type: 'text', value: (v) => at(v, 'donorDetails', 'portInNumber') },
  { key: 'donorId', label: 'Donor ID', type: 'text', sensitive: true, value: (v) => at(v, 'donorDetails', 'donorId') },
  { key: 'donorIdType', label: 'Donor ID Type', type: 'text', value: (v) => at(v, 'donorDetails', 'donorIdType') },
];

export const donorAttachmentSummary: SummaryField[] = [
  { key: 'form', label: 'Form Type', type: 'text', value: (v) => at(v, 'donorAttachment', 'mnpFormType') },
  { key: 'signed', label: 'Signed', type: 'toggle', value: (v) => Boolean(at(v, 'donorAttachment', 'signatureDataUrl')) },
];

export const billingProfileSummary: SummaryField[] = [
  { key: 'language', label: 'Language', type: 'text', optional: true, value: (v) => at(v, 'billing', 'language') },
  { key: 'payment', label: 'Payment Method', type: 'text', optional: true, value: (v) => at(v, 'billing', 'paymentMethod') },
  { key: 'media', label: 'Bill Media', type: 'text', optional: true, value: (v) => at(v, 'billing', 'billMedia') },
];

export const idImagesSummary = (key = 'qidImages'): SummaryField[] => [
  { key: 'front', label: 'Front scanned', type: 'toggle', value: (v) => Boolean(at(v, key, 'frontScanned')) },
  { key: 'back', label: 'Back scanned', type: 'toggle', value: (v) => Boolean(at(v, key, 'backScanned')) },
];

export const paymentSummary: SummaryField[] = [
  { key: 'paid', label: 'Paid', type: 'toggle', value: (v) => Boolean(at(v, 'payment', 'paid')) },
  { key: 'ref', label: 'Reference', type: 'text', optional: true, value: (v) => at(v, 'payment', 'reference') },
];
