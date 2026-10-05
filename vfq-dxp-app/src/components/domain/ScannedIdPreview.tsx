import { useState } from 'react';

export interface SpecimenIdentity {
  name: string;
  idNo: string;
  nationality: string;
  /** dd/mm/yyyy */
  dob: string;
  /** dd/mm/yyyy */
  expiry: string;
}

const yymmdd = (dmy: string) => {
  const [d, m, y] = dmy.split('/');
  return y && m && d ? `${y.slice(2)}${m}${d}` : '000000';
};

export type IdVariant = 'qid' | 'passport' | 'gcc' | 'diplomatic' | 'b2b2c' | 'retired' | 'mada';

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
  /**
   * Which layout to draw. Defaults from `documentType` (QID / Passport / GCC ID /
   * Diplomatic ID). The three customer-type scenarios - B2B2C, Retired, MADA - have
   * no documentType of their own: they are the office ID card scanned for that
   * scenario, so the caller names them here.
   */
  variant?: IdVariant;
  /** The customer this capture belongs to (journey started from Customer 360): drawn in place of the fixed specimen person. */
  identity?: SpecimenIdentity;
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
    name: 'Ahmed Abdulla Hassan Al-Sulaiti',
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
    name: 'Bimal Bahadur Thapa',
    idLabel: 'Passport No.',
    idNo: 'P0998812',
    nationality: 'Nepalese',
    dob: '22/07/1990',
    expiry: '30/11/2029',
    back: [
      { label: 'Type', value: 'P' },
      { label: 'Issuing State', value: 'NPL' },
    ],
    mrz: ['P<NPLTHAPA<<BIMAL<BAHADUR<<<<<<<<<<<<<<<<<<', 'P0998812<3NPL9007224M2911308<<<<<<<<<<<<<04'],
  },
  'GCC ID': {
    name: 'Khalid Saeed Rashid Al-Mazrouei',
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
    name: 'Henrik Lars Lindqvist',
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

interface Theme {
  /** Card background. */
  bg: string;
  /** Header strip colour, or null for the Qatar ID's left identity band. */
  accent: string;
  headerText?: string;
  headerFill?: string;
  /** Secondary colour (gold seal, chip, ribbon). */
  second?: string;
  /** 'dark' draws light text on a dark card (MADA). */
  dark?: boolean;
  /** Label of the second/third rows on the front, in place of Nationality / D.O.B. */
  rows?: [string, string][];
  /** Back-face rows, replacing the specimen's institutional lines. */
  back?: { label: string; value: string }[];
  mrz?: boolean;
}

// One layout per document type or customer scenario, so each is recognisable at a
// glance: Qatar ID keeps its maroon side band; Passport is a cream data page with
// a navy header and MRZ on the face; GCC ID has a teal header with a ring of six
// stars; Diplomatic ID is navy and gold with a seal; B2B2C is a blue employee
// card; Retired an amber pension card; MADA a dark green payment card with a chip.
const THEMES: Record<IdVariant, Theme> = {
  qid: { bg: '#fafafa', accent: '#8D1B3D', mrz: true },
  passport: { bg: '#f6f1e3', accent: '#1f3a5f', headerText: 'PASSPORT', headerFill: '#ffffff', second: '#c9b27c', mrz: true },
  gcc: { bg: '#f1f8f6', accent: '#0f766e', headerText: 'GCC NATIONAL ID', headerFill: '#ffffff', second: '#ffffff', mrz: true },
  diplomatic: { bg: '#faf6ea', accent: '#1b2a49', headerText: 'DIPLOMATIC IDENTITY', headerFill: '#e3c470', second: '#b8912f', mrz: true },
  b2b2c: {
    bg: '#f2f7ff', accent: '#2563eb', headerText: 'EMPLOYEE ID  -  PARTNER COMPANY', headerFill: '#ffffff', second: '#bfd3fb',
    rows: [['Employer', 'Acme Trading W.L.L.'], ['Staff No.', 'E-20418'], ['Department', 'Operations']],
    back: [{ label: 'Issued by', value: 'Human Resources' }, { label: 'Use', value: 'Proof of employment' }],
  },
  retired: {
    bg: '#fff8ee', accent: '#b45309', headerText: 'RETIRED PERSON CARD', headerFill: '#ffffff', second: '#f3c98b',
    rows: [['Status', 'Retired'], ['Retired since', '01/04/2021'], ['Pension no.', 'GRA-5520817']],
    back: [{ label: 'Authority', value: 'General Retirement Authority' }, { label: 'Scheme', value: 'Retirement benefit' }],
  },
  mada: {
    bg: '#14532d', accent: '#0b3b1f', headerText: 'MADA', headerFill: '#ffffff', second: '#d9b44a', dark: true,
    rows: [['Card no.', '5078  ****  ****  1234'], ['Valid thru', '11/29'], ['Scheme', 'MADA debit']],
    back: [{ label: 'Customer service', value: '800 0000' }, { label: 'Issuer', value: 'Qatar bank (specimen)' }],
  },
};

const variantOf = (documentType: string): IdVariant =>
  documentType === 'Passport' ? 'passport' : documentType === 'GCC ID' ? 'gcc' : documentType === 'Diplomatic ID' ? 'diplomatic' : 'qid';

export function ScannedIdPreview({ side, src, documentType = 'QID', clear = true, variant: variantProp, identity }: ScannedIdPreviewProps) {
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

  const variant = variantProp ?? variantOf(documentType);
  const theme = THEMES[variant];
  const isQid = variant === 'qid';
  const scenario = Boolean(theme.rows);
  // The real Qatar ID carries a machine-readable code on its reverse; no other
  // document type here does, so drawing one elsewhere would be inventing a feature.
  const showBarcode = side === 'back' && variant === 'qid';
  const baseSpecimen = SPECIMENS[documentType] ?? SPECIMENS.QID;
  const specimen: Specimen = identity
    ? {
        ...baseSpecimen,
        name: identity.name,
        idNo: identity.idNo,
        nationality: identity.nationality,
        dob: identity.dob,
        expiry: identity.expiry,
        mrz: [`ID QAT${identity.idNo}`.padEnd(30, '<'), `${yymmdd(identity.dob)}0M${yymmdd(identity.expiry)}1QAT`.padEnd(30, '<')],
      }
    : baseSpecimen;
  const labelFill = theme.dark ? '#cfe8d8' : LABEL_FILL;
  const valueFill = theme.dark ? '#ffffff' : VALUE_FILL;
  const passportFace = variant === 'passport' && side === 'front';
  const label = variant === 'b2b2c' ? 'B2B2C office ID' : variant === 'retired' ? 'Retired office ID' : variant === 'mada' ? 'MADA card' : documentType;

  // Passport: an open booklet in portrait - the inside page above, the data page below with the photo,
  // the personal details and the two machine-readable lines. One image, not a front and a back.
  if (variant === 'passport' && side === 'back') {
    const rows = [...specimen.back, { label: 'Issuing Authority', value: 'Ministry of Foreign Affairs' }];
    return (
      <svg
        viewBox="0 0 160 220"
        role="img"
        aria-label={clear ? 'Simulated capture of the passport back side' : 'Blurred capture of the passport back side - unreadable, retake the scan'}
        className={`w-full rounded-[var(--radius-button)] border border-border-soft ${clear ? '' : 'blur-[1.5px] saturate-50'}`}
      >
        <rect width="160" height="220" fill="#eef3f8" />
        <rect x="0" y="0" width="160" height="22" fill="#1f3a5f" />
        <text x="10" y="14" fontSize="5.4" fontWeight="700" letterSpacing="0.6" fill="#ffffff">OBSERVATIONS &amp; ENDORSEMENTS</text>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
          <line key={n} x1="10" y1={42 + n * 10} x2="150" y2={42 + n * 10} stroke="#c5d2e0" strokeWidth="0.5" />
        ))}
        {rows.map((row, i) => (
          <text key={row.label} x="10" y={134 + i * 14} fontSize="5">
            <tspan fill="#6b7b8f">{row.label}: </tspan>
            <tspan fill="#1b2430" fontWeight="600">{row.value}</tspan>
          </text>
        ))}
        <text className="demo-only" x="10" y="208" fontSize="4" fill="#9aa7b6" fontStyle="italic">SPECIMEN - sample data for demo purposes only</text>
      </svg>
    );
  }
  if (variant === 'passport') {
    const parts = specimen.name.trim().split(/\s+/);
    const surname = (parts.length > 1 ? parts[parts.length - 1] : parts[0]).toUpperCase();
    const given = (parts.length > 1 ? parts.slice(0, -1) : []).join(' ').toUpperCase();
    const country = specimen.mrz[0].slice(2, 5);
    const lorem = ['Lorem ipsum dolor sit amet, consectetur adipiscing elit semper', 'in augue urna vel diam. Vestibulum sed eros ut ligula'];
    return (
      <svg
        viewBox="0 0 160 220"
        role="img"
        aria-label={clear ? `Simulated capture of the passport data page` : `Blurred capture of the passport data page - unreadable, retake the scan`}
        className={`w-full rounded-[var(--radius-button)] border border-border-soft ${clear ? '' : 'blur-[1.5px] saturate-50'}`}
      >
        <rect width="160" height="220" fill="#eef3f8" />
        {/* Inside page */}
        <rect x="0" y="0" width="160" height="92" fill="#eaf0f6" />
        <line x1="80" y1="8" x2="80" y2="86" stroke="#cfd9e4" strokeWidth="0.6" />
        {[0, 1, 2, 3, 4, 5].map((n) => (
          <rect key={`l${n}`} x="10" y={12 + n * 5} width={n === 5 ? 40 : 62} height="1.6" rx="0.8" fill="#9fb0c3" />
        ))}
        {[0, 1, 2, 3, 4, 5].map((n) => (
          <rect key={`r${n}`} x="90" y={12 + n * 5} width={n === 5 ? 34 : 60} height="1.6" rx="0.8" fill="#9fb0c3" />
        ))}
        <text x="10" y="50" fontSize="3.4" fill="#7b8ba0">{lorem[0]}</text>
        <text x="10" y="55" fontSize="3.4" fill="#7b8ba0">{lorem[1]}</text>
        <text x="96" y="64" fontSize="4.2" fill="#d33" fontWeight="600">HA №000001</text>
        {/* Data page */}
        <rect x="0" y="92" width="160" height="128" fill="#f7fafc" />
        <line x1="0" y1="92" x2="160" y2="92" stroke="#c5d2e0" strokeWidth="0.6" />
        <circle cx="14" cy="104" r="3" fill="none" stroke="#d33" strokeWidth="0.9" />
        <text x="21" y="105.5" fontSize="5.4" fontWeight="700" fill="#1f3a5f">PASSPORT</text>
        {/* Photo */}
        <rect x="8" y="112" width="42" height="52" rx="2" fill="#dfe6ee" />
        <circle cx="29" cy="132" r="11" fill="#6b4f3b" />
        <circle cx="29" cy="136" r="8.5" fill="#d9a77c" />
        <path d="M10 164c2-14 36-14 38 0z" fill="#3a5ba0" />
        {/* Details */}
        {[
          ['Type', 'P', 58, 112],
          ['Country code', country, 84, 112],
          ['Passport No.', specimen.idNo, 118, 112],
          ['Surname', surname, 58, 124],
          ['Given names', given, 58, 136],
          ['Nationality', specimen.nationality, 58, 148],
          ['Date of birth', specimen.dob, 58, 160],
          ['Date of expiry', specimen.expiry, 100, 160],
        ].map(([lab, val, x, y]) => (
          <g key={String(lab)}>
            <text x={x as number} y={y as number} fontSize="3.2" fill="#6b7b8f">{lab}</text>
            <text x={x as number} y={(y as number) + 5.2} fontSize="5" fill="#1b2430" fontWeight="600" fontFamily={lab === 'Passport No.' ? MONO : undefined}>{val}</text>
          </g>
        ))}
        <text x="8" y="172" fontSize="3.2" fill="#6b7b8f">Sex</text>
        <text x="8" y="177" fontSize="5" fill="#1b2430" fontWeight="600">M</text>
        <text className="demo-only" x="8" y="186" fontSize="4" fill="#9aa7b6" fontStyle="italic">SPECIMEN - sample data for demo purposes only</text>
        <text x="6" y="205" fontSize="4.6" fontFamily={MONO} fill="#2b3644" letterSpacing="0.15">{specimen.mrz[0]}</text>
        <text x="6" y="213" fontSize="4.6" fontFamily={MONO} fill="#2b3644" letterSpacing="0.15">{specimen.mrz[1]}</text>
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 214 135"
      role="img"
      aria-label={
        clear
          ? `Simulated capture of the ${label} ${side} side`
          : `Blurred capture of the ${label} ${side} side - unreadable, retake the scan`
      }
      // Blur only the drawn content, not the frame around it (the border
      // below stays crisp) - an out-of-focus SCAN blurs the document, not the
      // UI chrome displaying it.
      className={`w-full rounded-[var(--radius-button)] border border-border-soft ${clear ? '' : 'blur-[1.5px] saturate-50'}`}
    >
      <rect width="214" height="135" fill={theme.bg} />

      {/* Identity marks: the Qatar ID's maroon hoist band, or a full-width header on every other layout. */}
      {isQid && (side === 'front' ? <rect width="10" height="135" fill={theme.accent} /> : <rect x="0" y="18" width="214" height="22" fill="#313131" />)}
      {!isQid && side === 'front' && (
        <>
          <rect width="214" height="17" fill={theme.accent} />
          <text x="12" y="11.5" fontSize="6.5" fontWeight="700" letterSpacing="0.8" fill={theme.headerFill}>
            {theme.headerText}
          </text>
          {variant === 'gcc' &&
            [0, 1, 2, 3, 4, 5].map((n) => <circle key={n} cx={170 + n * 7} cy="8.5" r="2" fill="#ffffff" />)}
          {variant === 'diplomatic' && (
            <>
              <circle cx="196" cy="8.5" r="6" fill={theme.second} />
              <circle cx="196" cy="8.5" r="3.4" fill={theme.accent} />
            </>
          )}
          {variant === 'b2b2c' && <rect x="176" y="3.5" width="28" height="10" rx="5" fill={theme.headerFill} />}
          {variant === 'b2b2c' && (
            <text x="190" y="10.8" fontSize="5.5" fontWeight="700" textAnchor="middle" fill={theme.accent}>
              B2B2C
            </text>
          )}
          {variant === 'retired' && <rect x="168" y="3.5" width="36" height="10" rx="5" fill={theme.second} />}
          {variant === 'retired' && (
            <text x="186" y="10.8" fontSize="5.5" fontWeight="700" textAnchor="middle" fill={theme.accent}>
              RETIRED
            </text>
          )}
          {variant === 'mada' && <rect x="178" y="3" width="24" height="11" rx="2" fill={theme.second} />}
          {variant === 'mada' && (
            <text x="190" y="11" fontSize="6.5" fontWeight="800" textAnchor="middle" fill={theme.accent}>
              mada
            </text>
          )}
        </>
      )}
      {!isQid && side === 'back' && <rect x="0" y="18" width="214" height="22" fill={variant === 'mada' ? '#0b0b0b' : theme.accent} />}

      {side === 'front' && (
        <>
          {variant === 'mada' ? (
            // Payment card: gold chip in place of a portrait.
            <>
              <rect x="22" y="30" width="30" height="23" rx="4" fill={theme.second} />
              <path d="M22 41.5h30M37 30v23" stroke="#a8862b" strokeWidth="1" />
            </>
          ) : (
            <>
              {/* Portrait block - round for the passport page, square-cornered elsewhere. */}
              <rect x="24" y="26" width="46" height={passportFace ? 50 : 58} rx={passportFace ? 8 : 3} fill="#e0e0e0" />
              <circle cx="47" cy="46" r="11" fill="#c9c9c9" />
              <path d={passportFace ? 'M30 76c3-13 31-13 34 0z' : 'M30 84c3-13 31-13 34 0z'} fill="#c9c9c9" />
            </>
          )}
          <text x={variant === 'mada' ? 62 : 82} y="35" fontSize="7" fill={valueFill} fontWeight="600">
            {variant === 'mada' ? specimen.name.toUpperCase() : specimen.name}
          </text>
          {scenario ? (
            theme.rows!.map(([k, v], n) => (
              <text key={k} x={variant === 'mada' ? 62 : 82} y={48 + n * 13} fontSize="6.5">
                <tspan fill={labelFill}>{k} </tspan>
                <tspan fill={valueFill} fontFamily={MONO}>
                  {v}
                </tspan>
              </text>
            ))
          ) : (
            <>
              <text x="82" y="48" fontSize="6.5">
                <tspan fill={labelFill}>{specimen.idLabel} </tspan>
                <tspan fill={valueFill} fontFamily={MONO}>
                  {specimen.idNo}
                </tspan>
              </text>
              <text x="82" y="61" fontSize="6.5">
                <tspan fill={labelFill}>Nationality </tspan>
                <tspan fill={valueFill}>{specimen.nationality}</tspan>
              </text>
              <text x="82" y="74" fontSize="6.5">
                <tspan fill={labelFill}>D.O.B. </tspan>
                <tspan fill={valueFill}>{specimen.dob}</tspan>
              </text>
            </>
          )}
          {scenario && variant !== 'mada' && (
            <text x="24" y="96" fontSize="6.5">
              <tspan fill={labelFill}>QID No. </tspan>
              <tspan fill={valueFill} fontFamily={MONO}>
                {specimen.idNo}
              </tspan>
            </text>
          )}
          <text x="24" y={passportFace ? 90 : scenario ? 106 : 100} fontSize="6.5">
            <tspan fill={labelFill}>Expiry </tspan>
            <tspan fill={valueFill} fontWeight="600">
              {specimen.expiry}
            </tspan>
          </text>
          {/* Never lets the specimen pass as a real capture, however legible
              the text above reads. */}
          <text className="demo-only" x="24" y={passportFace ? 98 : scenario ? 120 : 114} fontSize="5.5" fill="#b5b5b5" fontStyle="italic">
            SPECIMEN - sample data for demo purposes only
          </text>
          {passportFace && (
            <>
              <text x="12" y="116" fontSize="6.5" fontFamily={MONO} fill="#4a4a4a" letterSpacing="0.3">
                {specimen.mrz[0]}
              </text>
              <text x="12" y="126" fontSize="6.5" fontFamily={MONO} fill="#4a4a4a" letterSpacing="0.3">
                {specimen.mrz[1]}
              </text>
            </>
          )}
        </>
      )}

      {side === 'back' && (
        <>
          {(theme.back ?? specimen.back).map((row, i) => (
            <text key={row.label} x="18" y={56 + i * 12} fontSize="6.5">
              <tspan fill={labelFill}>{row.label}: </tspan>
              <tspan fill={valueFill}>{row.value}</tspan>
            </text>
          ))}
          {variant === 'mada' && (
            // Signature panel, as on a payment card.
            <>
              <rect x="18" y="84" width="120" height="16" rx="2" fill="#f4f4f4" />
              <text x="22" y="95" fontSize="5.5" fill="#777" fontStyle="italic">
                Authorised signature
              </text>
            </>
          )}
          {showBarcode && (
            <g transform={`translate(${BARCODE_X} ${BARCODE_Y})`}>
              <rect x="-3" y="-3" width={BARCODE_W + 6} height="38" rx="1" fill="#ffffff" />
              {BARCODE_RECTS.map((bar) => (
                <rect key={bar.x} x={bar.x} y="0" width={bar.w} height="26" fill="#313131" />
              ))}
              <text x={BARCODE_W / 2} y="34" fontSize="5" textAnchor="middle" fontFamily={MONO} fill={LABEL_FILL}>
                {specimen.idNo}
              </text>
            </g>
          )}
          {/* MRZ-shaped filler on the document types that carry one - the passport's lives on its face instead. */}
          {theme.mrz && (
            <>
              <text x="18" y="100" fontSize="7" fontFamily={MONO} fill="#4a4a4a" letterSpacing="0.3">
                {specimen.mrz[0]}
              </text>
              <text x="18" y="112" fontSize="7" fontFamily={MONO} fill="#4a4a4a" letterSpacing="0.3">
                {specimen.mrz[1]}
              </text>
            </>
          )}
        </>
      )}
    </svg>
  );
}
