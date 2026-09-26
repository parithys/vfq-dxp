import type { TextareaHTMLAttributes } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export function Textarea({ label, error, helperText, className = '', id, 'aria-describedby': ariaDescribedby, ...rest }: TextareaProps) {
  const textareaId = id ?? `textarea-${label?.replace(/\s+/g, '-').toLowerCase()}`;
  const helperId = `${textareaId}-helper`;
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
        <label htmlFor={textareaId} className={`text-[length:var(--fs-label)] ${rest.disabled ? 'text-[var(--field-label-disabled)]' : 'text-fg-2'}`}>
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        rows={4}
        aria-describedby={describedBy}
        className={`rounded-[var(--field-radius)] border px-3 py-2 text-[length:var(--fs-body)] text-fg bg-bg
          ${borderClass}
          focus:outline-none focus-visible:border-[var(--field-focus-border)] focus-visible:shadow-[var(--field-focus-ring)]
          disabled:border-[var(--field-border-disabled)] disabled:text-[var(--field-label-disabled)] disabled:bg-[var(--field-bg-disabled)]
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
}
