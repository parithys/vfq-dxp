import { useEffect, useRef, useState } from 'react';
import { Button } from '../primitives/Button';
import { Spinner } from '../primitives/Spinner';
import { ScannedIdPreview } from './ScannedIdPreview';
import { SYNTHETIC_CLASS } from '../../data/synthetic/syntheticMarker';
import { SCAN_DURATION_MS } from './qidImageUploadModel';
import type { QidImageUploadProps } from './qidImageUploadModel';

// ---------------------------------------------------------------------------------------------------------
// Passport: two separate scanning sections, one per side, each captured on the flatbed scanner.
// The attempt budget is charged once per document pass (the first side to complete), not once per side.
// ---------------------------------------------------------------------------------------------------------
type PassportProps = Pick<QidImageUploadProps, 'value' | 'onChange' | 'onScan' | 'error' | 'canScan' | 'demoTypes' | 'onDemoScan' | 'blurFirstScan' | 'hideUnclearNotice' | 'variant' | 'identity'>;

export function PassportScanSections({ value, onChange, onScan, error, canScan = true, demoTypes, onDemoScan, blurFirstScan = false, hideUnclearNotice = false, variant, identity }: PassportProps) {
  const [scanning, setScanning] = useState<'front' | 'back' | null>(null);
  const [blurred, setBlurred] = useState({ front: false, back: false });
  const [retakes, setRetakes] = useState({ front: 0, back: 0 });
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef(value);
  latest.current = value;
  const charged = useRef(false);
  const anyScanned = Boolean(value.frontScanned || value.backScanned);
  useEffect(() => () => clearTimeout(timer.current), []);
  // A fresh document (both sides cleared from outside) starts a new pass.
  useEffect(() => {
    if (!anyScanned) {
      charged.current = false;
      setBlurred({ front: false, back: false });
    }
  }, [anyScanned]);

  const scanSide = (side: 'front' | 'back') => {
    if (scanning || !canScan) return;
    const scannedKey = side === 'front' ? 'frontScanned' : 'backScanned';
    const imageKey = side === 'front' ? 'frontImage' : 'backImage';
    const isRetake = Boolean(latest.current[scannedKey]);
    if (isRetake) onChange({ ...latest.current, [scannedKey]: false, [imageKey]: undefined, clear: undefined });
    setScanning(side);
    timer.current = setTimeout(() => {
      setScanning(null);
      if (!charged.current) {
        charged.current = true;
        if (onScan?.() === false) {
          charged.current = false;
          return;
        }
      }
      if (isRetake) setRetakes((r) => ({ ...r, [side]: r[side] + 1 }));
      // The first pass over each side comes back blurred when the demo asks for it; a retake is clear.
      const nextBlurred = { ...blurred, [side]: blurFirstScan && !isRetake };
      setBlurred(nextBlurred);
      onChange({ ...latest.current, [scannedKey]: true, clear: !(nextBlurred.front || nextBlurred.back) });
    }, SCAN_DURATION_MS);
  };

  const section = (side: 'front' | 'back') => {
    const done = Boolean(side === 'front' ? value.frontScanned : value.backScanned);
    const title = side === 'front' ? 'Scan Front Side' : 'Scan Back Side';
    const n = retakes[side];
    return (
      <div key={side} className="rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg p-4 flex flex-col gap-3">
        <p className="text-fg font-medium text-[length:var(--fs-body)]">{title}</p>
        {scanning === side ? (
          <div className="min-h-[var(--size-dropzone-min-h)] rounded-[var(--radius-card)] border border-dashed border-border bg-[var(--surface-subtle)] px-4 py-8 flex flex-col items-center justify-center gap-3">
            <Spinner size={28} label={`Scanning the Passport ${side} side`} />
            <span className="text-fg-2 text-[length:var(--fs-caption)] uppercase tracking-[0.14em] text-center">Scanning Passport {side} side</span>
          </div>
        ) : done ? (
          <>
            <figure className="flex flex-col items-center gap-2 max-w-[15rem] mx-auto w-full">
              <ScannedIdPreview
                side={side}
                documentType="Passport"
                variant={variant}
                identity={identity}
                src={side === 'front' ? value.frontImage : value.backImage}
                clear={!blurred[side]}
              />
              <figcaption className="text-fg-2 text-[length:var(--fs-caption)]">Passport {side}</figcaption>
            </figure>
            {blurred[side] && !hideUnclearNotice && (
              <p role="alert" className="text-danger text-[length:var(--fs-caption)] text-center">
                Image unclear - the reader could not read this capture. Retake the scan for a clear image.
              </p>
            )}
            <Button variant="ghost-rect" compact className="w-full" onClick={() => scanSide(side)} aria-label={n > 0 ? `Retake ${side} side scan, ${n} so far` : undefined}>
              Retake scan{n > 0 && ` (${n})`}
            </Button>
          </>
        ) : (
          <div className="min-h-[var(--size-dropzone-min-h)] rounded-[var(--radius-card)] border border-dashed border-border bg-[var(--surface-subtle)] px-4 py-8 flex flex-col items-center justify-center gap-3">
            <span className="text-fg-2 text-[length:var(--fs-caption)] uppercase tracking-[0.14em] text-center">
              {canScan ? `Place the passport ${side} side` : 'Card could not be read'}
            </span>
            {canScan && (
              <Button variant="primary-rect" compact onClick={() => scanSide(side)}>
                Scan {side} side
              </Button>
            )}
            {side === 'front' && !anyScanned && canScan && demoTypes && demoTypes.length > 0 && onDemoScan && (
              <div className={`${SYNTHETIC_CLASS} flex flex-col items-center gap-1`}>
                <span className="text-[length:var(--fs-micro)] uppercase tracking-wide">Demo only - simulate inserting</span>
                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
                  {demoTypes.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => {
                        onDemoScan(t.value);
                        scanSide('front');
                      }}
                      className="text-[length:var(--fs-caption)] underline hover:opacity-80 focus:outline-none focus-visible:shadow-[var(--focus-ring)] rounded-[var(--radius-button)] px-0.5"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {error &&
              (Array.isArray(error) ? (
                <ul role="alert" className="text-danger text-[length:var(--fs-caption)] text-left max-w-[var(--size-field-message-max-w)] list-disc pl-5 space-y-1">
                  {error.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : (
                <p role="alert" className="text-danger text-[length:var(--fs-caption)] text-center max-w-[var(--size-field-message-max-w)]">
                  {error}
                </p>
              ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {section('front')}
      {section('back')}
    </div>
  );
}
