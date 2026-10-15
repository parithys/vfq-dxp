import { APPOINTMENT_LABEL } from '../../data/stepLabels';
import type { WizardStep } from '../../components/patterns/wizard/guidedWizardTypes';
import { AppointmentBooking } from './AppointmentBooking';
import type { AppointmentBookingValue } from '../../components/patterns/AppointmentBookingStep';

/** Appointment booking, stored under `appointment`; complete once a cluster, date and time slot are chosen. */
export function appointmentBookingStep(): WizardStep {
  return {
    key: 'appointment',
    label: APPOINTMENT_LABEL,
    render: ({ values, setValue }) => (
      <AppointmentBooking value={(values.appointment as AppointmentBookingValue) ?? {}} onChange={(v) => setValue('appointment', v)} />
    ),
    isValid: (values) => {
      const a = values.appointment as AppointmentBookingValue | undefined;
      return Boolean(a?.cluster && a?.date && a?.timeSlot);
 },
 };
}
