interface ScannedIdPreviewProps {
  side: 'front' | 'back';
  /** A real captured image, when one exists. Falls back to the stand-in. */
  src?: string;
}

// The captured document, as shown back to the agent after a scan.
//
// There is no scanner and no file I/O in this app, so there is no photograph
// to show. Rather than leave the card empty or invent a specific person's ID,
// this renders a DOCUMENT-SHAPED STAND-IN: correct 85.6 x 54mm ID-1 aspect,
// a portrait block, redacted data lines, and the Qatar maroon band on the
// front. It is captioned as simulated at the call site so nobody mistakes it
// for a real capture.
//
// `src` is honoured first, so the day a real scanner or file upload lands,
// passing a data URL here is the only change needed - the surrounding card,
// the badge and the gating all stay as they are.
export function ScannedIdPreview({ side, src }: ScannedIdPreviewProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={`Scanned Qatar ID, ${side} side`}
        className="w-full rounded-[var(--radius-button)] border border-border-soft object-cover"
      />
    );
  }

  return (
    <svg
      viewBox="0 0 214 135"
      role="img"
      aria-label={`Simulated capture of the Qatar ID ${side} side`}
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
          <rect x="18" y="52" width="130" height="6" rx="3" fill="#d8d8d8" />
          <rect x="18" y="64" width="104" height="6" rx="3" fill="#e4e4e4" />
          <rect x="18" y="76" width="118" height="6" rx="3" fill="#e4e4e4" />
          {/* Machine-readable zone */}
          <rect x="18" y="96" width="178" height="8" rx="2" fill="#e0e0e0" />
          <rect x="18" y="108" width="178" height="8" rx="2" fill="#e0e0e0" />
        </>
      )}
    </svg>
  );
}
