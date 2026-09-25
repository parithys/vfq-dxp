import { Button } from '../primitives/Button';
import { Badge } from '../primitives/Badge';

export interface QidImageUploadValue {
  frontScanned?: boolean;
  backScanned?: boolean;
}

interface QidImageUploadProps {
  value: QidImageUploadValue;
  onChange: (value: QidImageUploadValue) => void;
}

// FLD (Passport to QID journey, UJ-076): "scan/upload QID Front & Back" required
// before Continue - no real file I/O in a front-end-only app, so scanning is
// simulated with a button per side, matching the mandatory-gating shape
// evidenced elsewhere (Pattern 12).
export function QidImageUpload({ value, onChange }: QidImageUploadProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {(['front', 'back'] as const).map((side) => {
        const scanned = side === 'front' ? value.frontScanned : value.backScanned;
        return (
          <div key={side} className="rounded-[var(--radius-card)] border border-border-soft bg-bg p-4 flex flex-col items-center gap-2">
            <span className="text-fg-2 text-[length:var(--fs-body)] capitalize">QID {side}</span>
            {scanned ? (
              <Badge variant="success">Successfully scanned</Badge>
            ) : (
              <Button
                variant="ghost-rect"
                compact
                onClick={() => onChange({ ...value, [side === 'front' ? 'frontScanned' : 'backScanned']: true })}
              >
                Scan {side}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
