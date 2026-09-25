import type { ReactNode, Ref } from 'react';
import { Icon } from '../primitives/Icon';
import { Button } from '../primitives/Button';

export type QidType = 'QID' | 'Passport' | 'GCC ID' | 'Diplomatic ID';

interface QidTypeSelectorProps {
  idType: QidType;
  onIdTypeChange: (type: QidType) => void;
}

interface QidNumberFieldProps {
  idType: QidType;
  value: string;
  onChange: (value: string) => void;
  onFetch: () => void;
  fetching?: boolean;
  error?: string;
  /** Lets the owner move the cursor into the field - used after an ID Type
   * switch clears it, so the agent lands on the field they must retype
   * rather than on the chip they just clicked. */
  inputRef?: Ref<HTMLInputElement>;
  /**
   * The number came off a scan rather than the keyboard, so it is displayed
   * rather than typed - and Fetch is HIDDEN, because the scan already
   * triggered the lookup. Fetch appears only when the field is editable,
   * i.e. when there is a number the agent could have changed.
   */
  readOnly?: boolean;
  /** Sits under the field. */
  hint?: string;
  /**
   * Right-aligned on the label line - for a lookup status that belongs to
   * this number (the MOI badge). Kept as a slot rather than a boolean so the
   * caller owns what the status says; this component knows nothing about MOI.
   */
  status?: ReactNode;
}
const CHECK = 'M20 6L9 17l-5-5';
const SEARCH_ICON = 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.3-4.3';
const CARD_ICON = 'M3 6h18v12H3z M3 10h18 M6 15h3';
const BOOK_ICON = 'M12 6.5c-1.6-1.1-4-1.6-6-1.2v12.8c2-0.4 4.4 0.1 6 1.2 M12 6.5c1.6-1.1 4-1.6 6-1.2v12.8c-2-0.4-4.4 0.1-6 1.2 M12 6.5v12.8';
const GLOBE_ICON = 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M3 12h18 M12 3c2.4 2.6 2.4 15.4 0 18 M12 3c-2.4 2.6-2.4 15.4 0 18';
const SHIELD_ICON = 'M12 3l7 3v5.5c0 5-3 8.3-7 9.5-4-1.2-7-4.5-7-9.5V6z';

const ID_TYPES: { type: QidType; label: string; numberLabel: string; icon: string; placeholder: string }[] = [
  { type: 'QID', label: 'Qatar ID (QID)', numberLabel: 'Qatar ID (QID) Number', icon: CARD_ICON, placeholder: 'e.g. 28456701234' },
  { type: 'Passport', label: 'Passport', numberLabel: 'Passport Number', icon: BOOK_ICON, placeholder: 'e.g. P0998812' },
  { type: 'GCC ID', label: 'GCC ID', numberLabel: 'GCC ID Number', icon: GLOBE_ICON, placeholder: 'e.g. 784202312345678' },
  { type: 'Diplomatic ID', label: 'Diplomatic ID', numberLabel: 'Diplomatic ID Number', icon: SHIELD_ICON, placeholder: 'e.g. DIP-QA-004521' },
];

// QID/Passport/GCC/Diplomatic ID lookup control, per component-catalogue.md §2
// (ENT-023/037 Customer/Contact) - a 4-way ID Type card selector (only QID and
// Passport have evidenced identity-documents records to resolve against; GCC
// ID/Diplomatic ID are included as selectable per the reference but have no
// seeded MOI matches yet) driving the label/placeholder of a single number
// field with an inline Fetch action, replacing the earlier plain text input +
// separate below-field submit button.
// The 4-way ID Type card selector. Split out from the number field on
// 2026-09-25 so a caller can put content BETWEEN them - IdLookupStep now
// renders the QID scanner in that gap, and only reveals the number once a
// scan has produced one.
export function QidTypeSelector({ idType, onIdTypeChange }: QidTypeSelectorProps) {
  return (
    <div>
      <p className="text-[length:var(--fs-label)] text-fg-2 mb-2">ID Type</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {ID_TYPES.map((t) => {
          const selected = t.type === idType;
          return (
            <button
              key={t.type}
              type="button"
              onClick={() => onIdTypeChange(t.type)}
              className={`relative flex flex-col items-center gap-2 rounded-[var(--radius-card)] border p-4 ${
                selected
                  ? 'border-[var(--field-card-selected)] bg-[var(--field-card-selected-bg)] text-[var(--field-card-selected)]'
                  : 'border-border-soft text-fg-2 enabled:hover:border-[var(--field-card-selected)]/50'
              }`}
            >
              {selected && (
                <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[var(--field-card-selected)] text-white flex items-center justify-center">
                  <Icon path={CHECK} className="w-2.5 h-2.5" />
                </span>
              )}
              <Icon path={t.icon} className="w-6 h-6" />
              <span className="text-[length:var(--fs-caption)] font-medium">{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// The number field and its Fetch action. The label and placeholder follow the
// selected ID Type. Whether this renders AT ALL is the caller's decision.
export function QidNumberField({
  idType,
  value,
  onChange,
  onFetch,
  fetching,
  error,
  inputRef,
  readOnly = false,
  hint,
  status,
}: QidNumberFieldProps) {
  const current = ID_TYPES.find((t) => t.type === idType) ?? ID_TYPES[0];

  return (
    <div>
      {/* Label left, status right, on one line. The status sits here rather
          than beside the input because the input is flex-1 and consumes the
          whole row whenever Fetch is hidden - which is exactly the state that
          HAS a status to show. min-h keeps the line the same height with and
          without a badge, so the field below does not shift when the lookup
          resolves. */}
      <div className="flex items-center justify-between gap-3 min-h-7 mb-1">
        <label htmlFor="qid-number-input" className="block text-[length:var(--fs-label)] text-fg-2">
          {current.numberLabel}
        </label>
        {status}
      </div>
      <div className="flex gap-2">
        {/* readOnly, not disabled: a scanned number is data the agent reads
            back off the screen, and disabled styling drops it to
            --field-label-disabled at about 2.3:1. readOnly keeps --fg and
            stays selectable so it can be copied. */}
        <input
          id="qid-number-input"
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={readOnly ? undefined : current.placeholder}
          readOnly={readOnly}
          className={`flex-1 min-w-0 rounded-[var(--field-radius)] border px-3 py-2 text-[length:var(--fs-body)] text-fg
            ${readOnly ? 'bg-surface cursor-default' : 'bg-bg'}
            ${error ? 'border-[var(--field-border-error)]' : value ? 'border-[var(--field-border-filled)]' : 'border-[var(--field-border)]'}
            focus:outline-none focus-visible:border-[var(--field-focus-border)] focus-visible:shadow-[var(--field-focus-ring)]`}
        />
        {/* Only when the number is typeable. A scanned number has already
            been looked up by the act of scanning, so a Fetch beside it asked
            the agent to perform an action that had no effect they could
            observe - and its presence implied the read-only value might still
            need submitting. Hidden rather than disabled: there is no state
            from which it becomes usable without the field becoming editable
            first, so a greyed-out button would never light up in place. */}
        {!readOnly && (
          <Button variant="primary-rect" onClick={onFetch} disabled={!value || fetching}>
            <Icon path={SEARCH_ICON} className="w-4 h-4" />
            {fetching ? 'Fetching…' : 'Fetch'}
          </Button>
        )}
      </div>
      {error && <p className="text-[var(--field-border-error)] text-[length:var(--fs-caption)] mt-1">{error}</p>}
      {!error && hint && <p className="text-muted text-[length:var(--fs-caption)] mt-1">{hint}</p>}
    </div>
  );
}
