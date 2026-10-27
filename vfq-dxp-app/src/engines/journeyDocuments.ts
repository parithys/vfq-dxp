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

interface RequirementRule {
  id: string;
  label: string;
  reason: string;
  /** The journeys it applies to (the draft's wizard family); omitted = every journey. */
  journeys?: readonly string[];
  /** Roles it applies to; omitted = every role. */
  personas?: readonly string[];
  applies: (values: Record<string, unknown>) => boolean;
}

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

const RULES: readonly RequirementRule[] = [
  {
    id: 'waive-off-support',
    label: 'Waive Off Supporting Document',
    reason: 'Supports the Waive Off of the Star number charge; the order is approved against it.',
    journeys: ['new-connection'],
    applies: (v) => v.numberWaiver === 'partial' || v.numberWaiver === 'full',
  },
  {
    id: 'court-type-order',
    label: 'Court Type Order',
    reason: 'The applicant is under 18: the order is accepted only with the court order that allows it.',
    applies: (v) => {
      const moi = (v.contact as { moiResult?: { dob?: string } } | undefined)?.moiResult;
      const age = ageFromDob(moi?.dob);
      return age !== undefined && age < MINIMUM_APPLICANT_AGE;
    },
  },
];

/** The documents this order requires, for the journey it is in and the role working it. */
export function requiredDocumentsFor(ctx: { values: Record<string, unknown>; personaId?: string; journey?: string }): DocumentRequirement[] {
  return RULES.filter((r) => (!r.journeys || !ctx.journey || r.journeys.includes(ctx.journey)) && (!r.personas || (ctx.personaId !== undefined && r.personas.includes(ctx.personaId))) && r.applies(ctx.values)).map(
    ({ id, label, reason }) => ({ id, label, reason })
  );
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
