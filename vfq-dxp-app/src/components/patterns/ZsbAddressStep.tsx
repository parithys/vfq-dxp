import { useEffect, useState } from 'react';
import { Input } from '../primitives/Input';
import { Select } from '../primitives/Select';
import { Textarea } from '../primitives/Textarea';
import { FibreReadinessBanner } from '../domain/FibreReadinessBanner';
import * as mockDataEngine from '../../engines/mockDataEngine';
import { lookupServiceLocation } from '../../engines/serviceLocationLookup';
import { useAreaOptions } from '../../hooks/useAreaOptions';
import { Button } from '../primitives/Button';
import { Icon } from '../primitives/Icon';

export interface ZsbAddressValue {
  zone?: string;
  streetNo?: string;
  buildingNo?: string;
  /** Added 2026-09-28, alongside Floor - no evidenced source prefills this;
   * free text like every other field on this step. */
  floor?: string;
  aptFlatUnit?: string;
  /** District/city, e.g. West Bay. Prefills from the address record's `city`
   * - displayed as "Area/City" (2026-09-28) since that field is exactly what
   * it holds either way. */
  area?: string;
  /**
   * A free-text catch-all line for anything the granular fields above don't
   * capture (a landmark, a combined description) - added 2026-09-28,
   * mirroring the `addressLine`/`addressLine1` concept already used by
   * kid-address-records.json and Customer 360's own Address section, neither
   * of which this step reads from; this is its own independent field.
   */
  addressLine?: string;
  /**
   * Kahramaa / location ID. OPTIONAL for postpaid activation (2026-09-25) -
   * a mobile line needs no serviceable premises, unlike the fibre journeys
   * where a KID is what makes an address installable. Prefills from the
   * address record's `kahramaaId` when one is on file. Field key unchanged
   * from before - only the visible label became "Kahramaa ID" (2026-09-28),
   * dropping the "(Location ID)" gloss now that the label just says what it
   * is directly.
   */
  kidLocationId?: string;
  /**
   * Added 2026-09-28. A DIFFERENT identifier from Kahramaa ID - VFID is
   * Vodafone's own location code (public/mock-data/vodafone-ids.json, format
   * like "WKR-0231-A"), which maps to one or more Kahramaa IDs rather than
   * being one. Free text here, same as every other field on this step: nothing
   * in this component validates or resolves it against that dataset, matching
   * how Kahramaa ID itself is captured (evidenced free entry, not a lookup).
   */
  vodafoneId?: string;
  fetchedFromMoi?: boolean;
}

interface ZsbAddressStepProps {
  value: ZsbAddressValue;
  onChange: (value: ZsbAddressValue) => void;
  /** When the Contact step's ID lookup resolved a Qatari national, their
   * registered address is looked up and prefilled rather than re-typed by the
   * agent - a Qatari ID is already tied to a Kahramaa-linked address record on
   * file. Omitted/non-Qatari falls back to the existing evidenced manual-entry
   * + Skip Address flow unchanged.
   *
   * Prefilled but EDITABLE as of 2026-09-26. These fields were disabled once
   * fetched, on the reasoning that a registry address should not be typed
   * over. That is wrong for the case it is most likely to meet: the record on
   * file is the customer's REGISTERED address, and a walk-in moving house has
   * no way to tell the agent so. The fetch is a head start, not a verdict.
   *
   * `fetchedFromMoi` still guards against re-fetching, so an agent's
   * correction is never clobbered by the effect running again. */
  idNumber?: string;
  nationality?: string;
  /** A journey that reports fibre readiness itself (Fixed Activation: from its RFS check) hides this built-in banner. */
  hideFibreReadiness?: boolean;
}

interface AddressRecord {
  customerId: string;
  zone: string;
  streetNo: string;
  buildingNo: string;
  aptFlatUnit: string;
  city?: string;
  kahramaaId?: string;
  primaryStatus: string;
  activeFlag: boolean;
}

// SCR-155/SCR-122 (MNP Postpaid Address, FLD-523–526): Zone/Street No./Building
// No./Apt-Flat-Unit, all evidenced Mandatory: No, with "Save Address"/"Skip
// Address"/"Go back"/"Cancel" buttons - a mobile-channel address step, distinct
// from the saved-address picker this step replaced (which picked an existing
// serviceable Address record).
//
// The Save Address / Skip Address pair was removed on 2026-09-26, along with
// the `skipped` flag they were the only thing that set. Save committed nothing
// - every field already writes on change, so it re-submitted the value it had
// - and Skip is no longer needed to decline the step: all six fields are
// evidenced Mandatory: No, so leaving them empty and pressing Continue is the
// same outcome the flag used to record. Worth noting the departure: the
// evidenced screen (SCR-155/SCR-122) does show Save Address / Skip Address /
// Go back / Cancel, so the journey no longer mirrors that button row.
//
// The on-screen "Unresolved policy conflict" advisory was removed on
// 2026-09-25. The conflict itself is NOT resolved by removing it - the
// Consumer Activation Process Manual requires ZSB for mobile while a Day 7
// workshop says it is FWA/fixed-only, and the evidenced screen marks these
// fields Mandatory: No with a Skip Address option. It stays recorded in
// reference/blueprint conflict-report.md (Conflict 2) and in ruleEngine's
// BR-ZSB-MANDATORY-FOR-MOBILE, which still evaluates; it simply no longer
// addresses the agent, who cannot action it.
const CARD = 'card p-4 space-y-4';
const SEARCH_ICON = 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.3-4.3';
const CARD_TITLE = 'text-fg text-[length:var(--fs-h5)] font-semibold';

export function ZsbAddressStep({ value, onChange, idNumber, nationality, hideFibreReadiness = false }: ZsbAddressStepProps) {
  const [fetching, setFetching] = useState(false);
  // Area / District suggestions (see useAreaOptions).
  const areaOptions = useAreaOptions();
  // Vodafone ID follows from the Kahramaa ID: vodafone-ids.json maps each VFID
  // to the KIDs it covers (mappedKidIds, from UIM). Used to prefill the field.
  const [vfidMap, setVfidMap] = useState<{ format: string; mappedKidIds: string[]; status?: string }[]>([]);
  useEffect(() => {
    mockDataEngine.list<{ format: string; mappedKidIds: string[]; status?: string }>('vodafone-ids').then(setVfidMap);
  }, []);
  const vfidFor = (kid: string | undefined) => {
    const k = kid?.trim().toUpperCase();
    if (!k) return undefined;
    return (vfidMap.find((v) => v.status === 'Active' && v.mappedKidIds.some((m) => m.toUpperCase() === k)) ??
      vfidMap.find((v) => v.mappedKidIds.some((m) => m.toUpperCase() === k)))?.format;
  };

  // Search next to the Kahramaa Meter ID and the Vodafone Premise ID: looks the entered ID up and fills the address fields
  // below from the record it names. `lookupNote` says what happened, under the ID it belongs to.
  const [searching, setSearching] = useState<'kid' | 'vfid' | null>(null);
  const [lookupNote, setLookupNote] = useState<{ field: 'kid' | 'vfid'; ok: boolean; text: string } | null>(null);
  const searchLocation = async (field: 'kid' | 'vfid') => {
    const id = (field === 'kid' ? value.kidLocationId : value.vodafoneId)?.trim();
    if (!id || searching) return;
    setSearching(field);
    setLookupNote(null);
    const result = await lookupServiceLocation(field === 'kid' ? { kid: id } : { vodafoneId: id });
    setSearching(null);
    if (!result.found) {
      setLookupNote({ field, ok: false, text: `No location found for ${id}. Check the ID, or enter the address below.` });
      return;
    }
    onChange({ ...value, ...result.fields });
    setLookupNote({ field, ok: true, text: 'Location found - the address fields below have been filled in.' });
  };

  useEffect(() => {
    if (nationality !== 'Qatari' || !idNumber || value.fetchedFromMoi || value.zone) return;
    let cancelled = false;
    (async () => {
      setFetching(true);
      const docs = await mockDataEngine.list<{ documentNumber: string; customerId: string }>('identity-documents');
      const doc = docs.find((d) => d.documentNumber === idNumber);
      if (!doc) {
        if (!cancelled) setFetching(false);
        return;
      }
      const addresses = await mockDataEngine.list<AddressRecord>('addresses');
      const onFile = addresses.find((a) => a.customerId === doc.customerId && a.primaryStatus === 'Primary' && a.activeFlag);
      setFetching(false);
      if (!cancelled && onFile) {
        onChange({
          zone: onFile.zone,
          streetNo: onFile.streetNo,
          buildingNo: onFile.buildingNo,
          aptFlatUnit: onFile.aptFlatUnit,
          // `city` is the nearest thing on file to the mockup's Area, and
          // `kahramaaId` is the KID itself - both were already in
          // addresses.json and simply unused here.
          area: onFile.city,
          kidLocationId: onFile.kahramaaId,
          fetchedFromMoi: true,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idNumber, nationality]);

  // The service identifiers card (Kahramaa Meter ID / Vodafone Premise ID, each with Search): always the first card of the
  // form, above the address - the one layout every journey's address step uses.
  const serviceInformation = (
    <section className={CARD}>
      <div>
        <h3 className={CARD_TITLE}>
          Service Information <span className="font-normal">(If available)</span>
        </h3>
        <p className="text-fg-2 text-[length:var(--fs-body)]">These details are used for service activation.</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {/* Optional for a postpaid mobile line, which needs no serviceable premises - unlike the
            fibre journeys, where the KID is what makes an address installable. */}
        <div>
          <div className="flex items-end gap-2">
            <div className="flex-1 min-w-0">
              <Input
                label="Kahramaa Meter ID (Optional)"
                placeholder="e.g. KID-00123456"
                value={value.kidLocationId ?? ''}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), void searchLocation('kid'))}
                onChange={(e) => {
                  const kid = e.target.value;
                  const mapped = vfidFor(kid);
                  // Prefill when the KID maps to a Vodafone ID; if it stops mapping,
                  // clear only a value this lookup put there (never something the
                  // agent typed). The field stays editable either way.
                  const wasAuto = value.vodafoneId !== undefined && value.vodafoneId === vfidFor(value.kidLocationId);
                  setLookupNote(null);
                  onChange({
                    ...value,
                    kidLocationId: kid,
                    vodafoneId: mapped ?? (wasAuto ? '' : value.vodafoneId),
                  });
                }}
              />
            </div>
            <Button
              variant="secondary"
              className="!px-3"
              onClick={() => void searchLocation('kid')}
              disabled={!value.kidLocationId?.trim() || searching !== null}
              aria-label="Search by Kahramaa Meter ID"
              title="Search by Kahramaa Meter ID"
            >
              <Icon path={SEARCH_ICON} className="w-5 h-5" />
            </Button>
          </div>
          {lookupNote?.field === 'kid' && (
            <p role="status" className={`mt-1 text-[length:var(--fs-caption)] ${lookupNote.ok ? 'text-success' : 'text-danger'}`}>
              {lookupNote.text}
            </p>
          )}
        </div>
        {/* Vodafone ID follows from the Kahramaa ID (vfidFor), so the pair stays on one row, after the Kahramaa Meter ID it derives from. */}
        <div>
          <div className="flex items-end gap-2">
            <div className="flex-1 min-w-0">
              <Input
                label="Vodafone Premise ID (Optional)"
                placeholder="e.g. WKR-0231-A"
                value={value.vodafoneId ?? ''}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), void searchLocation('vfid'))}
                onChange={(e) => {
                  setLookupNote(null);
                  onChange({ ...value, vodafoneId: e.target.value });
                }}
              />
            </div>
            <Button
              variant="secondary"
              className="!px-3"
              onClick={() => void searchLocation('vfid')}
              disabled={!value.vodafoneId?.trim() || searching !== null}
              aria-label="Search by Vodafone Premise ID"
              title="Search by Vodafone Premise ID"
            >
              <Icon path={SEARCH_ICON} className="w-5 h-5" />
            </Button>
          </div>
          {lookupNote?.field === 'vfid' && (
            <p role="status" className={`mt-1 text-[length:var(--fs-caption)] ${lookupNote.ok ? 'text-success' : 'text-danger'}`}>
              {lookupNote.text}
            </p>
          )}
        </div>
      </div>
    </section>
  );

  return (
    <div className="space-y-4">
      {serviceInformation}
      {fetching && <p className="text-muted text-[length:var(--fs-body)]">Checking for an address on file…</p>}
      {/* The provenance line ("Retrieved from the customer's Qatar ID. Edit any
          field if the customer confirms a change.") was removed on 2026-09-27
          per the annotated walkthrough. The fields remain prefilled from MOI
          and editable exactly as before - only the caption is gone, so
          `fetchedFromMoi` still drives the prefill, just nothing on screen. */}
      {/* Layout per the 2026-10-10 "Qatar Address" reference: three cards - the blue-plate
          address, optional location detail, and service identifiers.
          The value shape is unchanged; only labels, grouping and helper copy moved. The marks on
          Zone/Street/Building are visual: this step is still Mandatory: No (FLD-523-526) and does
          not gate Continue (see serviceAddressStep.isValid). */}
      <section className={CARD}>
        <div className="grid grid-cols-3 gap-4">
          <Input
            label="Zone Number"
            required
            placeholder="e.g. 66"
            value={value.zone ?? ''}
            onChange={(e) => onChange({ ...value, zone: e.target.value })}
          />
          <Input
            label="Street Number"
            required
            placeholder="e.g. 840"
            value={value.streetNo ?? ''}
            onChange={(e) => onChange({ ...value, streetNo: e.target.value })}
          />
          <Input
            label="Building Number"
            required
            placeholder="e.g. 24"
            value={value.buildingNo ?? ''}
            onChange={(e) => onChange({ ...value, buildingNo: e.target.value })}
          />
        </div>
      </section>

      <section className={CARD}>
        <h3 className={CARD_TITLE}>
          Additional Details <span className="font-normal">(Optional)</span>
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <Select
            label="Area / District"
            placeholder="Select an area"
            searchable
            // A dropdown with search. A value already on the address that is not in the list
            // (typed earlier, or from a lookup) stays selectable so it is never lost.
            options={[...new Set([...(value.area ? [value.area] : []), ...areaOptions])].map((a) => ({ value: a, label: a }))}
            value={value.area ?? ''}
            onChange={(e) => onChange({ ...value, area: e.target.value })}
          />
          <Input
            label="Flat / Apartment / Unit Number"
            placeholder="e.g. 4B, 1402"
            value={value.aptFlatUnit ?? ''}
            onChange={(e) => onChange({ ...value, aptFlatUnit: e.target.value })}
          />
          <Input
            label="Floor"
            placeholder="e.g. 4"
            value={value.floor ?? ''}
            onChange={(e) => onChange({ ...value, floor: e.target.value })}
          />
        </div>
        {/* Free-text catch-all (addressLine) - see ZsbAddressValue's note on why it sits
            alongside the granular fields rather than instead of them. */}
        <Textarea
          label="Directions / Landmark (Optional)"
          rows={2}
          placeholder="e.g. Near City Center Mall, opposite Al Rayyan Park"
          helperText="Add any landmarks, directions or additional notes to help us locate you"
          value={value.addressLine ?? ''}
          onChange={(e) => onChange({ ...value, addressLine: e.target.value })}
        />
      </section>


      {/* Read-only, checked against the ZSB (Zone/Street/Building) the agent
          just typed above - see FibreReadinessBanner's own note on why "NAS"
          isn't a term this corpus evidences and what this reads the request
          as instead. Renders nothing until Zone/Street/Building are all
          filled in, so it never reports on a half-typed address. */}
      {!hideFibreReadiness && <FibreReadinessBanner zone={value.zone} street={value.streetNo} building={value.buildingNo} />}
    </div>
  );
}
