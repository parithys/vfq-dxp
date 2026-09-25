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
}

// FLD (Passport to QID journey, UJ-076): "scan/upload QID Front & Back" required
// before Continue - no real file I/O in a front-end-only app, so scanning is
// simulated with a button per side, matching the mandatory-gating shape
// evidenced elsewhere (Pattern 12).
//
// Once a side is scanned the card shows the captured document rather than just
// a badge, so the agent can see WHICH side landed and that something was read
// at all. Because the scan is simulated there is no photograph to show, so the
// preview is a document-shaped stand-in and is captioned as such - see
// ScannedIdPreview. Passing a real data URL through frontImage/backImage
// replaces it with no other change.
export function QidImageUpload({ value, onChange }: QidImageUploadProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {(['front', 'back'] as const).map((side) => {
        const scanned = side === 'front' ? value.frontScanned : value.backScanned;
        const image = side === 'front' ? value.frontImage : value.backImage;
        const scannedKey = side === 'front' ? 'frontScanned' : 'backScanned';
        return (
          <div
            key={side}
            className="rounded-[var(--radius-card)] border border-border-soft bg-bg p-4 flex flex-col items-center gap-2"
          >
            <span className="text-fg-2 text-[length:var(--fs-body)] capitalize">QID {side}</span>
            {scanned ? (
              <>
                {/* The image IS the success state now - the "Successfully
                    scanned" badge was removed as redundant once the capture
                    itself is on screen. Non-visual users are not left without
                    it: the preview carries an aria-label naming the side it
                    captured, and Re-scan only exists once a side is scanned. */}
                <ScannedIdPreview side={side} src={image} />
                {/* Only when the image is a stand-in. A real capture needs no
                    disclaimer, and labelling one would be wrong. */}
                {!image && <span className="text-muted text-[length:var(--fs-caption)]">Simulated capture</span>}
                {/* Re-scanning has to be reachable: a crooked or cut-off
                    capture is the ordinary reason an agent looks at this
                    preview at all, and before this the only way to retry was
                    to switch ID type and start over. */}
                <Button
                  variant="ghost-rect"
                  compact
                  onClick={() =>
                    onChange({
                      ...value,
                      [scannedKey]: false,
                      [side === 'front' ? 'frontImage' : 'backImage']: undefined,
                    })
                  }
                >
                  Re-scan {side}
                </Button>
              </>
            ) : (
              <Button variant="ghost-rect" compact onClick={() => onChange({ ...value, [scannedKey]: true })}>
                Scan {side}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
