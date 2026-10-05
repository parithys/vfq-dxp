import { useEffect, useRef, useState } from 'react';
import { QidNumberField, QidTypeSelector } from '../domain/QidInput';
import type { SpecimenIdentity } from '../domain/ScannedIdPreview';
import { callService, ServiceError, takeDuplicateFault, VALIDATION_TTL_MS, type FailureKind, type ServiceName } from '../../engines/serviceCall';
import { TechnicalFailure, ValidationStatus } from './ValidationStatus';
import { Button } from '../primitives/Button';
import type { QidType } from '../domain/QidInput';
import { IdScannerPanel } from './IdScannerPanel';
import { Badge } from '../primitives/Badge';
import { Input } from '../primitives/Input';
import * as mockDataEngine from '../../engines/mockDataEngine';
import { useEnterToSubmit } from '../../hooks/useEnterToSubmit';
import { MAX_SCAN_ATTEMPTS, LEGACY_MAX_SCAN_ATTEMPTS, SCANNABLE_ID_TYPES, misread, isoToDmy } from './idLookupModel';
import type { DuplicateCandidate, IdLookupValue } from './idLookupModel';


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
  /**
   * Scan -> verify -> Fetch (2026-09-30), OPT-IN for the same reason as
   * autoDetectIdType. The scan populates the QID number AND expiry date as
   * editable fields and does NOT call MOI; the agent compares them with the
   * physical card and presses Fetch, which submits both for validation.
   */
  verifyThenFetch?: boolean;
  /**
   * Whoever this ID belongs to is handled as a genuine NEW customer (New
   * Connection - New Customer): identity from NAS where NAS has it, the
   * Siebel customerId/employer/phone are NOT carried, and the email is the
   * NAS one (masked by the Contact step).
   */
  asNewCustomer?: boolean;
  /**
   * Prototype rule (journey started from Customer 360): the customer is the one
   * the journey was opened for, whatever number the scan returned - the demo
   * scanner returns the same QID every time. Identity is taken from this record.
   */
  asCustomerId?: string;
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
export function IdLookupStep({ value = {}, onChange, showMoiDetails = true, allowedIdTypes, unavailableIdTypes, unavailableIdTypesHint, autoDetectIdType = false, verifyThenFetch = false, asNewCustomer = false, asCustomerId }: IdLookupStepProps) {
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [expiryMismatch, setExpiryMismatch] = useState(false);
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
  // verifyThenFetch is selector-led with NOTHING preselected (2026-10-04). A
  // QID default (2026-10-02) meant a Diplomatic ID, Passport or GCC ID presented
  // at the reader was read as a QID unless the agent noticed and switched first.
  // The agent now names the document type, and the scanner, the document read
  // and the MOI lookup all follow that type - each type its own flow.
  const typeChosen = !verifyThenFetch || Boolean(value.idType);
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
  const scannable = typeChosen && SCANNABLE_ID_TYPES.has(idType);
  // Everything that asks "is there a reader on this screen" must accept a demo
  // scan too, or the capture disappears the moment a non-scannable type wins.
  const effectiveScannable = scannable || demoType !== null;

  const handleIdTypeChange = (nextType: QidType) => {
    // Re-clicking the type you are already on is a no-op, not a reset. These
    // are plain buttons rather than radios, so without this a stray second
    // click on the selected chip would wipe a number the agent had just typed.
    if (nextType === idType && typeChosen) return;
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

  // Customer 360 context: the card drawn in the reader shows this customer.
  const [contextIdentity, setContextIdentity] = useState<SpecimenIdentity | undefined>();
  /** Set (to the customer's name, or the id) when the journey's customer has no identity document on file: nothing to draw in the reader. */
  const [contextNoDocument, setContextNoDocument] = useState<string | undefined>();
  useEffect(() => {
    setContextNoDocument(undefined);
    if (!asCustomerId) {
      setContextIdentity(undefined);
      return;
    }
    let cancelled = false;
    void Promise.all([
      mockDataEngine.list<{ customerId: string; name: string; nationality: string; dob: string }>('customers'),
      mockDataEngine.list<{ customerId: string; documentType: string; documentNumber: string; expiryDate?: string }>('identity-documents'),
    ]).then(([customers, docs]) => {
      const c = customers.find((x) => x.customerId === asCustomerId);
      const own = docs.filter((d) => d.customerId === asCustomerId);
      const d = own.find((x) => x.documentType === 'QID') ?? own[0];
      if (cancelled) return;
      if (!c || !d) {
        // Never fall back to another customer's specimen card: say there is no document.
        setContextIdentity(undefined);
        setContextNoDocument(c?.name ?? asCustomerId);
        return;
      }
      setContextIdentity({ name: c.name, idNo: d.documentNumber, nationality: c.nationality, dob: isoToDmy(c.dob), expiry: d.expiryDate ? isoToDmy(d.expiryDate) : '' });
    });
    return () => {
      cancelled = true;
    };
  }, [asCustomerId]);

  // ---- Failure handling ------------------------------------------------------
  // A lookup that cannot complete is UNRESOLVED: it never becomes "not found",
  // "new customer", "validated" or "eligible". The failure is held here, shown
  // with Retry while attempts remain, and a controlled recovery once they are
  // spent. `requestSeq` makes every result belong to exactly one request, so a
  // retry, a retake or an edited number can never be answered by an older call.
  const [failure, setFailure] = useState<{ service: ServiceName; kind: FailureKind; attempts: number } | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[] | null>(null);
  const [expiredNotice, setExpiredNotice] = useState(false);
  const attemptsRef = useRef<{ number: string; n: number }>({ number: '', n: 0 });
  const requestSeq = useRef(0);

  // A different number is a different question: forget the old answer's trouble.
  useEffect(() => {
    setFailure(null);
    setDuplicates(null);
    setRetrying(false);
  }, [value.idNumber]);

  // A successful MOI validation does not last forever. Once it is older than the
  // TTL it is dropped (the identity fields clear with it) and the agent must
  // validate again - the journey never continues on a stale result.
  const validatedAt = value.moiResult?.moiUpdateTime;
  useEffect(() => {
    if (!validatedAt) return;
    const left = new Date(validatedAt).getTime() + VALIDATION_TTL_MS - Date.now();
    const drop = () => {
      setExpiredNotice(true);
      onChange({ ...latest.current, moiResult: undefined });
    };
    if (left <= 0) {
      drop();
      return;
    }
    const t = setTimeout(drop, left);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validatedAt]);
  useEffect(() => {
    if (value.moiResult) setExpiredNotice(false);
  }, [value.moiResult]);

  const runMoiValidation = async (opts: { forceCustomerId?: string; retry?: boolean } = {}) => {
    if (!value.idNumber) return;
    const requested = value.idNumber;
    const seq = ++requestSeq.current;
    const stale = () => seq !== requestSeq.current || latest.current.idNumber !== requested;
    if (attemptsRef.current.number !== requested) attemptsRef.current = { number: requested, n: 0 };
    setLoading(true);
    setNotFound(false);
    setExpiryMismatch(false);
    setDuplicates(null);
    setExpiredNotice(false);
    setRetrying(Boolean(opts.retry));
    if (!opts.retry) setFailure(null);
    try {
      // MOI: the identity document registry.
      const identityDocs = await callService('moi', () =>
        mockDataEngine.list<{ documentNumber: string; customerId: string; expiryDate?: string }>('identity-documents')
      );
      if (stale()) return;
      const docMatches = identityDocs.filter((d) => d.documentNumber === requested);
      const docMatch = docMatches[0];
      // NAS: the person may be known there without a customer record. In the New
      // Customer journey it is consulted even when a record exists.
      const nasRecord =
        docMatch && !asNewCustomer
          ? undefined
          : (
              await callService('nas', () =>
                mockDataEngine.list<{ documentNumber: string; expiryDate?: string; name: string; firstName?: string; middleName?: string; lastName?: string; dob: string; nationality: string; gender?: string; email?: string }>(
                  'nas-records'
                )
              )
            ).find((r) => r.documentNumber === requested);
      if (stale()) return;
      const match = docMatch ?? (nasRecord && { customerId: undefined, expiryDate: nasRecord.expiryDate });
      if (!match) {
        // Every system ANSWERED and none knows this number: a business result.
        setNotFound(true);
        return;
      }
      // MOI validates the number AND the expiry together. Only when the agent
      // verified a scanned expiry; the other journeys never supply one.
      if (verifyThenFetch && match.expiryDate && latest.current.scannedExpiry !== isoToDmy(match.expiryDate)) {
        setExpiryMismatch(true);
        return;
      }
      const customers = await callService('customer-lookup', () =>
        mockDataEngine.list<{ customerId: string; name: string; firstName?: string; middleName?: string; lastName?: string; dob: string; nationality: string; email?: string; gender?: string; companyName?: string; phone?: string; preferredLanguage?: string }>(
          'customers'
        )
      );
      if (stale()) return;

      // More than one record for this ID: never pick one silently. (The Customer
      // 360 journey is already fixed to its customer, and an explicit choice from
      // the agent resolves it.)
      if (!asCustomerId && !opts.forceCustomerId) {
        const ids = [...new Set(docMatches.map((d) => d.customerId).filter(Boolean))];
        if (takeDuplicateFault('customer-lookup') && ids.length === 1) {
          const other = customers.find((c) => c.customerId !== ids[0]);
          if (other) ids.push(other.customerId);
        }
        if (ids.length > 1) {
          setDuplicates(
            ids
              .map((id) => customers.find((c) => c.customerId === id))
              .filter((c): c is NonNullable<typeof c> => Boolean(c))
              .map((c) => ({ customerId: c.customerId, name: c.name, dob: c.dob }))
          );
          return;
        }
      }

      const wantedId = opts.forceCustomerId ?? asCustomerId ?? match.customerId;
      const customer = wantedId ? customers.find((c) => c.customerId === wantedId) : undefined;
      // The record this ID points at is missing from the lookup: that is a
      // lookup failure, NOT evidence that the person is new.
      if (wantedId && !customer) throw new ServiceError('customer-lookup', 'partial');

      if ((!customer && nasRecord) || (asNewCustomer && (nasRecord || customer))) {
        // NEW customer: identity and email come from NAS, not Siebel. In the New
        // Customer journey (asNewCustomer) an ID that also has a Siebel record is
        // still treated as new - its demographics are used only as the fallback
        // when NAS holds none, and no customerId is carried.
        const src = (nasRecord ?? customer)!;
        // An answer missing the details the journey is built on cannot be used.
        if (!src.name || !src.dob || !src.nationality) throw new ServiceError(nasRecord ? 'nas' : 'customer-lookup', 'partial');
        if (stale()) return;
        attemptsRef.current = { number: requested, n: 0 };
        onChange({
          ...latest.current,
          manualEntry: fallbackUnlocked && !scanComplete,
          moiResult: {
            name: src.name,
            firstName: src.firstName,
            middleName: src.middleName,
            lastName: src.lastName,
            dob: src.dob,
            nationality: src.nationality,
            email: src.email,
            emailSource: 'NAS',
            isNewCustomer: true,
            gender: src.gender,
            expiryDate: match.expiryDate,
            moiUpdateTime: new Date().toISOString(),
          },
        });
        return;
      }
      if (customer) {
        if (!customer.name || !customer.dob || !customer.nationality) throw new ServiceError('customer-lookup', 'partial');
        // Only for a customer who has an employer, so an ordinary consumer sale
        // costs no extra dataset read.
        let companyAccountId: string | undefined;
        if (customer.companyName) {
          const accounts = await callService('customer-lookup', () =>
            mockDataEngine.list<{ enterpriseAccountId: string; name: string }>('enterprise-accounts')
          );
          companyAccountId = accounts.find((a) => a.name === customer.companyName)?.enterpriseAccountId;
          // Left undefined when the employer is not in the registry, rather than
          // faked. The order still carries the name and still routes for
          // approval; the approver is the one who can see that the sponsoring
          // account does not exist yet, which is exactly the kind of thing they
          // are there to catch.
        }
        // Existing customer's email: the one on their Billing Profile, whenever the
        // account has one - also when the account carries several addresses (the
        // customer record, billing contact and so on). Where the Billing Profile has
        // none, the single address on file (the customer record's) is used.
        const [accountsAll, profilesAll] = await callService('customer-lookup', () =>
          Promise.all([
            mockDataEngine.list<{ accountId: string; customerId: string; billingProfileId?: string }>('accounts'),
            mockDataEngine.list<{ billingProfileId: string; billingContactEmail?: string }>('billing-profiles'),
          ])
        );
        const profileIds = new Set(accountsAll.filter((a) => a.customerId === customer.customerId).map((a) => a.billingProfileId));
        const billingEmail = profilesAll.find((p) => profileIds.has(p.billingProfileId) && p.billingContactEmail)?.billingContactEmail;
        // Superseded while in flight - the agent retook the scan, switched ID
        // type, or edited the number. Applying this now would attach one
        // document's demographics to another's number.
        if (stale()) return;
        attemptsRef.current = { number: requested, n: 0 };
        onChange({
          ...latest.current,
          manualEntry: fallbackUnlocked && !scanComplete,
          moiResult: {
            customerId: customer.customerId,
            name: customer.name,
            firstName: customer.firstName,
            middleName: customer.middleName,
            lastName: customer.lastName,
            dob: customer.dob,
            nationality: customer.nationality,
            email: billingEmail ?? customer.email,
            emailSource: billingEmail ? 'Billing Profile' : 'Siebel',
            gender: customer.gender,
            phone: customer.phone,
            preferredLanguage: customer.preferredLanguage,
            companyName: customer.companyName,
            companyAccountId,
            expiryDate: match.expiryDate,
            moiUpdateTime: new Date().toISOString(),
          },
        });
      }
    } catch (err) {
      if (stale()) return; // interrupted by a newer request: not this one's to report
      const e = err instanceof ServiceError ? err : new ServiceError('moi', 'unexpected');
      attemptsRef.current = { number: requested, n: attemptsRef.current.n + 1 };
      setFailure({ service: e.service, kind: e.kind, attempts: attemptsRef.current.n });
      // A failed check leaves the validation unresolved: drop any earlier result so the identity
      // details below never read as validated while the failure banner is showing.
      onChange({ ...latest.current, moiResult: undefined });
    } finally {
      if (seq === requestSeq.current) {
        setLoading(false);
        setRetrying(false);
      }
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
  // No document to read for this customer: the reader cannot help, so manual entry is available straight away.
  useEffect(() => {
    if (contextNoDocument) setFallbackUnlocked(true);
  }, [contextNoDocument]);
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
  const readDocumentFromScan = async (): Promise<{ documentType: QidType; documentNumber: string; expiryDate?: string } | undefined> => {
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
    // Journey started from Customer 360: the reader returns THAT customer's own
    // document, never another customer's. (Their QID where they hold one.)
    const ownDocs = asCustomerId
      ? docs.filter((d) => (d as { customerId?: string }).customerId === asCustomerId)
      : undefined;
    const candidates = ownDocs
      ? [...ownDocs].sort((a, b) => Number(b.documentType === 'QID') - Number(a.documentType === 'QID'))
      : docs.filter((d) => detectable.includes(d.documentType as QidType));
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
    return { documentType: found.documentType as QidType, documentNumber: found.documentNumber, expiryDate: found.expiryDate };
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
      // Deliberately blurred (2026-09-28 demo direction, gated by
      // autoDetectIdType below) - the reader captured something, but not
      // legibly enough to OCR. Not run through readDocumentFromScan at all:
      // this is not "no match found" (which counts toward the fallback
      // threshold below), it is "nothing was even attempted yet" - the agent
      // has to Retake, which arrives clear and re-runs this effect.
      if (value.qidScans?.clear === false && !verifyThenFetch) return;
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
        // Blurred first pass (verifyThenFetch): OCR captures a WRONG number. The
        // agent must Retake; nothing here can be fetched until they do.
        const blurred = verifyThenFetch && now.qidScans?.clear === false;
        onChange({
          ...now,
          idType: scanned.documentType,
          idNumber: blurred ? misread(scanned.documentNumber) : scanned.documentNumber,
          scannedExpiry: verifyThenFetch && scanned.expiryDate ? isoToDmy(scanned.expiryDate) : undefined,
        });
      });
      return;
    }
    if (value.moiResult || loading) return;
    // verifyThenFetch: the agent verifies against the card and presses Fetch.
    if (verifyThenFetch) return;
    if (autoFetchedNumber.current === number) return;
    autoFetchedNumber.current = number;
    void runMoiValidation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idType, effectiveScannable, scanComplete, value.idNumber, value.moiResult, loading, value.qidScans?.clear]);

  const handleKeyDown = useEnterToSubmit(Boolean(value.idNumber) && !loading, runMoiValidation);

  // Built once and placed by ID type below. Only the showMoiDetails={false}
  // shape gets a loose badge at all - the other journeys keep theirs inside
  // the bordered panel it heads, where it introduces the identity read-out.
  const moiBadge =
    !showMoiDetails && value.moiResult ? (
      <Badge variant="success-solid">
        {/* verifyThenFetch: one line, the time folded into the badge. */}
        {verifyThenFetch && value.moiResult.moiUpdateTime
          ? `MOI validated successfully at ${new Date(value.moiResult.moiUpdateTime).toLocaleString()}`
          : 'MOI validated successfully'}
      </Badge>
    ) : undefined;

  // "MOI Update Time" (2026-09-28) - see MoiResult.moiUpdateTime's own note
  // for the evidenced field name. toLocaleString() rather than a hand-rolled
  // formatter, matching how this app already renders absolute timestamps
  // elsewhere (TaskDetailView.tsx, BulkNotesSection.tsx).
  const moiUpdateTimeText = value.moiResult?.moiUpdateTime
    ? `MOI Update Time: ${new Date(value.moiResult.moiUpdateTime).toLocaleString()}`
    : undefined;

  // The scanner, shown only for a Qatar ID. The other three document
  // types are single-sided in this corpus (a passport is scanned at its
  // photo page, GCC/Diplomatic IDs have no evidenced reverse capture),
  // so offering a two-face capture for them would invent a step. Reuses
  // the same QidImageUpload the Passport-to-QID and SIM Swap journeys
  // already gate on, rather than a second scanner with its own shape.
  //
  // NOTHING HERE EXPOSES THE SIMULATION. The counter ("Scan attempts:
  // n / 4") and the "Simulate scan failure" button that used to sit
  // under this card are both gone as of 2026-09-25. They were debug
  // affordances: the counter published the exact budget the agent was
  // told not to be shown, and the button described the app to itself.
  // The budget now shows up the only way it should - as a scan that
  // fails - and the failure message says what the agent can do about it
  // without mentioning attempts.
  // verifyThenFetch: the scanned number and expiry are locked - a bad read is
  // fixed by Retake - until the SECOND rescan (third pass over the reader) has
  // completed. From then on the agent may correct them by hand.
  const correctionUnlocked = verifyThenFetch && scanAttempts >= 3;

  const scannerBlock = effectiveScannable && (
    <IdScannerPanel
      value={value}
      onChange={onChange}
      latest={latest}
      idType={idType}
      verifyThenFetch={Boolean(verifyThenFetch)}
      autoDetectIdType={Boolean(autoDetectIdType)}
      contextNoDocument={contextNoDocument}
      contextIdentity={contextIdentity}
      scanComplete={scanComplete}
      setNotFound={setNotFound}
      setExpiryMismatch={setExpiryMismatch}
      demoType={demoType}
      handleScanAttempt={handleScanAttempt}
      handleDemoScan={handleDemoScan}
      fallbackUnlocked={fallbackUnlocked}
    />
  );

  // FALLBACK ONLY as of 2026-09-28 for the scan-first flow. Automatic
  // detection is the primary path there: the reader identifies the
  // document, so asking the agent to classify it first was asking a
  // question the scanner answers. For the eight journeys that still lead
  // with a type selector (autoDetectIdType false), this is unconditional
  // and unchanged - those journeys have no detector to defer to, so the
  // selector remains the first thing the agent does, not a fallback.
  // `manualEntryUnlocked` is latched - see fallbackUnlocked.
  const selectorBlock = (!autoDetectIdType || manualEntryUnlocked) && (
    <QidTypeSelector
      idType={typeChosen ? idType : undefined}
      onIdTypeChange={handleIdTypeChange}
      allowedTypes={allowedIdTypes}
      unavailableTypes={unavailableIdTypes}
      unavailableHint={unavailableIdTypesHint}
    />
  );

  return (
    <div className="space-y-4" onKeyDown={handleKeyDown}>
      {/* Scan-first flow (2026-09-28): the scanner leads, and the type
          selector - now purely a fallback - follows it, since it is
          something the scanner's own failure hands off to rather than a
          question asked ahead of it. The eight selector-led journeys keep
          their original order: selector first, since they have no
          detector for the scanner to lead with. */}
      {autoDetectIdType ? (
        <>
          {scannerBlock}
          {selectorBlock}
        </>
      ) : (
        <>
          {selectorBlock}
          {scannerBlock}
        </>
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
      {typeChosen && (!effectiveScannable || (scanComplete && Boolean(value.idNumber)) || manualEntryUnlocked) && (
        <QidNumberField
          idType={idType}
          inputRef={numberInputRef}
          value={value.idNumber ?? ''}
          onChange={(idNumber: string) => {
            setNotFound(false);
            setExpiryMismatch(false);
            onChange({ ...value, idNumber, moiResult: undefined });
          }}
          onFetch={runMoiValidation}
          fetching={loading}
          error={
            notFound
              ? 'No MOI record found for this ID - try again.'
              : expiryMismatch
                ? 'The expiry date does not match the MOI record - check the card and try again.'
                : undefined
          }
          inlineField={
            verifyThenFetch && effectiveScannable && (scanComplete || manualEntryUnlocked) ? (
              <Input
                label="Expiry Date"
                value={value.scannedExpiry ?? ''}
                placeholder="DD/MM/YYYY"
                inputMode="numeric"
                maxLength={10}
                // Locked with the number until the second rescan has completed.
                readOnly={!correctionUnlocked && !manualEntryUnlocked}
                onChange={(e) => {
                  setExpiryMismatch(false);
                  onChange({ ...value, scannedExpiry: e.target.value, moiResult: undefined });
                }}
              />
            ) : undefined
          }
          readOnly={effectiveScannable && scanComplete && !correctionUnlocked}
          // Also disabled once the fetch has succeeded (moiResult set). Editing
          // the number or expiry clears moiResult, which re-enables it.
          fetchDisabled={Boolean(value.moiResult) || (verifyThenFetch && !value.scannedExpiry)}
          // verifyThenFetch: the scanned values are locked, Fetch stays available.
          showFetch={verifyThenFetch}
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
                : verifyThenFetch
                  ? 'Read from the scanned document - verify with the original document, then select Fetch.'
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
          statusDetail={verifyThenFetch ? undefined : moiUpdateTimeText}
        />
      )}

      {/* ---- Validation status. Each state looks different (see ValidationStatus):
          technical failure = amber and unresolved, business result = red, pending
          = neutral, success = green. A technical failure never reads as "not found". */}
      {loading && !failure && !retrying && !value.moiResult && (
        <ValidationStatus variant="pending" title="Validating the identity document…">
          Checking MOI and the customer records. Nothing is decided until this completes.
        </ValidationStatus>
      )}
      {(failure || retrying) && (
        <TechnicalFailure
          service={failure?.service ?? 'moi'}
          kind={failure?.kind ?? 'unexpected'}
          attempts={failure?.attempts ?? 0}
          retrying={retrying}
          onRetry={() => void runMoiValidation({ retry: true })}
          exhaustedHint="Retake the scan to read the document again, or use Save & Exit to resume later."
        />
      )}
      {expiredNotice && !value.moiResult && (
        <TechnicalFailure
          service="moi"
          kind="expired"
          attempts={0}
          onRetry={() => void runMoiValidation()}
        />
      )}
      {duplicates && (
        <ValidationStatus variant="technical" tag="Needs a decision" title="More than one customer record matches this ID">
          <p>No customer has been selected automatically. Choose the record that belongs to this person, or ask Customer Data Management to merge the duplicates.</p>
          <ul className="mt-2 space-y-2">
            {duplicates.map((d) => (
              <li key={d.customerId} className="flex items-center justify-between gap-3 rounded-[var(--radius-button)] border border-border-soft bg-bg px-3 py-2">
                <span className="min-w-0">
                  <span className="block text-fg font-medium truncate">{d.name}</span>
                  <span className="block text-muted text-[length:var(--fs-caption)]">{d.customerId} - born {isoToDmy(d.dob)}</span>
                </span>
                <Button variant="ghost-rect" compact onClick={() => void runMoiValidation({ forceCustomerId: d.customerId })}>
                  Use this record
                </Button>
              </li>
            ))}
          </ul>
        </ValidationStatus>
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
          <div className="rounded-[var(--radius-card)] border border-success bg-[color-mix(in_oklab,var(--success),var(--bg)_88%)] p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="success-solid">MOI validated successfully</Badge>
              {moiUpdateTimeText && <span className="text-[length:var(--fs-caption)] text-muted">{moiUpdateTimeText}</span>}
            </div>
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
