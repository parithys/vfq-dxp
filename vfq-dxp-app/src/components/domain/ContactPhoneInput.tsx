import { useEffect, useRef, useState } from 'react';
import { Icon } from '../primitives/Icon';
import * as mockDataEngine from '../../engines/mockDataEngine';
import { formatQatarPhoneForDisplay } from '../primitives/PhoneNumberInput';

interface ContactRecord {
  contactRecordId: string;
  customerId: string;
  firstName: string;
  lastName: string;
  cellNumber?: string;
  workPhone?: string;
}

interface ContactPhoneInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  value: string;
  onChange: (value: string) => void;
  /** Saved-contacts panel is scoped to this customer's own `customer-contacts`
   * records — omitted entirely (chevron/panel not rendered) when there's no
   * active customer to source it from, rather than showing an empty panel. */
  customerId?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

const CHEVRON_DOWN = 'M6 9l6 6 6-6';
const CHEVRON_UP = 'M18 15l-6-6-6 6';

function initials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
}

// Mobile-number field with a saved-contacts picker, per Contact-Open.svg.
// Sourced from the customer's real `customer-contacts` records (cellNumber +
// name) — the mockup's per-row "Primary" badge and photo avatars have no
// backing field in that dataset, so this renders initials avatars and omits
// the badge rather than fabricating either.
export function ContactPhoneInput({
  label,
  error,
  helperText,
  value,
  onChange,
  customerId,
  placeholder,
  disabled,
  className = '',
  id,
}: ContactPhoneInputProps) {
  const inputId = id ?? `contact-phone-${label?.replace(/\s+/g, '-').toLowerCase()}`;
  const helperId = `${inputId}-helper`;
  const describedBy = helperText && !error ? helperId : undefined;
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!customerId) return;
    mockDataEngine.list<ContactRecord>('customer-contacts').then((all) => setContacts(all.filter((c) => c.customerId === customerId && c.cellNumber)));
  }, [customerId]);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const pick = (c: ContactRecord) => {
    if (c.cellNumber) onChange(c.cellNumber);
    setOpen(false);
  };

  const isFilled = value.trim().length > 0;
  const borderClass = error
    ? 'border-[var(--field-border-error)]'
    : isFilled
      ? 'border-[var(--field-border-filled)] enabled:hover:border-[var(--field-border-filled)]'
      : 'border-[var(--field-border)] enabled:hover:border-accent/40';

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className={`text-[length:var(--fs-label)] ${disabled ? 'text-[var(--field-label-disabled)]' : 'text-fg-2'}`}>
          {label}
        </label>
      )}
      <div ref={containerRef} className="relative">
        <div
          className={`flex items-center gap-2 rounded-[var(--field-radius)] border bg-bg pl-3 pr-2 py-2 focus-within:border-[var(--field-focus-border)] focus-within:shadow-[var(--field-focus-ring)]
            ${disabled ? 'border-[var(--field-border-disabled)]' : borderClass}
            ${className}`}
        >
          <span aria-hidden="true" className="text-base leading-none">🇶🇦</span>
          <span className="text-[length:var(--fs-body)] text-fg-2 shrink-0">+974</span>
          <span className="w-px h-5 bg-[var(--field-border-disabled)] shrink-0" />
          <input
            id={inputId}
            disabled={disabled}
            value={focused ? value : formatQatarPhoneForDisplay(value)}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={placeholder}
            aria-describedby={describedBy}
            className="flex-1 min-w-0 bg-transparent text-[length:var(--fs-body)] text-fg focus:outline-none disabled:text-[var(--field-label-disabled)]"
          />
          {customerId && (
            <button
              type="button"
              disabled={disabled}
              aria-label="Choose a saved contact"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className={`shrink-0 p-1 ${disabled ? 'text-muted' : isFilled ? 'text-[var(--field-icon-active)]' : 'text-[var(--field-icon)]'}`}
            >
              <Icon path={open ? CHEVRON_UP : CHEVRON_DOWN} className="w-4 h-4" />
            </button>
          )}
        </div>

        {open && (
          <ul
            role="listbox"
            className="absolute z-50 top-full left-0 right-0 mt-1 max-h-80 overflow-y-auto rounded-[var(--radius-card)] border border-border-soft bg-bg shadow-raised py-1 divide-y divide-[var(--field-divider)]"
          >
            {contacts.map((c) => (
              <li
                key={c.contactRecordId}
                role="option"
                onClick={() => pick(c)}
                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-surface"
              >
                <span className="w-8 h-8 rounded-full bg-accent text-white text-[length:var(--fs-caption)] font-semibold flex items-center justify-center shrink-0">
                  {initials(c.firstName, c.lastName)}
                </span>
                <span className="min-w-0">
                  <span className="block text-[length:var(--fs-body)] text-fg truncate">{formatQatarPhoneForDisplay(c.cellNumber ?? '')}</span>
                  <span className="block text-[length:var(--fs-caption)] text-muted truncate">{c.firstName} {c.lastName}</span>
                </span>
              </li>
            ))}
            {contacts.length === 0 && <li className="px-3 py-3 text-[length:var(--fs-body)] text-muted">No saved contacts.</li>}
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
