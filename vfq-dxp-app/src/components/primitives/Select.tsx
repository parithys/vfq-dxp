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
  className?: string;
  id?: string;
  /** Dark-panel styling for the login page (Role field) — same mechanism, different trigger/panel skin. */
  dark?: boolean;
}

const CHEVRON_DOWN = 'M6 9l6 6 6-6';

// A custom-positioned listbox, not a native <select>. Native <select> option
// popups are rendered by the browser/OS and their placement relative to the
// trigger can't be controlled via CSS — that's what produced the
// inconsistent gap this replaces. This panel is a normal absolutely
// positioned DOM node (`top-full` + a small `mt-1`), so it opens directly
// under the trigger's bottom edge identically everywhere the component is
// used. `onChange` synthesizes a minimal `{ target: { value } }` event —
// every call site in the app only ever reads `e.target.value`, so this is a
// drop-in replacement with no caller changes required.
export function Select({ label, error, helperText, options, placeholder, value, onChange, disabled, className = '', id, dark = false }: SelectProps) {
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
    : `${error ? 'border-danger' : 'border-[var(--grey-form)]'} bg-bg text-fg focus-visible:shadow-[var(--focus-ring)]`;
  const panelClasses = dark
    ? 'border-white/15 bg-[var(--charcoal-panel)] divide-y divide-white/10'
    : 'border-border-soft bg-bg divide-y divide-border-soft';
  const optionClasses = dark ? 'text-white' : 'text-fg';

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={selectId} className={`text-[length:var(--fs-label)] ${dark ? 'text-white/70' : 'text-fg-2'}`}>
          {label}
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
          aria-describedby={describedBy}
          onClick={() => !disabled && setOpen((v) => !v)}
          onKeyDown={onTriggerKeyDown}
          className={`w-full flex items-center justify-between gap-2 rounded-[var(--radius-button)] border pl-3 pr-3 py-2 text-[length:var(--fs-body)] text-left
            disabled:opacity-40 disabled:cursor-not-allowed
            focus:outline-none
            ${triggerClasses}
            ${className}`}
        >
          <span className={`truncate ${!selected ? (dark ? 'text-white/35' : 'text-muted') : ''}`}>
            {selected ? selected.label : (placeholder ?? '')}
          </span>
          <Icon path={CHEVRON_DOWN} className={`w-4 h-4 shrink-0 ${dark ? 'text-white/50' : 'text-muted'}`} />
        </button>

        {open && (
          <ul
            role="listbox"
            tabIndex={-1}
            onKeyDown={onListKeyDown}
            ref={(el) => el?.focus()}
            className={`absolute z-50 top-full left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-[var(--radius-button)] border shadow-raised py-1 ${panelClasses}`}
          >
            {options.map((opt, i) => (
              <li
                key={opt.value}
                role="option"
                aria-selected={opt.value === value}
                onMouseEnter={() => setHighlighted(i)}
                onClick={() => commit(opt.value)}
                className={`px-3 py-2 text-[length:var(--fs-body)] cursor-pointer ${optionClasses} ${
                  i === highlighted ? (dark ? 'bg-white/10' : 'bg-surface') : ''
                } ${opt.value === value ? 'font-medium' : ''}`}
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
      {error && <span className="text-[length:var(--fs-caption)] text-danger">{error}</span>}
    </div>
  );
}
