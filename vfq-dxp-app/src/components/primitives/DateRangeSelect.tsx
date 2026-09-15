import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { DateRangeCalendar, type DateRangeValue } from './DateRangeCalendar';

export type DatePreset = 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'custom';

export interface DateRangeSelectValue extends DateRangeValue {
  preset?: DatePreset;
}

interface DateRangeSelectProps {
  label?: string;
  error?: string;
  helperText?: string;
  value: DateRangeSelectValue;
  onChange: (value: DateRangeSelectValue) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}

const CALENDAR_ICON = 'M3 6h18v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6z M8 3v4 M16 3v4 M3 10h18';
const CHEVRON_DOWN = 'M6 9l6 6 6-6';
const CHEVRON_UP = 'M18 15l-6-6-6 6';

const PRESET_LABELS: Record<DatePreset, string> = {
  thisWeek: 'This Week',
  lastWeek: 'Last Week',
  thisMonth: 'This Month',
  lastMonth: 'Last Month',
  thisYear: 'This Year',
  custom: 'Date Range',
};

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function rangeForPreset(preset: DatePreset, now: Date): DateRangeValue {
  const day = (now.getDay() + 6) % 7; // 0=Mon
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
  switch (preset) {
    case 'thisWeek':
      return { from: toIso(startOfWeek), to: toIso(new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + 6)) };
    case 'lastWeek': {
      const start = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() - 7);
      return { from: toIso(start), to: toIso(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6)) };
    }
    case 'thisMonth':
      return { from: toIso(new Date(now.getFullYear(), now.getMonth(), 1)), to: toIso(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
    case 'lastMonth':
      return { from: toIso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: toIso(new Date(now.getFullYear(), now.getMonth(), 0)) };
    case 'thisYear':
      return { from: toIso(new Date(now.getFullYear(), 0, 1)), to: toIso(new Date(now.getFullYear(), 11, 31)) };
    case 'custom':
      return {};
  }
}

// Preset date-range dropdown per Date-Open.svg — a plain preset list, except
// the last row ("Date Range") swaps the panel content to the full
// DateRangeCalendar instead of committing immediately, matching
// Date Specific-Open.svg.
export function DateRangeSelect({ label, error, helperText, value, onChange, disabled, className = '', id }: DateRangeSelectProps) {
  const selectId = id ?? `date-range-${label?.replace(/\s+/g, '-').toLowerCase()}`;
  const helperId = `${selectId}-helper`;
  const describedBy = helperText && !error ? helperId : undefined;
  const [open, setOpen] = useState(false);
  const [pickingCustom, setPickingCustom] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setPickingCustom(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const commitPreset = (preset: DatePreset) => {
    if (preset === 'custom') {
      setPickingCustom(true);
      return;
    }
    onChange({ preset, ...rangeForPreset(preset, new Date()) });
    setOpen(false);
  };

  const summary = value.preset && value.preset !== 'custom'
    ? PRESET_LABELS[value.preset]
    : value.from && value.to
      ? `${value.from} to ${value.to}`
      : '';

  const hasValue = Boolean(summary);
  const borderClass = error
    ? 'border-[var(--field-border-error)]'
    : hasValue
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
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-describedby={describedBy}
          onClick={() => !disabled && setOpen((v) => !v)}
          className={`w-full flex items-center gap-2 rounded-[var(--field-radius)] border pl-3 pr-3 py-2 text-[length:var(--fs-body)] text-left
            disabled:cursor-not-allowed
            focus:outline-none focus-visible:border-[var(--field-focus-border)] focus-visible:shadow-[var(--field-focus-ring)]
            bg-bg text-fg disabled:border-[var(--field-border-disabled)]
            ${borderClass}
            ${className}`}
        >
          <Icon path={CALENDAR_ICON} className={`w-4 h-4 shrink-0 ${disabled ? 'text-muted' : 'text-[var(--field-icon)]'}`} />
          <span className={`flex-1 truncate ${disabled ? 'text-[var(--field-label-disabled)]' : !hasValue ? 'text-muted' : ''}`}>
            {hasValue ? summary : 'Select a date range'}
          </span>
          <Icon path={open ? CHEVRON_UP : CHEVRON_DOWN} className={`w-4 h-4 shrink-0 ${disabled ? 'text-muted' : 'text-[var(--field-icon)]'}`} />
        </button>

        {open && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-[var(--radius-card)] border border-border-soft bg-bg shadow-raised overflow-hidden">
            {pickingCustom ? (
              <DateRangeCalendar
                value={value}
                onChange={(range) => {
                  onChange({ preset: 'custom', ...range });
                  if (range.from && range.to) {
                    setOpen(false);
                    setPickingCustom(false);
                  }
                }}
              />
            ) : (
              <ul role="listbox" className="py-1 divide-y divide-[var(--field-divider)]">
                {(Object.keys(PRESET_LABELS) as DatePreset[]).map((preset) => (
                  <li
                    key={preset}
                    role="option"
                    aria-selected={value.preset === preset}
                    onClick={() => commitPreset(preset)}
                    className={`px-3 py-2 text-[length:var(--fs-body)] text-fg cursor-pointer hover:bg-surface ${value.preset === preset ? 'font-medium' : ''}`}
                  >
                    {PRESET_LABELS[preset]}
                  </li>
                ))}
              </ul>
            )}
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
