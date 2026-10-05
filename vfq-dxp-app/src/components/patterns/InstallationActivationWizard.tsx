import { useNavigate } from 'react-router-dom';
import { GuidedActivationWizard } from './GuidedActivationWizard';
import { activityStep, contactStep, isCafValid, type CafValue } from './wizardSteps';
import { MsisdnPicker } from '../domain/MsisdnPicker';
import { CafSignatureCapture } from './CafSignatureCapture';
import { AppointmentBookingStep } from './AppointmentBookingStep';
import type { AppointmentBookingValue } from './AppointmentBookingStep';
import type { GuidedContactValue } from './guidedContactModel';
import { AddressSelectionStep } from './AddressSelectionStep';
import { ProductPlanStep } from './ProductPlanStep';
import type { CafType } from './cafTypes';
import { useEntityStore } from '../../stores/entityStore';
import { useNotificationStore } from '../../stores/notificationStore';

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
    <div className="p-8">
      <GuidedActivationWizard
        wizardId={config.wizardId}
        title={config.title}
        steps={[
          contactStep({ hideIptvToggle: config.hideIptvToggle }),
          {
            key: 'address',
            label: 'Address',
            render: ({ values, setValue }) => (
              <AddressSelectionStep
                value={values.addressId as string | undefined}
                onChange={(id) => setValue('addressId', id)}
                {...(config.addressUsesIdentity
                  ? {
                      idNumber: (values.contact as GuidedContactValue | undefined)?.idNumber,
                      onClear: () => setValue('addressId', undefined),
                    }
                  : {})}
              />
            ),
            isValid: (values) => Boolean(values.addressId),
          },
          {
            key: 'plan',
            label: 'Plan',
            render: ({ values, setValue }) => (
              <ProductPlanStep
                planType={config.planType}
                selectedProductId={values.productId as string | undefined}
                onSelect={(id) => setValue('productId', id)}
                {...(config.creditCheck
                  ? {
                      showCreditCheck: true,
                      creditCheckAcknowledged: values.creditCheckAcknowledged === true,
                      onAcknowledgeCreditCheck: (v: boolean) => setValue('creditCheckAcknowledged', v),
                      onCreditCheckResult: (pass: boolean) => setValue('creditCheckPass', pass),
                    }
                  : {})}
              />
            ),
            isValid: (values) =>
              Boolean(values.productId) && (!config.creditCheck || values.creditCheckPass === true || values.creditCheckAcknowledged === true),
          },
          {
            key: 'number',
            label: 'Number Selection',
            render: ({ values, setValue }) => (
              <MsisdnPicker
                selected={values.msisdn as string | undefined}
                onSelect={(msisdn) => setValue('msisdn', msisdn)}
                inlineToolbar
                hideReservedBadge
                onDeselect={() => setValue('msisdn', undefined)}
              />
            ),
            isValid: (values) => Boolean(values.msisdn),
          },
          {
            key: 'appointment',
            label: 'Book Appointment',
            render: ({ values, setValue }) => (
              <AppointmentBookingStep
                value={(values.appointment as AppointmentBookingValue) ?? {}}
                onChange={(v) => setValue('appointment', v)}
              />
            ),
            isValid: (values) => {
              const a = values.appointment as AppointmentBookingValue | undefined;
              return Boolean(a?.cluster && a?.date && a?.timeSlot);
            },
          },
          {
            key: 'caf',
            label: 'CAF & Signature',
            render: ({ values, setValue }) => (
              <CafSignatureCapture
                value={(values.caf as CafValue) ?? {}}
                onChange={(v) => setValue('caf', v)}
                customerName={(values.contact as GuidedContactValue | undefined)?.moiResult?.name}
                // The CAF type follows the device in use (touch-capable -> Touch Screen,
                // otherwise Digital) instead of the agent picking one; both sign in-app.
                autoDetectDeviceType={config.autoDetectCafDevice ? true : undefined}
              />
            ),
            isValid: (values) => isCafValid(values.caf as CafValue | undefined, config.cafNeedsSignature),
          },
          activityStep(),
        ]}
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
