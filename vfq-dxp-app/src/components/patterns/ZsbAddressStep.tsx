import { useEffect, useState } from 'react';
import { Input } from '../primitives/Input';
import { Select } from '../primitives/Select';
import { FibreReadinessBanner } from '../domain/FibreReadinessBanner';
import * as mockDataEngine from '../../engines/mockDataEngine';

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
// from Fixed Line/FWA's AddressSelectionStep (which picks an existing
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
export function ZsbAddressStep({ value, onChange, idNumber, nationality, hideFibreReadiness = false }: ZsbAddressStepProps) {
  const [fetching, setFetching] = useState(false);
  // Area suggestions. kid-address-records is the only dataset in this corpus
  // carrying Qatari area names; addresses.json has `city` (always "Doha"),
  // which is why the prefill above lands a city in this field. Both feed the
  // list so a prefilled value is also offered back as a suggestion.
  const [areaOptions, setAreaOptions] = useState<string[]>([]);
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

  useEffect(() => {
    Promise.all([
      mockDataEngine.list<{ area?: string }>('kid-address-records'),
      mockDataEngine.list<{ city?: string }>('addresses'),
      mockDataEngine.list<{ area?: string }>('qatar-areas'),
    ]).then(([kid, addr, areas]) => {
      const names = [...kid.map((k) => k.area), ...addr.map((a) => a.city), ...areas.map((a) => a.area)].filter(
        (n): n is string => Boolean(n && n.trim())
      );
      setAreaOptions([...new Set(names)].sort());
    });
  }, []);

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

  return (
    <div className="space-y-4">
      {fetching && <p className="text-muted text-[length:var(--fs-body)]">Checking for an address on file…</p>}
      {/* The provenance line ("Retrieved from the customer's Qatar ID. Edit any
          field if the customer confirms a change.") was removed on 2026-09-27
          per the annotated walkthrough. The fields remain prefilled from MOI
          and editable exactly as before - only the caption is gone, so
          `fetchedFromMoi` still drives the prefill, just nothing on screen. */}
      <div className="grid grid-cols-2 gap-4">
          <Input
            label="Zone"
            placeholder="e.g. Zone 38"
            value={value.zone ?? ''}
            onChange={(e) => onChange({ ...value, zone: e.target.value })}
          />
          <Input
            label="Street"
            placeholder="e.g. Al Corniche Street"
            value={value.streetNo ?? ''}
            onChange={(e) => onChange({ ...value, streetNo: e.target.value })}
          />
          <Input
            label="Building"
            placeholder="e.g. Tower A"
            value={value.buildingNo ?? ''}
            onChange={(e) => onChange({ ...value, buildingNo: e.target.value })}
          />
          {/* Floor, added 2026-09-28 between Building and Unit/Apartment -
              the natural order an agent reads a premises out in (building,
              then floor, then unit). No evidenced source prefills it; free
              text like the rest of this step. */}
          <Input
            label="Floor"
            placeholder="e.g. 4th Floor"
            value={value.floor ?? ''}
            onChange={(e) => onChange({ ...value, floor: e.target.value })}
          />
          <Input
            label="Unit / Apartment"
            placeholder="e.g. Apt 4B"
            value={value.aptFlatUnit ?? ''}
            onChange={(e) => onChange({ ...value, aptFlatUnit: e.target.value })}
          />
          {/* Area/City paired with Unit/Apartment (2026-09-28 swap - was
              paired with Kahramaa ID below, and Vodafone ID sat here). */}
          <Select
            label="Area/City"
            placeholder="Select an area"
            searchable
            // A dropdown with search. A value already on the address that is not in the list
            // (typed earlier, or from a lookup) stays selectable so it is never lost.
            options={[...new Set([...(value.area ? [value.area] : []), ...areaOptions])].map((a) => ({ value: a, label: a }))}
            value={value.area ?? ''}
            onChange={(e) => onChange({ ...value, area: e.target.value })}
          />
          {/* Kahramaa ID paired with Vodafone ID (2026-09-28 swap - order
              reversed again; was Vodafone ID then Kahramaa ID). Explicitly
              labelled optional. Every field on this step is Mandatory: No
              per FLD-523-526, but KID is the one an agent would reasonably
              expect to be required - it IS required in the fibre journeys,
              where it identifies a serviceable premises. A postpaid mobile
              line needs no premises, so saying so here saves the agent
              hunting for a value they do not need. */}
          <Input
            label="Kahramaa ID"
            placeholder="e.g. KID-00123456"
            value={value.kidLocationId ?? ''}
            onChange={(e) => {
              const kid = e.target.value;
              const mapped = vfidFor(kid);
              // Prefill when the KID maps to a Vodafone ID; if it stops mapping,
              // clear only a value this lookup put there (never something the
              // agent typed). The field stays editable either way.
              const wasAuto = value.vodafoneId !== undefined && value.vodafoneId === vfidFor(value.kidLocationId);
              onChange({
                ...value,
                kidLocationId: kid,
                vodafoneId: mapped ?? (wasAuto ? '' : value.vodafoneId),
              });
            }}
          />
          {/* Vodafone ID paired with Kahramaa ID. Both are location
              identifiers, sharing this row per the original 2026-09-28
              "same row" direction that still applies. */}
          <Input
            label="Vodafone ID"
            placeholder="e.g. WKR-0231-A"
            value={value.vodafoneId ?? ''}
            onChange={(e) => onChange({ ...value, vodafoneId: e.target.value })}
          />
          <div className="col-span-2">
            {/* Free-text catch-all, added 2026-09-28 - see ZsbAddressValue's
                own note on why this exists alongside the granular fields
                rather than instead of them. */}
            <Input
              label="Address Line"
              placeholder="e.g. Near City Center Mall, opposite Al Rayyan park"
              value={value.addressLine ?? ''}
              onChange={(e) => onChange({ ...value, addressLine: e.target.value })}
            />
          </div>
      </div>
      {/* Read-only, checked against the ZSB (Zone/Street/Building) the agent
          just typed above - see FibreReadinessBanner's own note on why "NAS"
          isn't a term this corpus evidences and what this reads the request
          as instead. Renders nothing until Zone/Street/Building are all
          filled in, so it never reports on a half-typed address. */}
      {!hideFibreReadiness && <FibreReadinessBanner zone={value.zone} street={value.streetNo} building={value.buildingNo} />}
    </div>
  );
}
