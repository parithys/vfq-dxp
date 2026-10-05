import { useEffect, useState } from 'react';
import * as mockDataEngine from '../../engines/mockDataEngine';
import { Badge } from '../primitives/Badge';
import { Button } from '../primitives/Button';
import { Checkbox } from '../primitives/Checkbox';
import { Drawer } from '../primitives/Drawer';
import { Input } from '../primitives/Input';
import { Select } from '../primitives/Select';

interface AccountRecord {
  accountId: string;
  customerId: string;
  accountType: string;
  billingProfileId: string;
}

interface BillingProfileRecord {
  billingProfileId: string;
  accountId: string;
  name: string;
  billingCycle: string;
  billingAddress: string;
  billMedium: string;
  billingContactName: string;
  billingContactEmail: string;
}

interface ContactRecord {
  contactRecordId: string;
  customerId: string;
  firstName: string;
  middleName?: string;
  lastName: string;
}

interface CustomerRecord {
  customerId: string;
  segment: string;
}

export interface NewBillingAccountValue {
  primaryContactId?: string;
  hasSecondaryContact?: boolean;
  secondaryContactName?: string;
  useSameAddress?: boolean;
  newStreet?: string;
  newArea?: string;
  newBuilding?: string;
  preferredInvoiceRecipient?: string;
  /** Auto-computed from computeBillCycleDay(); only overridable for a VIP
   * segment - see that function's own note on the evidenced vs. assumed
   * halves of this rule. */
  billCycleDay?: number;
  billCycleOverride?: boolean;
  /** Only the last 4 digits and a generated token ever persist here - see
   * tokenizeCard()'s own note on why the full number is never stored. */
  cardLast4?: string;
  cardToken?: string;
  profileName?: string;
  billMedia?: string;
  billingSchedule?: string;
}

export interface BillingAccountValue {
  /** Set when the agent picked an account already on file. Mutually
   * exclusive with `creatingNew`. */
  selectedProfileId?: string;
  creatingNew?: boolean;
  newAccount?: NewBillingAccountValue;
  /** Set by BillingAccountAutoResolver: the customer this value was resolved
   * for ('new' when there is no customer record yet). */
  autoResolvedFor?: string;
}

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

/**
 * "Bill Cycle" (2026-09-28 request): "VIP customers default to the 7th of
 * every month. All other customer segments are assigned to either the 1st
 * or 15th, depending on which date is closer to the three-day submission
 * window."
 *
 * EVIDENCED HALF: business-rules.json's "Default Postpaid Billing Cycle
 * Rule" confirms postpaid profiles default to automatic 1st/15th cycles.
 * ASSUMED HALF: no rule in the corpus defines a "VIP" customer segment or a
 * 7th-of-month VIP default - customers.json's own `segment` values are only
 * ever "Consumer"/"Enterprise" in this app's seed data. Implemented exactly
 * as directed, gated on `segment === 'VIP'` so it activates the moment a
 * VIP-segmented customer record exists, without inventing one now.
 */
export function computeBillCycleDay(segment: string | undefined, asOf: Date): number {
  if (segment === 'VIP') return 7;
  const submissionWindowEnd = new Date(asOf);
  submissionWindowEnd.setDate(submissionWindowEnd.getDate() + 3);
  const day = submissionWindowEnd.getDate();
  return Math.abs(day - 1) <= Math.abs(day - 15) ? 1 : 15;
}

function ordinal(day: number): string {
  if (day === 1) return '1st';
  if (day === 15) return '15th';
  if (day === 7) return '7th';
  return `${day}th`;
}

/**
 * "Validation of payment details ... is required for successful processing,
 * with only the last four digits of the card and a generated token number
 * stored for security" (2026-09-28) - the raw number this function receives
 * is never returned or stored anywhere past this call, matching that rule.
 *
 * UNEVIDENCED: no payment gateway is named anywhere in this corpus. The
 * screenshot accompanying this request said "Gatan gateway simulation" -
 * kept verbatim in the token prefix and the field's own helper text as a
 * demo label, not a real integration.
 */
function tokenizeCard(cardNumber: string): { last4: string; token: string } | null {
  const digits = cardNumber.replace(/\D/g, '');
  if (digits.length < 12) return null;
  const last4 = digits.slice(-4);
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 10; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
  return { last4, token: `GATAN-${suffix}` };
}

const INVOICE_RECIPIENTS = [
  { value: 'Primary Contact', label: 'Primary Contact' },
  { value: 'Secondary Contact', label: 'Secondary Contact' },
];

const BILL_MEDIA_OPTIONS = [
  { value: 'Email', label: 'Email' },
  { value: 'Paper Bill', label: 'Paper Bill' },
  { value: 'SMS', label: 'SMS' },
];

const BILLING_SCHEDULE_OPTIONS = [
  { value: 'Immediate', label: 'Immediate' },
  { value: 'Next Cycle', label: 'Next Cycle' },
];

// "Billing Profile Setup" (2026-09-28 screenshot) - a short secondary
// disclosure for the three fields that name and route the profile itself,
// kept out of the main form so that form reads as "who/where/how they pay"
// and this reads as "what the profile itself is called and how it behaves."
// Drawer, not Modal, per Modal.tsx's own reservation ("short confirmation
// messages only") - this is a small form, which is exactly what Drawer.tsx
// says it exists for instead.
function BillingProfileSetupDrawer({
  open,
  onClose,
  value,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  value: NewBillingAccountValue;
  onSave: (patch: Pick<NewBillingAccountValue, 'profileName' | 'billMedia' | 'billingSchedule'>) => void;
}) {
  const [profileName, setProfileName] = useState(value.profileName ?? '');
  const [billMedia, setBillMedia] = useState(value.billMedia ?? 'Email');
  const [billingSchedule, setBillingSchedule] = useState(value.billingSchedule ?? 'Immediate');

  return (
    <Drawer open={open} onClose={onClose} title="Billing Profile Setup">
      <div className="space-y-4">
        <Input
          label="Billing Profile Name"
          required
          placeholder="e.g. My Account"
          value={profileName}
          onChange={(e) => setProfileName(e.target.value)}
        />
        <Select
          label="Bill Media"
          value={billMedia}
          onChange={(e) => setBillMedia(e.target.value)}
          options={BILL_MEDIA_OPTIONS}
        />
        <Select
          label="Billing Schedule"
          value={billingSchedule}
          onChange={(e) => setBillingSchedule(e.target.value)}
          options={BILLING_SCHEDULE_OPTIONS}
        />
        <Button
          variant="primary-rect"
          disabled={!profileName.trim()}
          onClick={() => {
            onSave({ profileName: profileName.trim(), billMedia, billingSchedule });
            onClose();
          }}
        >
          Save
        </Button>
      </div>
    </Drawer>
  );
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
                  onClick={() => onChange({ selectedProfileId: p.billingProfileId, creatingNew: false })}
                  className={`text-left rounded-[var(--radius-card)] border p-4 ${
                    selected
                      ? 'border-[var(--field-card-selected)] bg-[var(--field-card-selected-bg)] shadow-[var(--shadow-selected-ring)]'
                      : 'border-[var(--field-card-border)] bg-bg hover:border-[var(--field-card-hover-border)] hover:ring-1 hover:ring-inset hover:ring-[var(--field-card-hover-border)] hover:bg-[var(--field-card-hover-bg)]'
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
          <button
            type="button"
            onClick={() => onChange({ ...value, creatingNew: !value.creatingNew, selectedProfileId: undefined })}
            className="w-full flex items-center justify-between px-4 py-3 text-fg font-medium"
          >
            <span>{value.creatingNew ? '[-]' : '[+]'} Create New Billing Account</span>
          </button>

          {value.creatingNew && (
            <div className="px-4 pb-4 space-y-6 border-t border-border-soft pt-4">
              {/* Contact */}
              <div className="space-y-3">
                <h4 className="text-fg font-medium text-[length:var(--fs-body)]">Contact</h4>
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
                  Secondary Contact
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
              <div className="space-y-3">
                <h4 className="text-fg font-medium text-[length:var(--fs-body)]">Billing Address</h4>
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
              <div className="space-y-3">
                <h4 className="text-fg font-medium text-[length:var(--fs-body)]">Payment</h4>
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
                  Primary Payment Profile
                  <span className="text-muted text-[length:var(--fs-caption)]">(the only profile being created here)</span>
                </label>
              </div>

              {/* Billing Profile Setup */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-fg font-medium text-[length:var(--fs-body)]">Billing Profile Setup</h4>
                  <Button variant="ghost-rect" compact onClick={() => setSetupOpen(true)}>
                    + Add
                  </Button>
                </div>
                {newAccount.profileName ? (
                  <dl className="rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-surface p-3 text-[length:var(--fs-caption)]">
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
                  <p className="text-muted text-[length:var(--fs-caption)]">Not yet configured - required before this account can be finalised.</p>
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

/** Same gate the wizard's own isValid reads - kept alongside the component so
 * the two cannot drift apart. */
export function isBillingAccountValid(value: BillingAccountValue): boolean {
  if (value.selectedProfileId) return true;
  if (!value.creatingNew) return false;
  const a = value.newAccount ?? {};
  if (!a.primaryContactId) return false;
  if (a.hasSecondaryContact && !a.secondaryContactName?.trim()) return false;
  if (!(a.useSameAddress ?? true)) {
    if (!a.newStreet?.trim() || !a.newArea?.trim() || !a.newBuilding?.trim()) return false;
  }
  if (!a.preferredInvoiceRecipient) return false;
  if (!a.cardToken) return false;
  if (!a.profileName?.trim()) return false;
  return true;
}


/**
 * Headless replacement for the Billing Profile page (2026-10-01 request): an
 * existing billing account is selected automatically, and when the customer
 * has none one is created, so the agent never has to visit the step.
 *
 * Mounts anywhere before checkout and renders nothing. It re-resolves only
 * when the customer changes, so an agent who later overrides the value is not
 * overwritten.
 *
 * The auto-created account carries no card: card-on-file tokenisation needs
 * the agent to key a card number, which an automatic step cannot do, so
 * `cardToken`/`cardLast4` stay unset and the order records none.
 */
export function BillingAccountAutoResolver({
  customerId,
  customerName,
  value,
  onChange,
}: {
  customerId: string | undefined;
  customerName?: string;
  value: BillingAccountValue;
  onChange: (value: BillingAccountValue) => void;
}) {
  const key = customerId ?? 'new';
  useEffect(() => {
    if (value.autoResolvedFor === key) return;
    let cancelled = false;
    (async () => {
      const [accounts, allProfiles, allContacts, allCustomers] = customerId
        ? await Promise.all([
            mockDataEngine.list<AccountRecord>('accounts'),
            mockDataEngine.list<BillingProfileRecord>('billing-profiles'),
            mockDataEngine.list<ContactRecord>('customer-contacts'),
            mockDataEngine.list<CustomerRecord>('customers'),
          ])
        : [[], [], [], []];
      if (cancelled) return;
      const own = (accounts as AccountRecord[])
        .filter((a) => a.customerId === customerId)
        .map((a) => allProfiles.find((pr) => pr.billingProfileId === a.billingProfileId))
        .filter((p): p is BillingProfileRecord => Boolean(p));
      if (own.length > 0) {
        onChange({ selectedProfileId: own[0].billingProfileId, autoResolvedFor: key });
        return;
      }
      const segment = (allCustomers as CustomerRecord[]).find((c) => c.customerId === customerId)?.segment;
      const contact = (allContacts as ContactRecord[]).find((c) => c.customerId === customerId);
      onChange({
        creatingNew: true,
        autoResolvedFor: key,
        newAccount: {
          primaryContactId: contact?.contactRecordId,
          useSameAddress: true,
          preferredInvoiceRecipient: 'Primary Contact',
          billCycleDay: computeBillCycleDay(segment, new Date()),
          profileName: `${customerName ?? 'New customer'} - Postpaid`,
          billMedia: 'Email',
          billingSchedule: 'Immediate',
        },
      });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}
