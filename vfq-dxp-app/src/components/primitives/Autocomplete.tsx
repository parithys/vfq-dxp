import { useEffect, useRef, useState } from 'react';

interface AutocompleteProps {
  label?: string;
  /** The committed value. This is a FREE-TEXT field with suggestions, not a
   * closed list: the corpus's area data is three records, so restricting entry
   * to it would block every address outside them. */
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  id?: string;
}

// Free-text field with a filtered suggestion list. Distinct from Select (a
// closed set the user must choose from) and from LocationInput (which searches
// whole address RECORDS and returns one). This is the plain case: type, see
// matching strings, optionally pick one.
export function Autocomplete({
  label,
  value,
  onChange,
  options,
  placeholder,
  error,
  helperText,
  required,
  id,
}: AutocompleteProps) {
  const inputId = id ?? `autocomplete-${label?.replace(/\s+/g, '-').toLowerCase()}`;
  const helperId = `${inputId}-helper`;
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const q = value.trim().toLowerCase();
  // An exact match means the user has already chosen; showing a one-item list
  // repeating what is in the box is noise, so the panel closes itself.
  const matches = options.filter((o) => o.toLowerCase().includes(q));
  const results = matches.length === 1 && matches[0].toLowerCase() === q ? [] : matches.slice(0, 8);

  const pick = (option: string) => {
    onChange(option);
    setOpen(false);
    setActiveIndex(-1);
  };

  return (
    <div className="flex flex-col gap-1 relative" ref={containerRef}>
      {label && (
        <label htmlFor={inputId} className="text-[length:var(--fs-label)] text-fg-2">
          {label}
          {required && (
            <span className="text-[var(--field-border-error)]" aria-hidden="true">
              {' *'}
            </span>
          )}
        </label>
      )}
      <input
        id={inputId}
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-autocomplete="list"
        aria-controls={`${inputId}-listbox`}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={helperText && !error ? helperId : undefined}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open || results.length === 0) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((i) => (i + 1) % results.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
          } else if (e.key === 'Enter' && activeIndex >= 0) {
            e.preventDefault();
            pick(results[activeIndex]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        className={`rounded-[var(--field-radius)] border px-3 py-2 text-[length:var(--fs-body)] text-fg bg-bg
          ${error ? 'border-[var(--field-border-error)]' : value ? 'border-[var(--field-border-filled)]' : 'border-[var(--field-border)]'}
          focus:outline-none focus-visible:border-[var(--field-focus-border)]! focus-visible:bg-[var(--field-focus-bg)] focus-visible:shadow-[var(--field-focus-ring)]`}
      />
      {open && results.length > 0 && (
        <ul
          id={`${inputId}-listbox`}
          role="listbox"
          className="absolute top-full left-0 right-0 z-20 mt-1 max-h-56 overflow-y-auto rounded-[var(--radius-card)]
            border border-border-soft bg-bg shadow-[var(--elev-raised)]"
        >
          {results.map((option, i) => (
            <li key={option}>
              <button
                type="button"
                role="option"
                aria-selected={i === activeIndex}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(option)}
                className={`w-full text-left px-3 py-2 text-[length:var(--fs-body)] ${
                  i === activeIndex ? 'bg-[var(--highlight-bg)] text-[var(--deep-red)]' : 'text-fg hover:bg-surface'
                }`}
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error ? (
        <span className="text-[length:var(--fs-caption)] text-[var(--field-border-error)]">{error}</span>
      ) : (
        helperText && (
          <span id={helperId} className="text-[length:var(--fs-caption)] text-muted">
            {helperText}
          </span>
        )
      )}
    </div>
  );
}
