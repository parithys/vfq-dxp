import { ZsbAddressStep } from '../../../components/patterns/ZsbAddressStep';
import type { ZsbAddressValue } from '../../../components/patterns/ZsbAddressStep';
import type { WizardStep } from '../../../components/patterns/wizard/guidedWizardTypes';

export function addressStep(): WizardStep {
  return {
    key: 'address',
    // 2026-10-01: the address is not fetched from NAS and starts blank.
    // The step stays in the rail but Continue passes over it
    // (autoPass), so Plan & Add-ons goes on to Number Selection; the
    // agent can still come back and fill it in.
    autoPass: () => true,
    label: 'Address',
    render: ({ values, setValue }) => {
      return (
        <ZsbAddressStep
          value={(values.address as ZsbAddressValue) ?? {}}
          onChange={(v) => setValue('address', v)}
        />
      );
    },
    // Mandatory: No per FLD-523–526 - never gates progression, matching the evidenced Skip Address affordance.
    isValid: () => true,
  };
}
