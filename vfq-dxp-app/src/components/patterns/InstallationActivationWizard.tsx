import { useNavigate } from 'react-router-dom';
import { GuidedActivationWizard } from './GuidedActivationWizard';
import { MsisdnPicker } from '../domain/MsisdnPicker';
import { CafSignatureCapture } from './CafSignatureCapture';
import { ActivityCommentsStep } from './ActivityCommentsStep';
import { AppointmentBookingStep } from './AppointmentBookingStep';
import type { AppointmentBookingValue } from './AppointmentBookingStep';
import { GuidedContactStep } from './GuidedContactStep';
import { isValidAltPhone, isValidEmail, hasIdentityDetails } from './guidedContactModel';
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
  /** CAF types that need a captured signature before Continue. */
  cafNeedsSignature: (type: CafType) => boolean;
  order: {
    orderType: string;
    /** The order's status once submitted. */
    status: (contact: GuidedContactValue) => string;
    createdBy: string;
    sourceChannel: string;
  };
  /** The toast shown on submit. */
  submittedMessage: (args: { orderId: string; appointment: AppointmentBookingValue; isB2B2C: boolean }) => string;
  /** Where to go after submit. */
  successRoute: string;
}

type CafValue = { cafType?: CafType; signatureDataUrl?: string };

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
          {
            key: 'contact',
            label: 'Contact',
            render: ({ values, setValue }) => (
              <GuidedContactStep
                value={(values.contact as GuidedContactValue) ?? {}}
                onChange={(v) => setValue('contact', v)}
              />
            ),
            isValid: (values) => {
              const c = values.contact as GuidedContactValue | undefined;
              return Boolean(c?.moiResult && hasIdentityDetails(c ?? {}) && isValidEmail(c?.email) && isValidAltPhone(c?.altPhone));
            },
          },
          {
            key: 'address',
            label: 'Address',
            render: ({ values, setValue }) => (
              <AddressSelectionStep
                value={values.addressId as string | undefined}
                onChange={(id) => setValue('addressId', id)}
                idNumber={(values.contact as GuidedContactValue | undefined)?.idNumber}
                onClear={() => setValue('addressId', undefined)}
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
                showCreditCheck
                selectedProductId={values.productId as string | undefined}
                onSelect={(id) => setValue('productId', id)}
                creditCheckAcknowledged={values.creditCheckAcknowledged === true}
                onAcknowledgeCreditCheck={(v) => setValue('creditCheckAcknowledged', v)}
                onCreditCheckResult={(pass) => setValue('creditCheckPass', pass)}
              />
            ),
            isValid: (values) => Boolean(values.productId) && (values.creditCheckPass === true || values.creditCheckAcknowledged === true),
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
                autoDetectDeviceType
              />
            ),
            isValid: (values) => {
              const c = values.caf as CafValue | undefined;
              if (!c?.cafType) return false;
              return !config.cafNeedsSignature(c.cafType) || Boolean(c.signatureDataUrl);
            },
          },
          {
            key: 'activity',
            label: 'Activity',
            render: ({ values, setValue }) => (
              <ActivityCommentsStep value={(values.comments as string) ?? ''} onChange={(v) => setValue('comments', v)} />
            ),
            isValid: (values) => Boolean((values.comments as string)?.trim()),
          },
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
