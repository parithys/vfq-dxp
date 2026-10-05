import { useRef, useState } from 'react';
import { Button } from './Button';

interface SignaturePadProps {
  onDone: (dataUrl: string) => void;
  /** Label of the confirm button. Default "Done". */
  doneLabel?: string;
  /** When given, a Cancel button is shown beside Clear and Save. */
  onCancel?: () => void;
}

// Backs the "Please Sign" pad modal per Pattern 6 (CAF/Contract Signature
// Capture) - drawn signature, Clear/Done buttons (SCR-058, SCR-084, etc.).
export function SignaturePad({ onDone, doneLabel = 'Done', onCancel }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = 'var(--fg)';
    ctx.lineWidth = 2;
    ctx.stroke();
    setHasDrawn(true);
  };

  const end = () => {
    drawing.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const done = () => {
    onDone(canvasRef.current!.toDataURL());
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={480}
        height={160}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className="border border-[var(--grey-form)] rounded-[var(--radius-card)] bg-bg touch-none w-full max-w-[480px]"
      />
      <div className="flex gap-2 mt-2">
        <Button variant="ghost-rect" onClick={clear}>
          Clear
        </Button>
        {onCancel && (
          <Button variant="ghost-rect" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button variant="primary-rect" onClick={done} disabled={!hasDrawn}>
          {doneLabel}
        </Button>
      </div>
    </div>
  );
}
