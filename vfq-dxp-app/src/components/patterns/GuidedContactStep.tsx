import { IdLookupStep } from './IdLookupStep';
import type { QidType } from '../domain/QidInput';
import type { QidImageUploadValue } from '../domain/QidImageUpload';
import { CompanySearchInput } from '../domain/CompanySearchInput';
import { Checkbox } from '../primitives/Checkbox';
import { Radio } from '../primitives/Radio';
import { Input } from '../primitives/Input';
import { PhoneNumberInput } from '../primitives/PhoneNumberInput';
import { Select } from '../primitives/Select';

interface MoiResult {
  name: string;
  dob: string;
  nationality: string;
  email?: string;
  gender?: string;
}

export interface GuidedContactValue {
  idType?: QidType;
  idNumber?: string;
  moiResult?: MoiResult;
  /** Front/back QID capture - only collected when idType is 'QID'. */
  qidScans?: QidImageUploadValue;
  /**
   * Identity fields, agent-editable as of 2026-09-24 and prefilled from the
   * MOI result when one is found. This reverses the supplied asset's "State
   * MOI Registry Records (Read Only) / all identity fields are locked to
   * read-only" rule, on explicit direction - the asset is still what governs
   * their visual treatment, just not their editability.
   *
   * `gender` has no MOI source: MoiResult carries name/dob/nationality/email
   * only, so it is always agent-entered even for a customer on file.
   */
  firstName?: string;
  lastName?: string;
  dob?: string;
  gender?: string;
  nationality?: string;
  email?: string;
  altPhone?: string;
  language?: string;
  getIptv?: 'Yes' | 'No';
  /** Boolean since 2026-09-24 - was a 'Yes'|'No' Select, now a checkbox. */
  digitalLeadSale?: boolean;
  isB2B2C?: boolean;
  /** The chosen employer. Committed only by a pick or an explicit "Add new
   * company" - never by typing. See CompanySearchInput. */
  companyName?: string;
  /** Set when companyName came from the `enterprise-accounts` registry, so a
   * linked employer is distinguishable from one that still has to be created.
   * The two were indistinguishable while this was a free-text box. */
  companyAccountId?: string;
  /** Set when the agent chose "Add new company" instead. */
  companyIsNew?: boolean;
}

interface GuidedContactStepProps {
  value: GuidedContactValue;
  onChange: (value: GuidedContactValue) => void;
  /** Fixed Line evidences a "Get IPTV?" field at Contact; FWA's evidenced Contact
   * fields (FLD-430–450) don't include it - default true for Fixed Line callers. */
  showIptvToggle?: boolean;
  /**
   * Which ID types the journey offers. Forwarded to IdLookupStep; omitted
   * means all four. New Postpaid narrows it to QID and Diplomatic ID.
   */
  allowedIdTypes?: QidType[];
}

// Single source of truth for "is this a valid Alternate phone #" - exported
// so every wizard's Contact step isValid gate checks the exact same rule as
// the field's own inline error.
//
// Deliberately accepts any plausible mobile number, not just a Qatar-local
// one, per explicit product direction: field-inventory/business-rules.json
// evidence says this field "must be a local mobile number" (repeated across
// 5+ journeys, FLD-352 et al.) since it's used as an SMS notification
// contact - but a postpaid customer may only have a foreign number on file
// (e.g. a GCC/expat/diplomatic customer), so hard-blocking on Qatar's format
// specifically was judged too restrictive for this rebuild. Accepts either
// an 8-digit Qatar mobile (optionally +974/974-prefixed, 3/5/6/7 leading
// digit) or a general international number (optional "+", 7–15 digits).
export function isValidAltPhone(raw: string | undefined): boolean {
  if (!raw) return false;
  const digits = raw.replace(/[\s-]/g, '');
  const isQatarLocal = /^[3567]\d{7}$/.test(digits.replace(/^\+?974/, ''));
  const isInternational = /^(\+[1-9]\d{7,14}|\d{7,15})$/.test(digits);
  return isQatarLocal || isInternational;
}

// Same contract as isValidAltPhone - one rule shared by the field's inline
// error and every wizard's Contact isValid gate, so the two can't disagree.
//
// Email is mandatory: all four Contact-step wizards already required a
// truthy `email` to advance, but the field was disabled and populated only
// from the MOI result. That made the gate unsatisfiable whenever the MOI
// record carried no email - Continue stayed dead with nothing the agent
// could do about it. The field is now agent-editable, which is also what
// this file's own header comment always claimed ("Email/Alt Phone/Language/
// Digital Lead-Sale/B2B2C are agent-entered in both"), and the gates check
// this instead of mere truthiness, so "x" no longer passes.
//
// Deliberately a shape check, not RFC 5322: one @, no whitespace, a dot-led
// TLD of 2+ letters. Over-strict email regexes reject valid addresses, and
// nothing here can confirm deliverability anyway.
export function isValidEmail(raw: string | undefined): boolean {
  if (!raw) return false;
  return /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(raw.trim());
}

// Progressive DD/MM/YYYY mask - the agent types 10102000 and gets 10/10/2000
// without touching the slash key.
//
// Works off the digits alone rather than appending separators to whatever the
// field already held, so backspacing over a slash deletes the digit before it
// instead of stalling: "10/1" backspaced becomes "10" -> re-masked to "10/",
// and one more backspace gives "1". Extra digits past 8 are dropped, which is
// also why the field carries maxLength.
export function formatDobInput(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

// MOI's YYYY-MM-DD into the field's DD/MM/YYYY. Anything not in that exact
// ISO shape is passed through untouched rather than mangled - better a value
// the agent can see and correct than a silently rearranged one.
function isoToMaskedDob(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

// A real calendar date, not just the right shape - 31/02/2000 matches the mask
// but isn't a day. Rejects the future and anything implying an age over 120,
// both of which are typos rather than customers.
export function isValidDob(masked: string): boolean {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(masked);
  if (!m) return false;
  const [, dd, mm, yyyy] = m;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  if (month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day > daysInMonth) return false;
  const date = new Date(year, month - 1, day);
  const now = new Date();
  if (date > now) return false;
  return year > now.getFullYear() - 120;
}

// Mandatory identity fields, checked by the field markers and by every
// Contact isValid gate. Trimmed, because a space is not a name.
export function hasIdentityDetails(v: {
  firstName?: string;
  lastName?: string;
  dob?: string;
  gender?: string;
  nationality?: string;
}): boolean {
  return Boolean(
    v.firstName?.trim() && v.lastName?.trim() && isValidDob(v.dob ?? '') && v.gender?.trim() && v.nationality?.trim()
  );
}

// Seeds the editable identity fields from an MOI result - or clears them when
// there isn't one, so re-typing an ID doesn't leave the previous person's
// details behind.
//
// MOI returns one `name` string; the form wants First and Last separately, so
// the first whitespace-delimited token becomes First and the remainder Last
// ("Ahmed Al-Sulaiti" -> "Ahmed" / "Al-Sulaiti"). That is a guess about name
// order, which is why both fields stay editable and the MOI panel above tells
// the agent to review them: for a multi-part given name this split will be
// wrong, and the agent is the one who can see the document.
//
// `gender` IS seeded as of 2026-09-24. It has to be: the identity fields are
// read-only now, so a mandatory Gender with no registry source and no way to
// type into it would block Continue permanently. customers.json has always
// carried the field; only MoiResult was failing to pass it through.
function identityFromMoi(moi: MoiResult | undefined) {
  if (!moi)
    return {
      firstName: undefined,
      lastName: undefined,
      dob: undefined,
      nationality: undefined,
      email: undefined,
      gender: undefined,
    };
  const parts = moi.name.trim().split(/\s+/);
  return {
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' '),
    // MOI returns ISO (1985-03-12); the field is masked DD/MM/YYYY. Without
    // this the prefilled value would fail isValidDob and block Continue for
    // exactly the customers the registry DID find - reformatted, not
    // reinterpreted, so the date itself is unchanged.
    dob: isoToMaskedDob(moi.dob),
    nationality: moi.nationality,
    email: moi.email,
    gender: moi.gender,
  };
}

// Contact step shared across New Fixed Line (SCR-043, FLD-340–352) and New FWA
// (SCR-078, FLD-430–450) - Pattern 1 describes the contact step as "near-identical
// across every connection/activation journey regardless of product," and the two
// evidenced field sets overlap almost entirely (ID Expiry/Nationality/Gender/
// Name/DOB auto-populate from the ID scan; Email/Alt Phone/Language/Digital
// Lead-Sale/B2B2C are agent-entered in both).
// Per explicit product direction, the ID Type/Number fields must never
// auto-populate with a real value - even when Customer 360's product
// actions launch this step for a customer already on screen - so the
// agent always performs (or at least sees) an explicit Fetch rather than
// silently trusting cached active-customer state. The number field shows
// a format-example placeholder instead (see QidInput.tsx).
export function GuidedContactStep({ value, onChange, showIptvToggle = true, allowedIdTypes }: GuidedContactStepProps) {
  return (
    <div className="space-y-4">
      <IdLookupStep
        value={{ idType: value.idType, idNumber: value.idNumber, moiResult: value.moiResult, qidScans: value.qidScans }}
        // The identity read-out is suppressed here because this step renders
        // those three as editable fields below - see the prop's own note.
        showMoiDetails={false}
        allowedIdTypes={allowedIdTypes}
        // Every MOI-derived field is re-seeded from the result whenever it
        // changes, and cleared with it when the ID is edited/re-typed. A new
        // ID is a new person, so carrying over the previous one's name or
        // email would be worse than clearing. Agent edits survive anything
        // that is not an ID/MOI change, since this only fires for those.
        onChange={(v) => onChange({ ...value, ...v, ...identityFromMoi(v.moiResult) })}
      />

      {value.moiResult && (
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border-soft">
          {/* Field order per the 2026-09-25 direction, which happens to fall
              into clean rows of the 2-column grid:

                First Name    | Last Name      read-only
                Date of Birth | Nationality    read-only
                Email         | Alt phone      EDITABLE
                Gender        |                read-only

              So the two fields the agent can actually change now share a row
              instead of being scattered between read-only ones, and the
              registry-owned fields sit above and below them. Gender ends the
              set alone; it is not padded with a spacer, because the two flag
              checkboxes that follow are full-width and close the block.

              The five identity fields are READ-ONLY. This re-reverses the
              2026-09-24 decision that made them agent-editable and restores
              the supplied asset's "State MOI Registry Records (Read Only)"
              rule. They stay `required` and still gate Continue, but the only
              thing that can fill them is the registry.

              That is exactly why MoiResult now carries `gender` (see
              identityFromMoi). A mandatory field that is read-only AND has no
              registry source can never be satisfied, and Continue would be
              dead for every customer. Email and Alternate phone remain
              editable, so the agent can still correct the two fields a
              customer actually contests at the counter. */}
          <Input label="First Name" required readOnly value={value.firstName ?? ''} onChange={() => {}} />
          <Input label="Last Name" required readOnly value={value.lastName ?? ''} onChange={() => {}} />
          <Input label="Date of Birth" required readOnly value={value.dob ?? ''} onChange={() => {}} />
          <Input label="Nationality" required readOnly value={value.nationality ?? ''} onChange={() => {}} />
          <Input
            label="Email Address"
            type="email"
            required
            value={value.email ?? ''}
            placeholder="customer@example.qa"
            error={value.email && !isValidEmail(value.email) ? 'Please enter a valid email address.' : undefined}
            onChange={(e) => onChange({ ...value, email: e.target.value })}
          />
          <PhoneNumberInput
            label="Alternate phone #"
            required
            value={value.altPhone ?? ''}
            placeholder="5566 7766"
            error={
              value.altPhone && !isValidAltPhone(value.altPhone)
                ? 'Please enter a valid mobile number.'
                : undefined
            }
            onChange={(e) => onChange({ ...value, altPhone: e.target.value })}
          />
          {/* Kept as a fieldset/legend radio group rather than swapped for a
              read-only text box, so the control's shape does not change with
              its editability - the radios are simply disabled. */}
          <fieldset className="flex flex-col gap-1">
            <legend className="text-[length:var(--fs-label)] text-fg-2">
              Gender
              <span className="text-[var(--field-border-error)]" aria-hidden="true">
                {' *'}
              </span>
            </legend>
            <div className="flex items-center gap-6 py-2">
              {['Male', 'Female'].map((g) => (
                <label key={g} className="flex items-center gap-2 text-[length:var(--fs-body)] text-fg-2">
                  <Radio
                    name="contact-gender"
                    value={g}
                    checked={value.gender === g}
                    // Radios have no readOnly, so this one genuinely needs
                    // disabled - there is no other way to make a radio
                    // uncheckable. The label colour is left at --fg-2 rather
                    // than the disabled grey so the answer stays legible, and
                    // Radio dims its own centre dot to --field-label-disabled
                    // so a disabled-but-checked answer still reads as chosen.
                    disabled
                  />
                  {g}
                </label>
              ))}
            </div>
          </fieldset>
          {/* Fixed Line evidences a "Get IPTV?" field at Contact; FWA's
              evidenced set does not, hence the prop. Restored here after a
              field reorder briefly dropped it - postpaid passes
              showIptvToggle={false} so it never appeared in that journey,
              which is exactly why losing it would not have shown up in
              postpaid testing. */}
          {showIptvToggle && (
            <Select
              label="Get IPTV?"
              value={value.getIptv ?? 'No'}
              onChange={(e) => onChange({ ...value, getIptv: e.target.value as 'Yes' | 'No' })}
              options={[
                { value: 'No', label: 'No' },
                { value: 'Yes', label: 'Yes' },
              ]}
            />
          )}

          {/* Both flags on one full-width row, per the mockup. Digital Lead /
              Sale was a Yes/No Select; as a checkbox its stored value is now a
              boolean rather than the string 'Yes'|'No'. Safe to change shape:
              nothing outside this component read the field - no order payload,
              engine or screen referenced it. */}
          <div className="col-span-2 flex items-center gap-6">
            <label className="flex items-center gap-2 text-[length:var(--fs-body)] text-fg-2">
              <Checkbox
                checked={value.digitalLeadSale ?? false}
                onChange={(e) => onChange({ ...value, digitalLeadSale: e.target.checked })}
              />
              Digital Lead / Sale
            </label>
            <label className="flex items-center gap-2 text-[length:var(--fs-body)] text-fg-2">
              <Checkbox
                checked={value.isB2B2C ?? false}
                // Unticking clears all three company fields together, not just
                // the name. Leaving companyAccountId or companyIsNew behind on
                // a non-B2B2C order would keep an employer link alive on an
                // order that no longer has an employer.
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? { ...value, isB2B2C: true }
                      : {
                          ...value,
                          isB2B2C: false,
                          companyName: undefined,
                          companyAccountId: undefined,
                          companyIsNew: undefined,
                        }
                  )
                }
              />
              B2B2C Order
            </label>
          </div>
          {value.isB2B2C && (
            <CompanySearchInput
              label="Company Name (B2B2C)"
              value={{
                companyName: value.companyName,
                companyAccountId: value.companyAccountId,
                companyIsNew: value.companyIsNew,
              }}
              onChange={(next) => onChange({ ...value, ...next })}
            />
          )}
        </div>
      )}
    </div>
  );
}
