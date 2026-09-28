import { useRef, useState } from 'react';
import { Input } from '../primitives/Input';
import { Button } from '../primitives/Button';
import { Icon } from '../primitives/Icon';

export interface AdditionalDocument {
  /** Local id - a session artefact, not a persisted record, same as CafDocument. */
  id: string;
  /** Agent-typed, not from a fixed vocabulary (2026-09-28 request) - e.g.
   * "Employer Letter", "Utility Bill". Unlike CafDocumentUpload's signed-
   * paperwork types, this app has no fixed taxonomy for post-signature
   * supporting documents, so the agent names each one as it is added. */
  label: string;
  fileName: string;
  sizeBytes: number;
}

interface AdditionalDocumentsUploadProps {
  documents: AdditionalDocument[];
  onChange: (documents: AdditionalDocument[]) => void;
}

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_DOCUMENTS = 10;
const ACCEPTED = '.pdf,.jpg,.jpeg,.png';

const TRASH = 'M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6 M10 11v6 M14 11v6';
const DOC = 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6';

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// Post-signature supporting documents (2026-09-28 request) - separate from
// CafDocumentUpload's "Signed documents", which is the proof of the CAF
// signing itself and is gated on cafType/signature. These are whatever else
// the agent needs to attach afterward (proof of employment, an address bill,
// anything ad hoc) - agent-DEFINED labels rather than a fixed dropdown, and
// explicitly no signature required for any of them. Modelled on
// CafDocumentUpload's own interaction shape (label chosen before the file,
// hidden native input driven by a Button) so the two feel like the same
// control despite the label being free text here.
export function AdditionalDocumentsUpload({ documents, onChange }: AdditionalDocumentsUploadProps) {
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const atLimit = documents.length >= MAX_DOCUMENTS;

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    const trimmed = label.trim();
    if (!trimmed) {
      setError('Enter a label for this document before uploading.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError(`${file.name} is ${formatSize(file.size)}. The limit is 5 MB per file.`);
      return;
    }
    setError(null);
    onChange([...documents, { id: `${Date.now()}-${file.name}`, label: trimmed, fileName: file.name, sizeBytes: file.size }]);
    setLabel('');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="rounded-[var(--radius-card)] border border-border-soft bg-surface p-4 space-y-3">
      <div>
        <h4 className="text-fg font-medium text-[length:var(--fs-body)]">Additional documents</h4>
        <p className="text-muted text-[length:var(--fs-caption)]">
          Optional - label and attach anything else this order needs. No signature required. Up to {MAX_DOCUMENTS} files, 5 MB each.
        </p>
      </div>

      {documents.length > 0 && (
        <ul className="divide-y divide-border-soft rounded-[var(--radius-card)] border border-border-soft bg-bg">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 px-3 py-2">
              <Icon path={DOC} className="w-4 h-4 text-muted shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-fg text-[length:var(--fs-body)] truncate">{doc.fileName}</span>
                <span className="block text-muted text-[length:var(--fs-caption)]">
                  {doc.label} · {formatSize(doc.sizeBytes)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => onChange(documents.filter((d) => d.id !== doc.id))}
                aria-label={`Remove ${doc.fileName}`}
                className="shrink-0 p-1.5 rounded-[var(--radius-button)] text-muted hover:text-danger
                  focus:outline-none focus-visible:shadow-[var(--focus-ring)]"
              >
                <Icon path={TRASH} className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {atLimit ? (
        <p className="text-muted text-[length:var(--fs-caption)]">
          Maximum of {MAX_DOCUMENTS} documents reached. Remove one to upload another.
        </p>
      ) : (
        <div className="flex items-end gap-3">
          <div className="flex-1 min-w-0">
            <Input
              label="Document label"
              placeholder="e.g. Employer Letter"
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
                setError(null);
              }}
            />
          </div>
          <input ref={fileRef} type="file" accept={ACCEPTED} className="sr-only" onChange={(e) => handleFile(e.target.files?.[0])} />
          <Button
            variant="ghost-rect"
            onClick={() => fileRef.current?.click()}
            disabled={!label.trim()}
            title={!label.trim() ? 'Enter a label first' : undefined}
          >
            Browse…
          </Button>
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
