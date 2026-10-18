import { CARD_SELECTED, CARD_IDLE } from '../primitives/offerCardParts';
import { useEffect, useState } from 'react';
import * as mockDataEngine from '../../engines/mockDataEngine';
import { LocationInput, type AddressRecord } from '../primitives/LocationInput';
import { Button } from '../primitives/Button';
import { Input } from '../primitives/Input';
import { useEntityStore } from '../../stores/entityStore';

interface AddressSelectionStepProps {
  value: string | undefined;
  onChange: (addressId: string) => void;
  /**
   * Customer's ID number from the Contact step. When given, the step also lists
   * the addresses on that customer's account to pick from, and lets the agent
   * add a new one on the same page. Without it the step is the original
   * search-only field.
   */
  idNumber?: string;
  /** Clears the chosen address - clicking the selected address again calls this (toggle). */
  onClear?: () => void;
}

type AccountAddress = AddressRecord & AddressExtras & { customerId?: string; primaryStatus?: string };

type AddressExtras = { floor?: string; kahramaaId?: string; vodafoneId?: string; addressLine1?: string; addressLine2?: string; poBox?: string; postalCode?: string; country?: string };

const line = (a: AddressRecord & AddressExtras) =>
  [
    a.zone && `Zone ${a.zone}`,
    a.streetNo && `Street ${a.streetNo}`,
    a.buildingNo && `Building ${a.buildingNo}`,
    a.floor,
    a.aptFlatUnit,
  ]
    .filter(Boolean)
    .join(', ') ||
  a.addressLine1 ||
  a.id;

/** Every address field the record carries, as label/value pairs (empty ones left out). */
const detailRows = (a: AccountAddress) =>
  [
    ['Zone', a.zone],
    ['Street', a.streetNo],
    ['Building', a.buildingNo],
    ['Floor', a.floor],
    ['Unit / Apartment', a.aptFlatUnit],
    ['Area/City', a.city],
    ['Country', a.country],
    ['PO Box', a.poBox],
    ['Postal Code', a.postalCode],
    ['Kahramaa ID', a.kahramaaId],
    ['Vodafone ID', a.vodafoneId],
    ['Address Line', [a.addressLine1, a.addressLine2].filter(Boolean).join(', ')],
  ].filter(([, v]) => v) as [string, string][];

function AddressDetails({ address }: { address: AccountAddress }) {
  return (
    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[length:var(--fs-caption)]">
      {detailRows(address).map(([k, v]) => (
        <div key={k} className="flex gap-2">
          <dt className="text-fg shrink-0">{k}:</dt>
          <dd className="text-fg-2 min-w-0 break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

const EMPTY_DRAFT = { zone: '', streetNo: '', buildingNo: '', floor: '', aptFlatUnit: '', city: '', kahramaaId: '', vodafoneId: '', addressLine: '' };

// Address step shared across New Fixed Line (SCR-045), New FWA (SCR-079), and
// New Postpaid (SCR-155) wizards. FLD-281 evidences a read-only Service Points
// grid (Service Point ID / Status / Device Type) surfaced once an address
// resolves to an existing serviceable point - no dedicated service-point mock
// dataset exists in reconstruction-package/mock-data (only ENT-036 Address
// records), so this step lets the agent select/confirm a physical address; the
// Service Point grid itself remains a documented gap (screens.md SCR-034 covers
// the KID/lookup variant with the same limitation).
//
// Backed by LocationInput's search-as-you-type UX instead of the previous
// list-every-seeded-address-as-a-card approach, which doesn't scale past a
// handful of records. Prop contract (value: addressId, onChange: (id) =>
// void) is unchanged, so neither wizard call site needs updating - this
// still self-fetches `addresses` (now just to resolve `value` back to a
// record for the confirmation summary below the search field).
export function AddressSelectionStep({ value, onChange, idNumber, onClear }: AddressSelectionStepProps) {
  const [addresses, setAddresses] = useState<AccountAddress[]>([]);
  const [customerId, setCustomerId] = useState<string | undefined>();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const createRecord = useEntityStore((st) => st.createRecord);

  useEffect(() => {
    mockDataEngine.list<AccountAddress>('addresses').then(setAddresses);
  }, []);

  // The customer behind the scanned ID, resolved the same way eligibility does.
  useEffect(() => {
    if (!idNumber) {
      setCustomerId(undefined);
      return;
    }
    let cancelled = false;
    mockDataEngine
      .list<{ documentNumber: string; customerId: string }>('identity-documents')
      .then((docs) => {
        if (!cancelled) setCustomerId(docs.find((d) => d.documentNumber === idNumber)?.customerId);
      });
    return () => {
      cancelled = true;
    };
  }, [idNumber]);

  const selected = addresses.find((a) => a.id === value);
  const accountAddresses = customerId ? addresses.filter((a) => a.customerId === customerId) : [];
  // Every field is optional (as on the Zone/Street/Building address step), but a blank form is not an address.
  const draftValid = Object.values(draft).some((v) => v.trim());

  const saveNew = async () => {
    const record: AccountAddress & Record<string, unknown> = {
      id: `ADDR-${Date.now().toString().slice(-6)}`,
      customerId,
      zone: draft.zone.trim(),
      streetNo: draft.streetNo.trim(),
      buildingNo: draft.buildingNo.trim(),
      floor: draft.floor.trim(),
      aptFlatUnit: draft.aptFlatUnit.trim(),
      city: draft.city.trim(),
      kahramaaId: draft.kahramaaId.trim(),
      vodafoneId: draft.vodafoneId.trim(),
      addressLine1: draft.addressLine.trim(),
      country: 'Qatar',
      primaryStatus: 'Secondary',
      activeFlag: true,
    };
    // Shown and selectable straight away; persisted best-effort alongside.
    setAddresses((prev) => [...prev, record]);
    void createRecord('addresses', record).catch(() => undefined);
    onChange(record.id);
    setDraft(EMPTY_DRAFT);
    setAdding(false);
  };

  return (
    <div className="space-y-3">
      <LocationInput label="Address" placeholder="Search by zone, street, building, or city…" onSelect={(a) => onChange(a.id)} />

      {accountAddresses.length > 0 && (
        <div className="space-y-2">
          <p className="text-[length:var(--fs-label)] text-fg-2">Addresses on this account</p>
          <div className="grid gap-2">
            {accountAddresses.map((a) => {
              const isSel = a.id === value;
              return (
                <button
                  key={a.id}
                  type="button"
                  aria-pressed={isSel}
                  // Toggle: clicking the chosen address again clears it.
                  onClick={() => (isSel && onClear ? onClear() : onChange(a.id))}
                  className={`text-left rounded-[var(--radius-card)] border p-3 transition-colors ${
                    isSel
                      ? CARD_SELECTED
                      : CARD_IDLE
                  }`}
                >
                  <div className="text-fg">{line(a)}</div>
                  <div className="text-[length:var(--fs-caption)] text-muted">
                    {a.city}
                    {a.primaryStatus ? ` · ${a.primaryStatus}` : ''}
                  </div>
                  {isSel && <AddressDetails address={a} />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Picked via search (not on the account list) or just cleared-to-empty. */}
      {selected && !accountAddresses.some((a) => a.id === selected.id) && (
        <div className="rounded-[var(--radius-card)] border border-[var(--field-card-selected)] bg-[var(--field-card-selected-bg)] shadow-[var(--shadow-selected-ring)] p-3">
          <div className="text-fg">{line(selected)}</div>
          <div className="text-[length:var(--fs-caption)] text-muted">{selected.city}</div>
          <AddressDetails address={selected} />
        </div>
      )}

      <div className="flex items-center gap-3">
        {idNumber && !adding && (
          <Button variant="secondary" compact onClick={() => setAdding(true)}>
            Add new address
          </Button>
        )}
      </div>

      {adding && (
        <div className="card p-4 space-y-3">
          <p className="text-fg font-semibold text-[length:var(--fs-body)]">New address</p>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Zone" placeholder="e.g. Zone 38" value={draft.zone} onChange={(e) => setDraft({ ...draft, zone: e.target.value })} />
            <Input label="Street" placeholder="e.g. Al Corniche Street" value={draft.streetNo} onChange={(e) => setDraft({ ...draft, streetNo: e.target.value })} />
            <Input label="Building" placeholder="e.g. Tower A" value={draft.buildingNo} onChange={(e) => setDraft({ ...draft, buildingNo: e.target.value })} />
            <Input label="Floor" placeholder="e.g. 4th Floor" value={draft.floor} onChange={(e) => setDraft({ ...draft, floor: e.target.value })} />
            <Input label="Unit / Apartment" placeholder="e.g. Apt 4B" value={draft.aptFlatUnit} onChange={(e) => setDraft({ ...draft, aptFlatUnit: e.target.value })} />
            <Input label="Area/City" placeholder="e.g. Doha" value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} />
            <Input label="Kahramaa ID" placeholder="e.g. KID-00123456" value={draft.kahramaaId} onChange={(e) => setDraft({ ...draft, kahramaaId: e.target.value })} />
            <Input label="Vodafone ID" placeholder="e.g. WKR-0231-A" value={draft.vodafoneId} onChange={(e) => setDraft({ ...draft, vodafoneId: e.target.value })} />
            <div className="col-span-2">
              <Input
                label="Address Line"
                placeholder="e.g. Near City Center Mall, opposite Al Rayyan park"
                value={draft.addressLine}
                onChange={(e) => setDraft({ ...draft, addressLine: e.target.value })}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" compact onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button variant="primary" compact disabled={!draftValid} onClick={() => void saveNew()}>
              Save address
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
