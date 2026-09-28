import { useState } from 'react';

interface ScannedIdPreviewProps {
  side: 'front' | 'back';
  /** A real captured image, when one exists. Falls back to the drawn card. */
  src?: string;
  /**
   * Which document this depicts. Drives the alt text, the specimen fields
   * drawn on the card, and, on a Qatar ID back, the barcode that card
   * carries and the others do not.
   */
  documentType?: string;
  /**
   * Whether this capture is sharp enough to read (2026-09-28). False draws
   * the same card blurred, simulating a first pass the reader could not OCR -
   * the agent has to Retake before the card is legible. Defaults to true, so
   * every existing caller (VerificationGate, SIM Swap, Passport-to-QID) keeps
   * rendering a crisp card exactly as before; only IdLookupStep's scan-first
   * flow ever passes false.
   */
  clear?: boolean;
}

/**
 * Bar widths for the drawn barcode on the back of a Qatar ID, in viewBox
 * units. Even indices are bars, odd indices the gaps between them, which is
 * why the array alternates rather than listing bars alone.
 *
 * FIXED, not random. `Math.random()` here would re-lay the pattern on every
 * render - a barcode that reshuffles while you look at it - and would make
 * screenshots of this step differ run to run for no reason. The widths sum to
 * 51 units, which is what BARCODE_W below has to agree with.
 */
const BARCODE_BARS = [
  2, 1, 1, 3, 1, 2, 1, 1, 2, 3, 1, 1, 2, 1, 3, 1, 1, 2, 2, 1, 1, 3, 1, 1, 2, 1, 2, 1, 3, 1, 1, 2,
];
const BARCODE_W = 51;
/** Right-aligned to the same 18-unit margin the data lines use on the left. */
const BARCODE_X = 214 - 18 - BARCODE_W;
const BARCODE_Y = 46;

// Laid out once at module load: the offsets never change, so recomputing them
// per render would buy nothing.
const BARCODE_RECTS = (() => {
  const rects: { x: number; w: number }[] = [];
  let cursor = 0;
  BARCODE_BARS.forEach((w, i) => {
    if (i % 2 === 0) rects.push({ x: cursor, w });
    cursor += w;
  });
  return rects;
})();

interface Specimen {
  name: string;
  idLabel: string;
  idNo: string;
  nationality: string;
  dob: string;
  expiry: string;
  back: { label: string; value: string }[];
  /** Two-line MRZ-shaped filler - not a real checksum-valid MRZ, just laid
   * out to the right character shapes so it reads as one at a glance. */
  mrz: [string, string];
}

/**
 * One specimen per document type, grounded in this corpus's own seeded data
 * rather than invented (2026-09-28 direction: "realistic demo
 * text/information appropriate to that ID type").
 *
 * Deliberately the SAME record `readDocumentFromScan` resolves for each type
 * in the scan-first flow, verified by replicating that function's own
 * selection - NOT just identity-documents.json's first entry of the type:
 * `readDocumentFromScan` skips an expired candidate in favour of a later
 * unexpired one, falling back to the first only if every candidate has
 * expired. QID/Passport/GCC ID each have one unexpired candidate that is
 * also array-first, so those three match their first entry. Diplomatic ID
 * does not: its first entry (Sophie Laurent, DIP-QA-004521) is expired
 * (31/08/2025, before this app's 2026-09-28 "now"), so the function actually
 * resolves the SECOND Diplomatic ID record, Henrik Lindqvist/DIP-QA-004977 -
 * confirmed by running the exact same find() this app's code runs, not
 * assumed from array order. Getting this wrong would show one identity on
 * the card and a different one in the form once the scan resolves.
 */
const SPECIMENS: Record<string, Specimen> = {
  QID: {
    name: 'Ahmed Al-Sulaiti',
    idLabel: 'QID No.',
    idNo: '28456701234',
    nationality: 'Qatari',
    dob: '12/03/1985',
    expiry: '30/11/2029',
    back: [
      { label: 'Issue Authority', value: 'MOH-Qatar' },
      { label: 'Place of Birth', value: 'Doha' },
      { label: 'Blood Type', value: 'A+' },
    ],
    mrz: ['ID QAT2845670123410<<<<<<<<<<<<', '8503129M2911308QAT<<<<<<<<<<06'],
  },
  Passport: {
    name: 'Bimal Thapa',
    idLabel: 'Passport No.',
    idNo: 'P0998812',
    nationality: 'Nepalese',
    dob: '22/07/1990',
    expiry: '30/11/2029',
    back: [
      { label: 'Type', value: 'P' },
      { label: 'Issuing State', value: 'NPL' },
    ],
    mrz: ['P<NPLTHAPA<<BIMAL<<<<<<<<<<<<<<<<<<<<<<<<<<', 'P0998812<3NPL9007224M2911308<<<<<<<<<<<<<04'],
  },
  'GCC ID': {
    name: 'Khalid Al-Mazrouei',
    idLabel: 'GCC ID No.',
    idNo: '784202312345678',
    nationality: 'Emirati',
    dob: '14/09/1988',
    expiry: '30/11/2029',
    back: [
      { label: 'Issuing State', value: 'UAE' },
      { label: 'Card Type', value: 'National ID' },
    ],
    mrz: ['ID ARE7842023123456781<<<<<<<<', '8809148M2911308ARE<<<<<<<<<<02'],
  },
  'Diplomatic ID': {
    name: 'Henrik Lindqvist',
    idLabel: 'Diplomatic ID No.',
    idNo: 'DIP-QA-004977',
    nationality: 'Swedish',
    dob: '11/02/1981',
    expiry: '30/04/2030',
    back: [
      { label: 'Issuing Ministry', value: 'MOFA Qatar' },
      { label: 'Status', value: 'Accredited' },
    ],
    mrz: ['ID QATLINDQVIST<<HENRIK<<<<<<<<', '8102119M3004308SWE<<<<<<<<<<03'],
  },
};

const LABEL_FILL = '#8a8a8a';
const VALUE_FILL = '#2a2a2a';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

// The captured document, as shown back to the agent after a scan.
//
// ALWAYS DRAWN, never a photograph of a real card (2026-09-28 direction).
// Until then the Qatar ID faces rendered from specimen PNGs in public/brand/ -
// a photorealistic card, complete with a plausible-looking name, ID number and
// portrait. That is the wrong thing to put on screen in a demo: it reads as a
// real person's document, and nothing in the frame says otherwise. The drawn
// stand-in cannot be mistaken for one - it draws readable specimen TEXT
// (2026-09-28) rather than the earlier grey redaction bars, but the text is
// plainly synthetic (a monospace MRZ, machine field labels) rather than a
// rendered likeness of a card.
//
// Two sources remain, in order of preference:
//
//   1. `src` - a genuine capture from a scanner. Nothing sets this yet (there
//      is no scanner and no file input), but the day one lands, passing a data
//      URL here is the only change needed. A real capture is the customer's
//      own document, which is a different thing from shipping artwork of one.
//   2. The DRAWN STAND-IN - correct 85.6 x 54mm ID-1 aspect, a portrait block,
//      specimen data lines, the Qatar maroon band, and on a Qatar ID back the
//      barcode the real card carries. Deliberately abstract: it is obviously
//      not a real document, which is the point.
export function ScannedIdPreview({ side, src, documentType = 'QID', clear = true }: ScannedIdPreviewProps) {
  const [imageFailed, setImageFailed] = useState(false);

  if (src && !imageFailed) {
    return (
      // object-CONTAIN, and the frame takes the ID-1 ratio the card itself
      // has: a scanner produces whatever aspect it produces, and cropping the
      // capture to fit would defeat the entire point of showing it back for
      // the agent to judge.
      //
      // bg-white rather than a token because it is backing a photograph, not
      // continuing the page - a --bg-coloured frame would band visibly against
      // the image in dark mode.
      <span className="block w-full overflow-hidden rounded-[var(--radius-button)] border border-border-soft aspect-[1.585] bg-white">
        <img
          src={src}
          onError={() => setImageFailed(true)}
          alt={`Scanned ${documentType}, ${side} side`}
          // Blur travels here too, on the off chance a real capture path ever
          // lands while a first-pass-blur consumer is still asking for one -
          // the simulation should not depend on which source produced the
          // image.
          className={`w-full h-full object-contain ${clear ? '' : 'blur-[2px] saturate-50'}`}
        />
      </span>
    );
  }

  // The real Qatar ID carries a machine-readable code on its reverse; no other
  // document type here does, so drawing one on a passport back would be
  // inventing a feature of a document this app does not know.
  const showBarcode = side === 'back' && documentType === 'QID';
  const specimen = SPECIMENS[documentType] ?? SPECIMENS.QID;

  return (
    <svg
      viewBox="0 0 214 135"
      role="img"
      aria-label={
        clear
          ? `Simulated capture of the ${documentType} ${side} side`
          : `Blurred capture of the ${documentType} ${side} side - unreadable, retake the scan`
      }
      // Blur only the drawn content, not the frame around it (the border
      // below stays crisp) - an out-of-focus SCAN blurs the document, not the
      // UI chrome displaying it.
      className={`w-full rounded-[var(--radius-button)] border border-border-soft ${clear ? '' : 'blur-[1.5px] saturate-50'}`}
    >
      <rect width="214" height="135" fill="#fafafa" />
      {/* Maroon identity band, hoist side on the front and a magnetic-style
          stripe on the back, so the two sides are distinguishable at a glance. */}
      {side === 'front' ? (
        <rect width="10" height="135" fill="#8D1B3D" />
      ) : (
        <rect x="0" y="18" width="214" height="22" fill="#313131" />
      )}

      {side === 'front' && (
        <>
          {/* Portrait block */}
          <rect x="24" y="26" width="46" height="58" rx="3" fill="#e0e0e0" />
          <circle cx="47" cy="46" r="11" fill="#c9c9c9" />
          <path d="M30 84c3-13 31-13 34 0z" fill="#c9c9c9" />
          {/* Specimen fields (2026-09-28) - one "Label: value" text row apiece,
              replacing the earlier grey redaction bars. Same five fields for
              every document type (Name/ID No./Nationality/D.O.B./Expiry) so
              the four cards read consistently despite carrying different
              labels and values. */}
          <text x="82" y="35" fontSize="7" fill={VALUE_FILL} fontWeight="600">
            {specimen.name}
          </text>
          <text x="82" y="48" fontSize="6.5">
            <tspan fill={LABEL_FILL}>{specimen.idLabel} </tspan>
            <tspan fill={VALUE_FILL} fontFamily={MONO}>
              {specimen.idNo}
            </tspan>
          </text>
          <text x="82" y="61" fontSize="6.5">
            <tspan fill={LABEL_FILL}>Nationality </tspan>
            <tspan fill={VALUE_FILL}>{specimen.nationality}</tspan>
          </text>
          <text x="82" y="74" fontSize="6.5">
            <tspan fill={LABEL_FILL}>D.O.B. </tspan>
            <tspan fill={VALUE_FILL}>{specimen.dob}</tspan>
          </text>
          <text x="24" y="100" fontSize="6.5">
            <tspan fill={LABEL_FILL}>Expiry </tspan>
            <tspan fill={VALUE_FILL} fontWeight="600">
              {specimen.expiry}
            </tspan>
          </text>
          {/* Never lets the specimen pass as a real capture, however legible
              the text above reads. */}
          <text x="24" y="114" fontSize="5.5" fill="#b5b5b5" fontStyle="italic">
            SPECIMEN - sample data for demo purposes only
          </text>
        </>
      )}

      {side === 'back' && (
        <>
          {/* Institutional flavour fields - not personal data, so these carry
              no disclaimer of their own; the front's SPECIMEN line already
              covers the card as a whole. Two per type, positioned above the
              barcode's row for QID and stacked plainly for the other three. */}
          {specimen.back.map((row, i) => (
            <text key={row.label} x="18" y={34 + i * 12} fontSize="6.5">
              <tspan fill={LABEL_FILL}>{row.label}: </tspan>
              <tspan fill={VALUE_FILL}>{row.value}</tspan>
            </text>
          ))}
          {showBarcode && (
            <g transform={`translate(${BARCODE_X} ${BARCODE_Y})`}>
              {/* Quiet zone: a barcode reads against its own white ground, not
                  the card's off-white, so the bars keep their contrast
                  wherever this sits. */}
              <rect x="-3" y="-3" width={BARCODE_W + 6} height="38" rx="1" fill="#ffffff" />
              {BARCODE_RECTS.map((bar) => (
                <rect key={bar.x} x={bar.x} y="0" width={bar.w} height="26" fill="#313131" />
              ))}
              <text x={BARCODE_W / 2} y="34" fontSize="5" textAnchor="middle" fontFamily={MONO} fill={LABEL_FILL}>
                {specimen.idNo}
              </text>
            </g>
          )}
          {/* Machine-readable zone - shaped like a real one (two fixed-width
              monospace lines of the right character mix) rather than the
              earlier plain grey bars, but not checksum-valid: nothing reads
              it, so it only has to look right, not compute right. */}
          <text x="18" y="100" fontSize="7" fontFamily={MONO} fill="#4a4a4a" letterSpacing="0.3">
            {specimen.mrz[0]}
          </text>
          <text x="18" y="112" fontSize="7" fontFamily={MONO} fill="#4a4a4a" letterSpacing="0.3">
            {specimen.mrz[1]}
          </text>
        </>
      )}
    </svg>
  );
}
