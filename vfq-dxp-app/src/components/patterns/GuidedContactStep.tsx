import { IdLookupStep } from './IdLookupStep';
import { Input } from '../primitives/Input';
import { Select } from '../primitives/Select';

interface MoiResult {
  name: string;
  dob: string;
  nationality: string;
}

export interface GuidedContactValue {
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

// Contact step shared across New Fixed Line (SCR-043, FLD-340–352) and New FWA
// (SCR-078, FLD-430–450) — Pattern 1 describes the contact step as "near-identical
// across every connection/activation journey regardless of product," and the two
// evidenced field sets overlap almost entirely (ID Expiry/Nationality/Gender/
// Name/DOB auto-populate from the ID scan; Email/Alt Phone/Language/Digital
// Lead-Sale/B2B2C are agent-entered in both).
export function GuidedContactStep({ value, onChange, showIptvToggle = true }: GuidedContactStepProps) {
  return (
    <div className="space-y-4">
      <IdLookupStep
        value={{ idNumber: value.idNumber, moiResult: value.moiResult }}
        onChange={(v) => onChange({ ...value, ...v })}
      />

      {value.moiResult && (
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border-soft">
          <Input
            label="Email"
            type="email"
            value={value.email ?? ''}
            onChange={(e) => onChange({ ...value, email: e.target.value })}
          />
          <Input
            label="Alt. phone #"
            value={value.altPhone ?? ''}
            placeholder="97455667766"
            error={
              value.altPhone && !/^974\d{8}$/.test(value.altPhone)
                ? 'This is a notification contact. Please enter a local mobile number.'
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
