import { useEffect, useRef, useState } from 'react';
import { Button } from '../primitives/Button';
import { Spinner } from '../primitives/Spinner';
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
  /**
   * Whether the completed scan is sharp enough to read. Set by this
   * component, not the caller: true unless `blurFirstScan` is on AND this
   * was the first pass over the reader. See ScannedIdPreview.clear for what
   * it drives visually.
   */
  clear?: boolean;
}

interface QidImageUploadProps {
  value: QidImageUploadValue;
  onChange: (value: QidImageUploadValue) => void;
  /**
   * Called once per pass over the reader - an Initiate AND every Retake, both
   * of which drive the reader - when the pass COMPLETES, before any value is
   * written. One charge per physical pass either way, but adjudicating at the
   * end means a consumer's "budget spent" state, and any fallback it gates on
   * that, arrives with the failure rather than while the card is still
   * visibly reading.
   *
   * Return false to fail the pass: no capture is written, the card lands back
   * on the insert prompt once the pass ends, and the caller can render `error`
   * and open whatever fallback it owns.
   *
   * Optional, defaulting to always succeeding, because only IdLookupStep has
   * an attempt budget and a manual-entry fallback. The Verification Gate, SIM
   * Swap and Passport-to-QID all just need the scan to land.
   */
  onScan?: () => boolean;
  /** Rendered inside the insert zone, after a failed scan. */
  error?: string;
  /**
   * Whether the reader can still be driven. Default true.
   *
   * Pass false once the consumer's attempt budget is spent: the insert zone
   * keeps the prompt and the `error`, but drops the Initiate button. A scan
   * that can never succeed should not be offered - left live it spun for
   * 900ms and returned to the same prompt, which reads as a broken button
   * rather than as a reader that has given up, and the agent can sit there
   * pressing it. The same reason Retake is absent before the first capture.
   */
  canScan?: boolean;
  /**
   * Which document is in the reader. Defaults to 'QID', which is what the
   * three journeys other than IdLookupStep capture.
   *
   * Drives the face captions and, in ScannedIdPreview, whether the back face
   * carries a barcode - only the Qatar ID does.
   */
  documentType?: string;
  /**
   * DEMO ONLY (2026-09-28, requested as such). Document types offered as text
   * links under the Initiate button; clicking one names the card and runs the
   * scan.
   *
   * This deliberately re-opens a door closed on 2026-09-25, when a
   * "Simulate scan failure" button and a "Scan attempts: n / 4" counter were
   * removed from this card for exposing the simulation. Those were debug
   * leftovers; these are an explicit demo affordance, labelled as such on
   * screen so nobody mistakes them for production. Omit both props and the
   * card renders exactly as before.
   */
  demoTypes?: { value: string; label: string }[];
  onDemoScan?: (type: string) => void;
  /**
   * DEMO ONLY (2026-09-28, requested as such). When on, the FIRST pass over
   * the reader always comes back blurred - unreadable, forcing a Retake -
   * and every pass after that is clear. Defaults to false/undefined, which
   * reproduces the exact prior behaviour (every pass clear) for
   * VerificationGate, SIM Swap and Passport-to-QID, none of which this was
   * requested for and none of which have an OCR-extraction step for a blur
   * to plausibly block.
   *
   * Scoped in IdLookupStep to `autoDetectIdType` - the scan-first flow this
   * was asked for - rather than passed unconditionally to every IdLookupStep
   * caller, for the same reason: the eight selector-led journeys have no
   * "Document detected" auto-extraction either, so a forced blur-then-retake
   * there would be a new hurdle with nothing behind it to demonstrate.
   */
  blurFirstScan?: boolean;
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
// Two blocks: capture area, action. No header of its own.
//
// The card carried a "Qatar ID" title and, briefly, a "WAITING..." /
// "CAPTURED" state pill beside it. Both are gone, for the same reason: the
// caller already labels this section ("Scan Qatar ID" in IdLookupStep), the
// capture area IS the state - an insert prompt or two photographs - and the
// MOI badge that sat here for one revision now lives on the number field's
// label row. A header with nothing left to say is just an indent.
//
// - Capture area: a dashed insert zone before the scan, both faces after it.
//   Dashed, not solid, because the border is around an EMPTY target rather
//   than around content - the same distinction the rest of the re-skin draws
//   with its 1px solid borders.
// - Action: Initiate before, Retake after. RETAKE DRIVES THE READER ITSELF as
//   of 2026-09-26 - one press rescans, where it used to clear the card back to
//   the insert prompt and wait for a second press on Initiate. The card in
//   this journey never leaves the reader between reads, so sending the agent
//   back to "Insert card and initiate scan" asked them to re-seat a document
//   that was already seated, and cost two presses for one physical action.
//   Retake also carries the number of completed retakes, so the agent can see
//   how many reads this document has taken without counting them.
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

// How long the simulated reader takes. In the same 200-600ms family as
// mockDataEngine's artificial latency, at the top of it because this stands in
// for a physical pass over a card rather than a data read.
const SCAN_DURATION_MS = 900;

export function QidImageUpload({
  value,
  onChange,
  onScan,
  error,
  canScan = true,
  documentType = 'QID',
  demoTypes,
  onDemoScan,
  blurFirstScan = false,
}: QidImageUploadProps) {
  const scanned = Boolean(value.frontScanned && value.backScanned);

  // Which pass is running, or null when the reader is idle. One state rather
  // than a boolean plus a separate "was this a retake" flag, because a retake
  // clears the capture before its pass starts - so `scanned` cannot answer
  // which kind of pass this is once it is under way.
  const [pass, setPass] = useState<'first' | 'retake' | null>(null);
  const scanning = pass !== null;
  // Completed retakes, for the button's label. Counted on success, because the
  // label reports reads the agent GOT - an attempt the reader refused produced
  // no scan to number.
  //
  // Local, like IdLookupStep's attempt budget and for the same reason: this
  // describes one sitting at the counter, not the order. It is deliberately
  // NOT the same number as that budget, which counts attempts including the
  // failed one; these answer different questions and neither can be derived
  // from the other.
  const [retakes, setRetakes] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // The reader is mid-pass when the step unmounts - an ID Type switch, or the
  // agent leaving the journey. Without this the timer still fires and writes a
  // completed scan into a step that is gone.
  useEffect(() => () => clearTimeout(timer.current), []);

  const runScan = () => {
    if (scanning || !canScan) return;

    // Whether this pass is a retake has to be read BEFORE the value is
    // cleared, since clearing is what makes `scanned` false.
    const isRetake = scanned;

    // A retake discards the previous read immediately rather than at the end
    // of the pass. The old capture, and whatever the consumer derived from it,
    // describe a document the agent has just decided to read again - leaving
    // them up beside a spinner would have the card claiming a validated
    // identity while the reader was busy disagreeing with it.
    if (isRetake) {
      onChange({
        ...value,
        frontScanned: false,
        backScanned: false,
        frontImage: undefined,
        backImage: undefined,
        clear: undefined,
      });
    }

    setPass(isRetake ? 'retake' : 'first');
    timer.current = setTimeout(() => {
      setPass(null);
      // The attempt is counted and adjudicated when the pass ENDS, not when it
      // starts. Both are one charge per physical pass, so the budget arithmetic
      // is identical - but charging up front flipped the consumer's "budget
      // spent" state while the spinner was still turning, which put an
      // editable number field and a Fetch button on screen underneath a card
      // that was visibly still reading. The fallback has to arrive with the
      // failure, not ahead of it, or the reader is not the thing that opened
      // it.
      //
      // Explicit === false: an undefined onScan must not read as a rejection.
      //
      // Refused: leave the value cleared. The insert prompt returns with
      // whatever `error` the consumer renders, which is the honest state -
      // there is no capture, and the way forward is the fallback the consumer
      // owns rather than this card.
      if (onScan?.() === false) return;
      if (isRetake) setRetakes((n) => n + 1);
      // Blurred only on a first pass, and only when the caller asked for the
      // simulation. Every retake is clear - once the agent has re-seated the
      // card, the demo has made its point, and a card that stays unreadable
      // forever would just look broken rather than illustrative.
      const clear = !blurFirstScan || isRetake;
      onChange({ ...value, frontScanned: true, backScanned: true, clear });
    }, SCAN_DURATION_MS);
  };

  return (
    <div className="rounded-[var(--radius-card)] border border-border-soft bg-bg p-4 flex flex-col gap-3">
      {/* Scanning FIRST, so a retake shows the reader working rather than the
          insert prompt. A retake clears the capture to start its pass, which
          without this branch would drop the card straight back to "Insert card
          and initiate scan" - telling the agent to re-seat a document that
          never left the reader, and losing them the place they were at.
          Same height as the insert zone so the step does not jump. */}
      {scanning ? (
        <div className="min-h-[9rem] rounded-[var(--radius-card)] border border-dashed border-border bg-[var(--surface-subtle)] px-4 py-8 flex flex-col items-center justify-center gap-3">
          <Spinner size={28} label={`${pass === 'retake' ? 'Rescanning' : 'Scanning'} the ${documentType}`} />
          <span className="text-fg-2 text-[length:var(--fs-caption)] uppercase tracking-[0.14em] text-center">
            {pass === 'retake' ? 'Rescanning' : 'Scanning'} {documentType === 'QID' ? 'QID' : documentType}
          </span>
        </div>
      ) : scanned ? (
        <>
          {/* Both faces, side by side, from the one operation. Captioned per
              face so the agent can tell which is which when judging whether a
              capture is usable - the previews are deliberately similar
              (same document, same crop) and the maroon band alone is a thin
              cue to hang that on. */}
          <div className="grid grid-cols-2 gap-4">
            {(['front', 'back'] as const).map((side) => (
              <figure key={side} className="flex flex-col items-center gap-2">
                <ScannedIdPreview
                  side={side}
                  documentType={documentType}
                  src={side === 'front' ? value.frontImage : value.backImage}
                  clear={value.clear ?? true}
                />
                <figcaption className="text-fg-2 text-[length:var(--fs-caption)] capitalize">
                  {documentType === 'QID' ? 'QID' : documentType} {side}
                </figcaption>
              </figure>
            ))}
          </div>
          {/* "Document detected: X" moved out of this card and up to the
              heading IdLookupStep renders above it (2026-09-28), so it is not
              duplicated here. "Simulated capture" removed the same round -
              see the 2026-09-27 note this replaced, now gone along with the
              text. */}
          {/* role="alert": the blur is the ONLY signal a first-pass scan
              failed - IdLookupStep's OCR-extraction effect deliberately skips
              a blurred pass rather than trying and failing it, so no number
              or MOI result ever appears to explain the silence. Without this
              line the agent would see two blurry photos and a Retake button
              with nothing saying why nothing else happened. */}
          {value.clear === false && (
            <p role="alert" className="text-danger text-[length:var(--fs-caption)] text-center">
              Image unclear - the reader could not read this capture. Retake the scan for a clear image.
            </p>
          )}
          {/* The count is of retakes DONE, so it appears only once there has
              been one - a fresh capture's button reads "Retake scan", not
              "Retake scan (0)". Parenthesised rather than spelled out because
              it sits inside a control label, where "Retake scan, 2 so far"
              would be a sentence on a button. The screen-reader name spells it
              out instead, since "(2)" read aloud is just a number. */}
          <Button
            variant="ghost-rect"
            compact
            className="w-full"
            onClick={runScan}
            aria-label={retakes > 0 ? `Retake scan, ${retakes} so far` : undefined}
          >
            Retake scan{retakes > 0 && ` (${retakes})`}
          </Button>
        </>
      ) : (
        <div className="min-h-[9rem] rounded-[var(--radius-card)] border border-dashed border-border bg-[var(--surface-subtle)] px-4 py-8 flex flex-col items-center justify-center gap-3">
          <span className="text-fg-2 text-[length:var(--fs-caption)] uppercase tracking-[0.14em] text-center">
            {canScan ? "Scan customer's identity document" : 'Card could not be read'}
          </span>
          {canScan && (
            <Button variant="primary-rect" compact onClick={runScan}>
              Initiate scan
            </Button>
          )}
          {/* DEMO ONLY - labelled on screen, because an unlabelled row of
              document types under the scanner is indistinguishable from the ID
              Type selector this flow deliberately removed, and an agent would
              reasonably read it as "choose the document type first".
              A real reader offers no such choice. */}
          {canScan && demoTypes && demoTypes.length > 0 && onDemoScan && (
            <div className="flex flex-col items-center gap-1">
              <span className="text-muted text-[length:var(--fs-micro)] uppercase tracking-wide">
                Demo only - simulate inserting
              </span>
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
                {demoTypes.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => {
                      onDemoScan(t.value);
                      runScan();
                    }}
                    className="text-[length:var(--fs-caption)] text-accent underline
                      hover:text-[var(--deep-red)] focus:outline-none
                      focus-visible:shadow-[var(--focus-ring)] rounded-[var(--radius-button)] px-0.5"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}
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
