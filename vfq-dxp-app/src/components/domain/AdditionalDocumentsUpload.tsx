import { formatBytes as formatSize } from '../../lib/format';
import { Tooltip } from '../primitives/Tooltip';
import { IconButton } from '../primitives/IconButton';
import { useEffect, useRef, useState } from 'react';
import { Input } from '../primitives/Input';
import { Select } from '../primitives/Select';
import { Button } from '../primitives/Button';
import { Icon } from '../primitives/Icon';
import { UPLOAD_RULES, uploadFileProblem } from './documentUploadRules';
import { documentFileOf, forgetDocumentFile, readFileAsDataUrl, rememberDocumentFile } from '../../lib/documentFileStore';
import type { DocumentRequirement, JourneyDocument } from '../../engines/journeyDocuments';

type FileType = 'PDF' | 'PNG' | 'JPG' | 'IMG' | 'DOC';
/** The kind of file, from its name or, when it has none, from the content held. */
function fileTypeOf(fileName: string | undefined, dataUrl: string | undefined): FileType {
  const ext = fileName?.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'PDF';
  if (ext === 'png') return 'PNG';
  if (ext === 'jpg' || ext === 'jpeg') return 'JPG';
  const mime = /^data:([^;,]*)/.exec(dataUrl ?? '')?.[1] ?? '';
  if (mime === 'application/pdf') return 'PDF';
  if (mime.startsWith('image/')) return mime === 'image/png' ? 'PNG' : mime === 'image/jpeg' ? 'JPG' : 'IMG';
  return 'DOC';
}

/** A page with a folded corner and the file type on it - PDFs in the brand red, images in blue, anything else neutral. */
function FileTypeIcon({ type }: { type: FileType }) {
  const tone = type === 'PDF' ? 'text-[var(--tag-primary-fg)]' : type === 'DOC' ? 'text-muted' : 'text-[var(--tag-blue-fg)]';
  return (
    <span aria-hidden className={`relative flex h-14 w-11 shrink-0 items-end justify-center pb-3 ${tone}`}>
      <svg viewBox="0 0 44 56" fill="none" className="absolute inset-0 h-full w-full">
        <path d="M6 1.5h22l14.5 14.5V50a4.5 4.5 0 0 1-4.5 4.5H6A4.5 4.5 0 0 1 1.5 50V6A4.5 4.5 0 0 1 6 1.5z" className="fill-[var(--bg)] stroke-[var(--field-card-border)]" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M28 1.5V12a4 4 0 0 0 4 4h10.5" className="fill-[var(--surface)] stroke-[var(--field-card-border)]" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      <span className="relative font-bold text-[length:var(--fs-caption)] leading-none tracking-wide">{type}</span>
    </span>
  );
}

const escapeXml = (t: string) => t.replace(/[<>&"']/g, '');
/** Stand-in for a scan whose image was not kept: says what it is and that it is a specimen. */
const scanSpecimen = (label: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400"><rect width="640" height="400" rx="16" fill="whitesmoke" stroke="gray" stroke-width="2"/><text x="320" y="190" text-anchor="middle" font-family="sans-serif" font-size="28" font-weight="bold" fill="dimgray">${escapeXml(label)}</text><text x="320" y="230" text-anchor="middle" font-family="sans-serif" font-size="18" fill="gray">Specimen - the scanner kept no image of this capture</text></svg>`,
  )}`;
/** "QID Document (Front)" -> "QID Document"; the side is shown on the tile. */
const kindOf = (label: string) => label.replace(/\s*\((Front|Back|Both Sides)\)$/, '');
const sideOf = (label: string) => /\((Front|Back|Both Sides)\)$/.exec(label)?.[1] ?? label;

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
  /** The requirement this document satisfies (see engines/journeyDocuments.ts), when it was uploaded for one. */
  requirementId?: string;
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
  /** The documents this order requires, for its scenario and the role working it: each is asked for here, once. */
  requirements?: DocumentRequirement[];
  /** Called with how many required documents are still missing; the caller holds Continue until it is 0. */
  onMissingRequiredChange?: (missing: number) => void;
  /** Every document the journey already holds (ID scans, evidence, the signed CAF): listed here to be viewed and downloaded. */
  journeyDocuments?: JourneyDocument[];
}

const MAX_DOCUMENTS = 10;
const RULES = UPLOAD_RULES.supporting;

const TRASH = 'M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6 M10 11v6 M14 11v6';
const DOC = 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6';
const EYE = 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z';
const UPLOAD = 'M12 16V4 M7 9l5-5 5 5 M4 20h16';

/** A data URL as an object URL: browsers will not open a data: URL as a page, but they open a blob. */
function blobUrlOf(dataUrl: string): string | undefined {
  const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(dataUrl);
  if (!m) return undefined;
  const bytes = m[2] ? Uint8Array.from(atob(m[3]), (c) => c.charCodeAt(0)) : new TextEncoder().encode(decodeURIComponent(m[3]));
  return URL.createObjectURL(new Blob([bytes], { type: m[1] || 'application/octet-stream' }));
}

function openDocument(dataUrl: string): void {
  const url = blobUrlOf(dataUrl);
  if (url) window.open(url, '_blank', 'noopener');
}

const fileNameOf = (d: JourneyDocument): string => d.fileName ?? `${d.label.replace(/[^\w]+/g, '-').toLowerCase()}.${/^data:image\/png/.test(d.dataUrl ?? '') ? 'png' : /^data:image\/jpe?g/.test(d.dataUrl ?? '') ? 'jpg' : /^data:application\/pdf/.test(d.dataUrl ?? '') ? 'pdf' : 'svg'}`;

// Additional Documents: the end of the journey, after the CAF is signed. It holds (1) what this order requires the agent to attach, decided by
// its scenario and the role - asked for here and nowhere earlier; (2) every document the journey holds, consolidated, each one viewable; and (3) anything else the agent wants to attach, labelled by type. No signature is needed for any of it.
export function AdditionalDocumentsUpload({
  documents,
  onChange,
  labelOptions,
  maxDocuments = MAX_DOCUMENTS,
  whiteBackground = false,
  onPendingChange,
  requirements = [],
  onMissingRequiredChange,
  journeyDocuments = [],
}: AdditionalDocumentsUploadProps) {
  const [label, setLabel] = useState('');
  // The file chosen or dropped but not uploaded yet.
  const [staged, setStaged] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  // A type picked with no file yet is an unfinished upload: the caller blocks Continue until it is uploaded.
  useEffect(() => {
    onPendingChange?.(Boolean(label.trim() || staged));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label, staged]);
  useEffect(() => () => onPendingChange?.(false), []);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const requiredFileRef = useRef<HTMLInputElement>(null);
  const [uploadingFor, setUploadingFor] = useState<string | undefined>();
  const atLimit = documents.length >= maxDocuments;
  // A configured list with nothing left to offer for this role, journey and customer: there is nothing to upload as, so the panel is not shown.
  const noTypesToOffer = labelOptions !== undefined && labelOptions.every((o) => documents.some((d) => d.label === o));

  const uploadedFor = (requirementId: string) => documents.find((d) => d.requirementId === requirementId);
  const missing = requirements.filter((r) => !uploadedFor(r.id));
  useEffect(() => {
    onMissingRequiredChange?.(missing.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missing.length]);
  useEffect(() => () => onMissingRequiredChange?.(0), []);

  const add = async (file: File, doc: { label: string; requirementId?: string }) => {
    const problem = uploadFileProblem(file, RULES);
    if (problem) {
      setError(problem);
      return false;
    }
    setError(null);
    const id = `${Date.now()}-${file.name}`;
    // The content is kept in memory for viewing and download; only the name, size and label go with the draft.
    try {
      rememberDocumentFile(id, await readFileAsDataUrl(file), file.type);
    } catch {
      /* the document is still attached; it just cannot be opened */
    }
    onChange([...documents, { id, label: doc.label, fileName: file.name, sizeBytes: file.size, requirementId: doc.requirementId }]);
    return true;
  };

  // Choosing or dropping a file only stages it; "Upload documents" attaches it under the chosen type.
  const stageFile = (file: File | undefined) => {
    if (!file) return;
    const problem = uploadFileProblem(file, RULES);
    if (problem) {
      setStaged(null);
      setError(problem);
      return;
    }
    setError(null);
    setStaged(file);
  };

  const uploadStaged = async () => {
    const trimmed = label.trim();
    if (!trimmed) {
      setError(labelOptions ? 'Select a document type before uploading.' : 'Enter a label for this document before uploading.');
      return;
    }
    if (!staged) {
      setError('Choose a file to upload.');
      return;
    }
    if (await add(staged, { label: trimmed })) {
      setLabel('');
      setStaged(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleRequiredFile = async (file: File | undefined) => {
    const req = requirements.find((r) => r.id === uploadingFor);
    if (requiredFileRef.current) requiredFileRef.current.value = '';
    setUploadingFor(undefined);
    if (file && req) await add(file, { label: req.label, requirementId: req.id });
  };

  const remove = (id: string) => {
    forgetDocumentFile(id);
    onChange(documents.filter((d) => d.id !== id));
  };

  // Everything the journey holds, then what was uploaded here.
  const rows: (JourneyDocument & { removable?: boolean; sizeBytes?: number })[] = [
    ...journeyDocuments,
    ...documents.map((d) => ({ id: `upload-${d.id}`, label: d.label, source: d.requirementId ? 'Additional Documents · Required' : 'Additional Documents · Uploaded', fileName: d.fileName, fileId: d.id, removable: true, sizeBytes: d.sizeBytes })),
  ];

  // One section per kind of document within the page that produced it: "Customer Verification: QID Document".
  const sections = (() => {
    const out: { key: string; name: string; kind: string; title: string; how: string; items: typeof rows }[] = [];
    for (const d of rows) {
      const name = d.source.split(' · ')[0];
      const kind = kindOf(d.label);
      let g = out.find((x) => x.name === name && x.kind === kind);
      if (!g) out.push((g = { key: `${name}|${kind}`, name, kind, title: `${name}: ${kind}`, how: '', items: [] }));
      g.items.push(d);
    }
    // How the section was captured, from its documents: all scanned, all uploaded, or a mix.
    for (const g of out) {
      const hows = new Set(g.items.map((d) => d.source.split(' · ')[1]).filter(Boolean));
      g.how = hows.size === 1 ? [...hows][0].toLowerCase() : 'scanned or uploaded';
    }
    return out;
  })();

  return (
    <div className={`card ${whiteBackground ? '' : 'bg-surface'} p-4 space-y-4`}>
      <div>
        <h4 className="text-fg font-bold text-[length:var(--fs-body)]">Additional Documents</h4>
      </div>

      {missing.length > 0 && (
        <section aria-label="Required documents" className="space-y-3">
          <input ref={requiredFileRef} type="file" accept={RULES.accept} className="sr-only" aria-hidden tabIndex={-1} onChange={(e) => void handleRequiredFile(e.target.files?.[0])} />
          <p role="status" className="sr-only">
            {missing.length === 1 ? '1 required document is still to be uploaded.' : `${missing.length} required documents are still to be uploaded.`}
          </p>
          {missing.map((r) => (
            <div key={r.id} className="card flex items-center gap-3 px-3 py-3">
              <Icon path={DOC} className="w-4 h-4 text-muted shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-fg font-semibold text-[length:var(--fs-body)]">{r.label}</span>
                <span className="block text-muted text-[length:var(--fs-caption)]">{r.reason}</span>
              </span>
              <Button
                variant="primary"
                compact
                onClick={() => {
                  setUploadingFor(r.id);
                  requiredFileRef.current?.click();
                }}
              >
                Upload
              </Button>
            </div>
          ))}
        </section>
      )}

      <div className="@container">
        <div className="grid grid-cols-1 items-start gap-4 @2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        {noTypesToOffer ? null : !atLimit ? (
          <section aria-label="Upload new documents" className="card overflow-hidden">
            <header className="flex items-center gap-3 border-b border-border-soft px-4 py-3">
              <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-circle)] bg-accent text-accent-on font-bold text-[length:var(--fs-caption)]">01</span>
              <span className="min-w-0 flex-1">
                <span className="block text-fg font-semibold text-[length:var(--fs-body)]">Upload New Documents</span>
                <span className="block text-muted text-[length:var(--fs-caption)]">Add Optional Supporting Files</span>
              </span>
            </header>
            <div className="space-y-4 p-4">
              {labelOptions ? (
                <Select
                  label="Document Type"
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
              <input ref={fileRef} type="file" accept={RULES.accept} className="sr-only" aria-label="Choose a document to upload" onChange={(e) => stageFile(e.target.files?.[0])} />
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  stageFile(e.dataTransfer.files?.[0]);
                }}
                className={`flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-dashed px-4 py-6 text-center transition-colors ${dragging ? 'border-[var(--field-card-selected)] bg-tone-accent' : 'border-[var(--field-card-border)] bg-bg'}`}
              >
                <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-circle)] border border-[var(--danger-border)] bg-tone-accent text-accent">
                  <Icon path={UPLOAD} className="w-5 h-5" />
                </span>
                {staged ? (
                  <>
                    <p className="text-fg font-semibold text-[length:var(--fs-body)] break-all">{staged.name}</p>
                    <p className="text-muted text-[length:var(--fs-caption)]">{formatSize(staged.size)}</p>
                  </>
                ) : (
                  <>
                    <p className="text-fg font-semibold text-[length:var(--fs-body)]">Drop Documents Here</p>
                    <p className="text-fg-2 text-[length:var(--fs-caption)]">or choose files from your device</p>
                  </>
                )}
                <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                  {staged ? 'Choose another file' : 'Browse files'}
                </Button>
                <p className="text-muted text-[length:var(--fs-caption)]">{RULES.formatsLabel}, up to {RULES.maxLabel} per file</p>
              </div>
              <Button variant="primary" className="w-full" onClick={() => void uploadStaged()} disabled={!label.trim() || !staged}>
                Upload Documents
              </Button>
            </div>
          </section>
        ) : (
          <p className="text-muted text-[length:var(--fs-caption)]">Maximum of {maxDocuments} documents reached. Remove one to upload another.</p>
        )}
        {rows.length > 0 && (
          // One flat list of every document scanned or uploaded earlier in the journey: no container per document or per group.
          <section aria-label="Journey documents" className="space-y-1">
            <h5 className="text-fg font-semibold text-[length:var(--fs-body)]">Journey Documents <span className="text-muted font-normal text-[length:var(--fs-caption)]">({rows.length})</span></h5>
            <ul className="divide-y divide-border-soft">
              {sections.flatMap((g) =>
                g.items.map((d) => {
                  const held = d.dataUrl ?? (d.fileId ? documentFileOf(d.fileId)?.dataUrl : undefined);
                  // A capture the reader kept no image of (the demo scanner) opens as a labelled specimen, never as someone's document.
                  const dataUrl = held ?? (d.source.endsWith('Scanned') ? scanSpecimen(d.label) : undefined);
                  const name = d.fileName ?? fileNameOf(d);
                  // The document, then which side when the group holds several.
                  // Only the document, not the journey step it came from ("QID Document - Front", not "Customer Verification: QID Document - Front").
                  const docTitle = g.title.includes(': ') ? g.title.slice(g.title.indexOf(': ') + 2) : g.title;
                  const title = g.items.length > 1 || g.kind !== d.label ? `${docTitle} - ${sideOf(d.label)}` : docTitle;
                  return (
                    <li key={d.id} className="flex items-center gap-3 py-3">
                      <FileTypeIcon type={fileTypeOf(d.fileName, dataUrl)} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-fg font-semibold text-[length:var(--fs-body)] truncate">{title}</span>
                        <span className="block text-muted text-[length:var(--fs-caption)] truncate">{name}</span>
                      </span>
                      <Tooltip content={dataUrl ? `View ${d.label}` : 'No copy of this document is held'} placement="bottom">
                        <IconButton bordered icon={EYE} label={`View ${d.label}`} className="rounded-[var(--radius-pill)] border-border-soft! text-fg-2! enabled:hover:bg-surface" disabled={!dataUrl} onClick={() => dataUrl && openDocument(dataUrl)} />
                      </Tooltip>
                      {d.removable && d.fileId && <IconButton tone="danger" icon={TRASH} label={`Remove ${d.fileName ?? d.label}`} onClick={() => remove(d.fileId!)} />}
                    </li>
                  );
                })
              )}
            </ul>
          </section>
        )}
        </div>
      </div>

      {error && (
        <p role="alert" className="text-danger text-[length:var(--fs-caption)]">
          {error}
        </p>
      )}
    </div>
  );
}
