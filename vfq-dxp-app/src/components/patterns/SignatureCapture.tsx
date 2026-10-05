import { useState } from 'react';
import { Button } from '../primitives/Button';
import { SignaturePad } from '../primitives/SignaturePad';

/**
 * The standard "Please Sign" control, for every journey that captures a
 * signature: a Please Sign button, and - once pressed - the signing canvas
 * opening right below it with Clear and Save. No side drawer. Save hands the
 * signature (a PNG data URL) to `onSave` and closes it.
 */
export function SignatureCapture({
  onSave,
  label = 'Please Sign',
  disabled = false,
}: {
  onSave: (dataUrl: string) => void;
  label?: string;
  /** Keeps the Please Sign button off until a precondition (e.g. agreeing to the terms) is met. */
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <Button variant="primary-rect" onClick={() => setOpen(true)} disabled={open || disabled}>
        {label}
      </Button>
      {open && (
        <div className="mt-3">
          <SignaturePad
            doneLabel="Save"
            onDone={(dataUrl) => {
              onSave(dataUrl);
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
