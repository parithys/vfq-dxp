import { useEffect, useState } from 'react';
import { Input } from '../primitives/Input';
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

// Pattern 10: Number Selection / Reservation Step — 8-digit search box + Free/Reserved
// toggle, matching MSISDNs shown as selectable priced tiles; selecting triggers
// immediate reservation with a confirmation token (SCR-024/048/082/104/157/191).
export function MsisdnPicker({ selected, onSelect }: MsisdnPickerProps) {
  const [numbers, setNumbers] = useState<MsisdnRecord[]>([]);
  const [tab, setTab] = useState<'Free' | 'Reserved'>('Free');
  const [search, setSearch] = useState('');

  useEffect(() => {
    mockDataEngine.list<MsisdnRecord>('numbers').then(setNumbers);
  }, []);

  const filtered = numbers.filter((n) => {
    const matchesTab = tab === 'Free' ? n.category === 'Free' : n.status === 'Reserved';
    const matchesSearch = search ? n.msisdn.includes(search) : true;
    return matchesTab && matchesSearch;
  });

  return (
    <div className="space-y-3">
      <div className="flex gap-1 border-b border-border-soft">
        {(['Free', 'Reserved'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-[length:var(--fs-body)] border-b-2 -mb-px ${
              tab === t ? 'border-accent text-accent font-medium' : 'border-transparent text-fg-2'
            }`}
          >
            {t} Number
          </button>
        ))}
      </div>
      <Input placeholder="Search 8-digit number" value={search} onChange={(e) => setSearch(e.target.value)} />
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
                ${isSelected ? 'border-accent bg-surface-warm' : 'border-border-soft enabled:hover:border-accent'}`}
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
    </div>
  );
}
