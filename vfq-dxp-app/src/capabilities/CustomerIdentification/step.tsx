import { CUSTOMER_IDENTIFICATION_LABEL } from '../../data/stepLabels';
import type { WizardStep } from '../../components/patterns/wizard/guidedWizardTypes';
import { CustomerIdentification } from './CustomerIdentification';
import { isValidAltPhone, isValidEmail, hasIdentityDetails } from '../../components/patterns/guidedContactModel';
import type { GuidedContactValue } from '../../components/patterns/guidedContactModel';
import type { IdLookupValue } from '../../components/patterns/idLookupModel';

/** Contact: the MOI identity lookup plus identity, e-mail and alternate-phone details. */
export function contactStep(opts: { hideIptvToggle?: boolean } = {}): WizardStep {
  return {
    key: 'contact',
    label: CUSTOMER_IDENTIFICATION_LABEL,
    render: ({ values, setValue }) => (
      <CustomerIdentification
        collectContact
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

/** Identity lookup (ID type, number, MOI fetch) stored under `field`; continues once MOI has resolved. */
export function idLookupStep(opts: { key: string; field: string; manualEntry?: boolean }): WizardStep {
  return {
    key: opts.key,
    label: CUSTOMER_IDENTIFICATION_LABEL,
    render: ({ values, setValue }) => (
      <CustomerIdentification value={(values[opts.field] as IdLookupValue) ?? {}} onChange={(v) => setValue(opts.field, v)} manualEntry={opts.manualEntry} />
    ),
    isValid: (values) => Boolean((values[opts.field] as IdLookupValue | undefined)?.moiResult),
 };
}
