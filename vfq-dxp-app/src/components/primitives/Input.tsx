import type { InputHTMLAttributes } from 'react';
import { forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  readOnly?: boolean;
}

// Real Vodafone Input per design-system.md §7 (1px charcoal border, 2px radius) —
// the source itself flags this component's spec as inferred, not confirmed.
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, className = '', id, ...rest },
  ref
) {
  const inputId = id ?? `input-${label?.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-[length:var(--fs-label)] text-fg-2">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`rounded-[var(--radius-button)] border px-3 py-2 text-[length:var(--fs-body)] text-fg bg-bg
          ${error ? 'border-danger' : 'border-[var(--grey-form)]'}
          focus:outline-none focus-visible:shadow-[var(--focus-ring)]
          disabled:bg-surface disabled:text-muted
          ${className}`}
        {...rest}
      />
      {error && <span className="text-[length:var(--fs-caption)] text-danger">{error}</span>}
    </div>
  );
});
