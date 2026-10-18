import { CARD_SELECTED, CARD_IDLE } from '../primitives/offerCardParts';
import { useEffect, useRef, useState } from 'react';
import * as mockDataEngine from '../../engines/mockDataEngine';
import { Badge } from '../primitives/Badge';
import { Button } from '../primitives/Button';
import { Checkbox } from '../primitives/Checkbox';
import { Icon } from '../primitives/Icon';
import { Input } from '../primitives/Input';
import { Select } from '../primitives/Select';
import { useAreaOptions } from '../../hooks/useAreaOptions';
import { BILLING_MODES, BILL_CYCLE_DAYS, CARD_NUMBER_LENGTH, DEFAULT_BILLING_MODE, cardDigits, computeBillCycleDay, formatCardNumber, ordinal, tokenizeCard, INVOICE_RECIPIENTS } from './billingAccountModel';
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
  /** The identified customer's name: the primary contact to offer when no contact records are on file (a new customer). */
  customerName?: string;
}

// "Billing Profile" (2026-09-28 request) - Step 3 of New Postpaid Activation,
// immediately after Communication Address. Two mutually exclusive paths: pick
// one of the customer's existing billing accounts (business-rules.json's
// "Consumer Billing Profile Cap" - at most two for a Consumer, unlimited for
// Enterprise - gates whether "Create New" is offered at all), or create one.
// What this step loaded for a customer, kept for the session: coming back to the step (Edit in the summary, or Back) shows
// it at once instead of waiting through the data loads again. It is still refreshed in the background every time.
interface BillingData {
  profiles: (BillingProfileRecord & { accountType: string })[];
  contacts: ContactRecord[];
  segment: string | undefined;
}
// The primary-contact value for the identified customer when there are no contact records to pick from.
const NEW_CUSTOMER_CONTACT = 'CUSTOMER';
const billingDataCache = new Map<string, BillingData>();

export function BillingAccountStep({
  customerId,
  defaultAddressLine,
  value,
  onChange,
  customerEmail,
  customerName,
}: BillingAccountStepProps) {
  const areaOptions = useAreaOptions();
  const cached = customerId ? billingDataCache.get(customerId) : undefined;
  const [profiles, setProfiles] = useState<(BillingProfileRecord & { accountType: string })[]>(cached?.profiles ?? []);
  const [contacts, setContacts] = useState<ContactRecord[]>(cached?.contacts ?? []);
  const [customerSegment, setCustomerSegment] = useState<string | undefined>(cached?.segment);
  const [loaded, setLoaded] = useState(Boolean(cached));
  const [setupOpen, setSetupOpen] = useState(false);
  // The card number is held as digits only; it is shown in groups of four (formatCardNumber).
  const [cardNumber, setCardNumber] = useState('');
  const cardInputRef = useRef<HTMLInputElement>(null);
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
      const data: BillingData = {
        profiles: ownProfiles,
        contacts: allContacts.filter((c) => c.customerId === customerId),
        segment: allCustomers.find((c) => c.customerId === customerId)?.segment,
      };
      billingDataCache.set(customerId, data);
      setProfiles(data.profiles);
      setContacts(data.contacts);
      setCustomerSegment(data.segment);
      setLoaded(true);
    })();
  }, [customerId]);

  const newAccount = value.newAccount ?? {};
  const setNewAccount = (patch: Partial<NewBillingAccountValue>) =>
    onChange({ ...value, newAccount: { ...newAccount, ...patch } });

  const asOf = new Date();
  // The default day for this customer; the agent can pick another (newAccount.billCycleDay).
  const defaultBillCycleDay = computeBillCycleDay(customerSegment, asOf);
  const billCycleDay = newAccount.billCycleDay ?? defaultBillCycleDay;

  // "A consumer can have at most two billing profiles (one postpaid, one
  // prepaid); enterprises can have more" (business-rules.json) - this
  // journey only ever creates a postpaid profile, so a Consumer who already
  // holds two of ANY type has nowhere left for a new one to go.
  const atConsumerCap = customerSegment !== 'Enterprise' && profiles.length >= 2;

  const validateCard = () => {
    const result = tokenizeCard(cardNumber);
    if (!result) {
      setCardError(`Enter a ${CARD_NUMBER_LENGTH}-digit card number.`);
      setNewAccount({ cardLast4: undefined, cardToken: undefined });
      return;
    }
    setCardError(null);
    setNewAccount({ cardLast4: result.last4, cardToken: result.token });
  };

  // No customer yet (a new customer, or a journey that has not resolved one): there are no accounts to load, so the step
  // opens on its create form instead of waiting forever.
  if (customerId && !loaded) {
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
            onClick={() =>
              onChange({
                ...value,
                creatingNew: !value.creatingNew,
                selectedProfileId: undefined,
                // Opening the form fixes the primary-payment default: ticked only when the customer has no other profile.
                newAccount: { ...value.newAccount, primaryPaymentProfile: value.newAccount?.primaryPaymentProfile ?? profiles.length === 0 },
              })
            }
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
                {/* Primary and secondary contact share one row once a secondary contact is added. */}
                <div className={`grid gap-3 ${newAccount.hasSecondaryContact ? 'sm:grid-cols-2' : ''}`}>
                  <Select
                    label="Primary Contact"
                    required
                    value={newAccount.primaryContactId ?? ''}
                    onChange={(e) => setNewAccount({ primaryContactId: e.target.value })}
                    placeholder="Select contact"
                    // A customer with contact records picks one; a new customer has none yet, so the person identified in this
                    // journey is the contact (otherwise the list is empty and the step cannot be completed).
                    options={
                      contacts.length > 0 || !customerName
                        ? contacts.map((c) => ({
                            value: c.contactRecordId,
                            label: [c.firstName, c.middleName, c.lastName].filter(Boolean).join(' '),
                          }))
                        : [{ value: NEW_CUSTOMER_CONTACT, label: `${customerName} (the customer)` }]
                    }
                  />
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
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label="Street"
                        required
                        value={newAccount.newStreet ?? ''}
                        onChange={(e) => setNewAccount({ newStreet: e.target.value })}
                      />
                      <Input
                        label="Building"
                        required
                        value={newAccount.newBuilding ?? ''}
                        onChange={(e) => setNewAccount({ newBuilding: e.target.value })}
                      />
                    </div>
                    {/* The same three fields as the Additional Details of the service address. */}
                    <div className="grid grid-cols-3 gap-3">
                      <Select
                        label="Area / District"
                        required
                        placeholder="Select an area"
                        searchable
                        options={[...new Set([...(newAccount.newArea ? [newAccount.newArea] : []), ...areaOptions])].map((a) => ({ value: a, label: a }))}
                        value={newAccount.newArea ?? ''}
                        onChange={(e) => setNewAccount({ newArea: e.target.value })}
                      />
                      <Input
                        label="Flat / Apartment / Unit Number"
                        placeholder="e.g. 4B, 1402"
                        value={newAccount.newUnit ?? ''}
                        onChange={(e) => setNewAccount({ newUnit: e.target.value })}
                      />
                      <Input
                        label="Floor"
                        placeholder="e.g. 4"
                        value={newAccount.newFloor ?? ''}
                        onChange={(e) => setNewAccount({ newFloor: e.target.value })}
                      />
                    </div>
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
                {/* Bill cycle and billing mode on one row: the day the cycle starts (default by rule, editable) and how it bills. */}
                <div className="grid sm:grid-cols-2 gap-3">
                  <Select
                    label="Bill cycle"
                    required
                    value={String(billCycleDay)}
                    onChange={(e) => setNewAccount({ billCycleDay: Number(e.target.value) })}
                    helperText="Next cycle by default rule; VIP = 7th"
                    options={[...new Set([...BILL_CYCLE_DAYS, defaultBillCycleDay, billCycleDay])].sort((a, b) => a - b).map((d) => ({
                      value: String(d),
                      label: `${ordinal(d)} of every month${d === defaultBillCycleDay ? (customerSegment === 'VIP' ? ' (VIP default)' : ' (Default)') : ''}`,
                    }))}
                  />
                  <Select
                    label="Billing mode"
                    value={newAccount.billingMode ?? DEFAULT_BILLING_MODE}
                    onChange={(e) => setNewAccount({ billingMode: e.target.value })}
                    options={BILLING_MODES}
                  />
                </div>
                <Input
                  label="Card Number"
                  required
                  ref={cardInputRef}
                  inputMode="numeric"
                  autoComplete="cc-number"
                  placeholder="•••• •••• •••• ••••"
                  value={formatCardNumber(cardNumber)}
                  onChange={(e) => {
                    const el = e.target;
                    // Keep the caret next to the same digit after the spaces are re-inserted.
                    const digitsBeforeCaret = cardDigits(el.value.slice(0, el.selectionStart ?? el.value.length)).length;
                    const digits = cardDigits(el.value);
                    setCardNumber(digits);
                    setCardError(null);
                    setNewAccount({ cardLast4: undefined, cardToken: undefined });
                    requestAnimationFrame(() => {
                      const shown = formatCardNumber(digits);
                      let pos = 0;
                      for (let seen = 0; pos < shown.length && seen < digitsBeforeCaret; pos++) if (shown[pos] !== ' ') seen++;
                      cardInputRef.current?.setSelectionRange(pos, pos);
                    });
                  }}
                  // Copying or cutting gives the digits only, never the display spaces.
                  onCopy={(e) => {
                    const el = e.currentTarget;
                    e.clipboardData.setData('text/plain', cardDigits(el.value.slice(el.selectionStart ?? 0, el.selectionEnd ?? 0)));
                    e.preventDefault();
                  }}
                  onCut={(e) => {
                    const el = e.currentTarget;
                    const start = el.selectionStart ?? 0;
                    const end = el.selectionEnd ?? 0;
                    e.clipboardData.setData('text/plain', cardDigits(el.value.slice(start, end)));
                    e.preventDefault();
                    setCardNumber(cardDigits(el.value.slice(0, start) + el.value.slice(end)));
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
                <label className="flex items-center gap-2 text-[length:var(--fs-body)] text-fg cursor-pointer">
                  <Checkbox
                    checked={newAccount.primaryPaymentProfile ?? profiles.length === 0}
                    onChange={(e) => setNewAccount({ primaryPaymentProfile: e.target.checked })}
                  />
                  Set as primary payment profile
                  {profiles.length === 0 && <span className="text-muted text-[length:var(--fs-caption)]">(the customer's first billing profile)</span>}
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
                      <dt className="text-fg">Billing Profile Name</dt>
                      <dd className="text-fg font-medium">{newAccount.profileName}</dd>
                    </div>
                    <div className="flex justify-between gap-3 py-1">
                      <dt className="text-fg">Bill Media</dt>
                      <dd className="text-fg font-medium">{newAccount.billMedia}</dd>
                    </div>
                    <div className="flex justify-between gap-3 py-1">
                      <dt className="text-fg">Billing Schedule</dt>
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
