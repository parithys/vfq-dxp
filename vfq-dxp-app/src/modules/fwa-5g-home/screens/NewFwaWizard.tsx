import { useNavigate } from 'react-router-dom';
import { GuidedActivationWizard } from '../../../components/patterns/GuidedActivationWizard';
import { GuidedContactStep, isValidAltPhone, isValidEmail, hasIdentityDetails } from '../../../components/patterns/GuidedContactStep';
import type { GuidedContactValue } from '../../../components/patterns/GuidedContactStep';
import { AddressSelectionStep } from '../../../components/patterns/AddressSelectionStep';
import { ProductPlanStep } from '../../../components/patterns/ProductPlanStep';
import { MsisdnPicker } from '../../../components/domain/MsisdnPicker';
import { AppointmentBookingStep } from '../../../components/patterns/AppointmentBookingStep';
import type { AppointmentBookingValue } from '../../../components/patterns/AppointmentBookingStep';
import { CafSignatureCapture } from '../../../components/patterns/CafSignatureCapture';
import type { CafType } from '../../../components/patterns/CafSignatureCapture';
import { ActivityCommentsStep } from '../../../components/patterns/ActivityCommentsStep';
import { useEntityStore } from '../../../stores/entityStore';
import { useNotificationStore } from '../../../stores/notificationStore';

const WIZARD_ID = 'new-fwa';

// SCR-077/078/079/080/082/084/085 - the New FWA guided wizard (UJ-061 "New FWA
// Postpaid Outdoor Order," Stage K recovered detail: 33 steps across 6 parts,
// high confidence). Contact -> Address -> Plan -> Number Selection -> Book
// Appointment -> CAF/Signature -> Activity -> Submit, matching Pattern 1's
// canonical sequence - the same shape as New Fixed Line, minus the "Get IPTV?"
// field (not evidenced at FWA's Contact step, FLD-430–450). The technician-side
// Dual-Play Serial Number Check (SCR-093, UJ-061's post-submission WFM phase)
// is a separate screen for a different persona - see WfmSerialNumberCheck.tsx.
export function NewFwaWizard() {
  const navigate = useNavigate();
  const createRecord = useEntityStore((s) => s.createRecord);
  const pushToast = useNotificationStore((s) => s.pushToast);

  return (
    <div className="p-8">
      <GuidedActivationWizard
        wizardId={WIZARD_ID}
        title="New FWA (5G Home) Activation"
        steps={[
          {
            key: 'contact',
            label: 'Contact',
            render: ({ values, setValue }) => (
              <GuidedContactStep
                value={(values.contact as GuidedContactValue) ?? {}}
                onChange={(v) => setValue('contact', v)}
                showIptvToggle={false}
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
              <AddressSelectionStep value={values.addressId as string | undefined} onChange={(id) => setValue('addressId', id)} />
            ),
            isValid: (values) => Boolean(values.addressId),
          },
          {
            key: 'plan',
            label: 'Plan',
            render: ({ values, setValue }) => (
              <ProductPlanStep
                planType="FWA 5G Home Plan"
                selectedProductId={values.productId as string | undefined}
                onSelect={(id) => setValue('productId', id)}
              />
            ),
            isValid: (values) => Boolean(values.productId),
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
              />
            ),
            isValid: (values) => {
              const c = values.caf as { cafType?: CafType; signatureDataUrl?: string } | undefined;
              if (!c?.cafType) return false;
              return c.cafType !== 'Digital' || Boolean(c.signatureDataUrl);
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
            orderType: 'New FWA Postpaid Outdoor Order',
            orderSubType: contact.isB2B2C ? 'B2B2C' : 'Consumer',
            // B2B2C FWA orders route to manager approval first (UJ-062 "New FWA Tablet
            // Indoor B2B2C Order with Manager Approval") - approving one moves it on to
            // Pending WFM Installation rather than completing it directly, since
            // installation still needs to happen (see nextStatusOnApproval below).
            status: contact.isB2B2C ? 'Submitted for Approval' : 'Pending WFM Installation',
            nextStatusOnApproval: 'Pending WFM Installation',
            customerName: contact.moiResult?.name,
            addressId: values.addressId,
            productId: values.productId,
            msisdn: values.msisdn,
            createdBy: 'AGENT-KARTHIKK',
            sourceChannel: 'Desktop',
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
              ? `FWA order ${orderId} submitted for manager approval (B2B2C) - WFM installation booked for ${appointment.date} (${appointment.timeSlot}) once approved.`
              : `FWA order ${orderId} submitted - WFM installation appointment booked for ${appointment.date} (${appointment.timeSlot}).`
          );
          navigate('/fwa-5g-home');
        }}
      />
    </div>
  );
}
