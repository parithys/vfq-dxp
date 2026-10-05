import { forwardRef } from 'react';
import type { InputHTMLAttributes, ReactNode, Ref } from 'react';
import { Icon } from './Icon';

const SEARCH_ICON = 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.3-4.3';
const CLEAR_ICON = 'M18 6L6 18 M6 6l12 12';

interface SearchFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Shows a clear (x) button while there is text. */
  onClear?: () => void;
  /** Classes for the wrapper (width, margin). The field itself is never restyled per page. */
  wrapperClassName?: string;
  wrapperRef?: Ref<HTMLDivElement>;
  /** Anything that hangs off the field, e.g. a results dropdown positioned against the wrapper. */
  children?: ReactNode;
}

/**
 * The one search / lookup text field, taken from the Customer Search page: leading search icon,
 * rounded field border that fills darker once it has text, body-lg text, and a clear button.
 * Every search box in the app uses this, so they all look and behave the same.
 */
export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { onClear, wrapperClassName = '', wrapperRef, children, className = '', value, ...rest },
  ref
) {
  const filled = value !== undefined && value !== null && String(value) !== '';
  return (
    <div ref={wrapperRef} className={`relative ${wrapperClassName}`}>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
        <Icon path={SEARCH_ICON} className="w-4.5 h-4.5" />
      </span>
      <input
        ref={ref}
        type="text"
        value={value}
        className={`w-full rounded-[var(--field-radius)] border bg-bg pl-10 pr-10 py-3 text-[var(--color-field-text-filled)] text-[length:var(--fs-body-lg)] placeholder:text-muted hover:border-[var(--field-hover-border)] focus:outline-none focus-visible:border-[var(--field-focus-border)]! focus-visible:bg-[var(--field-focus-bg)] focus-visible:shadow-[var(--field-focus-ring)] ${filled ? 'border-[var(--field-border-filled)]' : 'border-[var(--field-border)]'} ${className}`}
        {...rest}
      />
      {onClear && filled && (
        <button type="button" onClick={onClear} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg">
          <Icon path={CLEAR_ICON} className="w-4 h-4" />
        </button>
      )}
      {children}
    </div>
  );
});
