import { IdLookupStep } from './IdLookupStep';
import type { QidType } from '../domain/QidInput';
import type { QidImageUploadValue } from '../domain/QidImageUpload';
import { Radio } from '../primitives/Radio';
import { Input } from '../primitives/Input';
import { PhoneNumberInput } from '../primitives/PhoneNumberInput';
import { Select } from '../primitives/Select';
import { Icon } from '../primitives/Icon';

// Mirrors IdLookupStep's MoiResult - this step receives the value that step
// produces. Kept as a local shape rather than imported because it is a subset:
// only the fields this step reads appear here.
interface MoiResult {
  name: string;
  dob: string;
  nationality: string;
  email?: string;
  gender?: string;
  /** Sponsoring employer, when on file. What isB2B2C is derived from. */
  companyName?: string;
  /** That employer's enterprise-accounts row, when it has one. */
  companyAccountId?: string;
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
  /**
   * Added 2026-09-27. Positional, from the middle tokens of MOI's single
   * `name` string - see identityFromMoi. Optional by design: a two-token name
   * has no middle, and a mandatory read-only field with no source deadlocks
   * Continue (the exact failure `gender` was added to fix).
   */
  middleName?: string;
  lastName?: string;
  dob?: string;
  gender?: string;
  nationality?: string;
  email?: string;
  altPhone?: string;
  language?: string;
  getIptv?: 'Yes' | 'No';
  /**
   * DERIVED, never agent-entered (2026-09-26). True when the customer the ID
   * lookup resolved has a sponsoring employer on file.
   *
   * This was a "B2B2C Order" checkbox, removed along with "Digital Lead /
   * Sale". The corpus is clear that B2B2C is an ACCOUNT-level classification -
   * completing one stamps Special Management "B2B2C Consumer" on the account,
   * and a later order against that account makes the agent confirm before
   * proceeding without B2B2C. A per-order checkbox modelled it as a choice the
   * agent makes fresh each time, which is the wrong shape: whether a walk-in
   * is sponsored by their employer is a fact about them, not a decision at the
   * counter.
   *
   * Still carried on the value (four wizards read it to set orderSubType and
   * to route to manager approval) - only its source changed.
   */
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
  unavailableIdTypes?: QidType[];
  unavailableIdTypesHint?: string;
  /** Scan-first with automatic type detection - see IdLookupStep. */
  autoDetectIdType?: boolean;
}

// Single source of truth for "is this a valid Alternate phone #" - exported
// so every wizard's Contact step isValid gate checks the exact same rule as
// the field's own inline error.
//
// QATAR ONLY: +974 followed by exactly 8 digits, e.g. +97474018245.
//
// This reverses the previous direction and returns to the evidenced rule.
// field-inventory/business-rules.json says this field "must be a local mobile
// number" - repeated across 5+ journeys, FLD-352 et al. - because it is the
// SMS notification contact. That was overridden during the rebuild on the
// reasoning that a postpaid customer might only have a foreign number on file
// (a GCC, expat or diplomatic customer), so the validator accepted any
// 7-to-15-digit international number. Direction on 2026-09-26 is the
// documented rule after all, so the override is gone.
//
// Consequence worth knowing: a customer who genuinely has no Qatar mobile can
// no longer be given one here, and the Contact step of all four journeys that
// share this gate will hold until a +974 number is entered. That was the
// exact objection the override existed to answer, so it is recorded in
// reference/VFQ_DXP_Postpaid_Activation_Open_Questions_Reference.md rather
// than only in this comment.
//
// Separators and an optional 974/+974 prefix are tolerated on INPUT, because
// the field displays itself grouped ("5551 2345") and the stored value is
// E.164 - so the same digits arrive here in several shapes and none of them
// is the agent making a mistake.
export function isValidAltPhone(raw: string | undefined): boolean {
  if (!raw) return false;
  const local = raw.replace(/[\s-]/g, '').replace(/^\+?974/, '');
  // Exactly 8 digits, per the stated format. Deliberately NOT also requiring a
  // 3/5/6/7 leading digit, which is the mobile-prefix rule MsisdnPicker
  // applies to inventory numbers: the instruction said "exactly 8 digits", and
  // rejecting a number the agent was told to type would be worse than
  // accepting a landline here.
  return /^\d{8}$/.test(local);
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
// That quote is the evidenced field set, and as of 2026-09-26 this app no
// longer matches the last two entries: Digital Lead-Sale is gone entirely and
// B2B2C is derived from the resolved customer's employer rather than entered.
// Email, Alt Phone and Language are still agent-entered, which is the part
// this paragraph relies on.
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
const TICK_ICON = 'M20 6L9 17l-5-5';

/**
 * Email verification state (2026-09-27 walkthrough).
 *
 * There is no email-verification service in this app, so this reports only
 * what can actually be known and never asserts a check that did not run:
 *
 *   verified  - unchanged from what the MOI registry returned (tick shown)
 *   pending   - agent typed a different, well-formed address
 *   unverified- no registry address, or the value is not a valid address yet
 *
 * Only `verified` earns the tick. The other two are said in words underneath
 * rather than marked, because a tick is a claim and neither state supports
 * one - an absent tick is the honest rendering of "not confirmed".
 */
function emailVerification(email: string | undefined, registryEmail: string | undefined) {
  if (!email || !isValidEmail(email)) return { verified: false, hint: undefined };
  if (registryEmail && email.trim().toLowerCase() === registryEmail.trim().toLowerCase()) {
    return { verified: true, hint: undefined };
  }
  return { verified: false, hint: 'Verification pending - address differs from the registry record.' };
}

function identityFromMoi(moi: MoiResult | undefined) {
  if (!moi)
    return {
      firstName: undefined,
      middleName: undefined,
      lastName: undefined,
      dob: undefined,
      nationality: undefined,
      email: undefined,
      gender: undefined,
      // Cleared with the rest. An employer link belongs to the resolved
      // customer, so losing the customer has to lose the link - otherwise
      // re-typing an ID would leave the previous person's employer attached,
      // and with it a B2B2C order subtype and an approval route.
      isB2B2C: undefined,
      companyName: undefined,
      companyAccountId: undefined,
      companyIsNew: undefined,
    };
  const parts = moi.name.trim().split(/\s+/);
  const employer = moi.companyName?.trim();
  return {
    // An employer on file IS the B2B2C signal - there is nothing else for the
    // flag to key off now the checkbox is gone. companyAccountId is resolved
    // separately against the enterprise-accounts registry (see the effect
    // below) because that needs a dataset read this pure function cannot do.
    isB2B2C: employer ? true : undefined,
    companyName: employer || undefined,
    companyAccountId: employer ? moi.companyAccountId : undefined,
    // Nothing can create a company from this step any more - the only control
    // that could is gone - so a derived employer is never a new one.
    companyIsNew: undefined,
    // Split three ways as of 2026-09-27, when Middle Name was added as its own
    // field. MOI returns ONE `name` string, so first/middle/last are positional:
    // first token, last token, and whatever sits between them. Arabic names in
    // this corpus routinely carry 3-4 tokens ("Ahmed Abdulla Al-Sulaiti"), which
    // the old two-way split folded entirely into Last Name.
    // A two-token name yields an empty middle rather than a guessed one.
    firstName: parts[0] ?? '',
    middleName: parts.length > 2 ? parts.slice(1, -1).join(' ') : '',
    lastName: parts.length > 1 ? parts[parts.length - 1] : '',
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
//
// Two of those evidenced fields are no longer rendered as agent input, per
// explicit product direction on 2026-09-26:
//
// - Digital Lead / Sale is REMOVED. It appears in 26 corpus documents, every
//   one a guided-journey screenshot, and in all of them it reads No - never
//   once Yes. No BRSD, business rule, workshop or CAF defines it, so nothing
//   says what ticking it would mean, and nothing in this app read the value it
//   wrote. A control that captures a flag no one consumes, for a decision no
//   one can describe, is worse than its absence: it implies a choice that
//   matters. Logged as an open question rather than quietly reproduced.
// - B2B2C is DERIVED, not ticked. See GuidedContactValue.isB2B2C.
// Per explicit product direction, the ID Type/Number fields must never
// auto-populate with a real value - even when Customer 360's product
// actions launch this step for a customer already on screen - so the
// agent always performs (or at least sees) an explicit Fetch rather than
// silently trusting cached active-customer state. The number field shows
// a format-example placeholder instead (see QidInput.tsx).
export function GuidedContactStep({ value, onChange, showIptvToggle = true, allowedIdTypes, unavailableIdTypes, unavailableIdTypesHint, autoDetectIdType }: GuidedContactStepProps) {
  return (
    <div className="space-y-4">
      <IdLookupStep
        value={{ idType: value.idType, idNumber: value.idNumber, moiResult: value.moiResult, qidScans: value.qidScans }}
        // The identity read-out is suppressed here because this step renders
        // those three as editable fields below - see the prop's own note.
        showMoiDetails={false}
        allowedIdTypes={allowedIdTypes}
        unavailableIdTypes={unavailableIdTypes}
        unavailableIdTypesHint={unavailableIdTypesHint}
        autoDetectIdType={autoDetectIdType}
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
          {/* Middle Name added 2026-09-27. Not `required`: MOI returns a single
              name string and plenty of records are two tokens, so a mandatory
              middle name would block Continue for every customer who has none
              on file - the one failure mode the read-only identity fields were
              already shown to cause. */}
          <Input label="Middle Name" readOnly value={value.middleName ?? ''} onChange={() => {}} />
          <Input label="Last Name" required readOnly value={value.lastName ?? ''} onChange={() => {}} />
          {/* The DD/MM/YYYY hint is the field's PLACEHOLDER, not a caption
              beneath it (2026-09-27). As a caption it sat under a field that
              is already populated from MOI, describing a format the agent
              cannot type into anyway; inside the box it does the one job a
              format hint has - telling you what to write when there is
              nothing there yet. */}
          <Input
            label="Date of Birth"
            required
            readOnly
            placeholder="DD/MM/YYYY"
            value={value.dob ?? ''}
            onChange={() => {}}
          />
          <Input label="Nationality" required readOnly value={value.nationality ?? ''} onChange={() => {}} />
          {/* Verification state rides INSIDE the field as a tick on its right
              edge (2026-09-27), replacing the badge that sat underneath. The
              badge was as wide as the input and read as a second control; the
              status belongs to the value, so it now sits with it.
              Only the VERIFIED state gets a mark - see emailVerification. */}
          <Input
            label="Email Address"
            type="email"
            required
            value={value.email ?? ''}
            placeholder="customer@example.qa"
            error={value.email && !isValidEmail(value.email) ? 'Please enter a valid email address.' : undefined}
            helperText={emailVerification(value.email, value.moiResult?.email).hint}
            trailingAddon={
              emailVerification(value.email, value.moiResult?.email).verified ? (
                <Icon
                  path={TICK_ICON}
                  className="w-4 h-4 text-success"
                  aria-label="Email address verified"
                />
              ) : undefined
            }
            onChange={(e) => onChange({ ...value, email: e.target.value })}
          />
          <PhoneNumberInput
            label="Alternate phone #"
            required
            // Dial code pinned to Qatar: the rule names one country, so a
            // picker offering 200 others would present a choice in which every
            // alternative fails validation.
            fixedIso="QA"
            // Qatar numbers are 8 digits after the dial code. Without this the
            // cap is E.164's 15-minus-dial-code, i.e. 12, so the field happily
            // took "777777777777" and only the validator underneath objected.
            // The 9th keystroke now simply does not land.
            maxNationalDigits={8}
            helperText="Service notifications will be sent to this Qatar mobile number."
            value={value.altPhone ?? ''}
            placeholder="5566 7766"
            error={
              value.altPhone && !isValidAltPhone(value.altPhone)
                ? 'Enter a Qatar mobile number: +974 followed by 8 digits.'
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

          {/* The employer, read-only, and only for a customer who has one.
              Where the "B2B2C Order" checkbox and its company typeahead used
              to be.
              
              Read-only because the agent no longer decides this - the registry
              does. It sits with the other registry-sourced identity fields and
              is styled like them, so its provenance reads the same way theirs
              does. An agent who believes it is wrong has the same recourse as
              for a wrong name: the record is corrected upstream, not typed
              over here.
              
              Absent, not empty, for an unsponsored customer. A blank "Employer"
              box on every ordinary consumer sale would imply a field someone
              forgot to fill in. */}
          {value.isB2B2C && value.companyName && (
            <Input
              id="contact-employer"
              label="Employer (B2B2C)"
              value={value.companyName}
              readOnly
              onChange={() => {}}
              helperText="On file with the sponsoring employer. This order routes for approval."
            />
          )}
        </div>
      )}
    </div>
  );
}
