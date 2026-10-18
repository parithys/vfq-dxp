import { useNavigate } from 'react-router-dom';
import * as sums from './commonSummaries';
import { attachSummaries } from './stepSummary';
import { GuidedActivationWizard } from '../../../capabilities/GuidedActivationWizard/GuidedActivationWizard';
import { activityStep, appointmentBookingStep, cafSignatureStep, contactStep, numberSelectionStep, planSelectionStep, serviceAddressStep } from '../../../capabilities';
import type { GuidedContactValue } from '../guidedContactModel';
import type { AppointmentBookingValue } from '../AppointmentBookingStep';
import type { CafType } from '../cafTypes';
import { useEntityStore } from '../../../stores/entityStore';
import { useNotificationStore } from '../../../stores/notificationStore';

/**
 * What differs between the installation-style activation journeys (Fixed Line, FWA ...). Everything else -
 * the step sequence Contact -> Address -> Plan -> Number Selection -> Book Appointment -> CAF & Signature ->
 * Activity, the validation of each step, and the order + appointment records written on submit - is shared.
 */
export interface InstallationWizardConfig {
  wizardId: string;
  title: string;
  /** ProductPlanStep's plan type, e.g. "Fixed Line Plan". */
  planType: string;
  /** The contact step omits the "Get IPTV?" field. */
  hideIptvToggle?: boolean;
  /** Address step is told the customer's ID number and can clear its selection. */
  addressUsesIdentity: boolean;
  /** Run the credit check on the Plan step and require it (or its acknowledgement) to continue. */
  creditCheck: boolean;
  /** CAF type follows the device in use (touch-capable -> Touch Screen, otherwise Digital). */
  autoDetectCafDevice: boolean;
  /** CAF types that need a captured signature before Continue. */
  cafNeedsSignature: (type: CafType) => boolean;
  order: {
    orderType: string;
    /** The order's status once submitted. */
    status: (contact: GuidedContactValue) => string;
    /** The status approval moves the order to (set on the order when it is routed for approval). */
    nextStatusOnApproval?: string;
    createdBy: string;
    sourceChannel: string;
  };
  /** The toast shown on submit. */
  submittedMessage: (args: { orderId: string; appointment: AppointmentBookingValue; isB2B2C: boolean }) => string;
  /** Where to go after submit. */
  successRoute: string;
}

export function InstallationActivationWizard({ config }: { config: InstallationWizardConfig }) {
  const navigate = useNavigate();
  const createRecord = useEntityStore((s) => s.createRecord);
  const pushToast = useNotificationStore((s) => s.pushToast);

  return (
    <div className="min-h-full flex flex-col">
      <GuidedActivationWizard
        wizardId={config.wizardId}
        title={config.title}
        steps={attachSummaries([
          contactStep({ hideIptvToggle: config.hideIptvToggle }),
          serviceAddressStep({
            mode: 'saved',
            identity: config.addressUsesIdentity ? (values) => ({ idNumber: (values.contact as GuidedContactValue | undefined)?.idNumber }) : undefined,
          }),
          planSelectionStep({ kind: 'catalogue', planType: config.planType, creditCheck: config.creditCheck }),
          numberSelectionStep(),
          appointmentBookingStep(),
          cafSignatureStep({
            customerName: (values) => (values.contact as GuidedContactValue | undefined)?.moiResult?.name,
            // The CAF type follows the device in use (touch-capable -> Touch Screen, otherwise Digital) instead of
            // the agent picking one; both sign in-app.
            autoDetectDevice: config.autoDetectCafDevice,
            needsSignature: config.cafNeedsSignature,
          }),
          activityStep(),
        ], {
          contact: sums.contactFormSummary(),
          address: sums.addressPickSummary(),
          plan: sums.planSummary(),
          number: sums.numberSummary(),
          appointment: sums.appointmentSummary,
          caf: sums.cafSummary,
        })}
        onSubmit={async (values) => {
          const contact = values.contact as GuidedContactValue;
          const appointment = values.appointment as AppointmentBookingValue;
          const orderId = `ORD-${Date.now().toString().slice(-6)}`;
          await createRecord('orders', {
            orderId,
            orderType: config.order.orderType,
            orderSubType: contact.isB2B2C ? 'B2B2C' : 'Consumer',
            status: config.order.status(contact),
            ...(config.order.nextStatusOnApproval ? { nextStatusOnApproval: config.order.nextStatusOnApproval } : {}),
            customerName: contact.moiResult?.name,
            addressId: values.addressId,
            productId: values.productId,
            msisdn: values.msisdn,
            createdBy: config.order.createdBy,
            sourceChannel: config.order.sourceChannel,
          });
          await createRecord('appointments', {
            appointmentId: `APT-${Date.now().toString().slice(-6)}`,
            orderId,
            status: 'pending',
            appointmentDate: appointment.date,
            timeSlot: appointment.timeSlot,
            cluster: appointment.cluster,
            channel: 'Retail Store',
          });
          pushToast('success', config.submittedMessage({ orderId, appointment, isB2B2C: Boolean(contact.isB2B2C) }));
          navigate(config.successRoute);
        }}
      />
    </div>
  );
}
