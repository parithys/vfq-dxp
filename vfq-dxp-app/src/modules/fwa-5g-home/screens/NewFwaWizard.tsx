import { InstallationActivationWizard, type InstallationWizardConfig } from '../../../components/patterns/InstallationActivationWizard';

// SCR-077/078/079/080/082/084/085 - the New FWA guided wizard (UJ-061 "New FWA
// Postpaid Outdoor Order," Stage K recovered detail: 33 steps across 6 parts,
// high confidence). Contact -> Address -> Plan -> Number Selection -> Book
// Appointment -> CAF/Signature -> Activity -> Submit, matching Pattern 1's
// canonical sequence - the same shape as New Fixed Line, minus the "Get IPTV?"
// field (not evidenced at FWA's Contact step, FLD-430-450). The steps live in the
// shared InstallationActivationWizard; this is what is specific to FWA. The
// technician-side Dual-Play Serial Number Check (SCR-093, UJ-061's post-submission
// WFM phase) is a separate screen for a different persona - see WfmSerialNumberCheck.tsx.
const FWA_CONFIG: InstallationWizardConfig = {
  wizardId: 'new-fwa',
  title: 'New FWA (5G Home) Activation',
  planType: 'FWA 5G Home Plan',
  hideIptvToggle: true,
  addressUsesIdentity: false,
  creditCheck: false,
  autoDetectCafDevice: false,
  // Only the Digital CAF is signed on this device.
  cafNeedsSignature: (type) => type === 'Digital',
  order: {
    orderType: 'New FWA Postpaid Outdoor Order',
    // B2B2C FWA orders route to manager approval first (UJ-062 "New FWA Tablet
    // Indoor B2B2C Order with Manager Approval") - approving one moves it on to
    // Pending WFM Installation rather than completing it directly, since
    // installation still needs to happen (see nextStatusOnApproval).
    status: (contact) => (contact.isB2B2C ? 'Submitted for Approval' : 'Pending WFM Installation'),
    nextStatusOnApproval: 'Pending WFM Installation',
    createdBy: 'AGENT-KARTHIKK',
    sourceChannel: 'Desktop',
  },
  submittedMessage: ({ orderId, appointment, isB2B2C }) =>
    isB2B2C
      ? `FWA order ${orderId} submitted for manager approval (B2B2C) - WFM installation booked for ${appointment.date} (${appointment.timeSlot}) once approved.`
      : `FWA order ${orderId} submitted - WFM installation appointment booked for ${appointment.date} (${appointment.timeSlot}).`,
  successRoute: '/fwa-5g-home',
};

export function NewFwaWizard() {
  return <InstallationActivationWizard config={FWA_CONFIG} />;
}
