import { CARD_SELECTED, CARD_IDLE } from '../primitives/offerCardParts';
import { useEffect, useState } from 'react';
import * as mockDataEngine from '../../engines/mockDataEngine';
import { Badge } from '../primitives/Badge';
import { Button } from '../primitives/Button';
import { Checkbox } from '../primitives/Checkbox';
import { Icon } from '../primitives/Icon';
import { Input } from '../primitives/Input';
import { Select } from '../primitives/Select';
import { computeBillCycleDay, ordinal, tokenizeCard, INVOICE_RECIPIENTS } from './billingAccountModel';
import type { AccountRecord, BillingProfileRecord, ContactRecord, CustomerRecord, NewBillingAccountValue, BillingAccountValue } from './billingAccountModel';
import { BillingProfileSetupDrawer } from './BillingProfileSetupDrawer';


const CHEVRON_DOWN = 'M6 9l6 6 6-6';
const CHEVRON_UP = 'M18 15l-6-6-6 6';
// Ruled form sections inside the Create New card: a bold heading, space below it, a divider between sections.
const SECTION = 'space-y-3';
const SECTION_RULE = 'border-t border-border-soft mt-6 pt-6';
const SECTION_TITLE = 'text-fg font-semibold text-[length:var(--fs-body-lg)]';

interface BillingAccountStepProps {
  customerId: string | undefined;
  /** The Communication Address step's own address, offered as "use the same
   * address" default rather than asking the agent to retype it. */
  defaultAddressLine: string | undefined;
  value: BillingAccountValue;
  onChange: (value: BillingAccountValue) => void;
  /**
   * The customer's email as captured on Customer Identification (masked for a new customer).
   * It is the single source of truth for the journey: when given, it is shown in place of the
   * address stored on each billing profile, never a second lookup.
   */
  customerEmail?: string;
}

// "Billing Profile" (2026-09-28 request) - Step 3 of New Postpaid Activation,
// immediately after Communication Address. Two mutually exclusive paths: pick
// one of the customer's existing billing accounts (business-rules.json's
// "Consumer Billing Profile Cap" - at most two for a Consumer, unlimited for
// Enterprise - gates whether "Create New" is offered at all), or create one.
export function BillingAccountStep({
  customerId,
  defaultAddressLine,
  value,
  onChange,
  customerEmail,
}: BillingAccountStepProps) {
  const [profiles, setProfiles] = useState<(BillingProfileRecord & { accountType: string })[]>([]);
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [customerSegment, setCustomerSegment] = useState<string | undefined>(undefined);
  const [loaded, setLoaded] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [cardError, setCardError] = useState<string | null>(null);

  useEffect(() => {
    if (!customerId) return;
    (async () => {
      const [accounts, allProfiles, allContacts, allCustomers] = await Promise.all([
        mockDataEngine.list<AccountRecord>('accounts'),
        mockDataEngine.list<BillingProfileRecord>('billing-profiles'),
        mockDataEngine.list<ContactRecord>('customer-contacts'),
        mockDataEngine.list<CustomerRecord>('customers'),
      ]);
      const ownAccounts = accounts.filter((a) => a.customerId === customerId);
      const ownProfiles = ownAccounts
        .map((a) => {
          const p = allProfiles.find((pr) => pr.billingProfileId === a.billingProfileId);
          return p ? { ...p, accountType: a.accountType } : undefined;
        })
        .filter((p): p is BillingProfileRecord & { accountType: string } => Boolean(p));
      setProfiles(ownProfiles);
      setContacts(allContacts.filter((c) => c.customerId === customerId));
      setCustomerSegment(allCustomers.find((c) => c.customerId === customerId)?.segment);
      setLoaded(true);
    })();
  }, [customerId]);

  const newAccount = value.newAccount ?? {};
  const setNewAccount = (patch: Partial<NewBillingAccountValue>) =>
    onChange({ ...value, newAccount: { ...newAccount, ...patch } });

  const asOf = new Date();
  const billCycleDay =
    customerSegment === 'VIP' && newAccount.billCycleOverride && newAccount.billCycleDay
      ? newAccount.billCycleDay
      : computeBillCycleDay(customerSegment, asOf);

  // "A consumer can have at most two billing profiles (one postpaid, one
  // prepaid); enterprises can have more" (business-rules.json) - this
  // journey only ever creates a postpaid profile, so a Consumer who already
  // holds two of ANY type has nowhere left for a new one to go.
  const atConsumerCap = customerSegment !== 'Enterprise' && profiles.length >= 2;

  const validateCard = () => {
    const result = tokenizeCard(cardNumber);
    if (!result) {
      setCardError('Enter a valid card number.');
      setNewAccount({ cardLast4: undefined, cardToken: undefined });
      return;
    }
    setCardError(null);
    setNewAccount({ cardLast4: result.last4, cardToken: result.token });
  };

  if (!loaded) {
    return <p className="text-muted text-[length:var(--fs-body)]">Loading billing accounts…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-fg font-semibold text-[length:var(--fs-body-lg)] mb-1">Existing Billing Accounts</h3>
        {profiles.length === 0 ? (
          <p className="text-muted text-[length:var(--fs-body)]">No billing accounts on file for this customer yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {profiles.map((p, i) => {
              const selected = value.selectedProfileId === p.billingProfileId;
              return (
                <button
                  key={p.billingProfileId}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onChange({ selectedProfileId: p.billingProfileId, creatingNew: false })}
                  className={`text-left rounded-[var(--radius-card)] border p-4 ${
                    selected
                      ? CARD_SELECTED
                      : CARD_IDLE
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-fg font-medium">Account ending …{p.billingProfileId.slice(-4)}</span>
                    {i === 0 && <Badge variant="filled-neutral">Default</Badge>}
                  </div>
                  <p className="text-fg-2 text-[length:var(--fs-caption)]">Primary contact: {p.billingContactName}</p>
                  <p className="text-muted text-[length:var(--fs-caption)]">
                    {p.billingAddress} · {customerEmail ?? p.billingContactEmail}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* "A consumer can have at most two billing profiles" - once a Consumer
          already holds two, there is nowhere for a new one to go, so the
          option to create one is withheld rather than offered and then
          rejected at submission. */}
      {atConsumerCap ? (
        <p className="text-muted text-[length:var(--fs-caption)]">
          This customer already holds the maximum of two billing profiles for a Consumer account - select one above.
        </p>
      ) : (
        <div className="border border-[var(--field-card-border)] rounded-[var(--radius-card)]">
          {/* Layout per the 2026-10-10 "Create New Billing Account" reference: a titled header with a one-line
              brief, a divider, then the form in ruled sections. The header is still the expand/collapse toggle
              (the old [+]/[-] prefix became a chevron, kept at the left so the floating Customer view button never covers it). */}
          <button
            type="button"
            onClick={() => onChange({ ...value, creatingNew: !value.creatingNew, selectedProfileId: undefined })}
            aria-expanded={Boolean(value.creatingNew)}
            className={`w-full flex items-center gap-3 px-6 py-4 text-left ${
              value.creatingNew ? 'border-b border-border-soft' : ''
            }`}
          >
            <Icon path={value.creatingNew ? CHEVRON_UP : CHEVRON_DOWN} className="w-5 h-5 shrink-0 text-muted" />
            <span className="flex-1">
              <span className="block text-fg font-semibold text-[length:var(--fs-h5)]">Create New Billing Account</span>
              <span className="block text-fg-2 text-[length:var(--fs-body)]">
                Provide the following details to set up your billing account.
              </span>
            </span>
          </button>

          {value.creatingNew && (
            <div className="px-6 pb-6">
              {/* Contact */}
              <div className={`${SECTION} pt-6`}>
                <h4 className={SECTION_TITLE}>Contact</h4>
                <Select
                  label="Primary Contact"
                  required
                  value={newAccount.primaryContactId ?? ''}
                  onChange={(e) => setNewAccount({ primaryContactId: e.target.value })}
                  placeholder="Select contact"
                  options={contacts.map((c) => ({
                    value: c.contactRecordId,
                    label: [c.firstName, c.middleName, c.lastName].filter(Boolean).join(' '),
                  }))}
                />
                <label className="flex items-center gap-2 text-[length:var(--fs-body)] text-fg cursor-pointer">
                  <Checkbox
                    checked={newAccount.hasSecondaryContact ?? false}
                    onChange={(e) =>
                      setNewAccount({
                        hasSecondaryContact: e.target.checked,
                        secondaryContactName: e.target.checked ? newAccount.secondaryContactName : undefined,
                      })
                    }
                  />
                  Add a secondary contact
                </label>
                {newAccount.hasSecondaryContact && (
                  <Input
                    label="Secondary Contact Name"
                    required
                    placeholder="Full name"
                    value={newAccount.secondaryContactName ?? ''}
                    onChange={(e) => setNewAccount({ secondaryContactName: e.target.value })}
                  />
                )}
              </div>

              {/* Billing Address */}
              <div className={`${SECTION} ${SECTION_RULE}`}>
                <h4 className={SECTION_TITLE}>Billing Address</h4>
                <label className="flex items-center gap-2 text-[length:var(--fs-body)] text-fg cursor-pointer">
                  <Checkbox
                    checked={newAccount.useSameAddress ?? true}
                    onChange={(e) => setNewAccount({ useSameAddress: e.target.checked })}
                  />
                  Use same address as Communication Address
                </label>
                {newAccount.useSameAddress ?? true ? (
                  <p className="text-muted text-[length:var(--fs-caption)]">{defaultAddressLine || 'No communication address on file yet.'}</p>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    <Input
                      label="Street"
                      required
                      value={newAccount.newStreet ?? ''}
                      onChange={(e) => setNewAccount({ newStreet: e.target.value })}
                    />
                    <Input
                      label="Area"
                      required
                      value={newAccount.newArea ?? ''}
                      onChange={(e) => setNewAccount({ newArea: e.target.value })}
                    />
                    <Input
                      label="Building"
                      required
                      value={newAccount.newBuilding ?? ''}
                      onChange={(e) => setNewAccount({ newBuilding: e.target.value })}
                    />
                  </div>
                )}
              </div>

              {/* Payment */}
              <div className={`${SECTION} ${SECTION_RULE}`}>
                <h4 className={SECTION_TITLE}>Payment</h4>
                <Select
                  label="Preferred Invoice Recipient"
                  required
                  value={newAccount.preferredInvoiceRecipient ?? ''}
                  onChange={(e) => setNewAccount({ preferredInvoiceRecipient: e.target.value })}
                  placeholder="e.g. Primary Contact"
                  options={
                    newAccount.hasSecondaryContact
                      ? INVOICE_RECIPIENTS
                      : INVOICE_RECIPIENTS.filter((r) => r.value === 'Primary Contact')
                  }
                />
                <div>
                  <p className="text-[length:var(--fs-label)] text-fg-2 mb-1">
                    Bill Cycle
                    <span className="text-muted"> (DEMO ONLY)</span>
                  </p>
                  <p className="text-fg text-[length:var(--fs-body)]">
                    {ordinal(billCycleDay)} of the Month{customerSegment === 'VIP' ? ' (VIP default)' : ' (Default)'}
                  </p>
                  {/* Manual override only reachable for a VIP segment - see
                      computeBillCycleDay's own note on why no seeded customer
                      can currently reach this branch. */}
                  {customerSegment === 'VIP' && (
                    <label className="flex items-center gap-2 text-[length:var(--fs-caption)] text-fg-2 cursor-pointer mt-1">
                      <Checkbox
                        checked={newAccount.billCycleOverride ?? false}
                        onChange={(e) => setNewAccount({ billCycleOverride: e.target.checked })}
                      />
                      Requires VIP segment details - use a different date
                    </label>
                  )}
                </div>
                <Input
                  label="Card Number"
                  required
                  placeholder="•••• •••• •••• ••••"
                  value={cardNumber}
                  onChange={(e) => {
                    setCardNumber(e.target.value);
                    setCardError(null);
                    setNewAccount({ cardLast4: undefined, cardToken: undefined });
                  }}
                  onBlur={validateCard}
                  error={cardError ?? undefined}
                  helperText="Only the last 4 digits and a generated token are stored (Gatan gateway simulation)."
                />
                {newAccount.cardToken && (
                  <p className="text-success text-[length:var(--fs-caption)]">
                    Card ending {newAccount.cardLast4} tokenized - {newAccount.cardToken}
                  </p>
                )}
                <label className="flex items-center gap-2 text-[length:var(--fs-body)] text-fg-2 cursor-not-allowed">
                  <Checkbox checked disabled />
                  Set as primary payment profile
                  <span className="text-muted text-[length:var(--fs-caption)]">(only profile being created here)</span>
                </label>
              </div>

              {/* Billing Profile Setup */}
              <div className={`space-y-2 ${SECTION_RULE}`}>
                <div className="flex items-center justify-between">
                  <h4 className={SECTION_TITLE}>Billing Profile Setup</h4>
                  <Button variant="secondary" compact onClick={() => setSetupOpen(true)}>
                    + Add Profile
                  </Button>
                </div>
                {newAccount.profileName ? (
                  <dl className="card card-surface p-3 text-[length:var(--fs-caption)]">
                    <div className="flex justify-between gap-3 py-1">
                      <dt className="text-fg-2">Billing Profile Name</dt>
                      <dd className="text-fg font-medium">{newAccount.profileName}</dd>
                    </div>
                    <div className="flex justify-between gap-3 py-1">
                      <dt className="text-fg-2">Bill Media</dt>
                      <dd className="text-fg font-medium">{newAccount.billMedia}</dd>
                    </div>
                    <div className="flex justify-between gap-3 py-1">
                      <dt className="text-fg-2">Billing Schedule</dt>
                      <dd className="text-fg font-medium">{newAccount.billingSchedule}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="text-muted text-[length:var(--fs-caption)]">Not yet configured – required before this account can be finalised.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <BillingProfileSetupDrawer
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        value={newAccount}
        onSave={(patch) => setNewAccount(patch)}
      />
    </div>
  );
}
