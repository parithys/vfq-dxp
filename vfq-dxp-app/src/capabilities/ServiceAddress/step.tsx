import { SERVICE_ADDRESS_LABEL } from '../../data/stepLabels';
import type { WizardStep } from '../../components/patterns/wizard/guidedWizardTypes';
import { ServiceAddress } from './ServiceAddress';
import { addressSummary } from './summary';
import type { ZsbAddressValue } from '../../components/patterns/ZsbAddressStep';

/**
 * Service address. 'structured' stores a ZSB address under `address`; 'saved' stores the chosen saved address's
 * id under `addressId` and requires one. `identity` reads the customer's ID number / nationality from the values
 * (from Customer Identification) so a Qatari's registered address is prefilled and a saved list can be offered.
 * Mandatory: No per FLD-523-526 - a structured address never gates progression (the Skip Address affordance).
 */
export function serviceAddressStep(
  opts: {
    mode: 'structured' | 'saved';
    identity?: (values: Record<string, unknown>) => { idNumber?: string; nationality?: string } | undefined;
    /** Continue passes over the step (it stays in the rail so the agent can come back and fill it in). */
    autoPass?: boolean;
 }
): WizardStep {
  return {
    key: 'address',
    label: SERVICE_ADDRESS_LABEL,
    summary: addressSummary,
    ...(opts.autoPass ? { autoPass: () => true } : {}),
    render: ({ values, setValue }) => {
      const who = opts.identity?.(values);
      return opts.mode === 'structured' ? (
        <ServiceAddress
          mode="structured"
          value={(values.address as ZsbAddressValue) ?? {}}
          onChange={(v) => setValue('address', v)}
          idNumber={who?.idNumber}
          nationality={who?.nationality}
        />
      ) : (
        <ServiceAddress
          mode="saved"
          value={values.addressId as string | undefined}
          onChange={(id) => setValue('addressId', id)}
          idNumber={who?.idNumber}
        />
      );
 },
    isValid: (values) => (opts.mode === 'saved' ? Boolean(values.addressId) : true),
 };
}
