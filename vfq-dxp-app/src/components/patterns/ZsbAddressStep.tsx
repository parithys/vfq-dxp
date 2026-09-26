import { useEffect, useState } from 'react';
import { Input } from '../primitives/Input';
import * as mockDataEngine from '../../engines/mockDataEngine';

export interface ZsbAddressValue {
  zone?: string;
  streetNo?: string;
  buildingNo?: string;
  aptFlatUnit?: string;
  /** District, e.g. West Bay. Prefills from the address record's `city`. */
  area?: string;
  /**
   * Kahramaa / location ID. OPTIONAL for postpaid activation (2026-09-25) -
   * a mobile line needs no serviceable premises, unlike the fibre journeys
   * where a KID is what makes an address installable. Prefills from the
   * address record's `kahramaaId` when one is on file.
   */
  kidLocationId?: string;
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
export function ZsbAddressStep({ value, onChange, idNumber, nationality }: ZsbAddressStepProps) {
  const [fetching, setFetching] = useState(false);

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
      {/* Provenance for the whole panel rather than a note under one field.
          It used to sit on KID alone, saying "Fetched from MOI - not
          editable." - which was true of all six fields, not just that one,
          and is no longer true of any of them. */}
      {value.fetchedFromMoi && (
        <p className="text-muted text-[length:var(--fs-caption)]">
          Retrieved from the customer's Qatar ID. Edit any field if the customer confirms a change.
        </p>
      )}
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
          <Input
            label="Unit / Apartment"
            placeholder="e.g. Apt 4B"
            value={value.aptFlatUnit ?? ''}
            onChange={(e) => onChange({ ...value, aptFlatUnit: e.target.value })}
          />
          {/* Area and KID span the full width, matching the mockup - they are
              single fields per row rather than a pair. */}
          <div className="col-span-2">
            <Input
              label="Area"
              placeholder="e.g. West Bay"
              value={value.area ?? ''}
              onChange={(e) => onChange({ ...value, area: e.target.value })}
            />
          </div>
          <div className="col-span-2">
            {/* Explicitly labelled optional. Every field on this step is
                Mandatory: No per FLD-523-526, but KID is the one an agent
                would reasonably expect to be required - it IS required in the
                fibre journeys, where it identifies a serviceable premises. A
                postpaid mobile line needs no premises, so saying so here
                saves the agent hunting for a value they do not need. */}
            <Input
              label="KID (Location ID)"
              placeholder="e.g. KID-00123456"
              value={value.kidLocationId ?? ''}
              onChange={(e) => onChange({ ...value, kidLocationId: e.target.value })}
            />
          </div>
      </div>
    </div>
  );
}
