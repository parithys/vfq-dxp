import { SERVICE_ADDRESS_LABEL } from '../../data/stepLabels';
import type { WizardStep } from '../../components/patterns/wizard/guidedWizardTypes';
import { ServiceAddress } from './ServiceAddress';
import { addressSummary } from './summary';
import type { ZsbAddressValue } from '../../components/patterns/ZsbAddressStep';

/**
 * Service address: stores a ZSB address under `address`. `identity` reads the customer's ID number / nationality from the
 * values (from Customer Identification) so a Qatari's registered address is prefilled. Mandatory: No per FLD-523-526 - the
 * address never gates progression (the Skip Address affordance).
 */
export function serviceAddressStep(
  opts: {
    /** Kept for existing callers; the only mode. */
    mode?: 'structured';
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
      return (
        <ServiceAddress
          value={(values.address as ZsbAddressValue) ?? {}}
          onChange={(v) => setValue('address', v)}
          idNumber={who?.idNumber}
          nationality={who?.nationality}
        />
      );
    },
    isValid: () => true,
 };
}
