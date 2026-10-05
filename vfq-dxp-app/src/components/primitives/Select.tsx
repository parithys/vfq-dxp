import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { Icon } from './Icon';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  error?: string;
  helperText?: string;
  options: SelectOption[];
  placeholder?: string;
  value?: string;
  onChange?: (e: ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  /** Required marker + aria-required, mirroring Input's prop of the same name. */
  required?: boolean;
  className?: string;
  id?: string;
  /** Dark-panel styling for the login page (Role field) - same mechanism, different trigger/panel skin. */
  dark?: boolean;
  /** For call sites with no visible `label` (e.g. a dense table-cell filter) -
   * gives the trigger an accessible name without rendering visible text. */
  'aria-label'?: string;
  /** Adds a search box at the top of the dropdown that filters the options as the user types. */
  searchable?: boolean;
}

const CHEVRON_DOWN = 'M6 9l6 6 6-6';

// A custom-positioned listbox, not a native <select>. Native <select> option
// popups are rendered by the browser/OS and their placement relative to the
// trigger can't be controlled via CSS - that's what produced the
// inconsistent gap this replaces. This panel is a normal absolutely
// positioned DOM node (`top-full` + a small `mt-1`), so it opens directly
// under the trigger's bottom edge identically everywhere the component is
// used. `onChange` synthesizes a minimal `{ target: { value } }` event -
// every call site in the app only ever reads `e.target.value`, so this is a
// drop-in replacement with no caller changes required.
export function Select({
  label,
  error,
  helperText,
  options,
  placeholder,
  value,
  onChange,
  disabled,
  required,
  className = '',
  id,
  dark = false,
  'aria-label': ariaLabel,
  searchable = false,
}: SelectProps) {
  const selectId = id ?? `select-${label?.replace(/\s+/g, '-').toLowerCase()}`;
  const helperId = `${selectId}-helper`;
  const describedBy = helperText && !error ? helperId : undefined;
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  // Options shown in the open panel: filtered by the search box when searchable.
  const shown = searchable && query.trim() ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase())) : options;

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const commit = (optionValue: string) => {
    if (optionValue === undefined) return;
    onChange?.({ target: { value: optionValue } } as ChangeEvent<HTMLSelectElement>);
    setOpen(false);
    setQuery('');
  };

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!open) {
        setHighlighted(Math.max(0, options.findIndex((o) => o.value === value)));
        setQuery('');
        setOpen(true);
      } else if (e.key === 'Enter') {
        commit(shown[highlighted]?.value);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const onListKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((i) => Math.min(shown.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      commit(shown[highlighted]?.value);
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      setOpen(false);
    }
  };

  const triggerClasses = dark
    ? 'border-white/15 bg-white/5 text-white focus-visible:border-accent'
    : `${
        error
          ? 'border-[var(--field-border-error)]'
          : selected
            ? 'border-[var(--field-border-filled)] enabled:hover:border-[var(--field-hover-border)]'
            : 'border-[var(--field-border)] enabled:hover:border-[var(--field-hover-border)]'
      } bg-bg text-[var(--color-field-text-filled)] focus-visible:border-[var(--field-focus-border)]! focus-visible:bg-[var(--field-focus-bg)] focus-visible:shadow-[var(--field-focus-ring)]
      disabled:border-[var(--field-border-disabled)] disabled:bg-[var(--field-bg-disabled)]`;
  const panelClasses = dark
    ? 'border-white/15 bg-[var(--charcoal-panel)] divide-y divide-white/10'
    : 'border-border-soft bg-bg divide-y divide-[var(--field-divider)]';
  const optionClasses = dark ? 'text-white' : 'text-fg-2';

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={selectId} className={`text-[length:var(--fs-label)] ${dark ? 'text-white/70' : disabled ? 'text-[var(--field-label-disabled)]' : 'text-fg-2'}`}>
          {label}
          {/* Same treatment as Input's required marker - aria-hidden, with the
              state carried by aria-required on the combobox below. */}
          {required && (
            <span className="text-[var(--field-border-error)]" aria-hidden="true">
              {' *'}
            </span>
          )}
        </label>
      )}
      <div ref={containerRef} className="relative">
        <button
          type="button"
          id={selectId}
          disabled={disabled}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-required={required || undefined}
          aria-describedby={describedBy}
          aria-label={ariaLabel}
          onClick={() => !disabled && setOpen((v) => !v)}
          onKeyDown={onTriggerKeyDown}
          className={`w-full flex items-center justify-between gap-2 rounded-[var(--field-radius)] border pl-3 pr-3 py-2 text-[length:var(--fs-body)] text-left
            disabled:cursor-not-allowed
            focus:outline-none
            ${triggerClasses}
            ${className}`}
        >
          <span className={`truncate ${disabled ? 'text-[var(--field-label-disabled)]' : !selected ? (dark ? 'text-white/35' : 'text-muted') : ''}`}>
            {selected ? selected.label : (placeholder ?? '')}
          </span>
          <Icon
            path={CHEVRON_DOWN}
            className={`w-4 h-4 shrink-0 ${
              dark ? 'text-white/50' : disabled ? 'text-muted' : selected ? 'text-[var(--field-icon-active)]' : 'text-muted'
            }`}
          />
        </button>

        {open && (
          <div className={`absolute z-50 top-full left-0 right-0 rounded-[var(--field-radius)] border shadow-raised overflow-hidden ${panelClasses}`}>
          {searchable && (
            <div className="p-2 border-b border-border-soft">
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setHighlighted(0);
                }}
                onKeyDown={onListKeyDown as unknown as (e: KeyboardEvent<HTMLInputElement>) => void}
                placeholder="Search…"
                aria-label="Search options"
                className="w-full rounded-[var(--field-radius)] border border-[var(--field-border)] bg-bg px-3 py-2 text-[length:var(--fs-body)] text-[var(--color-field-text-filled)] focus:outline-none focus-visible:border-[var(--field-focus-border)]"
              />
            </div>
          )}
          <ul
            role="listbox"
            tabIndex={-1}
            onKeyDown={onListKeyDown}
            ref={(el) => {
              if (!searchable) el?.focus();
            }}
            className="max-h-64 overflow-y-auto py-1"
          >
            {shown.length === 0 && <li className="px-4 py-3 text-muted text-[length:var(--fs-body)]">No matches</li>}
            {shown.map((opt, i) => (
              <li
                key={opt.value}
                role="option"
                aria-selected={opt.value === value}
                onMouseEnter={() => setHighlighted(i)}
                onClick={() => commit(opt.value)}
                className={`px-4 py-3 text-[length:var(--fs-body)] cursor-pointer ${optionClasses} ${
                  i === highlighted ? (dark ? 'bg-white/10' : 'bg-surface') : ''
                }`}
              >
                {opt.label}
              </li>
            ))}
          </ul>
          </div>
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
