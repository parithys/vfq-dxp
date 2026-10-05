import type { WizardStep } from './guidedWizardTypes';
import { GuidedContactStep } from './GuidedContactStep';
import { isValidAltPhone, isValidEmail, hasIdentityDetails } from './guidedContactModel';
import type { GuidedContactValue } from './guidedContactModel';
import { ActivityCommentsStep } from './ActivityCommentsStep';
import type { CafType } from './cafTypes';

// Step definitions several guided journeys share. Each journey still lists its own steps, in its own order;
// these only stop the identical ones being written out again in every wizard.

/** The captured CAF: its type and, once signed on this device, the signature. */
export type CafValue = { cafType?: CafType; signatureDataUrl?: string };

/**
 * Whether the CAF step may continue: a type is chosen and, for the types that are signed on this device,
 * the signature is captured. By default only the Digital CAF is signed here.
 */
export function isCafValid(caf: CafValue | undefined, needsSignature: (type: CafType) => boolean = (type) => type === 'Digital'): boolean {
  if (!caf?.cafType) return false;
  return !needsSignature(caf.cafType) || Boolean(caf.signatureDataUrl);
}

/** Contact: the MOI identity lookup plus identity, e-mail and alternate-phone details. */
export function contactStep(opts: { hideIptvToggle?: boolean } = {}): WizardStep {
  return {
    key: 'contact',
    label: 'Contact',
    render: ({ values, setValue }) => (
      <GuidedContactStep
        value={(values.contact as GuidedContactValue) ?? {}}
        onChange={(v) => setValue('contact', v)}
        showIptvToggle={opts.hideIptvToggle ? false : undefined}
      />
    ),
    isValid: (values) => {
      const c = values.contact as GuidedContactValue | undefined;
      return Boolean(c?.moiResult && hasIdentityDetails(c ?? {}) && isValidEmail(c?.email) && isValidAltPhone(c?.altPhone));
    },
  };
}

/** Activity: the agent's comments, required before the journey can finish. */
export function activityStep(): WizardStep {
  return {
    key: 'activity',
    label: 'Activity',
    render: ({ values, setValue }) => (
      <ActivityCommentsStep value={(values.comments as string) ?? ''} onChange={(v) => setValue('comments', v)} />
    ),
    isValid: (values) => Boolean((values.comments as string)?.trim()),
  };
}
