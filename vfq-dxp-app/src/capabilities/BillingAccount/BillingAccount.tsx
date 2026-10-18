import { BillingAccountStep } from '../../components/patterns/BillingAccountStep';
import type { BillingAccountValue } from '../../components/patterns/billingAccountModel';
import { BillingProfileStep } from '../../components/patterns/BillingProfileStep';
import type { BillingProfileValue } from '../../components/patterns/BillingProfileStep';

/**
 * BILLING ACCOUNT - the one application-wide capability for setting up what an order bills to.
 *
 * Journeys mount THIS component and say which kind of billing set-up their context needs; none of them picks
 * between the parts itself.
 *
 *   mode 'account'   pick one of the customer's existing billing accounts, or create one (contact, address,
 *                    card on file, bill cycle, the profile's name / media / schedule). New Connection, Fixed Line.
 *   mode 'settings'  just the billing settings of the order - language, payment method, bill media. Port-in (MNP).
 */
export type BillingAccountProps =
  | {
      mode: 'account';
      customerId: string | undefined;
      /** The journey's own address, offered as "use the same address" instead of asking the agent to retype it. */
      defaultAddressLine: string | undefined;
      value: BillingAccountValue;
      onChange: (value: BillingAccountValue) => void;
      /** The email captured at Customer Identification (masked for a new customer): shown instead of a second lookup. */
      customerEmail?: string;
      /** The name captured at Customer Identification: offered as the primary contact when the customer has no contact records yet
       * (a new customer). */
      customerName?: string;
    }
  | {
      mode: 'settings';
      value: BillingProfileValue;
      onChange: (value: BillingProfileValue) => void;
    };

export function BillingAccount(props: BillingAccountProps) {
  if (props.mode === 'account') {
    const { mode: _mode, ...rest } = props;
    return <BillingAccountStep {...rest} />;
  }
  const { mode: _mode, ...rest } = props;
  return <BillingProfileStep {...rest} />;
}
