import type { GuidedContactValue } from '../../../components/patterns/guidedContactModel';
import { maskEmail } from '../../../components/patterns/guidedContactModel';
import { SimTypeStep } from '../../../components/domain/SimTypeStep';
import type { SimTypeValue } from '../../../components/domain/SimTypeStep';
import type { WizardStep } from '../../../components/patterns/wizard/guidedWizardTypes';

// Device & DOI was removed from this journey on 2026-09-27 per the
// annotated walkthrough ("Remove this screen completed"). Device
// bundling and the BR-114 DOI declaration are therefore out of scope
// for a new postpaid activation; nothing else set `values.doi`, so
// the down-payment term of Due Today, the monthly installment term of
// the recurring charge, and the five device_* fields on the order
// record all went with it rather than being left to read as
// permanently absent.
export function simTypeStep(): WizardStep {
  return {
    key: 'simType',
    label: 'SIM Type',
    render: ({ values, setValue }) => {
      const contact = values.contact as GuidedContactValue | undefined;
      return (
        <SimTypeStep
          value={(values.simType as SimTypeValue) ?? {}}
          customerEmail={contact?.moiResult?.isNewCustomer && contact.email ? maskEmail(contact.email) : contact?.email}
          onChange={(v) => setValue('simType', v)}
        />
      );
    },
    isValid: (values) => {
      const s = values.simType as SimTypeValue | undefined;
      if (s?.simType === 'Physical') return s.simValid === true;
      if (s?.simType === 'eSIM') return s.esimIssued === true;
      return false;
    },
    // "On a successful complete scan ... automatically continue"
    // (2026-09-28) - Physical only. eSIM's "Select eSIM" is a choice
    // to review (QR-after-payment messaging, customer email), not a
    // validation result to act on immediately, so it stays a manual
    // Continue like every other non-scan step.
    autoAdvanceWhen: (values) => {
      const s = values.simType as SimTypeValue | undefined;
      return s?.simType === 'Physical' && s.simValid === true;
    },
  };
}
