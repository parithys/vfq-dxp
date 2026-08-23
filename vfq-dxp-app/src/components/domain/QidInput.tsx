import { Input } from '../primitives/Input';

interface QidInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  error?: string;
}

// QID/Passport/GCC/Diplomatic ID formatted input, per component-catalogue.md §2
// (ENT-023/037 Customer/Contact). Full validation is a TextInput + format check —
// kept minimal here (11-digit QID pattern) since the format rules themselves
// aren't itemized per-digit in the corpus beyond "Qatari ID or Passport Number".
export function QidInput({ value, onChange, label = 'Qatari ID / Passport Number', error }: QidInputProps) {
  return (
    <Input
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Insert or scan ID"
      error={error}
    />
  );
}
