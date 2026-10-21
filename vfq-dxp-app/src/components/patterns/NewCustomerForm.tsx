import { useState } from 'react';
import { Button } from '../primitives/Button';
import { Input } from '../primitives/Input';
import { Select } from '../primitives/Select';
import { NATIONALITIES } from '../../data/nationalities';
import { buildNewCustomerIdentity, formatDmyOnBlur } from './idLookupModel';
import type { NewCustomerErrors, NewCustomerInput, NewCustomerMoi } from './idLookupModel';

/**
 * Shown when no registry (MOI, NAS, the customer records) knows the ID Type + ID Number entered: the agent can create the customer. They enter
 * what the document shows - nationality, name, date of birth, gender and the ID's expiry - and the customer continues as a NEW customer with the
 * identity marked as typed, which routes the order for manager approval (the same rule as any identity that was not read by the reader).
 */
export function NewCustomerForm({
  idTypeLabel,
  idNumber,
  expiry,
  onCreate,
}: {
  idTypeLabel: string;
  idNumber: string;
  /** The expiry already entered above (DD/MM/YYYY), so it is not asked twice. */
  expiry: string | undefined;
  onCreate: (moi: NewCustomerMoi) => void;
}) {
  const [input, setInput] = useState<NewCustomerInput>({ nationality: '', firstName: '', middleName: '', lastName: '', dob: '', gender: '', expiry: expiry ?? '' });
  const [errors, setErrors] = useState<NewCustomerErrors>({});
  const set = (patch: Partial<NewCustomerInput>) => setInput((prev) => ({ ...prev, ...patch }));
  const dateField = (key: 'dob' | 'expiry', label: string) => (
    <Input
      label={label}
      required
      value={input[key]}
      placeholder="DD/MM/YYYY"
      inputMode="numeric"
      maxLength={10}
      error={errors[key]}
      onChange={(e) => set({ [key]: e.target.value } as Partial<NewCustomerInput>)}
      onBlur={(e) => set({ [key]: formatDmyOnBlur(e.target.value) } as Partial<NewCustomerInput>)}
    />
  );

  return (
    <section aria-labelledby="new-customer-heading" className="rounded-[var(--radius-card)] border border-border-soft bg-[var(--surface-subtle)] p-4 space-y-4">
      <div>
        <h3 id="new-customer-heading" className="text-fg font-semibold text-[length:var(--fs-body-lg)]">
          No customer found - create a new customer
        </h3>
        <p className="text-fg-2 text-[length:var(--fs-caption)]">
          No record matches {idTypeLabel} {idNumber}. Enter the details shown on the document to create the customer.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label="Nationality"
          required
          searchable
          placeholder="Select nationality"
          value={input.nationality}
          error={errors.nationality}
          options={NATIONALITIES.map((n) => ({ value: n, label: n }))}
          onChange={(e) => set({ nationality: e.target.value })}
        />
        <Select
          label="Gender"
          required
          placeholder="Select gender"
          value={input.gender}
          error={errors.gender}
          options={[{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }]}
          onChange={(e) => set({ gender: e.target.value })}
        />
        <Input label="First Name" required value={input.firstName} error={errors.firstName} onChange={(e) => set({ firstName: e.target.value })} />
        <Input label="Middle Name(s)" value={input.middleName} onChange={(e) => set({ middleName: e.target.value })} />
        <Input label="Last Name" required value={input.lastName} error={errors.lastName} onChange={(e) => set({ lastName: e.target.value })} />
        {dateField('dob', 'Date of Birth')}
        {dateField('expiry', 'ID Expiry Date')}
      </div>
      <div className="flex justify-end">
        <Button
          variant="primary"
          onClick={() => {
            const result = buildNewCustomerIdentity(input, NATIONALITIES);
            if (result.errors) {
              setErrors(result.errors);
              return;
            }
            setErrors({});
            onCreate(result.moi);
          }}
        >
          Create new customer
        </Button>
      </div>
    </section>
  );
}
