import type { InputHTMLAttributes } from 'react';
import { forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  readOnly?: boolean;
}

// Field chrome (border/radius/state colors) per the light-mode textbox
// reference supplied 2026-09-15 — see the --field-* tokens in tokens.css.
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, helperText, className = '', id, 'aria-describedby': ariaDescribedby, ...rest },
  ref
) {
  const inputId = id ?? `input-${label?.replace(/\s+/g, '-').toLowerCase()}`;
  const helperId = `${inputId}-helper`;
  const describedBy = [ariaDescribedby, helperText && !error ? helperId : undefined].filter(Boolean).join(' ') || undefined;
  const isFilled = rest.value !== undefined && rest.value !== null && rest.value !== '';
  const borderClass = error
    ? 'border-[var(--field-border-error)]'
    : isFilled
      ? 'border-[var(--field-border-filled)] enabled:hover:border-[var(--field-border-filled)]'
      : 'border-[var(--field-border)] enabled:hover:border-accent/40';
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className={`text-[length:var(--fs-label)] ${rest.disabled ? 'text-[var(--field-label-disabled)]' : 'text-fg-2'}`}>
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-describedby={describedBy}
        className={`rounded-[var(--field-radius)] border px-3 py-2 text-[length:var(--fs-body)] text-fg bg-bg
          ${borderClass}
          focus:outline-none focus-visible:border-accent focus-visible:shadow-[var(--focus-ring)]
          disabled:border-[var(--field-border-disabled)] disabled:text-[var(--field-label-disabled)]
          ${className}`}
        {...rest}
      />
      {helperText && !error && (
        <span id={helperId} className="text-[length:var(--fs-caption)] text-muted">
          {helperText}
        </span>
      )}
      {error && <span className="text-[length:var(--fs-caption)] text-[var(--field-border-error)]">{error}</span>}
    </div>
  );
});
