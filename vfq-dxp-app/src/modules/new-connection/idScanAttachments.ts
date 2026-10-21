import { idTypeLabel, type IdType } from '../../data/idTypes';

/** The two sides of the document the scanner reports on (every ID type is captured front and back). */
export interface IdScanState {
  frontScanned?: boolean;
  backScanned?: boolean;
  /** 'upload' when the files were uploaded in place of the reader. */
  source?: 'scan' | 'upload';
  /** Upload: the file each side came from. */
  frontFile?: string;
  backFile?: string;
}

/**
 * The order attachments for the identity document scanned at Contact, named for the ID type actually presented
 * ("Passport - Front", "GCC ID - Back" ...), one per side that was scanned. A side that was not scanned (manual entry,
 * or the scan never completed) gets no row, so an order never claims a document it does not hold.
 */
export function idScanAttachments(idType: IdType | undefined, scans: IdScanState | undefined): { label: string; detail: string }[] {
  const name = idTypeLabel(idType ?? 'QID');
  const detail = (file: string | undefined) => (scans?.source === 'upload' ? `Uploaded during Contact${file ? `: ${file}` : ''}` : 'Scanned during Contact');
  return [
    ...(scans?.frontScanned ? [{ label: `${name} - Front`, detail: detail(scans.frontFile) }] : []),
    ...(scans?.backScanned ? [{ label: `${name} - Back`, detail: detail(scans.backFile) }] : []),
  ];
}
