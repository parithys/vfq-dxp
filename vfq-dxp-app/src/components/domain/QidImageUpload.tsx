import { useEffect, useRef, useState } from 'react';
import { Button } from '../primitives/Button';
import { Spinner } from '../primitives/Spinner';
import { ScannedIdPreview } from './ScannedIdPreview';
import { SYNTHETIC_CLASS } from '../../data/synthetic/syntheticMarker';
import { SCAN_DURATION_MS } from './qidImageUploadModel';
import type { QidImageUploadProps } from './qidImageUploadModel';
import { PassportScanSections } from './PassportScanSections';


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
  hideUnclearNotice = false,
  onAccept,
  onReject,
  accepted,
  variant,
  identity,
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

  if (documentType === 'Passport') {
    return (
      <PassportScanSections
        value={value}
        onChange={onChange}
        onScan={onScan}
        error={error}
        canScan={canScan}
        demoTypes={demoTypes}
        onDemoScan={onDemoScan}
        blurFirstScan={blurFirstScan}
        hideUnclearNotice={hideUnclearNotice}
        variant={variant}
        identity={identity}
      />
    );
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg p-4 flex flex-col gap-3">
      {/* Scanning FIRST, so a retake shows the reader working rather than the
          insert prompt. A retake clears the capture to start its pass, which
          without this branch would drop the card straight back to "Insert card
          and initiate scan" - telling the agent to re-seat a document that
          never left the reader, and losing them the place they were at.
          Same height as the insert zone so the step does not jump. */}
      {scanning ? (
        <div className="min-h-[var(--size-dropzone-min-h)] rounded-[var(--radius-card)] border border-dashed border-border bg-[var(--surface-subtle)] px-4 py-8 flex flex-col items-center justify-center gap-3">
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
          <div className={documentType === 'Passport' ? 'grid grid-cols-1 gap-4 max-w-xs mx-auto' : 'grid grid-cols-2 gap-4'}>
            {(documentType === 'Passport' ? (['front'] as const) : (['front', 'back'] as const)).map((side) => (
              <figure key={side} className="flex flex-col items-center gap-2">
                <ScannedIdPreview
                  side={side}
                  documentType={documentType}
                  variant={variant}
                  identity={identity}
                  src={side === 'front' ? value.frontImage : value.backImage}
                  clear={value.clear ?? true}
                />
                <figcaption className="text-fg-2 text-[length:var(--fs-caption)] capitalize">
                  {documentType === 'Passport' ? 'Passport data page' : `${documentType === 'QID' ? 'QID' : documentType} ${side}`}
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
          {value.clear === false && !hideUnclearNotice && (
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
          <div className={onAccept || onReject ? 'flex items-center justify-between gap-3' : ''}>
            <Button
              variant="ghost-rect"
              compact
              className={onAccept || onReject ? '' : 'w-full'}
              onClick={runScan}
              aria-label={retakes > 0 ? `Retake scan, ${retakes} so far` : undefined}
            >
              Retake scan{retakes > 0 && ` (${retakes})`}
            </Button>
            {(onAccept || onReject) && (
              <div className="flex items-center gap-2">
                {onAccept && (
                  <Button variant="primary-rect" compact onClick={onAccept} disabled={accepted || value.clear === false}>
                    {accepted ? 'Accepted' : 'Accept'}
                  </Button>
                )}
                {onReject && (
                  <Button variant="ghost-rect" compact onClick={onReject}>
                    Reject
                  </Button>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="min-h-[var(--size-dropzone-min-h)] rounded-[var(--radius-card)] border border-dashed border-border bg-[var(--surface-subtle)] px-4 py-8 flex flex-col items-center justify-center gap-3">
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
            <div className={`${SYNTHETIC_CLASS} flex flex-col items-center gap-1`}>
              <span className="text-[length:var(--fs-micro)] uppercase tracking-wide">
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
                    className="text-[length:var(--fs-caption)] underline
                      hover:opacity-80 focus:outline-none
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
            Array.isArray(error) ? (
              <ul role="alert" className="text-danger text-[length:var(--fs-caption)] text-left max-w-[var(--size-field-message-max-w)] list-disc pl-5 space-y-1">
                {error.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : (
              <p role="alert" className="text-danger text-[length:var(--fs-caption)] text-center max-w-[var(--size-field-message-max-w)]">
                {error}
              </p>
            )
          )}
        </div>
      )}
    </div>
  );
}
