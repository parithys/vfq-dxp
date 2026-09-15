import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Icon } from './Icon';

interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  label?: string;
  error?: string;
  helperText?: string;
  options: MultiSelectOption[];
  placeholder?: string;
  values: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  'aria-label'?: string;
}

const CHEVRON_DOWN = 'M6 9l6 6 6-6';
const CHECK = 'M20 6L9 17l-5-5';

// Multi-select checklist dropdown per Checkbox-Open.svg — same custom-listbox
// mechanism as Select.tsx (absolutely positioned panel under the trigger, not
// a native element) but each row toggles independently instead of closing the
// panel on selection, and the trigger summarizes the current selection.
export function MultiSelect({
  label,
  error,
  helperText,
  options,
  placeholder,
  values,
  onChange,
  disabled,
  className = '',
  id,
  'aria-label': ariaLabel,
}: MultiSelectProps) {
  const selectId = id ?? `multiselect-${label?.replace(/\s+/g, '-').toLowerCase()}`;
  const helperId = `${selectId}-helper`;
  const describedBy = helperText && !error ? helperId : undefined;
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedLabels = options.filter((o) => values.includes(o.value)).map((o) => o.label);
  const summary = selectedLabels.length === 0 ? '' : selectedLabels.length === 1 ? selectedLabels[0] : `${selectedLabels[0]} +${selectedLabels.length - 1} more`;

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const toggle = (optionValue: string) => {
    onChange(values.includes(optionValue) ? values.filter((v) => v !== optionValue) : [...values, optionValue]);
  };

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!open) setOpen(true);
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
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle(options[highlighted]?.value);
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      setOpen(false);
    }
  };

  const hasSelection = values.length > 0;
  const triggerBorderClass = error
    ? 'border-[var(--field-border-error)]'
    : hasSelection
      ? 'border-[var(--field-border-filled)] enabled:hover:border-[var(--field-border-filled)]'
      : 'border-[var(--field-border)] enabled:hover:border-accent/40';

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={selectId} className={`text-[length:var(--fs-label)] ${disabled ? 'text-[var(--field-label-disabled)]' : 'text-fg-2'}`}>
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
          aria-label={ariaLabel}
          onClick={() => !disabled && setOpen((v) => !v)}
          onKeyDown={onTriggerKeyDown}
          className={`w-full flex items-center justify-between gap-2 rounded-[var(--field-radius)] border pl-3 pr-3 py-2 text-[length:var(--fs-body)] text-left
            disabled:cursor-not-allowed
            focus:outline-none focus-visible:border-[var(--field-focus-border)] focus-visible:shadow-[var(--field-focus-ring)]
            bg-bg text-fg disabled:border-[var(--field-border-disabled)]
            ${triggerBorderClass}
            ${className}`}
        >
          <span className={`truncate ${disabled ? 'text-[var(--field-label-disabled)]' : !hasSelection ? 'text-muted' : ''}`}>
            {hasSelection ? summary : (placeholder ?? '')}
          </span>
          <Icon
            path={CHEVRON_DOWN}
            className={`w-4 h-4 shrink-0 ${disabled ? 'text-muted' : hasSelection ? 'text-[var(--field-icon-active)]' : 'text-muted'}`}
          />
        </button>

        {open && (
          <ul
            role="listbox"
            aria-multiselectable="true"
            tabIndex={-1}
            onKeyDown={onListKeyDown}
            ref={(el) => el?.focus()}
            className="absolute z-50 top-full left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-[var(--radius-card)] border border-border-soft bg-bg shadow-raised py-1 divide-y divide-[var(--field-divider)]"
          >
            {options.map((opt, i) => {
              const checked = values.includes(opt.value);
              return (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={checked}
                  onMouseEnter={() => setHighlighted(i)}
                  onClick={() => toggle(opt.value)}
                  className={`flex items-center justify-between gap-3 px-3 py-2 text-[length:var(--fs-body)] text-fg cursor-pointer ${i === highlighted ? 'bg-surface' : ''}`}
                >
                  <span className="truncate">{opt.label}</span>
                  <span
                    className={`shrink-0 w-[19px] h-[19px] rounded-[2.5px] border flex items-center justify-center ${
                      checked ? 'border-[var(--field-selected)] bg-[var(--field-selected)]' : 'border-[var(--field-border)] bg-bg'
                    }`}
                  >
                    {checked && <Icon path={CHECK} className="w-3 h-3 text-white" />}
                  </span>
                </li>
              );
            })}
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
