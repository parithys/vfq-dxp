import { useEffect, useRef, useState } from 'react';
import { QidInput } from '../domain/QidInput';
import { QidImageUpload } from '../domain/QidImageUpload';
import type { QidImageUploadValue } from '../domain/QidImageUpload';
import type { QidType } from '../domain/QidInput';
import { Badge } from '../primitives/Badge';
import { Button } from '../primitives/Button';
import * as mockDataEngine from '../../engines/mockDataEngine';
import { useEnterToSubmit } from '../../hooks/useEnterToSubmit';

interface MoiResult {
  name: string;
  dob: string;
  nationality: string;
  email?: string;
  // Added 2026-09-24 so Gender can be registry-sourced. It has to be: the
  // identity fields are non-editable, and a mandatory field with no source
  // and no way to type into it would block Continue forever. customers.json
  // has carried `gender` all along; only MoiResult was not passing it on.
  gender?: string;
}

// Four, per the reference asset's "Scan Attempts: 0 / 4".
const MAX_SCAN_ATTEMPTS = 4;

type IdLookupValue = { idType?: QidType; idNumber?: string; moiResult?: MoiResult; qidScans?: QidImageUploadValue };

interface IdLookupStepProps {
  value?: IdLookupValue;
  onChange: (value: IdLookupValue) => void;
  /**
   * Render the Name/DOB/Nationality read-out inside the MOI panel. Default
   * true, which is what the six other journeys using this step rely on.
   *
   * GuidedContactStep passes false: as of 2026-09-24 it renders those three
   * as editable, prefilled fields of its own, so showing them read-only here
   * as well would put the same data on screen twice with only one copy
   * editable. The "MOI Validated" badge still renders either way - the fetch
   * succeeding is a separate fact from where the data is displayed.
   */
  showMoiDetails?: boolean;
}

// Pattern 2: Customer/Contact Lookup Step (QID/Kahramaa ID Scan + MOI Validation) -
// the ID Type selector, number field, and Fetch action stay on screen at all
// times; the MOI result renders directly beneath them once resolved, rather
// than replacing the input entirely. Editing the number after a result exists
// clears that result immediately - a fetched result stays pinned to the exact
// value it came from, never left showing stale demographic data for a field
// the agent has since changed. Switching ID Type clears the result AND the
// number, since a number entered under one scheme is never valid under
// another. The returned
// name/DOB/nationality are still read-only display per the Retail Sales Agent
// restriction carried over from the 66-persona model's PERSONA-001 ("cannot
// manually enter ID details, only re-scan/search") - only the lookup ID
// number itself is directly editable.
export function IdLookupStep({ value = {}, onChange, showMoiDetails = true }: IdLookupStepProps) {
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const numberInputRef = useRef<HTMLInputElement>(null);
  const idType = value.idType ?? 'QID';

  const handleIdTypeChange = (nextType: QidType) => {
    // Re-clicking the type you are already on is a no-op, not a reset. These
    // are plain buttons rather than radios, so without this a stray second
    // click on the selected chip would wipe a number the agent had just typed.
    if (nextType === idType) return;
    setNotFound(false);
    // Clear the NUMBER, not just the MOI result. The two ID schemes have
    // nothing in common, so a number carried across a type switch is always
    // wrong for the field it now sits in - the reported case was a QID,
    // 28456701234, left sitting under a "Diplomatic ID Number" label whose
    // own placeholder reads "e.g. DIP-QA-004521". Fetch would then either miss
    // or, worse, resolve the OLD document and show demographics that have
    // nothing to do with the selected type.
    //
    // `email` needs no clearing here: GuidedContactStep re-derives it from
    // moiResult on every change. `altPhone` is deliberately kept - switching
    // type normally means the same walk-in presenting a different document,
    // and discarding a contact number the agent typed would be the bigger
    // loss.
    // qidScans clears with the rest: a scan belongs to the document that was
    // in the reader, so retaining it across a type switch would let a QID
    // scan satisfy a Passport journey.
    onChange({ ...value, idType: nextType, idNumber: '', moiResult: undefined, qidScans: undefined });
    // Attempts belong to the document that was being scanned, so a new type
    // starts from zero. Without this, switching away from an exhausted QID and
    // back would leave manual entry already unlocked for a fresh card.
    setScanFailures(0);
    // The number field is now the outstanding one and typing it is the
    // unambiguous next action, so move the cursor there rather than leaving it
    // on the chip the agent just clicked.
    //
    // Synchronous, NOT wrapped in requestAnimationFrame. The input node
    // already exists and React reuses it across this re-render, so there is
    // nothing to wait for - and rAF never fires while the document is hidden,
    // so an agent returning to a backgrounded tab would have found the field
    // cleared but the cursor still on the chip.
    numberInputRef.current?.focus();
  };

  const runMoiValidation = async () => {
    if (!value.idNumber) return;
    setLoading(true);
    setNotFound(false);
    const identityDocs = await mockDataEngine.list<{ documentNumber: string; customerId: string }>('identity-documents');
    const match = identityDocs.find((d) => d.documentNumber === value.idNumber);
    if (!match) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const customers = await mockDataEngine.list<{ customerId: string; name: string; dob: string; nationality: string; email?: string; gender?: string }>(
      'customers'
    );
    const customer = customers.find((c) => c.customerId === match.customerId);
    setLoading(false);
    if (customer) {
      onChange({
        ...value,
        moiResult: {
          name: customer.name,
          dob: customer.dob,
          nationality: customer.nationality,
          email: customer.email,
          gender: customer.gender,
        },
      });
    }
  };

  // Completing both scans IS the fetch trigger for a QID - the agent doesn't
  // press Fetch separately. The button stays on screen as a retry: an
  // auto-fetch that finds no record, or a corrected number after one, still
  // needs a way to run again without re-scanning the document.
  //
  // Guarded by a ref keyed on the number that was fetched, not by a boolean,
  // because the effect re-runs on every keystroke in the number field. Without
  // the key, correcting a digit after a failed auto-fetch would never retry;
  // with a plain boolean it would fire on every render while both scans stayed
  // complete. `notFound` is deliberately NOT a dependency - re-running on it
  // would loop a failing lookup forever.
  const autoFetchedNumber = useRef<string | null>(null);
  const bothSidesScanned = Boolean(value.qidScans?.frontScanned && value.qidScans?.backScanned);

  // Failed scan attempts, capped at MAX_SCAN_ATTEMPTS. Reaching the cap is
  // what unlocks manual number entry - the reference asset's "Manual Fallback
  // Entry", gated behind its "Scan Attempts: n / 4" counter.
  //
  // Local state, not draft state: an attempt count describes this sitting at
  // the counter, not the order. Re-entering the step should offer the scanner
  // again rather than resuming someone else's exhausted attempts.
  const [scanFailures, setScanFailures] = useState(0);
  const manualEntryUnlocked = idType !== 'QID' || scanFailures >= MAX_SCAN_ATTEMPTS;

  // Simulated OCR. A real scanner reads the number off the card, which is the
  // only reason the number field can be locked at all - with no scanner and no
  // typing, nothing could ever be looked up.
  //
  // It resolves against the seeded identity documents rather than inventing a
  // literal, so it stays correct if the seed changes. DEMO LIMITATION, stated
  // plainly: it takes the first QID-type document, so every successful scan
  // resolves to the same customer. A real integration would return whatever
  // card is physically in the reader.
  const readNumberFromScan = async (): Promise<string | undefined> => {
    const docs = await mockDataEngine.list<{ documentType: string; documentNumber: string }>('identity-documents');
    return docs.find((d) => d.documentType === 'QID')?.documentNumber;
  };

  useEffect(() => {
    if (idType !== 'QID' || !bothSidesScanned) {
      // Reset so re-scanning after a type switch or a cleared scan fetches again.
      autoFetchedNumber.current = null;
      return;
    }
    const number = value.idNumber?.trim();
    // Nothing typed (the field may well be locked), so the scan supplies it.
    // Setting idNumber re-runs this effect, which then fetches.
    if (!number) {
      if (value.moiResult || loading) return;
      void readNumberFromScan().then((scanned) => {
        if (scanned) onChange({ ...value, idNumber: scanned });
      });
      return;
    }
    if (value.moiResult || loading) return;
    if (autoFetchedNumber.current === number) return;
    autoFetchedNumber.current = number;
    void runMoiValidation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idType, bothSidesScanned, value.idNumber, value.moiResult, loading]);

  const handleKeyDown = useEnterToSubmit(Boolean(value.idNumber) && !loading, runMoiValidation);

  return (
    <div className="space-y-4" onKeyDown={handleKeyDown}>
      <QidInput
        idType={idType}
        onIdTypeChange={handleIdTypeChange}
        inputRef={numberInputRef}
        value={value.idNumber ?? ''}
        onChange={(idNumber) => {
          setNotFound(false);
          onChange({ ...value, idNumber, moiResult: undefined });
        }}
        onFetch={runMoiValidation}
        fetching={loading}
        error={notFound ? 'No MOI record found for this ID - try again.' : undefined}
        numberEntryLocked={!manualEntryUnlocked}
        numberEntryHint={
          manualEntryUnlocked
            ? idType === 'QID' && scanFailures >= MAX_SCAN_ATTEMPTS
              ? `Manual entry unlocked after ${MAX_SCAN_ATTEMPTS} failed scan attempts.`
              : undefined
            : `Scan the document below to read this automatically. Manual entry unlocks after ${MAX_SCAN_ATTEMPTS} failed attempts.`
        }
      />

      {/* Front/back capture, shown only for a Qatar ID. The other three
          document types are single-sided in this corpus (a passport is
          scanned at its photo page, GCC/Diplomatic IDs have no evidenced
          reverse capture), so offering two sides for them would invent a
          step. Reuses the same QidImageUpload the Passport-to-QID and SIM
          Swap journeys already gate on, rather than a second scanner with
          its own shape. */}
      {idType === 'QID' && (
        <div className="space-y-2">
          <p className="text-[length:var(--fs-label)] text-fg-2">Scan Qatar ID</p>
          <QidImageUpload
            value={value.qidScans ?? {}}
            onChange={(qidScans) => onChange({ ...value, qidScans })}
          />
          {/* Attempt counter and a way to fail a scan, both from the reference
              asset ("Scan Attempts: 0 / 4", "Simulate Scan Failure (0/4)").
              A simulated scanner cannot fail on its own, so without an
              explicit control the fallback would be unreachable and the
              locked field would be a dead end. */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <span className="text-[length:var(--fs-caption)] text-muted">
              Scan attempts: {scanFailures} / {MAX_SCAN_ATTEMPTS}
            </span>
            {scanFailures < MAX_SCAN_ATTEMPTS && (
              <Button
                variant="ghost-rect"
                compact
                onClick={() => {
                  // A failed read clears whatever was captured, so the agent
                  // re-presents the document rather than retrying against a
                  // half-scanned one.
                  setScanFailures((n) => n + 1);
                  onChange({ ...value, qidScans: undefined });
                }}
              >
                Simulate scan failure
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Two shapes, chosen by showMoiDetails.
          - false (GuidedContactStep): the badge alone. The bordered green
            container and its "Registry details prefilled..." line were
            removed on 2026-09-24 - with the identity fields directly below
            read-only and obviously registry-sourced, the panel was restating
            what the fields already show.
          - true (the six other journeys): the original bordered panel with
            the Name/DOB/Nationality read-out, which is the ONLY place those
            journeys display it. Collapsing both branches to a bare badge
            would silently strip identity data from Passport-to-QID, SIM Swap,
            Pre-to-Post and the rest. */}
      {value.moiResult &&
        (showMoiDetails ? (
          <div className="pt-2 border-t border-border-soft">
            <div className="rounded-[var(--radius-card)] border border-success/30 bg-[color-mix(in_oklab,var(--success),var(--bg)_92%)] p-4 space-y-3">
              <Badge variant="success">MOI validated successfully</Badge>
              <div className="grid grid-cols-3 gap-4 text-[length:var(--fs-body)]">
                <div>
                  <div className="text-[length:var(--fs-caption)] text-muted">Name</div>
                  <div className="text-fg font-semibold text-[length:var(--fs-body-lg)]">{value.moiResult.name}</div>
                </div>
                <div>
                  <div className="text-[length:var(--fs-caption)] text-muted">Date of Birth</div>
                  <div className="text-fg font-semibold text-[length:var(--fs-body-lg)]">{value.moiResult.dob}</div>
                </div>
                <div>
                  <div className="text-[length:var(--fs-caption)] text-muted">Nationality</div>
                  <div className="text-fg font-semibold text-[length:var(--fs-body-lg)]">
                    {value.moiResult.nationality}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <Badge variant="success">MOI validated successfully</Badge>
        ))}
    </div>
  );
}
