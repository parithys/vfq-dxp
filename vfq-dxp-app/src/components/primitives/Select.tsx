import type { SelectHTMLAttributes } from 'react';
import { Icon } from './Icon';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

const CHEVRON_DOWN = 'M6 9l6 6 6-6';

// The native <select> arrow's position/spacing is UA-drawn and not
// consistently controllable via padding alone (varies by browser/OS), which
// is exactly what produced the inconsistent text-to-arrow gap this fixes —
// `appearance-none` removes it in favour of one Icon-drawn chevron at a
// fixed offset, so every dropdown in the app renders pixel-identical spacing
// regardless of page, module, or persona.
export function Select({ label, error, options, placeholder, className = '', id, ...rest }: SelectProps) {
  const selectId = id ?? `select-${label?.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={selectId} className="text-[length:var(--fs-label)] text-fg-2">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          className={`w-full appearance-none rounded-[var(--radius-button)] border pl-3 pr-9 py-2 text-[length:var(--fs-body)] text-fg bg-bg
            ${error ? 'border-danger' : 'border-[var(--grey-form)]'}
            focus:outline-none focus-visible:shadow-[var(--focus-ring)]
            ${className}`}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <Icon path={CHEVRON_DOWN} className="w-4 h-4 text-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
      {error && <span className="text-[length:var(--fs-caption)] text-danger">{error}</span>}
    </div>
  );
}
