import { SIM_SERIAL_LABEL, SIM_TYPE_LABEL } from '../../data/stepLabels';
import type { GuidedContactValue } from '../../components/patterns/guidedContactModel';
import { maskEmail } from '../../components/patterns/guidedContactModel';
import type { SimTypeValue } from '../../components/domain/SimTypeStep';
import type { DeviceType } from '../../lib/deviceType';
import type { WizardStep } from '../../components/patterns/wizard/guidedWizardTypes';
import { SimType } from './SimType';
import { SimSerial } from './SimSerial';
import { simTypeSummary } from './summary';

/**
 * SIM type, stored under `simType`. Physical is complete once the serial validates; eSIM once it is issued. A
 * validated Physical SIM moves the journey on by itself ("on a successful complete scan ... automatically
 * continue", 2026-09-28); eSIM stays a manual Continue - it is a choice to review (QR-after-payment messaging,
 * customer email), not a validation result to act on at once.
 *
 * `customerEmail` is where an eSIM's QR code is sent; by default the email captured at Customer Identification,
 * masked for a new customer. `device` makes the serial field scan-led on a tablet and type-led on the web.
 */
export function simTypeStep(
  opts: {
    customerEmail?: (values: Record<string, unknown>) => string | undefined;
    device?: DeviceType;
    /** Says the agent chose a Pre-Paired SIM: the step scans one from the Pre-Paired inventory and takes the MSISDN from it. */
    prePaired?: (values: Record<string, unknown>) => boolean;
  } = {}
): WizardStep {
  const fromContact = (values: Record<string, unknown>) => {
    const contact = values.contact as GuidedContactValue | undefined;
    return contact?.moiResult?.isNewCustomer && contact.email ? maskEmail(contact.email) : contact?.email;
  };
  return {
    key: 'simType',
    summary: simTypeSummary,
    label: SIM_TYPE_LABEL,
    render: ({ values, setValue }) => (
      <SimType
        value={(values.simType as SimTypeValue) ?? {}}
        customerEmail={(opts.customerEmail ?? fromContact)(values)}
        device={opts.device}
        prePaired={opts.prePaired?.(values)}
        onChange={(v) => {
          setValue('simType', v);
          // A Pre-Paired SIM brings its own number, which is what the rest of the journey reads as the MSISDN.
          if (opts.prePaired?.(values)) setValue('msisdn', v.prePairedMsisdn);
        }}
      />
    ),
    isValid: (values) => {
      const s = values.simType as SimTypeValue | undefined;
      if (opts.prePaired?.(values)) return s?.prePaired === true && s.simValid === true && Boolean(values.msisdn);
      if (s?.simType === 'Physical') return s.simValid === true;
      if (s?.simType === 'eSIM') return s.esimIssued === true;
      return false;
    },
    autoAdvanceWhen: (values) => {
      const s = values.simType as SimTypeValue | undefined;
      // A Pre-Paired SIM stays on screen: its SIM and MSISDN details are what the agent confirms (SIM_02).
      if (opts.prePaired?.(values)) return false;
      return s?.simType === 'Physical' && s.simValid === true;
    },
  };
}

/**
 * SIM serial only, stored under `simSerial` with its validity under `simValid` and the ICCID / stock status / kind read from inventory
 * under `simDetails` - for journeys that put a new SIM in a number without choosing a type (port-in). Once the serial is scanned or
 * entered and validates, the journey moves on by itself: nothing is left for the agent to confirm.
 */
export function simSerialStep(): WizardStep {
  return {
    key: 'sim',
    label: SIM_SERIAL_LABEL,
    render: ({ values, setValue }) => (
      <SimSerial
        value={(values.simSerial as string) ?? ''}
        onChange={(v, valid, details) => {
          setValue('simSerial', v);
          setValue('simValid', valid);
          // Only a validated serial has details; an edit or a failed check clears the previous SIM's.
          setValue('simDetails', valid && details ? details : undefined);
        }}
      />
    ),
    isValid: (values) => values.simValid === true,
    autoAdvanceWhen: (values) => values.simValid === true && Boolean(values.simSerial),
  };
}
