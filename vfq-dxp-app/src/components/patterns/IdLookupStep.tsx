import { useEffect, useRef, useState } from 'react';
import { QidNumberField, QidTypeSelector, idTypeLabel } from '../domain/QidInput';
import { QidImageUpload } from '../domain/QidImageUpload';
import type { QidImageUploadValue } from '../domain/QidImageUpload';
import type { QidType } from '../domain/QidInput';
import { Badge } from '../primitives/Badge';
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
  // The sponsoring employer, when the registry has one on file. Added
  // 2026-09-26 so B2B2C can be DERIVED rather than ticked: the Contact step's
  // "B2B2C Order" checkbox was removed, and this is what replaces it.
  //
  // Strictly this is not MOI data - an employment relationship is not held by
  // the interior ministry - but it travels with the customer record the lookup
  // resolves, and inventing a second round trip to a system this app has no
  // evidence of would be pretending to know more about the integration than
  // the corpus says. Named companyName to match the field it comes from.
  companyName?: string;
  /**
   * The employer's row in `enterprise-accounts`, resolved here rather than by
   * the Contact step.
   *
   * Resolved at the same point the customer is, because this is where the data
   * layer already is - GuidedContactStep is a pure presentational component
   * with no state, no effects and no dataset reads, and giving it one just to
   * turn a name into an id would change its character for no gain. Carrying
   * the id matters because a NAME is not a link: two Lulu branches share a CR
   * prefix and differ only by suffix, so downstream needs the id to know which
   * account sponsors the line.
   */
  companyAccountId?: string;
}

// TWO, per 2026-09-28 direction ("Allow a maximum of two scanning attempts").
// Was four, from the reference asset's "Scan Attempts: 0 / 4".
//
// Both attempts pass over the reader; after the second the scanner locks and
// the manual fallback opens. Nothing in the UI names this number or shows a
// count - see the scanner block below.
const MAX_SCAN_ATTEMPTS = 2;
// The original budget, still used by the eight journeys that lead with a type
// selector rather than auto-detection.
const LEGACY_MAX_SCAN_ATTEMPTS = 4;

/**
 * ID types with a physical card the reader can capture, and therefore the
 * scan-first workflow: both faces in one operation, the number read off the
 * document, a four-attempt budget and a manual fallback behind it.
 *
 * Diplomatic ID joined QID on 2026-09-25 - a postpaid connection may be sold
 * directly against either, so both get the same process rather than QID
 * getting a scanner and its equal being typed in by hand.
 *
 * Passport and GCC ID are deliberately absent. A passport is a booklet
 * scanned at its photo page and GCC/Diplomatic reverse capture is not
 * evidenced for them, so offering a two-face card capture would invent a step.
 */
const SCANNABLE_ID_TYPES = new Set<QidType>(['QID', 'Diplomatic ID']);

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
  /**
   * Which ID types this journey offers. Defaults to all four; New Postpaid
   * narrows it to QID and Diplomatic ID. See QidTypeSelector.allowedTypes.
   */
  allowedIdTypes?: QidType[];
  /** Shown greyed and unselectable, with `unavailableIdTypesHint` beneath. */
  unavailableIdTypes?: QidType[];
  unavailableIdTypesHint?: string;
  /**
   * Scan-first with AUTOMATIC document-type detection (2026-09-28 direction).
   *
   * OPT-IN, and off by default on purpose. Only New Postpaid passes it. The
   * other eight journeys sharing this step offer all four ID types and never
   * narrow them, so hiding their selector behind a spent scan budget would
   * leave an agent who needs Passport or GCC ID unable to reach it without
   * first failing two scans they never wanted to run.
   *
   * When on:
   *   - the type selector is hidden until the fallback opens
   *   - the scan identifies the document rather than trusting a prior choice
   *   - the attempt budget is two rather than four
   */
  autoDetectIdType?: boolean;
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
export function IdLookupStep({ value = {}, onChange, showMoiDetails = true, allowedIdTypes, unavailableIdTypes, unavailableIdTypesHint, autoDetectIdType = false }: IdLookupStepProps) {
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const numberInputRef = useRef<HTMLInputElement>(null);
  // The current value, readable from an async continuation that was started
  // under an older one.
  //
  // Both lookups below are two-hop mock calls taking up to 600ms each, and
  // they spread `{ ...value }` when they land. Spreading the value they
  // CLOSED OVER writes back every field as it was when the call started - so
  // a Retake pressed while a lookup was in flight had the late result restore
  // the very scan flags the Retake had cleared, putting a read-only number
  // field with the previous document's number on screen underneath a card
  // that was visibly still reading. Reachable in one press since Retake
  // started driving the reader directly; before that the agent had to clear
  // and re-initiate, which took longer than the calls did.
  const latest = useRef(value);
  latest.current = value;
  const idType = value.idType ?? 'QID';
  /**
   * DEMO ONLY (2026-09-28, explicitly requested as such).
   *
   * Which card the demo links below the scanner say was put in the reader.
   * Null in the real flow, where the reader identifies the document itself.
   *
   * It exists because the four links must be able to produce a Passport or a
   * GCC ID - neither of which is in SCANNABLE_ID_TYPES, so without this the
   * scanner would unmount mid-demo and the "scanned" document would never be
   * shown. Kept OUT of the draft value: this is a property of the person
   * demonstrating the app, not of the order.
   */
  const [demoType, setDemoType] = useState<QidType | null>(null);
  const scannable = SCANNABLE_ID_TYPES.has(idType);
  // Everything that asks "is there a reader on this screen" must accept a demo
  // scan too, or the capture disappears the moment a non-scannable type wins.
  const effectiveScannable = scannable || demoType !== null;

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
    setScanAttempts(0);
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
    const requested = value.idNumber;
    setLoading(true);
    setNotFound(false);
    const identityDocs = await mockDataEngine.list<{ documentNumber: string; customerId: string }>('identity-documents');
    const match = identityDocs.find((d) => d.documentNumber === value.idNumber);
    if (!match) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const customers = await mockDataEngine.list<{ customerId: string; name: string; dob: string; nationality: string; email?: string; gender?: string; companyName?: string }>(
      'customers'
    );
    const customer = customers.find((c) => c.customerId === match.customerId);
    setLoading(false);
    // Superseded while in flight - the agent retook the scan, switched ID
    // type, or edited the number. Applying this now would attach one
    // document's demographics to another's number.
    if (latest.current.idNumber !== requested) return;
    if (customer) {
      // Only for a customer who has an employer, so an ordinary consumer sale
      // costs no extra dataset read.
      let companyAccountId: string | undefined;
      if (customer.companyName) {
        const accounts = await mockDataEngine.list<{ enterpriseAccountId: string; name: string }>(
          'enterprise-accounts'
        );
        companyAccountId = accounts.find((a) => a.name === customer.companyName)?.enterpriseAccountId;
        // Left undefined when the employer is not in the registry, rather than
        // faked. The order still carries the name and still routes for
        // approval; the approver is the one who can see that the sponsoring
        // account does not exist yet, which is exactly the kind of thing they
        // are there to catch.
      }
      onChange({
        ...latest.current,
        moiResult: {
          name: customer.name,
          dob: customer.dob,
          nationality: customer.nationality,
          email: customer.email,
          gender: customer.gender,
          companyName: customer.companyName,
          companyAccountId,
        },
      });
    }
  };

  // A completed scan IS the fetch trigger for a QID - the agent doesn't press
  // Fetch separately, and as of 2026-09-25 there is no Fetch button to press
  // in this state at all. If the auto-fetch finds no record, the recourse is
  // Retake scan, which is the right action anyway: a number the registry does
  // not recognise means the read was wrong or the document is not in MOI, and
  // neither is fixed by pressing the same lookup again on the same digits.
  // Once the scan budget is spent the field turns editable and Fetch returns
  // with it, so a bad read is never a dead end.
  //
  // Guarded by a ref keyed on the number that was fetched, not by a boolean,
  // because the effect re-runs on every keystroke in the number field. Without
  // the key, correcting a digit after a failed auto-fetch would never retry;
  // with a plain boolean it would fire on every render while the scan stayed
  // complete. `notFound` is deliberately NOT a dependency - re-running on it
  // would loop a failing lookup forever.
  const autoFetchedNumber = useRef<string | null>(null);
  // Both flags, even though one operation now sets them together: this is the
  // contract QidImageUpload's other three consumers also read, and checking
  // only one would quietly accept a half-written value.
  const scanComplete = Boolean(value.qidScans?.frontScanned && value.qidScans?.backScanned);

  // Scan attempts. Charged once per PASS OVER THE READER, which as of
  // 2026-09-26 includes a Retake: pressing it rescans there and then, so it is
  // a physical read and is counted like one. It was not counted while Retake
  // merely cleared the card and waited for a second press on Initiate, since
  // back then the gesture never touched the reader.
  //
  // The budget arithmetic is unchanged by that: the first scan on arrival is
  // attempt 1 and the three retakes after it are 2, 3 and 4, so three retakes
  // succeed - labelled (1), (2) and (3) on the button - and a fourth is the
  // fifth attempt, which fails and opens manual entry.
  //
  // Going past the budget is what unlocks manual number entry - the reference
  // asset's "Manual Fallback Entry". The exhausting attempt FAILS rather than
  // being blocked: a disabled scan button with a fallback appearing beside it
  // would tell the agent the app had decided to stop trying, where a failed
  // read tells them the document is the problem. It also means the simulated
  // reader is the thing that opens the fallback, which is how a real one
  // would.
  //
  // Local state, not draft state: an attempt count describes this sitting at
  // the counter, not the order. Re-entering the step should offer the scanner
  // again rather than resuming someone else's exhausted attempts.
  const [scanAttempts, setScanAttempts] = useState(0);
  /**
   * LATCHED, and deliberately separate from the attempt count.
   *
   * handleIdTypeChange resets scanAttempts to zero - correct, because a new
   * document deserves fresh attempts. But the fallback's whole purpose is to
   * let the agent pick a type by hand, so deriving its visibility from the
   * count meant the selector vanished the instant it was used. This latches
   * once the budget is spent and stays open for the rest of the sitting.
   */
  const [fallbackUnlocked, setFallbackUnlocked] = useState(false);
  // Two for the scan-first flow, four for the journeys that still lead with a
  // type selector - see autoDetectIdType.
  const maxScanAttempts = autoDetectIdType ? MAX_SCAN_ATTEMPTS : LEGACY_MAX_SCAN_ATTEMPTS;
  const manualEntryUnlocked = !effectiveScannable || fallbackUnlocked;

  /**
   * DEMO ONLY. Says which card was "inserted", then lets the normal scan run:
   * the reader animates, detection resolves that document, and the number and
   * type land exactly as they would from a real pass. Deliberately routed
   * through the same path rather than writing the result directly, so what the
   * demo shows is the real flow and not a parallel one.
   */
  const handleDemoScan = (type: QidType) => {
    setDemoType(type);
    setNotFound(false);
    // Clear any previous read so the new card resolves from scratch - without
    // this the effect sees an idNumber already present and never re-fetches.
    onChange({ ...latest.current, idType: type, idNumber: '', moiResult: undefined, qidScans: undefined });
  };

  // Returns whether this attempt read the card. QidImageUpload leaves its
  // value untouched on false, so a failed attempt keeps the insert prompt up.
  const handleScanAttempt = () => {
    const attempt = scanAttempts + 1;
    setScanAttempts(attempt);
    // The fallback is NOT opened merely because the budget is spent. A second
    // attempt that reads the card successfully must leave the agent on the
    // scanned path - manual entry is a fallback, never an alternative to a
    // successful scan. It opens in exactly two places:
    //   - here, when a pass is refused because the budget is gone
    //   - in the scan effect, when a completed pass identifies no document
    //     and no attempts remain
    if (attempt > maxScanAttempts) {
      setFallbackUnlocked(true);
      return false;
    }
    return true;
  };

  // Simulated OCR. A real scanner reads the number off the card, which is the
  // only reason the number field can be locked at all - with no scanner and no
  // typing, nothing could ever be looked up.
  //
  // It resolves against the seeded identity documents rather than inventing a
  // literal, so it stays correct if the seed changes. DEMO LIMITATION, stated
  // plainly: it takes the first QID-type document, so every successful scan
  // resolves to the same customer. A real integration would return whatever
  // card is physically in the reader.
  const readDocumentFromScan = async (): Promise<{ documentType: QidType; documentNumber: string } | undefined> => {
    const docs = await mockDataEngine.list<{ documentType: string; documentNumber: string; expiryDate?: string }>(
      'identity-documents'
    );
    // AUTOMATIC DETECTION (2026-09-28). The reader identifies what was put in
    // it, so this no longer filters by a type the agent picked beforehand -
    // there is no such selection during the normal flow any more. It considers
    // every type this journey accepts AND can physically capture, and returns
    // the type along with the number so the caller can record what was found.
    // Auto-detect considers every type this journey accepts AND can capture.
    // Without it, the original behaviour stands: resolve a document of the
    // type the agent already selected, so a Diplomatic scan does not fall back
    // to the first QID on file.
    const detectable = demoType
      ? // A demo link names the card, so the "detection" resolves that one.
        [demoType]
      : autoDetectIdType
        ? (allowedIdTypes ?? [...SCANNABLE_ID_TYPES]).filter((t) => SCANNABLE_ID_TYPES.has(t))
        : [idType];
    const candidates = docs.filter((d) => detectable.includes(d.documentType as QidType));
    // Prefers an UNEXPIRED document rather than simply the first match.
    //
    // Not cosmetic: two Diplomatic IDs are seeded and the first in file order
    // is deliberately expired (CUST-1006, the hard-stop fixture), so
    // first-match made that scan resolve to an expired card and the
    // direct-sale path could never be exercised. Depending on array order to
    // fix that would be worse - a reorder of the JSON would silently break it.
    //
    // The expired document is still reachable: it is the one the manual
    // fallback accepts once the scan budget is spent.
    const now = Date.now();
    const found =
      candidates.find((d) => !d.expiryDate || new Date(d.expiryDate).getTime() >= now) ?? candidates[0];
    if (!found) return undefined;
    return { documentType: found.documentType as QidType, documentNumber: found.documentNumber };
  };

  useEffect(() => {
    if (!effectiveScannable || !scanComplete) {
      // Reset so re-scanning after a type switch or a cleared scan fetches again.
      autoFetchedNumber.current = null;
      return;
    }
    const number = value.idNumber?.trim();
    // Nothing typed (the field may well be locked), so the scan supplies it.
    // Setting idNumber re-runs this effect, which then fetches.
    if (!number) {
      if (value.moiResult || loading) return;
      void readDocumentFromScan().then((scanned) => {
        const now = latest.current;
        // The scan this number was read off must still be the one on screen,
        // and nothing must have supplied a number meanwhile.
        const stillComplete = Boolean(now.qidScans?.frontScanned && now.qidScans?.backScanned);
        if (!scanned) {
          // The reader captured something it could not identify. That is an
          // unsuccessful attempt; once none remain, hand over to manual entry.
          if (scanAttempts >= maxScanAttempts) setFallbackUnlocked(true);
          return;
        }
        if (!stillComplete || now.idNumber) return;
        // Records the DETECTED type alongside the number, so everything
        // downstream - the field label, the MOI lookup, the eligibility ID-type
        // check - keys off what was actually in the reader rather than off the
        // 'QID' default this step starts on.
        onChange({ ...now, idType: scanned.documentType, idNumber: scanned.documentNumber });
      });
      return;
    }
    if (value.moiResult || loading) return;
    if (autoFetchedNumber.current === number) return;
    autoFetchedNumber.current = number;
    void runMoiValidation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idType, effectiveScannable, scanComplete, value.idNumber, value.moiResult, loading]);

  const handleKeyDown = useEnterToSubmit(Boolean(value.idNumber) && !loading, runMoiValidation);

  // Built once and placed by ID type below. Only the showMoiDetails={false}
  // shape gets a loose badge at all - the other journeys keep theirs inside
  // the bordered panel it heads, where it introduces the identity read-out.
  const moiBadge =
    !showMoiDetails && value.moiResult ? <Badge variant="success-solid">MOI validated successfully</Badge> : undefined;

  return (
    <div className="space-y-4" onKeyDown={handleKeyDown}>
      {/* FALLBACK ONLY as of 2026-09-28. Automatic detection is the primary
          path: the reader identifies the document, so asking the agent to
          classify it first was asking a question the scanner answers. The
          selector is therefore hidden during the normal flow and appears only
          once the scan budget is spent (or for a journey whose types are not
          scannable at all, where there is nothing to detect).
          `manualEntryUnlocked` is latched - see fallbackUnlocked. */}
      {(!autoDetectIdType || manualEntryUnlocked) && (
        <QidTypeSelector
          idType={idType}
          onIdTypeChange={handleIdTypeChange}
          allowedTypes={allowedIdTypes}
          unavailableTypes={unavailableIdTypes}
          unavailableHint={unavailableIdTypesHint}
        />
      )}

      {/* The scanner, shown only for a Qatar ID. The other three document
          types are single-sided in this corpus (a passport is scanned at its
          photo page, GCC/Diplomatic IDs have no evidenced reverse capture),
          so offering a two-face capture for them would invent a step. Reuses
          the same QidImageUpload the Passport-to-QID and SIM Swap journeys
          already gate on, rather than a second scanner with its own shape.

          NOTHING HERE EXPOSES THE SIMULATION. The counter ("Scan attempts:
          n / 4") and the "Simulate scan failure" button that used to sit
          under this card are both gone as of 2026-09-25. They were debug
          affordances: the counter published the exact budget the agent was
          told not to be shown, and the button described the app to itself.
          The budget now shows up the only way it should - as a scan that
          fails - and the failure message says what the agent can do about it
          without mentioning attempts. */}
      {effectiveScannable && (
        <div className="space-y-2">
          {/* Neutral until the reader has identified the document. Naming a
              type here ("Scan Qatar ID (QID)") before anything has been read
              asserts the answer to the question the scan exists to answer -
              and would be simply wrong for the Diplomatic ID the same reader
              detects. Once a scan has resolved, it names what was found. */}
          <p className="text-[length:var(--fs-label)] text-fg-2">
            {value.idNumber ? `Scan ${idTypeLabel(idType)}` : 'Scan identity document'}
          </p>
          <QidImageUpload
            value={value.qidScans ?? {}}
            onChange={(qidScans) => {
              // A Retake DISCARDS the previous read - the number that was
              // extracted and the MOI result fetched from it. Without this the
              // screen contradicted itself: the scanner showed a rescan in
              // progress while "MOI validated successfully" and the prefilled
              // identity fields stayed on display, for a document the reader
              // was at that moment re-reading. (Before retakes drove the
              // reader, the same contradiction showed the insert prompt
              // instead of a spinner.)
              //
              // This fires on the clear QidImageUpload performs at the START
              // of a retake pass, which is also what keeps the auto-fetch
              // effect below from re-reading the number mid-pass: scanComplete
              // goes false, so it resets and waits for the new capture. GuidedContactStep clears its
              // six identity fields from a cleared moiResult on its own, and
              // the step's isValid gate goes back to failing, so Continue is
              // no longer available against a discarded read.
              const stillComplete = Boolean(qidScans.frontScanned && qidScans.backScanned);
              if (scanComplete && !stillComplete) {
                setNotFound(false);
                onChange({ ...value, qidScans, idNumber: '', moiResult: undefined });
                return;
              }
              onChange({ ...value, qidScans });
            }}
            // Names the document in the card's captions and picks its
            // artwork - the QID specimen must not stand in for a Diplomatic
            // ID.
            documentType={demoType ?? idType}
            onScan={handleScanAttempt}
            // DEMO ONLY - see QidImageUpload.demoTypes. All four are offered,
            // including the two this journey cannot sell against, because the
            // point is to show what each document looks like coming off the
            // reader.
            //
            // Scoped to the scan-first flow. The eight journeys that still lead
            // with a type selector would otherwise show two ways to pick a type
            // on one screen, one of them labelled "demo" - which reads as a
            // broken duplicate rather than as a demo aid.
            demoTypes={!autoDetectIdType ? undefined : (['QID', 'Passport', 'GCC ID', 'Diplomatic ID'] as QidType[]).map((t) => ({
              value: t,
              // idTypeLabel, not the raw union member, so the link reads
              // "Qatar ID" rather than "QID" while still carrying the type.
              label: idTypeLabel(t),
            }))}
            onDemoScan={(t) => handleDemoScan(t as QidType)}
            // Budget spent: the reader is done, so the card stops offering to
            // drive it and the error below becomes the only instruction.
            // Switching ID type resets the budget (handleIdTypeChange), which
            // is the one way back to scanning - a different document deserves
            // its own attempts.
            canScan={!fallbackUnlocked}
            // Wording per the 2026-09-27 walkthrough. It names the barcode as
            // well as manual entry because both are real fallbacks at the
            // counter, and says "after the permitted attempts" so the agent
            // knows the reader is out of tries rather than merely unlucky.
            error={
              fallbackUnlocked
                ? 'We could not read the document after the permitted attempts. Select the ID type and enter the number manually to continue.'
                : undefined
            }
          />
        </div>
      )}

      {/* The number field comes AFTER the scanner and only once there is a
          number to show. Scanning is the primary path, so leading with an
          empty, locked text box asked the agent to read past the thing they
          cannot use to reach the thing they can.

          Three states:
          - non-QID: no scanner exists for these documents, so the field is
            the only way in and is always editable, with Fetch.
          - QID, scan complete AND a number extracted: shown read-only, no
            Fetch - the scan already triggered the lookup.
          - QID, scan budget exhausted: the manual fallback opens, editable
            and empty, and Fetch returns with it. Nothing announces the
            threshold - see the note above.

          The `idNumber` half of the second condition matters: a completed
          scan and an extracted number are NOT simultaneous. Reading the
          number is its own mock call, so for up to 600ms after the capture
          there is a scan but no digits - and rendering then put an EMPTY
          read-only box on screen under the hint "Read from the scanned
          document.", which is a claim about a value that had not arrived.
          Waiting for the number means the field appears already populated.

          Before any of those, for a QID, it is not rendered at all. */}
      {(!effectiveScannable || (scanComplete && Boolean(value.idNumber)) || manualEntryUnlocked) && (
        <QidNumberField
          idType={idType}
          inputRef={numberInputRef}
          value={value.idNumber ?? ''}
          onChange={(idNumber: string) => {
            setNotFound(false);
            onChange({ ...value, idNumber, moiResult: undefined });
          }}
          onFetch={runMoiValidation}
          fetching={loading}
          error={notFound ? 'No MOI record found for this ID - try again.' : undefined}
          readOnly={effectiveScannable && scanComplete}
          // The scanned path has no Fetch button, so it also lost the
          // "Fetching…" label that button carried - and the MOI lookup this
          // step fires automatically takes two mock calls at 200-600ms each.
          // Without this line the number simply appears and the screen sits
          // still for up to a second before the MOI badge shows up, which
          // reads as nothing happening. The hint is the only thing left in
          // that state that can say otherwise.
          hint={
            effectiveScannable && scanComplete
              ? loading
                ? 'Checking the MOI registry…'
                : 'Read from the scanned document.'
              : undefined
          }
          // The MOI badge, right-aligned on this field's label row - the
          // "Qatar ID (QID) Number" line, or "Passport Number" and so on for
          // the other types.
          //
          // One placement for all four ID types, which is why there is no
          // per-type routing here any more. It briefly sat on the scanner
          // card's "Qatar ID" header instead, but that card only exists for a
          // QID, so the other three needed a second home and the badge had
          // two possible parents.
          //
          // Safe to live inside the field: moiResult cannot outlive it.
          // Setting it requires an idNumber, and everything that hides the
          // field again - Retake, an ID Type switch - clears moiResult in the
          // same update.
          status={moiBadge}
        />
      )}

      {/* Only the showMoiDetails={true} shape renders here now: the bordered
          panel with the Name/DOB/Nationality read-out, which is the ONLY
          place the six other journeys (Passport-to-QID, SIM Swap,
          Pre-to-Post and the rest) display that identity data. Its badge
          stays inside the panel, heading the read-out it introduces.

          The showMoiDetails={false} shape used to render a bare badge in this
          slot, a row of its own under the field. It moved onto the number
          field's label line on 2026-09-25 and is passed as `status` above.
          GuidedContactStep needs nothing else here: its own identity fields
          already show what the panel would restate, which is why the bordered
          container went on 2026-09-24. */}
      {value.moiResult && showMoiDetails && (
        <div className="pt-2 border-t border-border-soft">
          <div className="rounded-[var(--radius-card)] border border-success/30 bg-[color-mix(in_oklab,var(--success),var(--bg)_92%)] p-4 space-y-3">
            <Badge variant="success-solid">MOI validated successfully</Badge>
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
      )}
    </div>
  );
}
