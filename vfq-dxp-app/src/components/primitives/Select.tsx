import { useEffect, useId, useRef, useState } from 'react';
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
  /** Opens the option list above the field - for a select at the bottom of a panel, where a list below would be cut off. */
  openUp?: boolean;
  /** Gives the option list a tinted surface so it stands apart from a same-coloured panel behind it (a drawer, a modal footer). */
  tintedPanel?: boolean;
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
  openUp = false,
  tintedPanel = false,
}: SelectProps) {
  const autoId = useId();
  const selectId = id ?? `select-${autoId}`;
  const helperId = `${selectId}-helper`;
  const errorId = `${selectId}-error`;
  const listboxId = `${selectId}-listbox`;
  const labelId = `${selectId}-label`;
  const optionId = (i: number) => `${selectId}-opt-${i}`;
  const describedBy = error ? errorId : helperText ? helperId : undefined;
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const typeAhead = useRef({ text: '', at: 0 });

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

  // Keep the highlighted option in view when the list is longer than its box.
  useEffect(() => {
    if (open) document.getElementById(optionId(highlighted))?.scrollIntoView({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, highlighted]);

  const close = (returnFocus: boolean) => {
    setOpen(false);
    setQuery('');
    if (returnFocus) triggerRef.current?.focus();
  };

  const commit = (optionValue: string | undefined) => {
    if (optionValue === undefined) return;
    onChange?.({ target: { value: optionValue } } as ChangeEvent<HTMLSelectElement>);
    close(true);
  };

  const openList = () => {
    setHighlighted(Math.max(0, options.findIndex((o) => o.value === value)));
    setQuery('');
    setOpen(true);
  };

  // Keys shared by the trigger (plain select) and the search box (searchable select): focus never leaves the control that has it;
  // the highlighted option is named through aria-activedescendant.
  const navigate = (e: KeyboardEvent<HTMLElement>): boolean => {
    const last = shown.length - 1;
    switch (e.key) {
      case 'ArrowDown':
        setHighlighted((i) => Math.min(last, i + 1));
        break;
      case 'ArrowUp':
        setHighlighted((i) => Math.max(0, i - 1));
        break;
      case 'Home':
        if (searchable) return false; // the caret moves inside the search box
        setHighlighted(0);
        break;
      case 'End':
        if (searchable) return false;
        setHighlighted(Math.max(0, last));
        break;
      case 'PageDown':
        setHighlighted((i) => Math.min(last, i + 8));
        break;
      case 'PageUp':
        setHighlighted((i) => Math.max(0, i - 8));
        break;
      case 'Enter':
        commit(shown[highlighted]?.value);
        break;
      case 'Escape':
        // Closes the list only - not the dialog the field sits in (Modal/Drawer listen for Escape on the document).
        e.stopPropagation();
        close(true);
        break;
      case 'Tab':
        close(false);
        return false; // let focus move on
      default:
        return false;
    }
    e.preventDefault();
    return true;
  };

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (e.key === ' ') {
      e.preventDefault();
      commit(shown[highlighted]?.value);
      return;
    }
    if (navigate(e)) return;
    // Type-ahead on a plain select: printable keys jump to the next option starting with what was typed.
    if (!searchable && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const now = Date.now();
      const ta = typeAhead.current;
      ta.text = now - ta.at > 700 ? e.key.toLowerCase() : ta.text + e.key.toLowerCase();
      ta.at = now;
      const from = ta.text.length === 1 ? highlighted + 1 : highlighted;
      const hit = [...shown.slice(from), ...shown.slice(0, from)].findIndex((o) => o.label.toLowerCase().startsWith(ta.text));
      if (hit >= 0) setHighlighted((from + hit) % shown.length);
    }
  };

  const triggerClasses = dark
    ? 'border-on-dark-line-2 bg-on-dark-fill-1 text-on-dark focus-visible:border-accent'
    : `${
        error
          ? 'border-[var(--field-border-error)]'
          : selected
            ? 'border-[var(--field-border-filled)] enabled:hover:border-[var(--field-hover-border)]'
            : 'border-[var(--field-border)] enabled:hover:border-[var(--field-hover-border)]'
      } bg-bg text-[var(--color-field-text-filled)] focus-visible:border-[var(--field-focus-border)]! focus-visible:bg-[var(--field-focus-bg)] focus-visible:shadow-[var(--field-focus-ring)]
      disabled:border-[var(--field-border-disabled)] disabled:bg-[var(--field-bg-disabled)]`;
  const panelClasses = dark
    ? 'border-on-dark-line-2 bg-[var(--charcoal-panel)] divide-y divide-on-dark-line-1'
    : tintedPanel
      ? 'border-[var(--field-card-border)] bg-surface divide-y divide-[var(--field-divider)]'
      : 'border-border-soft bg-bg divide-y divide-[var(--field-divider)]';
  const optionClasses = dark ? 'text-on-dark' : 'text-fg-2';

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label id={labelId} htmlFor={selectId} className={`text-[length:var(--fs-label)] ${dark ? 'text-on-dark-2' : disabled ? 'text-[var(--field-label-disabled)]' : 'text-fg'}`}>
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
          ref={triggerRef}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-activedescendant={open && !searchable && shown.length > 0 ? optionId(highlighted) : undefined}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-label={ariaLabel}
          onClick={() => !disabled && (open ? close(false) : openList())}
          onKeyDown={onTriggerKeyDown}
          className={`w-full flex items-center justify-between gap-2 rounded-[var(--field-radius)] ${openUp ? 'focus-visible:rounded-t-none' : 'focus-visible:rounded-b-none'} ${open ? (openUp ? 'rounded-t-none' : 'rounded-b-none') : ''} border pl-3 pr-3 py-2 text-[length:var(--fs-body)] text-left
            disabled:cursor-not-allowed
            focus:outline-none
            ${triggerClasses}
            ${className}`}
        >
          <span className={`truncate ${disabled ? 'text-[var(--field-label-disabled)]' : !selected ? (dark ? 'text-on-dark-4' : 'text-muted') : ''}`}>
            {selected ? selected.label : (placeholder ?? '')}
          </span>
          <Icon
            path={CHEVRON_DOWN}
            className={`w-4 h-4 shrink-0 ${
              dark ? 'text-on-dark-3' : disabled ? 'text-muted' : selected ? 'text-[var(--field-icon-active)]' : 'text-muted'
            }`}
          />
        </button>

        {/* Square on the edge that meets the field, rounded on the far edge, so the panel reads as attached to it (the open or focused trigger squares off its matching edge, and the shared border is drawn once). */}
        {open && (
          <div className={`absolute z-[var(--z-popover)] ${openUp ? 'bottom-full rounded-t-[var(--field-radius)] rounded-b-none border-b-0' : 'top-full rounded-b-[var(--field-radius)] rounded-t-none border-t-0'} left-0 right-0 border shadow-raised overflow-hidden ${panelClasses}`}>
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'Escape' || e.key === 'Tab' || e.key.startsWith('Arrow') || e.key.startsWith('Page')) navigate(e);
                }}
                role="combobox"
                aria-expanded
                aria-controls={listboxId}
                aria-autocomplete="list"
                aria-activedescendant={shown.length > 0 ? optionId(highlighted) : undefined}
                placeholder="Search…"
                aria-label="Search options"
                className="w-full rounded-[var(--field-radius)] border border-[var(--field-border)] bg-bg px-3 py-2 text-[length:var(--fs-body)] text-[var(--color-field-text-filled)] focus:outline-none focus-visible:border-[var(--field-focus-border)]"
              />
            </div>
          )}
          <ul
            id={listboxId}
            role="listbox"
            {...(label ? { 'aria-labelledby': labelId } : { 'aria-label': ariaLabel ?? 'Options' })}
            className="max-h-64 overflow-y-auto py-1"
          >
            {shown.map((opt, i) => (
              <li
                key={opt.value}
                id={optionId(i)}
                role="option"
                aria-selected={opt.value === value}
                onMouseEnter={() => setHighlighted(i)}
                onClick={() => commit(opt.value)}
                className={`px-4 py-3 text-[length:var(--fs-body)] cursor-pointer ${optionClasses} ${
                  i === highlighted ? `${dark ? 'bg-on-dark-fill-2' : tintedPanel ? 'bg-bg' : 'bg-surface'} ring-2 ring-inset ring-[var(--focus-outline)]` : ''
                }`}
              >
                {opt.label}
              </li>
            ))}
          </ul>
          {shown.length === 0 && (
            <p role="status" className="px-4 py-3 text-muted text-[length:var(--fs-body)]">
              No matches
            </p>
          )}
          </div>
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
