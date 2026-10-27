import { Tooltip } from '../primitives/Tooltip';
import { IconButton } from '../primitives/IconButton';
import { formatBytes as formatSize } from '../../lib/format';
import { useEffect, useRef, useState } from 'react';
import { Input } from '../primitives/Input';
import { Select } from '../primitives/Select';
import { Button } from '../primitives/Button';
import { Icon } from '../primitives/Icon';
import { UPLOAD_RULES, uploadFileProblem } from './documentUploadRules';
import { documentFileOf, forgetDocumentFile, readFileAsDataUrl, rememberDocumentFile } from '../../lib/documentFileStore';
import type { DocumentRequirement, JourneyDocument } from '../../engines/journeyDocuments';

/** What the section holds and how it was captured: "Identity documents scanned during verification". */
const groupNote = (name: string, how: string): string =>
  ({
    'Customer Verification': `Identity documents ${how} during verification`,
    'Special Discounts': `Evidence ${how} for the discount on this order`,
    'CAF & Signature': 'The signed application form',
    'Additional Documents': 'Documents attached here',
  })[name] ?? 'Documents on this order';
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

/** Size in bytes of a data URL's content, or undefined when it cannot be read. */
function byteSizeOf(dataUrl: string | undefined): number | undefined {
  const m = dataUrl ? /^data:[^,]*?(;base64)?,(.*)$/s.exec(dataUrl) : null;
  if (!m) return undefined;
  if (m[1]) return Math.floor((m[2].length * 3) / 4) - (m[2].endsWith('==') ? 2 : m[2].endsWith('=') ? 1 : 0);
  try {
    return new TextEncoder().encode(decodeURIComponent(m[2])).length;
  } catch {
    return undefined;
  }
}

/** Pages: a PDF's own page objects; an image is one page; anything else is unknown (shown without). */
function pageCountOf(type: FileType, dataUrl: string | undefined): number | undefined {
  if (type === 'PNG' || type === 'JPG' || type === 'IMG') return 1;
  if (type !== 'PDF' || !dataUrl) return undefined;
  const m = /;base64,(.*)$/s.exec(dataUrl);
  if (!m) return undefined;
  try {
    const n = (atob(m[1]).match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;
    return n > 0 ? n : undefined;
  } catch {
    return undefined;
  }
}

/** "1.2 MB · 1 page", from what is known of the file: size, then pages. */
function factsOf(sizeBytes: number | undefined, pages: number | undefined): string {
  return [sizeBytes !== undefined ? formatSize(sizeBytes) : undefined, pages !== undefined ? `${pages} page${pages === 1 ? '' : 's'}` : undefined].filter(Boolean).join(' · ');
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
const GROUP_ICON: Record<string, string> = {
  'Customer Verification': 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4',
  'Special Discounts': 'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z M7 7h.01',
  'CAF & Signature': 'M3 18c2-6 3.5-11 5.5-11S9 15 11 15s2-5 4-5 1.5 5 3 5 2.5-2 3-3',
};
const DOC = 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6';
const EYE = 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z';
const DOWNLOAD = 'M12 4v11 M7 10l5 5 5-5 M4 20h16';

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

function downloadDocument(dataUrl: string, name: string): void {
  const url = blobUrlOf(dataUrl);
  if (!url) return;
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const fileNameOf = (d: JourneyDocument): string => d.fileName ?? `${d.label.replace(/[^\w]+/g, '-').toLowerCase()}.${/^data:image\/png/.test(d.dataUrl ?? '') ? 'png' : /^data:image\/jpe?g/.test(d.dataUrl ?? '') ? 'jpg' : /^data:application\/pdf/.test(d.dataUrl ?? '') ? 'pdf' : 'svg'}`;

// Additional Documents: the end of the journey, after the CAF is signed. It holds (1) what this order requires the agent to attach, decided by
// its scenario and the role - asked for here and nowhere earlier; (2) every document the journey holds, consolidated, each one viewable and
// downloadable; and (3) anything else the agent wants to attach, labelled by type. No signature is needed for any of it.
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
  // A type picked with no file yet is an unfinished upload: the caller blocks Continue until it is uploaded.
  useEffect(() => {
    onPendingChange?.(Boolean(label.trim()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label]);
  useEffect(() => () => onPendingChange?.(false), []);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const requiredFileRef = useRef<HTMLInputElement>(null);
  const [uploadingFor, setUploadingFor] = useState<string | undefined>();
  const atLimit = documents.length >= maxDocuments;

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

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const trimmed = label.trim();
    if (!trimmed) {
      setError(labelOptions ? 'Select a document type before uploading.' : 'Enter a label for this document before uploading.');
      return;
    }
    if (await add(file, { label: trimmed })) {
      setLabel('');
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
        <p className="text-muted text-[length:var(--fs-caption)]">
          {requirements.length > 0 ? 'The documents this order needs are asked for here. ' : 'Optional - '}
          Label and attach anything else this order needs. No signature required. Up to {maxDocuments} files, {RULES.maxLabel} each.
        </p>
      </div>

      {sections.map((g) => (
        <section key={g.key} aria-label={`${g.title} documents`} className="card overflow-hidden">
          <header className="flex items-center gap-3 border-b border-border-soft px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-button)] border border-[var(--danger-border)] bg-tone-accent text-accent">
              <Icon path={GROUP_ICON[g.name] ?? DOC} className="w-4 h-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-fg font-semibold text-[length:var(--fs-body)]">{g.title}</span>
              <span className="block text-muted text-[length:var(--fs-caption)]">{groupNote(g.name, g.how)}</span>
            </span>
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-[var(--radius-button)] bg-surface px-2 text-fg font-medium text-[length:var(--fs-caption)]">{g.items.length}</span>
          </header>
          <div className="px-4 py-4">
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {g.items.map((d) => {
                    const held = d.dataUrl ?? (d.fileId ? documentFileOf(d.fileId)?.dataUrl : undefined);
                    // A capture the reader kept no image of (the demo scanner) opens as a labelled specimen, never as someone's document.
                    const dataUrl = held ?? (d.source.endsWith('Scanned') ? scanSpecimen(d.label) : undefined);
                    const name = d.fileName ?? fileNameOf(d);
                    return (
                      <li key={d.id} className="flex items-center gap-3 rounded-[var(--radius-card)] border border-border-soft bg-surface px-3 py-3">
                        <FileTypeIcon type={fileTypeOf(d.fileName, dataUrl)} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-fg font-semibold text-[length:var(--fs-body)] truncate">{g.items.length > 1 || g.kind !== d.label ? sideOf(d.label) : d.label}</span>
                          <span className="block text-muted text-[length:var(--fs-caption)] truncate">{name}</span>
                          <span className="block text-muted text-[length:var(--fs-caption)] truncate">{factsOf(d.sizeBytes ?? byteSizeOf(dataUrl), pageCountOf(fileTypeOf(d.fileName, dataUrl), dataUrl))}</span>
                        </span>
                        <Tooltip content={dataUrl ? 'View' : 'No copy of this document is held'} placement="bottom">
                          <IconButton bordered icon={EYE} label={`View ${d.label}`} className="rounded-[var(--radius-pill)] border-border-soft! text-fg-2! enabled:hover:bg-surface" disabled={!dataUrl} onClick={() => dataUrl && openDocument(dataUrl)} />
                        </Tooltip>
                        <Tooltip content={dataUrl ? 'Download' : 'No copy of this document is held'} placement="bottom">
                          <IconButton bordered icon={DOWNLOAD} label={`Download ${d.label}`} className="rounded-[var(--radius-pill)] border-border-soft! text-fg-2! enabled:hover:bg-surface" disabled={!dataUrl} onClick={() => dataUrl && downloadDocument(dataUrl, name)} />
                        </Tooltip>
                        {d.removable && d.fileId && <IconButton tone="danger" icon={TRASH} label={`Remove ${d.fileName ?? d.label}`} onClick={() => remove(d.fileId!)} />}
                      </li>
                    );
                  })}
                </ul>
          </div>
        </section>
      ))}

      {missing.length > 0 && (
        <section aria-label="Required documents" className="space-y-3">
          <input ref={requiredFileRef} type="file" accept={RULES.accept} className="sr-only" aria-hidden tabIndex={-1} onChange={(e) => void handleRequiredFile(e.target.files?.[0])} />
          <p role="status" className="text-[var(--warn-text)] text-[length:var(--fs-caption)]">
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
          <input ref={fileRef} type="file" accept={RULES.accept} className="sr-only" onChange={(e) => void handleFile(e.target.files?.[0])} />
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
