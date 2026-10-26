import { IconButton } from '../primitives/IconButton';
import { formatBytes as formatSize } from '../../lib/format';
import { useEffect, useRef, useState } from 'react';
import { Input } from '../primitives/Input';
import { Select } from '../primitives/Select';
import { Button } from '../primitives/Button';
import { Icon } from '../primitives/Icon';
import { UPLOAD_RULES, uploadFileProblem } from './documentUploadRules';

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
  /** When given, the label is picked from this list of values instead of typed. */
  labelOptions?: string[];
  /** Overrides the default 10-document cap. */
  maxDocuments?: number;
  /** White card instead of the grey surface. */
  whiteBackground?: boolean;
  /** Called with true while a document type is chosen but its document has not been uploaded yet. */
  onPendingChange?: (pending: boolean) => void;
}

const MAX_DOCUMENTS = 10;
const RULES = UPLOAD_RULES.supporting;

const TRASH = 'M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6 M10 11v6 M14 11v6';
const DOC = 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6';

// Post-signature supporting documents (2026-09-28 request) - separate from
// CafDocumentUpload's "Signed documents", which is the proof of the CAF
// signing itself and is gated on cafType/signature. These are whatever else
// the agent needs to attach afterward (proof of employment, an address bill,
// anything ad hoc) - agent-DEFINED labels rather than a fixed dropdown, and
// explicitly no signature required for any of them. Modelled on
// CafDocumentUpload's own interaction shape (label chosen before the file,
// hidden native input driven by a Button) so the two feel like the same
// control despite the label being free text here.
export function AdditionalDocumentsUpload({ documents, onChange, labelOptions, maxDocuments = MAX_DOCUMENTS, whiteBackground = false, onPendingChange }: AdditionalDocumentsUploadProps) {
  const [label, setLabel] = useState('');
  // A type picked with no file yet is an unfinished upload: the caller blocks Continue until it is uploaded.
  useEffect(() => {
    onPendingChange?.(Boolean(label.trim()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label]);
  useEffect(() => () => onPendingChange?.(false), []);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const atLimit = documents.length >= maxDocuments;

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    const trimmed = label.trim();
    if (!trimmed) {
      setError(labelOptions ? 'Select a document type before uploading.' : 'Enter a label for this document before uploading.');
      return;
    }
    const problem = uploadFileProblem(file, RULES);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    onChange([...documents, { id: `${Date.now()}-${file.name}`, label: trimmed, fileName: file.name, sizeBytes: file.size }]);
    setLabel('');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className={`card ${whiteBackground ? '' : 'bg-surface'} p-4 space-y-3`}>
      <div>
        <h4 className="text-fg font-bold text-[length:var(--fs-body)]">Additional Documents</h4>
        <p className="text-muted text-[length:var(--fs-caption)]">
          Optional - label and attach anything else this order needs. No signature required. Up to {maxDocuments} files, {RULES.maxLabel} each.
        </p>
      </div>

      {documents.length > 0 && (
        <ul className="divide-y divide-border-soft card ">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 px-3 py-2">
              <Icon path={DOC} className="w-4 h-4 text-muted shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-fg text-[length:var(--fs-body)] truncate">{doc.fileName}</span>
                <span className="block text-muted text-[length:var(--fs-caption)]">
                  {doc.label} · {formatSize(doc.sizeBytes)}
                </span>
              </span>
              <IconButton tone="danger" icon={TRASH} label={`Remove ${doc.fileName}`} onClick={() => onChange(documents.filter((d) => d.id !== doc.id))} />
            </li>
          ))}
        </ul>
      )}

      {atLimit ? (
        <p className="text-muted text-[length:var(--fs-caption)]">
          Maximum of {maxDocuments} documents reached. Remove one to upload another.
        </p>
      ) : (
        <div className="flex items-end gap-3">
          <div className="flex-1 min-w-0">
            {labelOptions ? (
              <Select
                label="Document Type"
                // "Choose document type" is the default first option (no type chosen).
                // A type already uploaded is not offered again.
                options={[
                  { value: '', label: 'Choose Document Type' },
                  ...labelOptions.filter((o) => !documents.some((d) => d.label === o)).map((o) => ({ value: o, label: o })),
                ]}
                value={label}
                onChange={(e) => {
                  setLabel(e.target.value);
                  setError(null);
                }}
              />
            ) : (
              <Input
                label="Document Label"
                placeholder="e.g. Employer Letter"
                value={label}
                onChange={(e) => {
                  setLabel(e.target.value);
                  setError(null);
                }}
              />
            )}
          </div>
          <input ref={fileRef} type="file" accept={RULES.accept} className="sr-only" onChange={(e) => handleFile(e.target.files?.[0])} />
          <Button
            variant="secondary"
            onClick={() => fileRef.current?.click()}
            disabled={!label.trim()}
            title={!label.trim() ? (labelOptions ? 'Select a document type first' : 'Enter a label first') : undefined}
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
