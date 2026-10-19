import { EligibilityGateStep } from '../../../capabilities';
import type { GuidedContactValue } from '../../../capabilities';
import type { EligibilityResult } from '../../../components/domain/eligibilityTypes';
import { LAUNCH_CUSTOMER_KEY } from '../../../components/patterns/wizard/useJourneyStartResume';
import { eligibilityJourney } from '../products';

/**
 * What depends on the product: its eligibility rules, judged for the product chosen (and, for MNP, the plan type it ports onto).
 * Silent on a clean pass. Shared by Product Selection and the MNP plan-type step, so both judge it the same way.
 */
export function ProductEligibility({
  values,
  setValue,
  flow,
  existingCustomerId,
  onSwitchToPrepaid,
}: {
  values: Record<string, unknown>;
  setValue: (field: string, value: unknown) => void;
  flow: 'new' | 'existing';
  existingCustomerId: string | undefined;
  /** Offered when the product is not already prepaid; switches the order to prepaid. */
  onSwitchToPrepaid?: () => void;
}) {
  const product = values.product as string | undefined;
  const contact = values.contact as GuidedContactValue | undefined;
  const eligibility = values.eligibility as EligibilityResult | undefined;
  if (!product || !contact?.moiResult) return null;
  return (
    <EligibilityGateStep
      asNewCustomer={flow === 'new' && !values[LAUNCH_CUSTOMER_KEY]}
      asCustomerId={flow === 'existing' ? existingCustomerId : (values[LAUNCH_CUSTOMER_KEY] as string | undefined)}
      announcePass={false}
      idNumber={contact.idNumber}
      journeyType={eligibilityJourney(values)}
      scope="product"
      portIn={product === 'mnp'}
      // The customer's checks were shown at Customer Identification. Here only what this product changes: everything for Prepaid (it judges
      // ID type and line limit by its own rules), otherwise just what blocks the product and the port-in dues.
      showRow={eligibilityJourney(values) === 'prepaid' ? undefined : (row) => row.tone === 'hard-stop' || row.tone === 'soft-stop' || row.id === 'port-in-dues'}
      result={eligibility}
      onResult={(r) => setValue('eligibility', r)}
      onSwitchToPrepaid={onSwitchToPrepaid}
    />
  );
}
