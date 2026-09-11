import { useEffect } from 'react';
import { IdLookupStep } from './IdLookupStep';
import type { QidType } from '../domain/QidInput';
import { Input } from '../primitives/Input';
import { PhoneNumberInput } from '../primitives/PhoneNumberInput';
import { Select } from '../primitives/Select';
import { useActiveCustomerStore } from '../../stores/activeCustomerStore';

interface MoiResult {
  name: string;
  dob: string;
  nationality: string;
  email?: string;
}

export interface GuidedContactValue {
  idType?: QidType;
  idNumber?: string;
  moiResult?: MoiResult;
  email?: string;
  altPhone?: string;
  language?: string;
  getIptv?: 'Yes' | 'No';
  digitalLeadSale?: 'Yes' | 'No';
  isB2B2C?: boolean;
  companyName?: string;
}

interface GuidedContactStepProps {
  value: GuidedContactValue;
  onChange: (value: GuidedContactValue) => void;
  /** Fixed Line evidences a "Get IPTV?" field at Contact; FWA's evidenced Contact
   * fields (FLD-430–450) don't include it — default true for Fixed Line callers. */
  showIptvToggle?: boolean;
}

// Single source of truth for "is this a valid Alternate phone #" — exported
// so every wizard's Contact step isValid gate checks the exact same rule as
// the field's own inline error.
//
// Deliberately accepts any plausible mobile number, not just a Qatar-local
// one, per explicit product direction: field-inventory/business-rules.json
// evidence says this field "must be a local mobile number" (repeated across
// 5+ journeys, FLD-352 et al.) since it's used as an SMS notification
// contact — but a postpaid customer may only have a foreign number on file
// (e.g. a GCC/expat/diplomatic customer), so hard-blocking on Qatar's format
// specifically was judged too restrictive for this rebuild. Accepts either
// an 8-digit Qatar mobile (optionally +974/974-prefixed, 3/5/6/7 leading
// digit) or a general international number (optional "+", 7–15 digits).
export function isValidAltPhone(raw: string | undefined): boolean {
  if (!raw) return false;
  const digits = raw.replace(/[\s-]/g, '');
  const isQatarLocal = /^[3567]\d{7}$/.test(digits.replace(/^\+?974/, ''));
  const isInternational = /^(\+[1-9]\d{7,14}|\d{7,15})$/.test(digits);
  return isQatarLocal || isInternational;
}

// Contact step shared across New Fixed Line (SCR-043, FLD-340–352) and New FWA
// (SCR-078, FLD-430–450) — Pattern 1 describes the contact step as "near-identical
// across every connection/activation journey regardless of product," and the two
// evidenced field sets overlap almost entirely (ID Expiry/Nationality/Gender/
// Name/DOB auto-populate from the ID scan; Email/Alt Phone/Language/Digital
// Lead-Sale/B2B2C are agent-entered in both).
export function GuidedContactStep({ value, onChange, showIptvToggle = true }: GuidedContactStepProps) {
  const activeCustomer = useActiveCustomerStore((s) => s.customer);

  // Customer 360's product actions launch this same wizard for a customer
  // already on screen — pre-fill from the active-customer bridge instead of
  // asking the agent to re-key an ID lookup they already did to get here.
  // Guarded on !value.idNumber so it only ever pre-fills a still-blank step
  // (never overwrites an in-progress manual entry) and only fires once.
  useEffect(() => {
    if (value.idNumber || !activeCustomer) return;
    onChange({
      ...value,
      idType: activeCustomer.idType,
      idNumber: activeCustomer.qid,
      email: activeCustomer.email,
      moiResult: {
        name: activeCustomer.name,
        dob: activeCustomer.dob,
        nationality: activeCustomer.nationality,
        email: activeCustomer.email,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCustomer?.customerId]);

  return (
    <div className="space-y-4">
      <IdLookupStep
        value={{ idType: value.idType, idNumber: value.idNumber, moiResult: value.moiResult }}
        // Email is fetched from MOI, not agent-entered — re-derive it from
        // the result every time it changes (and clear it along with the
        // result when the ID is edited/re-typed) rather than leaving
        // whatever the field held before.
        onChange={(v) => onChange({ ...value, ...v, email: v.moiResult?.email })}
      />

      {value.moiResult && (
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border-soft">
          <Input
            label="Email"
            type="email"
            value={value.email ?? ''}
            disabled
            helperText="Fetched from MOI — not editable."
            onChange={() => {}}
          />
          <PhoneNumberInput
            label="Alternate phone #"
            value={value.altPhone ?? ''}
            placeholder="+974 5566 7766"
            error={
              value.altPhone && !isValidAltPhone(value.altPhone)
                ? 'Please enter a valid mobile number (local or international).'
                : undefined
            }
            onChange={(e) => onChange({ ...value, altPhone: e.target.value })}
          />
          <Select
            label="Language"
            value={value.language ?? 'English'}
            onChange={(e) => onChange({ ...value, language: e.target.value })}
            options={[
              { value: 'English', label: 'English' },
              { value: 'Arabic', label: 'Arabic' },
            ]}
          />
          {showIptvToggle && (
            <Select
              label="Get IPTV?"
              value={value.getIptv ?? 'No'}
              onChange={(e) => onChange({ ...value, getIptv: e.target.value as 'Yes' | 'No' })}
              options={[
                { value: 'No', label: 'No' },
                { value: 'Yes', label: 'Yes' },
              ]}
            />
          )}
          <Select
            label="Digital Lead/Sale"
            value={value.digitalLeadSale ?? 'No'}
            onChange={(e) => onChange({ ...value, digitalLeadSale: e.target.value as 'Yes' | 'No' })}
            options={[
              { value: 'No', label: 'No' },
              { value: 'Yes', label: 'Yes' },
            ]}
          />
          <label className="flex items-center gap-2 text-[length:var(--fs-body)] text-fg-2">
            <input
              type="checkbox"
              checked={value.isB2B2C ?? false}
              onChange={(e) => onChange({ ...value, isB2B2C: e.target.checked, companyName: e.target.checked ? value.companyName : undefined })}
            />
            B2B2C order
          </label>
          {value.isB2B2C && (
            <Input
              label="Company Name (B2B2C)"
              value={value.companyName ?? ''}
              onChange={(e) => onChange({ ...value, companyName: e.target.value })}
            />
          )}
        </div>
      )}
    </div>
  );
}
