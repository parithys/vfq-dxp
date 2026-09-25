import { Button } from '../primitives/Button';
import { ScannedIdPreview } from './ScannedIdPreview';

export interface QidImageUploadValue {
  frontScanned?: boolean;
  backScanned?: boolean;
  /**
   * Data URL of a real capture, when there is one. Nothing sets this today -
   * there is no scanner and no file input - but the preview honours it, so a
   * real capture path only has to write here.
   */
  frontImage?: string;
  backImage?: string;
}

interface QidImageUploadProps {
  value: QidImageUploadValue;
  onChange: (value: QidImageUploadValue) => void;
  /**
   * Called when the agent initiates a scan, BEFORE the value is written.
   * Return false to fail the scan: the value is left untouched and the card
   * stays on the insert prompt, so the caller can render `error` and open
   * whatever fallback it owns.
   *
   * Optional, defaulting to always succeeding, because only IdLookupStep has
   * an attempt budget and a manual-entry fallback. The Verification Gate, SIM
   * Swap and Passport-to-QID all just need the scan to land.
   */
  onScan?: () => boolean;
  /** Rendered inside the insert zone, after a failed scan. */
  error?: string;
}

// FLD (Passport to QID journey, UJ-076): "scan/upload QID Front & Back" required
// before Continue - no real file I/O in a front-end-only app, so scanning is
// simulated, matching the mandatory-gating shape evidenced elsewhere
// (Pattern 12).
//
// ONE SCANNING OPERATION, not two. The reader takes the card once and reads
// both faces, so this is a single card with a single action and a single
// Retake - superseding the 2026-09-25 build where front and back were separate
// cards with their own Initiate and Retake buttons. That shape implied the
// agent feeds the card through twice and, worse, allowed a half-scanned state
// that every consumer had to treat as invalid anyway.
//
// The VALUE CONTRACT is deliberately unchanged: a scan still writes
// frontScanned AND backScanned, and all four consumers still gate on both.
// That is what let this be restructured without touching VerificationGate,
// NewSimSwapWizard or PassportToQidWizard - they each require both flags, and
// both flags now flip together.
//
// Three blocks: title, capture area, action.
//
// - Title: names the document. No state chip. A "WAITING..." / "CAPTURED"
//   pill was added on 2026-09-25 from the reference image and removed the
//   same day as not required: with one card and one operation, the capture
//   area already IS the state - an insert prompt or two photographs - so the
//   pill only restated what filled the largest block on screen. It earned its
//   place in the two-card build, where a half-scanned pair needed reading at a
//   glance; that ambiguity no longer exists.
// - Capture area: a dashed insert zone before the scan, both faces after it.
//   Dashed, not solid, because the border is around an EMPTY target rather
//   than around content - the same distinction the rest of the re-skin draws
//   with its 1px solid borders.
// - Action: Initiate before, Retake after. Retake returns the card to the
//   insert prompt rather than re-scanning immediately, so the agent re-seats
//   the document and initiates deliberately.
//
// Departures from the 2026-09-25 reference image, which showed the two-card
// shape. The first two are direct instructions, the rest are so the card obeys
// this app's tokens rather than restating the asset's literal values:
//
// - One card and one Retake, per above.
// - Retake is ABSENT before the first capture, where the asset greys it out.
//   A control that cannot act yet is noise in a step the agent reads top to
//   bottom, and "retake" is meaningless when nothing has been taken.
// - The primary action is --accent, not the asset's near-black. Primary
//   actions are brand red everywhere in this app, and a charcoal fill has no
//   dark-mode value (--charcoal-panel is #21232b against a #1b1d23 zone -
//   effectively invisible). Position, weight and fill-vs-outline all match.
// - The prompt sits at --fg-2, not the asset's light grey. --muted on
//   --surface-subtle is 4.33:1, just under SC 1.4.3's 4.5:1 at this size.
//   --fg-2 is 6.37:1 and still reads as secondary beside the --fg title.
export function QidImageUpload({ value, onChange, onScan, error }: QidImageUploadProps) {
  const scanned = Boolean(value.frontScanned && value.backScanned);
  const simulated = !value.frontImage && !value.backImage;

  const initiate = () => {
    // Explicit === false: an undefined onScan must not read as a rejection.
    if (onScan?.() === false) return;
    onChange({ ...value, frontScanned: true, backScanned: true });
  };

  const retake = () =>
    onChange({ ...value, frontScanned: false, backScanned: false, frontImage: undefined, backImage: undefined });

  return (
    <div className="rounded-[var(--radius-card)] border border-border-soft bg-bg p-4 flex flex-col gap-3">
      <span className="text-fg font-semibold text-[length:var(--fs-body)]">Qatar ID</span>

      {scanned ? (
        <>
          {/* Both faces, side by side, from the one operation. Captioned per
              face so the agent can tell which is which when judging whether a
              capture is usable - the previews are deliberately similar
              (same document, same crop) and the maroon band alone is a thin
              cue to hang that on. */}
          <div className="grid grid-cols-2 gap-4">
            {(['front', 'back'] as const).map((side) => (
              <figure key={side} className="flex flex-col items-center gap-2">
                <ScannedIdPreview side={side} src={side === 'front' ? value.frontImage : value.backImage} />
                <figcaption className="text-fg-2 text-[length:var(--fs-caption)] capitalize">QID {side}</figcaption>
              </figure>
            ))}
          </div>
          {/* Once, for the pair - they come from a single capture. Only when
              the images are stand-ins; a real capture needs no disclaimer and
              labelling one would be wrong. */}
          {simulated && (
            <span className="text-muted text-[length:var(--fs-caption)] text-center">Simulated capture</span>
          )}
          <Button variant="ghost-rect" compact className="w-full" onClick={retake}>
            Retake scan
          </Button>
        </>
      ) : (
        <div className="min-h-[9rem] rounded-[var(--radius-card)] border border-dashed border-border bg-[var(--surface-subtle)] px-4 py-8 flex flex-col items-center justify-center gap-3">
          <span className="text-fg-2 text-[length:var(--fs-caption)] uppercase tracking-[0.14em] text-center">
            Insert card and initiate scan
          </span>
          <Button variant="primary-rect" compact onClick={initiate}>
            Initiate scan
          </Button>
          {/* role="alert" so the failure is announced: the agent's attention is
              on the physical reader, not the screen, and nothing else about
              the card changes when a scan fails. */}
          {error && (
            <p role="alert" className="text-danger text-[length:var(--fs-caption)] text-center max-w-[24rem]">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
