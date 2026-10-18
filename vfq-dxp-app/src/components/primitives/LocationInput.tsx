import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from './Icon';
import * as mockDataEngine from '../../engines/mockDataEngine';
import { useSearchListNav } from '../../hooks/useSearchListNav';

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

// Searchable location field per Location-Open.svg - queries the app's real
// seeded `addresses` dataset (zone/street/building/city, the same ZSBU model
// ZsbAddressStep/AddressSelectionStep already use) rather than a fabricated
// landmark/POI list, since no such dataset exists in this project's corpus.
export function LocationInput({ label, error, helperText, placeholder, onSelect, disabled, className = '', id }: LocationInputProps) {
  const autoId = useId();
  const inputId = id ?? `location-${autoId}`;
  const helperId = `${inputId}-helper`;
  const errorId = `${inputId}-error`;
  const describedBy = error ? errorId : helperText ? helperId : undefined;
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

  // Keyboard: Arrow keys move through the addresses, Enter picks the highlighted one, Escape closes the list (text stays).
  const inputRef = useRef<HTMLInputElement>(null);
  const optionPrefix = `${inputId}-opt`;
  const nav = useSearchListNav({
    idPrefix: optionPrefix,
    count: results.length,
    enabled: open && Boolean(q),
    resetKey: `${q}|${results.length}`,
    inputRef,
    onSelect: (i) => pick(results[i]),
    onEscape: () => setOpen(false),
  });
  const listboxId = `${inputId}-listbox`;

  const isFilled = query.trim().length > 0;
  const borderClass = error
    ? 'border-[var(--field-border-error)]'
    : isFilled
      ? 'border-[var(--field-border-filled)] enabled:hover:border-[var(--field-hover-border)]'
      : 'border-[var(--field-border)] enabled:hover:border-[var(--field-hover-border)]';

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className={`text-[length:var(--fs-label)] ${disabled ? 'text-[var(--field-label-disabled)]' : 'text-fg'}`}>
          {label}
        </label>
      )}
      <div ref={containerRef} className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--field-icon)] pointer-events-none">
          <Icon path={SEARCH_ICON} className="w-4 h-4" />
        </span>
        <input
          ref={inputRef}
          {...nav.inputProps}
          id={inputId}
          role="combobox"
          aria-expanded={open && Boolean(q)}
          aria-controls={open && q ? listboxId : undefined}
          aria-autocomplete="list"
          aria-invalid={error ? true : undefined}
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
          className={`w-full rounded-[var(--field-radius)] border pl-10 pr-3 py-2 text-[length:var(--fs-body)] text-[var(--color-field-text-filled)] bg-bg
            focus:outline-none focus-visible:border-[var(--field-focus-border)]! focus-visible:bg-[var(--field-focus-bg)] focus-visible:shadow-[var(--field-focus-ring)]
            disabled:border-[var(--field-border-disabled)] disabled:text-[var(--field-label-disabled)] disabled:bg-[var(--field-bg-disabled)]
            ${borderClass}
            ${className}`}
        />

        {open && q && (
          <ul
            id={listboxId}
            role="listbox"
            aria-label={label ? `${label} suggestions` : 'Address suggestions'}
            className="absolute z-[var(--z-popover)] top-full left-0 right-0 max-h-80 overflow-y-auto rounded-[var(--field-radius)] border border-border-soft bg-bg shadow-raised py-1 divide-y divide-[var(--field-divider)]"
          >
            {results.map((a, i) => (
              <li
                key={a.id}
                id={`${optionPrefix}-${i}`}
                role="option"
                aria-selected={nav.active === i}
                onClick={() => pick(a)}
                className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-surface ${nav.active === i ? 'bg-surface ring-2 ring-inset ring-[var(--focus-outline)]' : ''}`}
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
            {results.length === 0 && <li className="px-4 py-3 text-[length:var(--fs-body)] text-muted">No matching addresses.</li>}
          </ul>
        )}
      </div>
      {helperText && !error && (
        <span id={helperId} className="text-[length:var(--fs-caption)] text-muted">
          {helperText}
        </span>
      )}
      {error && (
        <span id={errorId} role="alert" className="text-[length:var(--fs-caption)] text-[var(--field-border-error)]">
          {error}
        </span>
      )}
    </div>
  );
}
