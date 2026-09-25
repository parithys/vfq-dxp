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
}: SelectProps) {
  const selectId = id ?? `select-${label?.replace(/\s+/g, '-').toLowerCase()}`;
  const helperId = `${selectId}-helper`;
  const describedBy = helperText && !error ? helperId : undefined;
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const commit = (optionValue: string) => {
    onChange?.({ target: { value: optionValue } } as ChangeEvent<HTMLSelectElement>);
    setOpen(false);
  };

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!open) {
        setHighlighted(Math.max(0, options.findIndex((o) => o.value === value)));
        setOpen(true);
      } else if (e.key === 'Enter') {
        commit(options[highlighted]?.value);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const onListKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      commit(options[highlighted]?.value);
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
            ? 'border-[var(--field-border-filled)] enabled:hover:border-[var(--field-border-filled)]'
            : 'border-[var(--field-border)] enabled:hover:border-accent/40'
      } bg-bg text-fg focus-visible:border-[var(--field-focus-border)] focus-visible:shadow-[var(--field-focus-ring)]
      disabled:border-[var(--field-border-disabled)]`;
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
          <ul
            role="listbox"
            tabIndex={-1}
            onKeyDown={onListKeyDown}
            ref={(el) => el?.focus()}
            className={`absolute z-50 top-full left-0 right-0 max-h-64 overflow-y-auto rounded-[var(--field-radius)] border shadow-raised py-1 ${panelClasses}`}
          >
            {options.map((opt, i) => (
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
