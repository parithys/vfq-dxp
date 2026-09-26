import { useState } from 'react';

interface ScannedIdPreviewProps {
  side: 'front' | 'back';
  /** A real captured image, when one exists. Falls back to the specimen. */
  src?: string;
  /**
   * Which document this depicts. The specimen files are Qatar ID artwork, so
   * anything else falls through to the drawn stand-in rather than showing a
   * QID card captioned as a Diplomatic ID.
   */
  documentType?: string;
}

/**
 * Specimen Qatar ID artwork, used when no real capture exists.
 *
 * ONE FILE PER FACE. The supplied assets arrived as separate front and back
 * images, which is simpler than the stacked single file this briefly
 * expected: there is no crop, so nothing depends on the two faces being an
 * exact 50/50 split of one image.
 *
 * Their aspect is ~1.59:1, effectively the ID-1 ratio the frame already uses
 * (85.6 x 54mm = 1.585), so they fill it without meaningful cropping.
 *
 * NOT COMMITTED to this repo - both files have to be saved by hand, alongside
 * the only other brand asset (public/brand/login-bg.jpg). Nothing breaks
 * while they are missing: a failed load falls back to the drawn stand-in
 * below, per side independently.
 */
const QID_SPECIMEN_SRC: Record<'front' | 'back', string> = {
  front: '/brand/qid-front.png',
  back: '/brand/qid-back.png',
};

// The captured document, as shown back to the agent after a scan.
//
// Three sources, in order of preference:
//
//   1. `src` - a real capture. Nothing sets this yet (there is no scanner and
//      no file input), but the day one lands, passing a data URL here is the
//      only change needed.
//   2. The specimen file for this side.
//   3. A DRAWN STAND-IN - correct 85.6 x 54mm ID-1 aspect, a portrait block,
//      redacted data lines and the Qatar maroon band. Deliberately abstract:
//      it is obviously not a real document, which is the point.
//
// The fallback is driven by the image's own onError, not by a build-time check
// of whether the file exists, because the app cannot know. That keeps the
// preview working whether or not the specimen has been added, instead of
// showing a broken-image icon in a step the agent has to trust.
export function ScannedIdPreview({ side, src, documentType = 'QID' }: ScannedIdPreviewProps) {
  const [imageFailed, setImageFailed] = useState(false);
  // A real capture always wins. Otherwise the specimen is only correct for the
  // document it actually shows.
  const resolvedSrc = src ?? (documentType === 'QID' ? QID_SPECIMEN_SRC[side] : undefined);

  if (resolvedSrc && !imageFailed) {
    return (
      // A fixed ID-1 frame, so the two previews stay the same size whatever
      // the source images measure.
      //
      // object-CONTAIN, not cover. The specimen images are 593x344 (1.72:1)
      // because they include white margin around the card, while this frame
      // is the card's own 85.6 x 54mm ratio (1.585:1). Cover cropped about 4%
      // off each side, which ate the rounded card corners and clipped the
      // front's left-hand watermark edge. Contain shows the whole document,
      // which is the entire point of showing it back to the agent.
      //
      // The resulting letterbox is invisible rather than merely tolerated:
      // both images are pure white (255,255,255) in all four corners, so a
      // white frame continues their own margin. Fixed white rather than a
      // theme token because it is matching the ARTWORK, not the page - a
      // --bg-coloured frame would band visibly in dark mode.
      <span className="block w-full overflow-hidden rounded-[var(--radius-button)] border border-border-soft aspect-[214/135] bg-white">
        <img
          src={resolvedSrc}
          onError={() => setImageFailed(true)}
          alt={`Scanned ${documentType}, ${side} side`}
          className="w-full h-full object-contain"
        />
      </span>
    );
  }

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
