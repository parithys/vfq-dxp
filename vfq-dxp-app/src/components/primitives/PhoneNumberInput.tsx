import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { Input } from './Input';
import { Icon } from './Icon';
import { COUNTRY_DIAL_CODES, DEFAULT_COUNTRY_ISO, countryByIso, countryFromNumber } from './countryDialCodes';

const CHEVRON_DOWN = 'M6 9l6 6 6-6';

// Presentation-only grouping ("+974 5035 0824") for a complete, valid
// +974-prefixed 8-digit local number (mobile or landline - Qatar numbers of
// either kind are 8 digits after the country code, so this isn't restricted
// to mobile-prefix digits). Kept exported: callers outside this field still
// format stored numbers for display.
export function formatQatarPhoneForDisplay(raw: string): string {
  const digits = raw.replace(/^\+/, '');
  if (!digits.startsWith('974')) return raw;
  const local = digits.slice(3);
  if (!/^\d{8}$/.test(local)) return raw;
  return `+974 ${local.slice(0, 4)} ${local.slice(4)}`;
}

function groupDigits(national: string): string {
  return national.length > 4 ? `${national.slice(0, 4)} ${national.slice(4)}` : national;
}

interface PhoneNumberInputProps {
  label?: string;
  error?: string;
  value: string;
  placeholder?: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  required?: boolean;
  helperText?: string;
}

// Shared phone-number field: a country-code dropdown locked inside the field's
// left edge, then the national digits.
//
// The stored value is always E.164 (dial code + national), so every consumer
// and validator keeps receiving one string - the split is presentational.
// Changing the country rewrites the prefix and KEEPS the digits, which is what
// an agent correcting "right number, wrong country" expects.
//
// The selected country is component state rather than derived from the stored
// value on every render, because dial codes are not unique (+1 covers the US,
// Canada and much of the Caribbean), so a number cannot tell you which country
// was picked. It IS seeded from the value via countryFromNumber, so a
// persisted draft or an MOI prefill reopens on the right country.
//
// This restores international entry, which the fixed +974 prefix had removed -
// see the note on isValidAltPhone, which always accepted foreign numbers.
export function PhoneNumberInput({
  label,
  error,
  value,
  placeholder,
  onChange,
  className,
  required,
  helperText,
}: PhoneNumberInputProps) {
  const [iso, setIso] = useState(() => countryFromNumber(value)?.iso ?? DEFAULT_COUNTRY_ISO);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const country = countryByIso(iso);

  // Re-seed when a value arrives after mount (MOI prefill, draft rehydrate),
  // but stop once the agent has chosen a country themselves - otherwise this
  // would fight their selection on the next keystroke.
  const userPickedCountry = useRef(false);
  useEffect(() => {
    if (userPickedCountry.current) return;
    const detected = countryFromNumber(value);
    if (detected && detected.iso !== iso) setIso(detected.iso);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const national = value.startsWith(country.dial) ? value.slice(country.dial.length) : value.replace(/^\+/, '');
  const nationalDigits = national.replace(/\D/g, '');

  // E.164 allows 15 digits including the country code, so the national cap
  // depends on which country is selected rather than being Qatar's 8.
  const maxNational = 15 - (country.dial.length - 1);

  const handleDigits = (e: ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, maxNational);
    // Empty stays empty rather than becoming a bare dial code, which would
    // read as filled to the required check and to Input's isFilled border.
    e.target.value = digits ? `${country.dial}${digits}` : '';
    onChange(e);
  };

  const pickCountry = (nextIso: string) => {
    const next = countryByIso(nextIso);
    userPickedCountry.current = true;
    setIso(nextIso);
    setOpen(false);
    // Synthesised so the parent's onChange signature is unchanged; every call
    // site only ever reads e.target.value.
    onChange({
      target: { value: nationalDigits ? `${next.dial}${nationalDigits}` : '' },
    } as ChangeEvent<HTMLInputElement>);
  };

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!open) {
        setHighlighted(Math.max(0, COUNTRY_DIAL_CODES.findIndex((c) => c.iso === iso)));
        setOpen(true);
      } else {
        pickCountry(COUNTRY_DIAL_CODES[highlighted]?.iso ?? iso);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const onListKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((i) => Math.min(COUNTRY_DIAL_CODES.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pickCountry(COUNTRY_DIAL_CODES[highlighted]?.iso ?? iso);
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <Input
      label={label}
      error={error}
      required={required}
      helperText={helperText}
      inputMode="tel"
      autoComplete="tel-national"
      leadingAddon={
        <span ref={containerRef} className="contents">
            <button
              type="button"
              role="combobox"
              aria-haspopup="listbox"
              aria-expanded={open}
              aria-label={`Country calling code, currently ${country.name} ${country.dial}`}
              onClick={() => setOpen((v) => !v)}
              onKeyDown={onTriggerKeyDown}
              className="flex items-center gap-1 text-fg-2 focus:outline-none focus-visible:underline"
            >
              {country.dial}
              <Icon path={CHEVRON_DOWN} className="w-3.5 h-3.5 text-muted" />
            </button>
            {open && (
              <ul
                role="listbox"
                tabIndex={-1}
                onKeyDown={onListKeyDown}
                ref={(el) => el?.focus()}
                // Anchored to the field wrapper rather than the dial-code
                // button, so the panel is exactly as wide as the input it
                // belongs to instead of a fixed w-64. Inset by -1px each side
                // because left-0/right-0 resolve to the wrapper's padding box,
                // which excludes its 1px border - without this the panel is
                // 2px narrower than the field and the edges do not line up.
                className="absolute z-50 top-full -left-px -right-px mt-2 max-h-64 overflow-y-auto rounded-[var(--field-radius)] border border-border-soft bg-bg shadow-raised py-1"
              >
                {COUNTRY_DIAL_CODES.map((c, i) => (
                  <li
                    key={c.iso}
                    role="option"
                    aria-selected={c.iso === iso}
                    onMouseEnter={() => setHighlighted(i)}
                    onClick={() => pickCountry(c.iso)}
                    className={`flex items-center justify-between gap-3 px-3 py-2 text-[length:var(--fs-caption)] cursor-pointer text-fg-2 ${
                      i === highlighted ? 'bg-surface' : ''
                    }`}
                  >
                    <span className="truncate">{c.name}</span>
                    <span className="text-muted shrink-0">{c.dial}</span>
                  </li>
                ))}
              </ul>
            )}
        </span>
      }
      value={groupDigits(nationalDigits)}
      placeholder={placeholder}
      className={className}
      onChange={handleDigits}
    />
  );
}
