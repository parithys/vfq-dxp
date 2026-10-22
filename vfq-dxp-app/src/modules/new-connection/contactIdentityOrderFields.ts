import type { GuidedContactValue } from '../../capabilities';

/**
 * What an order records, against the contact, of the Sponsor (employer) and Occupation shown on Identity Details: the values the identity
 * lookup brought from the customer record, as the agent saw them. Absent on the record means absent on the order (never a default), and
 * the keys are separate from `companyName`, which is the B2B2C company a customer type selects. Shared by every journey's order, so they
 * record the same two fields the same way.
 */
export function contactIdentityOrderFields(contact: Pick<GuidedContactValue, 'companyName' | 'occupation'> | undefined): { customerSponsor?: string; customerOccupation?: string } {
  const sponsor = contact?.companyName?.trim();
  const occupation = contact?.occupation?.trim();
  return { ...(sponsor ? { customerSponsor: sponsor } : {}), ...(occupation ? { customerOccupation: occupation } : {}) };
}
