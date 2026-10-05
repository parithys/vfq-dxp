import { IdLookupStep } from './IdLookupStep';
import { idTypeLabel } from '../domain/QidInput';
import type { QidType } from '../domain/QidInput';
import { Radio } from '../primitives/Radio';
import { Input } from '../primitives/Input';
import { PhoneNumberInput } from '../primitives/PhoneNumberInput';
import { Select } from '../primitives/Select';
import { SYNTHETIC_CLASS } from '../../data/synthetic/syntheticMarker';
import { isValidAltPhone, isValidEmail, emailVerification, maskEmail, identityFromMoi } from './guidedContactModel';
import type { GuidedContactValue } from './guidedContactModel';


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
  /** Scan -> verify -> Fetch, with mobile number shown - see IdLookupStep. */
  verifyThenFetch?: boolean;
  /** Handle whoever the scanned ID belongs to as a genuine new customer (New Connection - New Customer). */
  asNewCustomer?: boolean;
  /** Journey started from Customer 360: the customer is this one, whatever ID the scan returned. */
  asCustomerId?: string;
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
// Filled-badge style (2026-09-28), replacing the plain outline tick: a solid
// success-coloured circle with a white check, rather than a currentColor
// stroke path. That two-tone look doesn't fit the shared Icon primitive
// (single-colour stroke on a 24x24 viewBox), so this is a small dedicated
// SVG local to this one call site instead of a change to Icon itself, which
// renders every stroke icon in the app.
function VerifiedBadge({ label }: { label: string }) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={label} className="w-4 h-4 shrink-0">
      <circle cx="12" cy="12" r="12" className="text-success" fill="currentColor" />
      <path
        d="M7.5 12.5l3 3 6-6.5"
        fill="none"
        className="stroke-white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
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
export function GuidedContactStep({ value, onChange, showIptvToggle = true, allowedIdTypes, unavailableIdTypes, unavailableIdTypesHint, autoDetectIdType, verifyThenFetch, asNewCustomer, asCustomerId }: GuidedContactStepProps) {
  return (
    <div className="space-y-4">
      <IdLookupStep
        value={{ idType: value.idType, idNumber: value.idNumber, moiResult: value.moiResult, qidScans: value.qidScans, scannedExpiry: value.scannedExpiry }}
        // The identity read-out is suppressed here because this step renders
        // those three as editable fields below - see the prop's own note.
        showMoiDetails={false}
        allowedIdTypes={allowedIdTypes}
        unavailableIdTypes={unavailableIdTypes}
        unavailableIdTypesHint={unavailableIdTypesHint}
        autoDetectIdType={autoDetectIdType}
        verifyThenFetch={verifyThenFetch}
        asNewCustomer={asNewCustomer}
        asCustomerId={asCustomerId}
        // Every MOI-derived field is re-seeded from the result whenever it
        // changes, and cleared with it when the ID is edited/re-typed. A new
        // ID is a new person, so carrying over the previous one's name or
        // email would be worse than clearing. Agent edits survive anything
        // that is not an ID/MOI change, since this only fires for those.
        onChange={(v) =>
          onChange({
            ...value,
            ...v,
            ...identityFromMoi(v.moiResult),
            // verifyThenFetch only: the record's mobile number arrives with the
            // MOI result. The communication language is NOT seeded from the
            // record - it defaults to English and the agent chooses.
            ...(verifyThenFetch
              ? {
                  mobileNumber: v.moiResult?.phone,
                }
              : {}),
          })
        }
      />

      {value.moiResult && (
        <div className="space-y-6 pt-2 border-t border-border-soft">
          {/* Two labelled groups (2026-09-30 regroup) - the registry-owned
              identity facts together, the two agent-editable contact fields
              (plus the notification/service preferences that ride with them)
              in their own group below. Heading style matches
              BillingAccountStep's "Existing Billing Accounts" - the
              established in-step sub-heading in this same design system,
              reused rather than inventing a new one. */}
          <div>
            <h3 className="text-fg font-semibold text-[length:var(--fs-body-lg)] mb-3">Identity Details</h3>
            {/* Three columns as of 2026-09-28 (was two, per the 2026-09-25
                direction below). Field order falls into clean rows:

                  First Name    | Middle Name    | Last Name      read-only
                  Date of Birth | Expiry Date    | Nationality    read-only
                  Document Type | Gender         |                read-only

                The five identity fields are READ-ONLY. This re-reverses the
                2026-09-24 decision that made them agent-editable and restores
                the supplied asset's "State MOI Registry Records (Read Only)"
                rule. They stay `required` and still gate Continue, but the
                only thing that can fill them is the registry.

                That is exactly why MoiResult now carries `gender` (see
                identityFromMoi). A mandatory field that is read-only AND has
                no registry source can never be satisfied, and Continue would
                be dead for every customer. */}
            <div className="grid grid-cols-3 gap-4">
              <Input label="First Name" required readOnly value={value.firstName ?? ''} onChange={() => {}} />
              {/* Middle Name(s) added 2026-09-27, relabelled with the "(s)"
                  2026-09-28 - identityFromMoi combines the 2nd-4th name tokens
                  here, so the label says plural rather than implying one name
                  where up to three may sit. Not `required`: MOI returns a
                  single name string and plenty of records are two tokens, so
                  a mandatory middle name would block Continue for every
                  customer who has none on file - the one failure mode the
                  read-only identity fields were already shown to cause. */}
              <Input label="Middle Name(s)" readOnly value={value.middleName ?? ''} onChange={() => {}} />
              <Input label="Last Name" required readOnly value={value.lastName ?? ''} onChange={() => {}} />
              {/* The DD/MM/YYYY hint is the field's PLACEHOLDER, not a caption
                  beneath it (2026-09-27). As a caption it sat under a field
                  that is already populated from MOI, describing a format the
                  agent cannot type into anyway; inside the box it does the
                  one job a format hint has - telling you what to write when
                  there is nothing there yet. */}
              <Input
                label="Date of Birth"
                required
                readOnly
                placeholder="DD/MM/YYYY"
                value={value.dob ?? ''}
                onChange={() => {}}
              />
              {/* ID Expiry - evidenced alongside Nationality/DOB/Name in this
                  file's own header comment as a field that "auto-populate[s]
                  from the ID scan", but nothing rendered it until 2026-09-28.
                  Same masked DD/MM/YYYY shape as Date of Birth, and the same
                  read-only registry-sourced treatment as every other identity
                  field on this row - see identityFromMoi. Follows Date of
                  Birth (2026-09-30 order), ahead of Nationality. */}
              <Input
                label="Expiry Date"
                required
                readOnly
                placeholder="DD/MM/YYYY"
                value={value.idExpiryDate ?? ''}
                onChange={() => {}}
              />
              <Input label="Nationality" required readOnly value={value.nationality ?? ''} onChange={() => {}} />
              {/* Document Type - which of the four ID Type cards resolved
                  this record (2026-09-30). Read-only for the same reason
                  every other field on this row is: it is what the scanner
                  identified, not something the agent chooses here - the ID
                  Type selector further up is the only place that changes it,
                  and doing so clears this whole panel and starts over. */}
              {/* verifyThenFetch: the agent already chose the type, so it is not repeated. */}
              {!verifyThenFetch && (
                <Input
                  label="Document Type"
                  readOnly
                  value={value.idType ? idTypeLabel(value.idType) : ''}
                  onChange={() => {}}
                />
              )}
              {/* Kept as a fieldset/legend radio group rather than swapped for
                  a read-only text box, so the control's shape does not change
                  with its editability - the radios are simply disabled. */}
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
                        // uncheckable. The label colour is left at --fg-2
                        // rather than the disabled grey so the answer stays
                        // legible, and Radio dims its own centre dot to
                        // --field-label-disabled so a disabled-but-checked
                        // answer still reads as chosen.
                        disabled
                      />
                      {g}
                    </label>
                  ))}
                </div>
              </fieldset>
              {/* The employer, read-only, and only for a customer who has
                  one. Where the "B2B2C Order" checkbox and its company
                  typeahead used to be.

                  Read-only because the agent no longer decides this - the
                  registry does. It sits with the other registry-sourced
                  identity fields and is styled like them, so its provenance
                  reads the same way theirs does. An agent who believes it is
                  wrong has the same recourse as for a wrong name: the record
                  is corrected upstream, not typed over here.

                  Absent, not empty, for an unsponsored customer. A blank
                  "Employer" box on every ordinary consumer sale would imply a
                  field someone forgot to fill in. */}
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
          </div>

          <div>
            <h3 className="text-fg font-semibold text-[length:var(--fs-body-lg)] mb-3">Contact &amp; Notification</h3>
            {/* The two fields the agent can actually change (Email, Alt
                phone) share a row with the one preference field evidenced
                alongside them - see isValidEmail's header note: "Email/Alt
                Phone/Language ... are agent-entered". */}
            <div className="grid grid-cols-3 gap-4">
              {/* Verification state rides INSIDE the field as a tick on its
                  right edge (2026-09-27), replacing the badge that sat
                  underneath. The badge was as wide as the input and read as a
                  second control; the status belongs to the value, so it now
                  sits with it. Only the VERIFIED state gets a mark - see
                  emailVerification. */}
              <Input
                label="Email Address"
                type="email"
                required
                // New customer: the address comes from NAS and is shown masked
                // (read-only - the stored value stays the real address). Existing
                // customer: the address from Siebel is shown as available and
                // stays editable.
                value={value.moiResult?.isNewCustomer && value.email ? maskEmail(value.email) : (value.email ?? '')}
                readOnly={Boolean(value.moiResult?.isNewCustomer && value.email)}
                placeholder="customer@example.qa"
                error={value.email && !isValidEmail(value.email) ? 'Please enter a valid email address.' : undefined}
                helperText={
                  emailVerification(value.email, value.moiResult?.email).hint ??
                  (value.moiResult?.emailSource && value.email ? <span className={SYNTHETIC_CLASS}>{`Fetched from ${value.moiResult.emailSource}`}</span> : undefined)
                }
                trailingAddon={
                  !verifyThenFetch && emailVerification(value.email, value.moiResult?.email).verified ? (
                    <VerifiedBadge label="Email address verified" />
                  ) : undefined
                }
                onChange={(e) => onChange({ ...value, email: e.target.value })}
              />
              <PhoneNumberInput
                label="Alternate phone #"
                // Optional in verifyThenFetch (New Connection); still validated when entered.
                required={!verifyThenFetch}
                // Optional in verifyThenFetch, so it must not pull the cursor on arrival.
                noAutoFocus={verifyThenFetch}
                // Dial code pinned to Qatar: the rule names one country, so a
                // picker offering 200 others would present a choice in which
                // every alternative fails validation.
                fixedIso="QA"
                // Qatar numbers are 8 digits after the dial code. Without this
                // the cap is E.164's 15-minus-dial-code, i.e. 12, so the field
                // happily took "777777777777" and only the validator
                // underneath objected. The 9th keystroke now simply does not
                // land.
                maxNationalDigits={8}
                helperText="Service notifications will be sent to this Qatar mobile number."
                value={value.altPhone ?? ''}
                placeholder="5566 7766"
                error={
                  value.altPhone && !isValidAltPhone(value.altPhone)
                    ? 'Enter a valid Qatar mobile number.'
                    : undefined
                }
                onChange={(e) => onChange({ ...value, altPhone: e.target.value })}
              />
              {/* Evidenced agent-entered field - `language` has held a slot on
                  GuidedContactValue since this step's interface was written,
                  but nothing rendered it until 2026-09-28. Defaults to
                  English, matching every other Language control in the app
                  (BillingProfileStep, Base Management's Contact step).

                  Options expanded 2026-09-28 from English/Arabic to also
                  offer Hindi, Malayalam and Filipino, matching Qatar's expat
                  customer base. English/Arabic/Hindi/Malayalam are the four
                  languages the CRM's actual SMS notification templates are
                  evidenced in (sms-templates - Locale codes
                  ENU/ARA/HIN/MAL); Filipino has no such template evidence but
                  was requested explicitly for this field, so it is included
                  as a demo-catalogue addition rather than an evidenced one. */}
              <Select
                label={verifyThenFetch ? 'Preferred Language' : 'Notification Language'}
                value={value.language ?? 'English'}
                onChange={(e) => onChange({ ...value, language: e.target.value })}
                options={[
                  { value: 'English', label: 'English' },
                  { value: 'Arabic', label: 'Arabic' },
                  { value: 'Hindi', label: 'Hindi' },
                  { value: 'Malayalam', label: 'Malayalam' },
                  { value: 'Filipino', label: 'Filipino' },
                ]}
              />
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
