import type { InputHTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  readOnly?: boolean;
  /**
   * Fixed content locked inside the field's left edge - currently the country
   * flag and dial code on PhoneNumberInput. NOT named `prefix`: React's
   * HTMLAttributes already declares an RDFa `prefix?: string`, so that name
   * collides and fails to typecheck.
   *
   * Providing this moves the border from the <input> onto a wrapper, because a
   * prefix has to sit inside the same outline as the text. Fields WITHOUT a
   * prefix keep the original markup untouched, so this cannot shift the other
   * ~60 inputs in the app.
   */
  leadingAddon?: ReactNode;
}

// Field chrome (border/radius/state colors) per the light-mode textbox
// reference supplied 2026-09-15 - see the --field-* tokens in tokens.css.
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, helperText, leadingAddon, className = '', id, 'aria-describedby': ariaDescribedby, ...rest },
  ref
) {
  const inputId = id ?? `input-${label?.replace(/\s+/g, '-').toLowerCase()}`;
  const helperId = `${inputId}-helper`;
  const errorId = `${inputId}-error`;
  // The error message is pointed at too, not just the helper. It replaces the
  // helper in the layout, so previously an invalid field announced no reason
  // at all - the text was on screen but referenced by nothing.
  const describedBy =
    [ariaDescribedby, error ? errorId : helperText ? helperId : undefined].filter(Boolean).join(' ') || undefined;
  const isFilled = rest.value !== undefined && rest.value !== null && rest.value !== '';
  // readOnly is NOT disabled. A disabled input drops its text to
  // --field-label-disabled (#b2b2b2, about 2.3:1 on white), which is fine for
  // "this control is unavailable" and wrong for "this is registry data you
  // must read back to the customer". readOnly keeps --fg text and its value
  // stays selectable; the recessed --surface fill signals it cannot be typed
  // into.
  const isReadOnly = Boolean(rest.readOnly) && !rest.disabled;
  const readOnlyClass = isReadOnly ? 'bg-surface cursor-default' : 'bg-bg';
  // OUT OF THE TAB ORDER, and no focus ring (2026-09-26).
  //
  // A read-only field used to take focus and draw the same pink ring an
  // editable one does - which is the ring announcing "type here" on a field
  // that will refuse every keystroke. Worse on the Contact step, where six
  // consecutive registry fields sat between the agent and the two they can
  // actually edit: eight tab presses to reach Email.
  //
  // Skipping them costs nothing in accessibility terms. tabindex=-1 removes a
  // control from SEQUENTIAL navigation only; the input keeps its role, name
  // and value in the accessibility tree, so a screen reader still reaches and
  // reads it in browse mode. `disabled` inputs are already unfocusable by
  // the browser, so this only changes the readOnly case.
  //
  // A caller can still opt back in by passing its own tabIndex, since `rest`
  // spreads after this.
  const focusClass = isReadOnly
    ? ''
    : 'focus-visible:border-[var(--field-focus-border)] focus-visible:shadow-[var(--field-focus-ring)]';
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
          {/* Required marker, per the 2026-09-24 reference, which asterisks
              "Identification Document Type *" and "ID Number *". This is the
              FIRST field in the app to use it: mandatory has until now been
              expressed only by the wizard disabling Continue via its step
              isValid, with nothing on the field itself. aria-hidden because
              the input carries aria-required, so a screen reader announces
              the state rather than reading a bare asterisk. */}
          {rest.required && (
            <span className="text-[var(--field-border-error)]" aria-hidden="true">
              {' *'}
            </span>
          )}
        </label>
      )}
      {leadingAddon ? (
        // focus-within, not focus-visible: the outline belongs to the wrapper
        // now, but the thing being focused is the inner input.
        <div
          // bg set here, not via Tailwind's disabled: pseudo-class - that only
          // matches the element it is written on, and `disabled` sits on the
          // <input> inside this wrapper, not on this div.
          className={`relative flex items-center rounded-[var(--field-radius)] border
            ${rest.disabled ? 'bg-[var(--field-bg-disabled)]' : 'bg-bg'}
            ${borderClass}
            focus-within:border-[var(--field-focus-border)] focus-within:shadow-[var(--field-focus-ring)]
            ${rest.disabled ? 'border-[var(--field-border-disabled)]' : ''}`}
        >
          <span className="flex items-center gap-2 pl-3 pr-2 text-[length:var(--fs-body)] text-fg-2 shrink-0 select-none">
            {leadingAddon}
          </span>
          <span className="self-stretch my-2 w-px bg-[var(--field-border)] shrink-0" aria-hidden="true" />
          <input
            ref={ref}
            id={inputId}
            aria-required={rest.required || undefined}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={`flex-1 min-w-0 bg-transparent px-3 py-2 text-[length:var(--fs-body)] text-fg
              focus:outline-none disabled:text-[var(--field-label-disabled)]
              ${className}`}
            {...rest}
          />
        </div>
      ) : (
        <input
          ref={ref}
          id={inputId}
          aria-required={rest.required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`rounded-[var(--field-radius)] border px-3 py-2 text-[length:var(--fs-body)] text-fg
            ${readOnlyClass}
            ${borderClass}
            focus:outline-none ${focusClass}
            disabled:border-[var(--field-border-disabled)] disabled:text-[var(--field-label-disabled)] disabled:bg-[var(--field-bg-disabled)]
            ${className}`}
          tabIndex={isReadOnly ? -1 : undefined}
          {...rest}
        />
      )}
      {helperText && !error && (
        <span id={helperId} className="text-[length:var(--fs-caption)] text-muted">
          {helperText}
        </span>
      )}
      {error && (
        <span id={errorId} className="text-[length:var(--fs-caption)] text-[var(--field-border-error)]">
          {error}
        </span>
      )}
    </div>
  );
});
