import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import * as mockDataEngine from '../../engines/mockDataEngine';

export interface AddressRecord {
  id: string;
  zone: string;
  streetNo: string;
  buildingNo: string;
  aptFlatUnit: string;
  city: string;
}

interface LocationInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  placeholder?: string;
  onSelect: (address: AddressRecord) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}

const PIN_ICON = 'M12 21s-7-7.5-7-12a7 7 0 0 1 14 0c0 4.5-7 12-7 12z M12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z';
const SEARCH_ICON = 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.3-4.3';

function title(a: AddressRecord): string {
  return `Zone ${a.zone}, Street ${a.streetNo}`;
}
function subtitle(a: AddressRecord): string {
  return `Building ${a.buildingNo}, ${a.aptFlatUnit}, ${a.city}`;
}

// Searchable location field per Location-Open.svg — queries the app's real
// seeded `addresses` dataset (zone/street/building/city, the same ZSBU model
// ZsbAddressStep/AddressSelectionStep already use) rather than a fabricated
// landmark/POI list, since no such dataset exists in this project's corpus.
export function LocationInput({ label, error, helperText, placeholder, onSelect, disabled, className = '', id }: LocationInputProps) {
  const inputId = id ?? `location-${label?.replace(/\s+/g, '-').toLowerCase()}`;
  const helperId = `${inputId}-helper`;
  const describedBy = helperText && !error ? helperId : undefined;
  const [addresses, setAddresses] = useState<AddressRecord[]>([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mockDataEngine.list<AddressRecord>('addresses').then(setAddresses);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const q = query.trim().toLowerCase();
  const results = q
    ? addresses.filter((a) => title(a).toLowerCase().includes(q) || subtitle(a).toLowerCase().includes(q)).slice(0, 8)
    : [];

  const pick = (a: AddressRecord) => {
    onSelect(a);
    setQuery(title(a));
    setOpen(false);
  };

  const isFilled = query.trim().length > 0;
  const borderClass = error
    ? 'border-[var(--field-border-error)]'
    : isFilled
      ? 'border-[var(--field-border-filled)] enabled:hover:border-[var(--field-border-filled)]'
      : 'border-[var(--field-border)] enabled:hover:border-accent/40';

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className={`text-[length:var(--fs-label)] ${disabled ? 'text-[var(--field-label-disabled)]' : 'text-fg-2'}`}>
          {label}
        </label>
      )}
      <div ref={containerRef} className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--field-icon)] pointer-events-none">
          <Icon path={SEARCH_ICON} className="w-4 h-4" />
        </span>
        <input
          id={inputId}
          disabled={disabled}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          aria-describedby={describedBy}
          autoComplete="off"
          className={`w-full rounded-[var(--field-radius)] border pl-10 pr-3 py-2 text-[length:var(--fs-body)] text-fg bg-bg
            focus:outline-none focus-visible:border-[var(--field-focus-border)] focus-visible:shadow-[var(--field-focus-ring)]
            disabled:border-[var(--field-border-disabled)] disabled:text-[var(--field-label-disabled)]
            ${borderClass}
            ${className}`}
        />

        {open && q && (
          <ul
            role="listbox"
            className="absolute z-50 top-full left-0 right-0 mt-1 max-h-80 overflow-y-auto rounded-[var(--radius-card)] border border-border-soft bg-bg shadow-raised py-1 divide-y divide-[var(--field-divider)]"
          >
            {results.map((a) => (
              <li
                key={a.id}
                role="option"
                onClick={() => pick(a)}
                className="flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-surface"
              >
                <span className="mt-0.5 text-[var(--field-pin)] shrink-0">
                  <Icon path={PIN_ICON} className="w-5 h-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[length:var(--fs-body)] font-semibold text-fg truncate">{title(a)}</span>
                  <span className="block text-[length:var(--fs-caption)] text-muted truncate">{subtitle(a)}</span>
                </span>
              </li>
            ))}
            {results.length === 0 && <li className="px-3 py-3 text-[length:var(--fs-body)] text-muted">No matching addresses.</li>}
          </ul>
        )}
      </div>
      {helperText && !error && (
        <span id={helperId} className="text-[length:var(--fs-caption)] text-muted">
          {helperText}
        </span>
      )}
      {error && <span className="text-[length:var(--fs-caption)] text-[var(--field-border-error)]">{error}</span>}
    </div>
  );
}
