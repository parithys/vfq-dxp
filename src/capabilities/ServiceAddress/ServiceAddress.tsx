import { AddressSelectionStep } from '../../components/patterns/AddressSelectionStep';
import { ZsbAddressStep } from '../../components/patterns/ZsbAddressStep';
import type { ZsbAddressValue } from '../../components/patterns/ZsbAddressStep';

/**
 * SERVICE ADDRESS - the one application-wide capability for the address a service is activated at.
 *
 * Journeys mount THIS component (usually through serviceAddressStep in wizard/wizardSteps) and say which kind
 * of address their context needs; none of them picks between the parts itself.
 *
 *   mode 'structured'  type or prefill a Zone / Street / Building address (ZSB); a Qatari ID's registered address
 *                      is looked up and offered as an editable head start. New Connection, Prepaid, MNP, Fixed Line.
 *   mode 'saved'       search, or pick one of the addresses already on the customer's account, or add one. FWA.
 */
export type ServiceAddressProps =
  | {
      mode: 'structured';
      value: ZsbAddressValue;
      onChange: (value: ZsbAddressValue) => void;
      /** From Customer Identification: a Qatari national's registered address is prefilled. */
      idNumber?: string;
      nationality?: string;
      /** A journey that reports fibre readiness itself hides the built-in banner. */
      hideFibreReadiness?: boolean;
    }
  | {
      mode: 'saved';
      value: string | undefined;
      onChange: (addressId: string | undefined) => void;
      /** From Customer Identification: lists the addresses on that customer's account to pick from. */
      idNumber?: string;
    };

export function ServiceAddress(props: ServiceAddressProps) {
  if (props.mode === 'structured') {
    const { mode: _mode, ...rest } = props;
    return <ZsbAddressStep {...rest} />;
  }
  const { mode: _mode, onChange, idNumber, ...rest } = props;
  return (
    <AddressSelectionStep
      {...rest}
      onChange={(id) => onChange(id)}
      idNumber={idNumber}
      // With an identified customer, choosing the selected address again clears it.
      onClear={idNumber ? () => onChange(undefined) : undefined}
    />
  );
}
