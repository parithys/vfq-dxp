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
}

interface MsisdnPickerProps {
  selected?: string;
  onSelect: (msisdn: string, priceQAR: number) => void;
}

// A full Qatar MSISDN: +974 followed by an 8-digit local number starting
// 3/5/6/7 (same shape as every seeded numbers.json record and the same
// leading-digit rule GuidedContactStep's isValidAltPhone uses for a Qatar
// local number) — stricter than that general validator since a number
// being reserved here must be a complete, dialable MSISDN, not any
// alternate-contact phone shape.
function isValidMsisdn(raw: string): boolean {
  return /^\+974[3567]\d{7}$/.test(raw.replace(/[\s-]/g, ''));
}

// Pattern 10: Number Selection / Reservation Step — 8-digit search box + Free/Reserved
// toggle, matching MSISDNs shown as selectable priced tiles; selecting triggers
// immediate reservation with a confirmation token (SCR-024/048/082/104/157/191).
export function MsisdnPicker({ selected, onSelect }: MsisdnPickerProps) {
  const [numbers, setNumbers] = useState<MsisdnRecord[]>([]);
  const [tab, setTab] = useState<'Free' | 'Star'>('Free');
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
      setCustomError(`${normalized} is already ${existing.status.toLowerCase()} — choose a different number.`);
      return;
    }
    setCustomError(null);
    onSelect(normalized, existing?.priceQAR ?? 0);
  };

  // Category (Free vs Star/premium) and status (AVAILABLE/Reserved/BLOCKED)
  // are independent axes — tabs must filter on category so a Star number
  // that happens to be AVAILABLE rather than Reserved still surfaces
  // somewhere selectable, instead of falling into neither tab.
  const filtered = numbers.filter((n) => {
    const matchesTab = n.category === tab;
    const matchesSearch = search ? n.msisdn.includes(search) : true;
    return matchesTab && matchesSearch;
  });

  return (
    <div className="space-y-3">
      <div className="flex gap-1 border-b border-border-soft">
        {(['Free', 'Star'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-[length:var(--fs-body)] border-b-2 -mb-px ${
              tab === t ? 'border-accent text-accent font-medium' : 'border-transparent text-fg-2'
            }`}
          >
            {t === 'Star' ? 'Star Number (Premium)' : 'Free Number'}
          </button>
        ))}
      </div>
      <Input aria-label="Search 8-digit number" placeholder="Search 8-digit number" value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {filtered.map((n) => {
          const isSelected = selected === n.msisdn;
          const available = n.status === 'AVAILABLE' || n.status === 'Reserved';
          return (
            <button
              key={n.msisdn}
              disabled={!available}
              onClick={() => onSelect(n.msisdn, n.priceQAR)}
              className={`text-left rounded-[var(--radius-card)] border p-3 disabled:opacity-40 disabled:cursor-not-allowed
                ${isSelected ? 'border-[var(--field-selected)] bg-surface-warm' : 'border-border-soft bg-bg enabled:hover:border-[var(--field-selected)]'}`}
            >
              <div className="text-fg font-medium">{n.msisdn}</div>
              <div className="text-[length:var(--fs-caption)] text-muted flex items-center gap-2 mt-1">
                QR {n.priceQAR}
                {n.valueTier && <Badge variant="outlined-red">{n.valueTier}</Badge>}
                <Badge variant={n.status === 'BLOCKED' ? 'danger' : 'filled-neutral'}>{n.status}</Badge>
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && <p className="text-muted text-[length:var(--fs-body)] col-span-full">No matching numbers.</p>}
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
