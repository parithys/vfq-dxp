// Documents of a journey, in one place: what the order REQUIRES the agent to attach (decided by the scenario the journey is in and by who is
// working it), and every document the journey already holds (the ID scans, the special-discount evidence, the signed CAF, what was uploaded).
// Additional Documents - the end of the journey, after the CAF is signed - is where both are shown. Scenario-specific supporting documents
// are requested there and nowhere earlier.
//
// Pure: reads the draft values and the persona, writes nothing.

export interface DocumentRequirement {
  /** Stable key: an uploaded document records the requirement it satisfies. */
  id: string;
  label: string;
  /** Why it is asked for, shown beside it. */
  reason: string;
}

export interface JourneyDocument {
  id: string;
  label: string;
  /** Where in the journey it came from. */
  source: string;
  fileName?: string;
  /** Content that can be opened and downloaded; absent for a capture the reader did not keep an image of. */
  dataUrl?: string;
  /** For an upload held in the session file store rather than in the values. */
  fileId?: string;
}

import { getDocumentTypes } from './configEngine';
import type { DocumentTypeConfig } from '../types/config';

export const MINIMUM_APPLICANT_AGE = 18;

/** The applicant's age in whole years from a DD/MM/YYYY date of birth; undefined when it is not on record (unknown stays unknown). */
export function ageFromDob(dob: string | undefined, now: Date = new Date()): number | undefined {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dob ?? '');
  if (!m) return undefined;
  const d = Number(m[1]), mo = Number(m[2]), y = Number(m[3]);
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < mo || (now.getMonth() + 1 === mo && now.getDate() < d)) age -= 1;
  return age;
}

type Values = Record<string, unknown>;

/**
 * The named conditions a document type's rules can use, each computed from the journey draft. The vocabulary is code (it says what a draft can
 * answer); which document uses which condition is configuration (public/config/document-types.json).
 */
const CONDITIONS: Record<string, (v: Values) => boolean> = {
  'number-waiver': (v) => v.numberWaiver === 'partial' || v.numberWaiver === 'full',
  'minor-applicant': (v) => {
    const age = ageFromDob((v.contact as { moiResult?: { dob?: string } } | undefined)?.moiResult?.dob);
    return age !== undefined && age < MINIMUM_APPLICANT_AGE;
  },
  'actual-user-other': (v) => (v.actualUser as { choice?: string } | undefined)?.choice === 'other',
  'manual-caf': (v) => (v.caf as { cafType?: string } | undefined)?.cafType === 'Manual',
  'upfront-payment': (v) => ((v.checkoutTotals as { dueTodayQar?: number } | undefined)?.dueTodayQar ?? 0) > 0,
};
const specialDiscount = (v: Values, kind: string) => {
  const c = v.customerType as { type?: string; rejected?: boolean } | undefined;
  return c?.type === kind && !c.rejected;
};
/** Whether a named condition holds; an unknown name never holds (unknown stays unknown). */
function holds(name: string, v: Values): boolean {
  if (name.startsWith('special-discount:')) return specialDiscount(v, name.slice('special-discount:'.length));
  return CONDITIONS[name]?.(v) ?? false;
}

export interface DocumentContext {
  values: Values;
  personaId?: string;
  /** The journey family (e.g. 'new-connection'). */
  journey?: string;
}

/** Whether a document type applies in this context: every dimension it names must match; an empty list matches nothing, an omitted one anything. */
export function documentTypeApplies(t: DocumentTypeConfig, ctx: DocumentContext): boolean {
  const a = t.appliesTo;
  if (!a) return true;
  const v = ctx.values;
  const contact = v.contact as { idType?: string } | undefined;
  const segment = (v.eligibility as { segment?: string } | undefined)?.segment;
  const product = v.product as string | undefined;
  if (a.journeys && !(ctx.journey !== undefined && a.journeys.includes(ctx.journey))) return false;
  if (a.personas && !(ctx.personaId !== undefined && a.personas.includes(ctx.personaId))) return false;
  if (a.products && !(product !== undefined && a.products.includes(product))) return false;
  if (a.idTypes && !(contact?.idType !== undefined && a.idTypes.includes(contact.idType))) return false;
  if (a.segments && !(segment !== undefined && a.segments.some((p) => segment.startsWith(p)))) return false;
  if (a.conditions && !a.conditions.every((c) => holds(c, v))) return false;
  return true;
}

/** The documents this order requires, for the journey it is in, the role working it and the customer: the configured types whose requiredWhen all hold. */
export function requiredDocumentsFor(ctx: DocumentContext): DocumentRequirement[] {
  return getDocumentTypes()
    .filter((t) => t.requiredWhen?.length && documentTypeApplies(t, ctx) && t.requiredWhen.every((c) => holds(c, ctx.values)))
    .map((t) => ({ id: t.id, label: t.label, reason: t.reason ?? 'Required for this order.' }));
}

/** The labels offered in the Document Type list: every configured type that applies here, except those already asked for as a required card. */
export function documentTypeOptionsFor(ctx: DocumentContext): string[] {
  const required = new Set(requiredDocumentsFor(ctx).map((r) => r.id));
  return getDocumentTypes().filter((t) => !required.has(t.id) && documentTypeApplies(t, ctx)).map((t) => t.label);
}

interface Scan {
  frontScanned?: boolean;
  backScanned?: boolean;
  frontImage?: string;
  backImage?: string;
  frontFile?: string;
  backFile?: string;
  combined?: boolean;
  source?: 'scan' | 'upload';
}

function scanDocuments(prefix: string, label: string, source: string, scan: Scan | undefined): JourneyDocument[] {
  if (!scan) return [];
  const how = scan.source === 'upload' ? 'Uploaded' : 'Scanned';
  const out: JourneyDocument[] = [];
  if (scan.frontScanned) out.push({ id: `${prefix}-front`, label: `${label}${scan.combined ? ' (Both Sides)' : ' (Front)'}`, source: `${source} · ${how}`, fileName: scan.frontFile, dataUrl: scan.frontImage });
  if (scan.backScanned && !scan.combined) out.push({ id: `${prefix}-back`, label: `${label} (Back)`, source: `${source} · ${how}`, fileName: scan.backFile, dataUrl: scan.backImage });
  return out;
}

/** Every document the journey holds so far, in the order the journey collected them. */
export function consolidatedDocuments(values: Record<string, unknown>, uploaded: { id: string; label: string; fileName: string }[] = []): JourneyDocument[] {
  const contact = values.contact as { idType?: string; qidScans?: Scan } | undefined;
  const type = values.customerType as { type?: string; officeId?: Scan; rejected?: boolean } | undefined;
  const caf = values.caf as { signatureDataUrl?: string; secondarySignatureDataUrl?: string } | undefined;
  const officeLabel = type?.type === 'b2b2c' ? 'Office ID Card' : type?.type === 'retired' ? 'Retiree Supporting Document' : type?.type === 'mada' ? 'MADA Supporting Document' : 'Supporting Document';
  return [
    ...scanDocuments('id', contact?.idType ? `${contact.idType} ID Document`.replace('ID ID', 'ID') : 'ID Document', 'Customer Verification', contact?.qidScans),
    ...(type && type.type && type.type !== 'none' && !type.rejected ? scanDocuments('special', officeLabel, 'Special Discounts', type.officeId) : []),
    ...(caf?.signatureDataUrl ? [{ id: 'caf-signature', label: 'Signed CAF', source: 'CAF & Signature', fileName: 'signed-caf.png', dataUrl: caf.signatureDataUrl }] : []),
    ...(caf?.secondarySignatureDataUrl ? [{ id: 'caf-secondary', label: 'Supplementary Form Signature', source: 'CAF & Signature', fileName: 'supplementary-signature.png', dataUrl: caf.secondarySignatureDataUrl }] : []),
    ...uploaded.map((u) => ({ id: `upload-${u.id}`, label: u.label, source: 'Additional Documents · Uploaded', fileName: u.fileName, fileId: u.id })),
  ];
}
