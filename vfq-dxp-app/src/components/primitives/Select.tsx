import type { SelectHTMLAttributes } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export function Select({ label, error, options, placeholder, className = '', id, ...rest }: SelectProps) {
  const selectId = id ?? `select-${label?.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={selectId} className="text-[length:var(--fs-label)] text-fg-2">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`rounded-[var(--radius-button)] border px-3 py-2 text-[length:var(--fs-body)] text-fg bg-bg
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
      {error && <span className="text-[length:var(--fs-caption)] text-danger">{error}</span>}
    </div>
  );
}
