import { useNavigate } from 'react-router-dom';
import { GuidedActivationWizard } from '../../../components/patterns/GuidedActivationWizard';
import { MsisdnPicker } from '../../../components/domain/MsisdnPicker';
import { CafSignatureCapture } from '../../../components/patterns/CafSignatureCapture';
import { ActivityCommentsStep } from '../../../components/patterns/ActivityCommentsStep';
import { AppointmentBookingStep } from '../../../components/patterns/AppointmentBookingStep';
import type { AppointmentBookingValue } from '../../../components/patterns/AppointmentBookingStep';
import { GuidedContactStep, isValidAltPhone, isValidEmail, hasIdentityDetails } from '../../../components/patterns/GuidedContactStep';
import type { GuidedContactValue } from '../../../components/patterns/GuidedContactStep';
import { AddressSelectionStep } from '../../../components/patterns/AddressSelectionStep';
import { ProductPlanStep } from '../../../components/patterns/ProductPlanStep';
import type { CafType } from '../../../components/patterns/CafSignatureCapture';
import { useEntityStore } from '../../../stores/entityStore';
import { useNotificationStore } from '../../../stores/notificationStore';

const WIZARD_ID = 'new-fixed-line';

// SCR-043/045/046/048/050 (+ SCR-058 CAF preview, book-appointment/activity
// steps) - the New Fixed Line guided wizard, the richest-evidenced journey in
// this module (UJ-047/049/050, journeys.md). Contact -> Address -> Plan ->
// Number Selection -> Book Appointment -> CAF/Signature -> Activity -> Submit,
// matching Pattern 1's canonical step sequence.
export function NewFixedLineWizard() {
  const navigate = useNavigate();
  const createRecord = useEntityStore((s) => s.createRecord);
  const pushToast = useNotificationStore((s) => s.pushToast);

  return (
    <div className="p-8">
      <GuidedActivationWizard
        wizardId={WIZARD_ID}
        title="New Fixed Line Activation"
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
                planType="Fixed Line Plan"
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
                value={(values.caf as { cafType?: CafType; signatureDataUrl?: string }) ?? {}}
                onChange={(v) => setValue('caf', v)}
                customerName={(values.contact as GuidedContactValue | undefined)?.moiResult?.name}
                // The CAF type follows the device in use (touch-capable -> Touch Screen,
                // otherwise Digital) instead of the agent picking one; both sign in-app.
                autoDetectDeviceType
              />
            ),
            isValid: (values) => {
              const c = values.caf as { cafType?: CafType; signatureDataUrl?: string } | undefined;
              if (!c?.cafType) return false;
              // Digital and Touch Screen are both signed on this device.
              return c.cafType === 'Manual' || Boolean(c.signatureDataUrl);
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
            orderType: 'New Fixed Line Activation',
            orderSubType: contact.isB2B2C ? 'B2B2C' : 'Consumer',
            // B2B2C orders route to manager approval per UJ-081/UJ-082 (New Postpaid/FWA/Fixed
            // Line B2B2C "With Approval" variants) - see order-management's OrderApprovalQueue.
            status: contact.isB2B2C ? 'Submitted for Approval' : 'Complete',
            customerName: contact.moiResult?.name,
            addressId: values.addressId,
            productId: values.productId,
            msisdn: values.msisdn,
            createdBy: 'AGENT-VINODHINIR',
            sourceChannel: 'Tablet',
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
          pushToast(
            'success',
            contact.isB2B2C
              ? `Fixed Line order ${orderId} submitted for manager approval (B2B2C) - appointment booked for ${appointment.date} (${appointment.timeSlot}).`
              : `Fixed Line order ${orderId} submitted - appointment booked for ${appointment.date} (${appointment.timeSlot}).`
          );
          navigate('/fixed-line-fibre');
        }}
      />
    </div>
  );
}
