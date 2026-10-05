import { useRef, useState } from 'react';
import { Button } from '../primitives/Button';

export interface UploadedDocument {
  fileName: string;
  sizeBytes: number;
}

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = '.pdf,.jpg,.jpeg,.png';

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/**
 * "Upload Document": the digital alternative to scanning a supporting document for the
 * Retired, B2B2C and MADA customer scenarios. Same card treatment as the scanner. Only the file's name and size
 * are kept (there is no document store in the prototype), exactly as the discount proof
 * document upload does.
 */
export function SupportingDocumentUpload({
  value,
  onChange,
}: {
  value?: UploadedDocument;
  onChange: (doc: UploadedDocument | undefined) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError(`${file.name} is ${formatSize(file.size)}. The limit is 5 MB.`);
      return;
    }
    setError(null);
    onChange({ fileName: file.name, sizeBytes: file.size });
    if (input.current) input.current.value = '';
  };

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg p-4 flex flex-col gap-3">
      <input ref={input} type="file" accept={ACCEPT} className="sr-only" aria-label="Upload supporting document" onChange={(e) => pick(e.target.files?.[0])} />
      {value ? (
        <>
          <div className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-surface px-3 py-2">
            <span className="min-w-0 text-[length:var(--fs-body)] text-fg truncate">
              {value.fileName}
              <span className="text-muted"> · {formatSize(value.sizeBytes)}</span>
            </span>
            <button
              type="button"
              onClick={() => onChange(undefined)}
              className="shrink-0 text-[length:var(--fs-caption)] text-muted hover:text-danger underline"
            >
              Remove
            </button>
          </div>
        </>
      ) : (
        <div className="min-h-[var(--size-dropzone-min-h)] rounded-[var(--radius-card)] border border-dashed border-border bg-[var(--surface-subtle)] px-4 py-8 flex flex-col items-center justify-center gap-3">
          <span className="text-fg-2 text-[length:var(--fs-caption)] uppercase tracking-[0.14em] text-center">Upload the supporting document</span>
          <Button variant="primary-rect" compact onClick={() => input.current?.click()}>
            Browse…
          </Button>
          <span className="text-muted text-[length:var(--fs-caption)]">PDF, JPG or PNG, up to 5 MB</span>
        </div>
      )}
      {error && (
        <p role="alert" className="text-danger text-[length:var(--fs-caption)]">
          {error}
        </p>
      )}
    </div>
  );
}
