import { useEffect, useState } from 'react';
import { Input } from '../primitives/Input';
import { Button } from '../primitives/Button';
import { Badge } from '../primitives/Badge';
import * as mockDataEngine from '../../engines/mockDataEngine';

interface MsisdnRecord {
  msisdn: string;
  category: string;
  status: string;
  priceQAR: number;
  valueTier?: string;
  /** Who holds the reservation, on a Reserved record. */
  reservedBy?: string;
}

/**
 * The three tabs, which do NOT all filter on the same axis - and that is the
 * point rather than an inconsistency.
 *
 * 'Free' and 'Star' are CATEGORIES (pricing tiers) and each shows only its
 * AVAILABLE numbers. 'Reserved' is a STATUS and cuts across both categories,
 * so a reserved Star number appears there rather than falling out of the UI
 * entirely - which is what happened when Reserved numbers were simply hidden.
 */
type NumberTab = 'Free' | 'Star' | 'Reserved';

const TAB_LABELS: Record<NumberTab, string> = {
  Free: 'Free Number',
  Star: 'Star Number (Premium)',
  Reserved: 'Reserved Numbers',
};

interface MsisdnPickerProps {
  selected?: string;
  onSelect: (msisdn: string, priceQAR: number) => void;
}

// A full Qatar MSISDN: +974 followed by an 8-digit local number starting
// 3/5/6/7 (same shape as every seeded numbers.json record and the same
// leading-digit rule GuidedContactStep's isValidAltPhone uses for a Qatar
// local number) - stricter than that general validator since a number
// being reserved here must be a complete, dialable MSISDN, not any
// alternate-contact phone shape.
function isValidMsisdn(raw: string): boolean {
  return /^\+974[3567]\d{7}$/.test(raw.replace(/[\s-]/g, ''));
}

// Pattern 10: Number Selection / Reservation Step - 8-digit search box + Free/Reserved
// toggle, matching MSISDNs shown as selectable priced tiles; selecting triggers
// immediate reservation with a confirmation token (SCR-024/048/082/104/157/191).
export function MsisdnPicker({ selected, onSelect }: MsisdnPickerProps) {
  const [numbers, setNumbers] = useState<MsisdnRecord[]>([]);
  const [tab, setTab] = useState<NumberTab>('Free');
  const [search, setSearch] = useState('');
  const [customMsisdn, setCustomMsisdn] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);

  useEffect(() => {
    mockDataEngine.list<MsisdnRecord>('numbers').then(setNumbers);
  }, []);

  const reserveCustom = () => {
    if (!isValidMsisdn(customMsisdn)) {
      setCustomError('Enter a full international format MSISDN (e.g. +974 3300 1234).');
      return;
    }
    const normalized = customMsisdn.replace(/[\s-]/g, '');
    const existing = numbers.find((n) => n.msisdn === normalized);
    if (existing && existing.status !== 'AVAILABLE') {
      setCustomError(`${normalized} is already ${existing.status.toLowerCase()} - choose a different number.`);
      return;
    }
    setCustomError(null);
    onSelect(normalized, existing?.priceQAR ?? 0);
  };

  // Category (Free vs Star/premium) and status (AVAILABLE/Reserved/BLOCKED)
  // are independent axes: the tab filters on CATEGORY, the availability check
  // on STATUS.
  //
  // Only AVAILABLE numbers are listed as of 2026-09-25. Reserved and BLOCKED
  // ones used to render greyed and unclickable, which filled the grid with
  // rows the agent could not act on - and with 18 free numbers now seeded,
  // dead cards push the selectable ones further from the top.
  //
  // They are NOT forgotten: reserveCustom below still rejects a Reserved or
  // BLOCKED number typed into Manual MSISDN Entry by name, so the inventory
  // is still enforced where an agent could otherwise ask for one.
  const filtered = numbers.filter((n) => {
    const matchesTab = tab === 'Reserved' ? n.status === 'Reserved' : n.category === tab && n.status === 'AVAILABLE';
    const matchesSearch = search ? n.msisdn.includes(search) : true;
    return matchesTab && matchesSearch;
  });

  return (
    <div className="space-y-3">
      <div className="flex gap-1 border-b border-border-soft">
        {(['Free', 'Star', 'Reserved'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-[length:var(--fs-body)] border-b-2 -mb-px ${
              tab === t ? 'border-accent text-accent font-medium' : 'border-transparent text-fg-2'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>
      <Input aria-label="Search 8-digit number" placeholder="Search 8-digit number" value={search} onChange={(e) => setSearch(e.target.value)} />
      {/* Capped and scrollable as of 2026-09-25, when the Free inventory went
          from 2 numbers to 18. Seven rows of cards pushed Continue below the
          fold on every visit; the search box above narrows the list for an
          agent who knows what they want, and this keeps the step navigable for
          one who is browsing. */}
      {/* ONE COLUMN on the Reserved tab, three on the others.
          Reserved is inherently a short list - it holds only the numbers an
          agent has already put aside - so a three-across grid left a single
          card stranded beside two thirds of empty row. It also carries an
          extra fact per row (who holds it), which reads better across a full
          width than wrapped inside a third of one. */}
      <div
        className={`grid gap-3 max-h-[22rem] overflow-y-auto pr-1 ${
          tab === 'Reserved' ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3'
        }`}
      >
        {filtered.map((n) => {
          const isSelected = selected === n.msisdn;
          // No disabled state: everything listed is selectable. An AVAILABLE
          // number can be taken, and a Reserved one is a held number the
          // agent is deliberately looking at in order to use it.
          //
          // No status badge on the Free/Star tabs either - the filter makes it
          // constant there, so it could only print the same word. On the
          // Reserved tab it says who holds the number, which is the one thing
          // that distinguishes those rows from each other.
          return (
            <button
              key={n.msisdn}
              onClick={() => onSelect(n.msisdn, n.priceQAR)}
              className={`text-left rounded-[var(--radius-card)] border p-3
                ${isSelected ? 'border-[var(--field-card-selected)] bg-[var(--field-card-selected-bg)]' : 'border-border-soft bg-bg hover:border-[var(--field-card-selected)]'}`}
            >
              {/* A full-width row puts the number and its detail side by side;
                  a grid tile stacks them. Same data either way. */}
              <div
                className={
                  tab === 'Reserved' ? 'flex items-center justify-between gap-4' : 'flex flex-col'
                }
              >
                <span className="text-fg font-medium">{n.msisdn}</span>
                <span
                  className={`text-[length:var(--fs-caption)] text-muted flex items-center gap-2 ${
                    tab === 'Reserved' ? '' : 'mt-1'
                  }`}
                >
                  QR {n.priceQAR}
                  {n.valueTier && <Badge variant="outlined-red">{n.valueTier}</Badge>}
                  {tab === 'Reserved' && (
                    <Badge variant="filled-neutral">{n.reservedBy ? `Held by ${n.reservedBy}` : 'Reserved'}</Badge>
                  )}
                </span>
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-muted text-[length:var(--fs-body)] col-span-full">
            {tab === 'Reserved'
              ? search
                ? 'No reserved numbers match that search.'
                : 'No reserved numbers.'
              : search
                ? 'No available numbers match that search.'
                : 'No available numbers in this category.'}
          </p>
        )}
      </div>
      {selected && (
        <p className="text-success text-[length:var(--fs-caption)]">
          SUCCESS: Reservation Token: SBL-EXL-{selected.slice(-5)}
        </p>
      )}

      <div className="rounded-[var(--radius-card)] border border-border-soft bg-surface p-4 space-y-2">
        <h4 className="text-fg font-semibold">Manual MSISDN Entry</h4>
        <Input
          label="Custom MSISDN"
          placeholder="+974 XXXX XXXX"
          value={customMsisdn}
          onChange={(e) => {
            setCustomMsisdn(e.target.value);
            setCustomError(null);
          }}
          error={customError ?? undefined}
          helperText="Enter a full international format MSISDN"
        />
        <Button variant="primary-rect" className="w-full" disabled={!isValidMsisdn(customMsisdn)} onClick={reserveCustom}>
          Reserve Custom Number
        </Button>
      </div>
    </div>
  );
}
