import { ActivationCompleteScreen } from '../../components/patterns/ActivationCompleteScreen';
import type { ActivationCompleteOrder } from '../../components/patterns/ActivationCompleteScreen';

/**
 * ACTIVATION COMPLETE - the one application-wide capability for the page that confirms a submitted activation:
 * the order's facts, its status (complete, or submitted for approval), and the follow-on actions (view the order,
 * print, done and exit, create a lead, continue with fibre), plus the eSIM handover and the confirmation email.
 *
 * Journeys mount THIS component with the facts of their order and the kind of service they activated; none of
 * them mounts ActivationCompleteScreen or restates its labels.
 *
 *   service   'mobile' (default): a SIM number, with a SIM type row.
 *             'fixed': a fixed-line number, no SIM row.
 *   showActivityId  false in the customer-view pop-up, which shows the order and never the internal activity ID.
 */
export interface ActivationCompleteProps {
  order: ActivationCompleteOrder;
  service?: 'mobile' | 'fixed';
  showActivityId?: boolean;
}

export function ActivationComplete({ order, service = 'mobile', showActivityId = true }: ActivationCompleteProps) {
  return (
    <ActivationCompleteScreen
      order={showActivityId ? order : { ...order, activityId: undefined }}
      numberLabel={service === 'fixed' ? 'Fixed Line Number' : undefined}
      hideSimType={service === 'fixed'}
    />
  );
}
