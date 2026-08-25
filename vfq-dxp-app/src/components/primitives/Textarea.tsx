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
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={textareaId} className="text-[length:var(--fs-label)] text-fg-2">
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        rows={4}
        aria-describedby={describedBy}
        className={`rounded-[var(--radius-button)] border px-3 py-2 text-[length:var(--fs-body)] text-fg bg-bg
          ${error ? 'border-danger' : 'border-[var(--grey-form)]'}
          focus:outline-none focus-visible:shadow-[var(--focus-ring)]
          ${className}`}
        {...rest}
      />
      {helperText && !error && (
        <span id={helperId} className="text-[length:var(--fs-caption)] text-muted">
          {helperText}
        </span>
      )}
      {error && <span className="text-[length:var(--fs-caption)] text-danger">{error}</span>}
    </div>
  );
}
