import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { Input } from './Input';

// Presentation-only grouping ("+974 5035 0824") for a complete, valid
// +974-prefixed 8-digit local number (mobile or landline — Qatar numbers of
// either kind are 8 digits after the country code, so this isn't restricted
// to mobile-prefix digits). The stored value is never mutated with spaces —
// callers keep passing/receiving the raw digits via `value`/`onChange`, so
// downstream validation/persistence is unaffected. Anything incomplete or
// non-Qatar is shown as-is rather than half-formatted.
export function formatQatarPhoneForDisplay(raw: string): string {
  const digits = raw.replace(/^\+/, '');
  if (!digits.startsWith('974')) return raw;
  const local = digits.slice(3);
  if (!/^\d{8}$/.test(local)) return raw;
  return `+974 ${local.slice(0, 4)} ${local.slice(4)}`;
}

interface PhoneNumberInputProps {
  label?: string;
  error?: string;
  value: string;
  placeholder?: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}

// Shared phone-number field: shows the raw, editable value while focused
// (so users can naturally add/remove digits) and the grouped +974 display
// once blurred — the one formatting behavior every phone-number entry point
// in the app should share, per the app-wide standardization request.
export function PhoneNumberInput({ label, error, value, placeholder, onChange, className }: PhoneNumberInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <Input
      label={label}
      error={error}
      value={focused ? value : formatQatarPhoneForDisplay(value)}
      placeholder={placeholder}
      className={className}
      onChange={onChange}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  );
}
