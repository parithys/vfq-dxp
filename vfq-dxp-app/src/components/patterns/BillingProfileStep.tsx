import { Select } from '../primitives/Select';

export interface BillingProfileValue {
  language?: string;
  paymentMethod?: string;
  billMedia?: string;
}

interface BillingProfileStepProps {
  value: BillingProfileValue;
  onChange: (value: BillingProfileValue) => void;
}

// SCR-156: Billing step (New Postpaid wizard) - FLD-624–627: Language (default
// ENG), Payment Type (Postpaid, display-only - this wizard is postpaid-only so
// it's not a user choice here), Payment Method (default Invoice), Bill Media
// (default Email).
export function BillingProfileStep({ value, onChange }: BillingProfileStepProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Select
        label="Language"
        value={value.language ?? 'ENG'}
        onChange={(e) => onChange({ ...value, language: e.target.value })}
        options={[
          { value: 'ENG', label: 'English' },
          { value: 'ARA', label: 'Arabic' },
        ]}
      />
      <div className="flex flex-col gap-1">
        <label className="text-[length:var(--fs-label)] text-[var(--field-label-disabled)]">Payment Type</label>
        <div className="rounded-[var(--field-radius)] border border-[var(--field-border-disabled)] px-3 py-2 text-[var(--field-label-disabled)] bg-bg">Postpaid</div>
      </div>
      <Select
        label="Payment Method"
        value={value.paymentMethod ?? 'Invoice'}
        onChange={(e) => onChange({ ...value, paymentMethod: e.target.value })}
        options={[
          { value: 'Invoice', label: 'Invoice' },
          { value: 'AutoPay', label: 'AutoPay' },
        ]}
      />
      <Select
        label="Bill Media"
        value={value.billMedia ?? 'Email'}
        onChange={(e) => onChange({ ...value, billMedia: e.target.value })}
        options={[
          { value: 'Email', label: 'Email' },
          { value: 'Paper', label: 'Paper' },
        ]}
      />
    </div>
  );
}
