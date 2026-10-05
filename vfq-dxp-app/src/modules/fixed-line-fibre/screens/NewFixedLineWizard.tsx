import { InstallationActivationWizard, type InstallationWizardConfig } from '../../../components/patterns/InstallationActivationWizard';

// SCR-043/045/046/048/050 (+ SCR-058 CAF preview, book-appointment/activity
// steps) - the New Fixed Line guided wizard, the richest-evidenced journey in
// this module (UJ-047/049/050, journeys.md). Contact -> Address -> Plan ->
// Number Selection -> Book Appointment -> CAF/Signature -> Activity -> Submit,
// matching Pattern 1's canonical step sequence. The steps live in the shared
// InstallationActivationWizard; this is what is specific to Fixed Line.
const FIXED_LINE_CONFIG: InstallationWizardConfig = {
  wizardId: 'new-fixed-line',
  title: 'New Fixed Line Activation',
  planType: 'Fixed Line Plan',
  // Digital and Touch Screen are both signed on this device.
  cafNeedsSignature: (type) => type !== 'Manual',
  order: {
    orderType: 'New Fixed Line Activation',
    // B2B2C orders route to manager approval per UJ-081/UJ-082 (New Postpaid/FWA/Fixed
    // Line B2B2C "With Approval" variants) - see order-management's OrderApprovalQueue.
    status: (contact) => (contact.isB2B2C ? 'Submitted for Approval' : 'Complete'),
    createdBy: 'AGENT-VINODHINIR',
    sourceChannel: 'Tablet',
  },
  submittedMessage: ({ orderId, appointment, isB2B2C }) =>
    isB2B2C
      ? `Fixed Line order ${orderId} submitted for manager approval (B2B2C) - appointment booked for ${appointment.date} (${appointment.timeSlot}).`
      : `Fixed Line order ${orderId} submitted - appointment booked for ${appointment.date} (${appointment.timeSlot}).`,
  successRoute: '/fixed-line-fibre',
};

export function NewFixedLineWizard() {
  return <InstallationActivationWizard config={FIXED_LINE_CONFIG} />;
}
