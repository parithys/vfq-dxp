import { useState } from 'react';

interface ScannedIdPreviewProps {
  side: 'front' | 'back';
  /** A real captured image, when one exists. Falls back to the drawn card. */
  src?: string;
  /**
   * Which document this depicts. Drives the alt text and, on a Qatar ID back,
   * the barcode that card carries and the others do not.
   */
  documentType?: string;
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

// The captured document, as shown back to the agent after a scan.
//
// ALWAYS DRAWN, never a photograph of a real card (2026-09-28 direction).
// Until then the Qatar ID faces rendered from specimen PNGs in public/brand/ -
// a photorealistic card, complete with a plausible-looking name, ID number and
// portrait. That is the wrong thing to put on screen in a demo: it reads as a
// real person's document, and nothing in the frame says otherwise. The drawn
// stand-in cannot be mistaken for one.
//
// Two sources remain, in order of preference:
//
//   1. `src` - a genuine capture from a scanner. Nothing sets this yet (there
//      is no scanner and no file input), but the day one lands, passing a data
//      URL here is the only change needed. A real capture is the customer's
//      own document, which is a different thing from shipping artwork of one.
//   2. The DRAWN STAND-IN - correct 85.6 x 54mm ID-1 aspect, a portrait block,
//      redacted data lines, the Qatar maroon band, and on a Qatar ID back the
//      barcode the real card carries. Deliberately abstract: it is obviously
//      not a real document, which is the point.
export function ScannedIdPreview({ side, src, documentType = 'QID' }: ScannedIdPreviewProps) {
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
          className="w-full h-full object-contain"
        />
      </span>
    );
  }

  // The real Qatar ID carries a machine-readable code on its reverse; no other
  // document type here does, so drawing one on a passport back would be
  // inventing a feature of a document this app does not know.
  const showBarcode = side === 'back' && documentType === 'QID';

  return (
    <svg
      viewBox="0 0 214 135"
      role="img"
      aria-label={`Simulated capture of the ${documentType} ${side} side`}
      className="w-full rounded-[var(--radius-button)] border border-border-soft"
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
          {/* Redacted data lines */}
          <rect x="82" y="30" width="104" height="7" rx="3.5" fill="#d8d8d8" />
          <rect x="82" y="44" width="76" height="6" rx="3" fill="#e4e4e4" />
          <rect x="82" y="56" width="88" height="6" rx="3" fill="#e4e4e4" />
          <rect x="82" y="68" width="60" height="6" rx="3" fill="#e4e4e4" />
          <rect x="24" y="94" width="162" height="8" rx="4" fill="#d8d8d8" />
          <rect x="24" y="108" width="120" height="6" rx="3" fill="#e4e4e4" />
        </>
      )}

      {side === 'back' && (
        <>
          {/* Redacted data lines. They stop short of the barcode column when
              there is one, rather than running under it. */}
          <rect x="18" y="52" width={showBarcode ? 106 : 130} height="6" rx="3" fill="#d8d8d8" />
          <rect x="18" y="64" width={showBarcode ? 84 : 104} height="6" rx="3" fill="#e4e4e4" />
          <rect x="18" y="76" width={showBarcode ? 96 : 118} height="6" rx="3" fill="#e4e4e4" />
          {showBarcode && (
            <g transform={`translate(${BARCODE_X} ${BARCODE_Y})`}>
              {/* Quiet zone: a barcode reads against its own white ground, not
                  the card's off-white, so the bars keep their contrast
                  wherever this sits. */}
              <rect x="-3" y="-3" width={BARCODE_W + 6} height="38" rx="1" fill="#ffffff" />
              {BARCODE_RECTS.map((bar) => (
                <rect key={bar.x} x={bar.x} y="0" width={bar.w} height="26" fill="#313131" />
              ))}
              {/* Stands in for the digits printed beneath a real symbol. A
                  redacted bar, like every other field here - printing an
                  actual ID number would put a fake identity on screen, which
                  is the thing this component exists to avoid. */}
              <rect x="6" y="30" width={BARCODE_W - 12} height="4" rx="2" fill="#c9c9c9" />
            </g>
          )}
          {/* Machine-readable zone */}
          <rect x="18" y="96" width="178" height="8" rx="2" fill="#e0e0e0" />
          <rect x="18" y="108" width="178" height="8" rx="2" fill="#e0e0e0" />
        </>
      )}
    </svg>
  );
}
