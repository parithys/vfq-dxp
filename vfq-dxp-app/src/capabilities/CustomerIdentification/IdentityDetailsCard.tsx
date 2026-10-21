import { Icon } from '../../components/primitives/Icon';

// Registry-sourced identity facts, shown as read-only content rather than disabled form controls: nothing here
// can be typed into, so nothing looks like it can. Each fact is a label above its value beside a small icon tile;
// the "View only" pill says why it cannot be changed.

const IC = {
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  calendar: 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M16 2v4 M8 2v4 M3 10h18',
  globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M2 12h20 M12 2a15 15 0 0 1 0 20 M12 2a15 15 0 0 0 0 20',
  gender: 'M14 10a5 5 0 1 1-10 0 5 5 0 0 1 10 0z M13 7l7-7 M15 0h5v5',
  idCard: 'M3 5h18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M7 11a2 2 0 1 0 0-.01 M5 16c0-1.5 1-2 2-2s2 .5 2 2 M13 10h6 M13 14h4',
  building: 'M6 2h12a1 1 0 0 1 1 1v19H5V3a1 1 0 0 1 1-1z M9 6h2 M13 6h2 M9 10h2 M13 10h2 M9 14h2 M13 14h2',
};

export interface Fact {
  label: string;
  value: string;
  icon: keyof typeof IC;
}

function Tile({ icon, className = 'w-9 h-9' }: { icon: keyof typeof IC; className?: string }) {
  return (
    <span className={`${className} rounded-[var(--radius-button)] bg-surface text-fg-2 flex items-center justify-center shrink-0`}>
      <Icon path={IC[icon]} className="w-[18px] h-[18px]" />
    </span>
  );
}

function FactRow({ facts }: { facts: Fact[] }) {
  return (
    <dl className="grid grid-cols-1 @lg:grid-cols-3 divide-y @lg:divide-y-0 @lg:divide-x divide-border-soft">
      {facts.map((f, i) => (
        <div key={f.label} className={`flex items-center gap-3 min-w-0 py-2 @lg:py-0 ${i === 0 ? '@lg:pr-4' : '@lg:px-4'}`}>
          <Tile icon={f.icon} />
          <div className="min-w-0">
            <dt className="text-fg text-[length:var(--fs-caption)] leading-tight">{f.label}</dt>
            <dd className="text-fg font-semibold text-[length:var(--fs-body)] leading-snug break-words">{f.value || '-'}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}

export function IdentityDetailsCard({ facts, status }: { facts: Fact[]; status?: string }) {
  // Rows of three, the last row left-aligned however many facts it holds.
  const rows: Fact[][] = [];
  for (let i = 0; i < facts.length; i += 3) rows.push(facts.slice(i, i + 3));
  return (
    <section aria-label="Identity Details" className="@container">
      {/* Same heading as "Contact & Notification" (plain, flush left, no icon); only the read-only pill sits beside it. */}
      <div className={`flex items-center justify-between gap-4 ${status ? 'mb-0' : 'mb-3'}`}>
        <h3 className="text-fg font-semibold text-[length:var(--fs-body-lg)]">Identity Details</h3>
        <span className="rounded-[var(--radius-pill)] bg-[var(--tint-blue-bg)] text-[var(--tint-blue-fg)] px-3 py-1 text-[length:var(--fs-caption)] font-medium shrink-0">
          View only
        </span>
      </div>
      {status && (
        <p className="-mt-1 mb-3 text-success font-medium text-[length:var(--fs-caption)]">{status}</p>
      )}
      {/* Validated with MOI: a faint success wash and border (the same tint recipe the success toast uses) so the
          card reads as registry-confirmed; the icon tiles go white to stay legible on it. */}
      <div
        className={`rounded-[var(--radius-card)] border p-5 space-y-4 ${
          status
            ? 'border-tone-success-border bg-tone-success-soft [&_dl_span]:bg-bg'
            : 'border-border-soft bg-bg'
        }`}
      >
        {rows.map((r, i) => (
          <div key={i} className={i > 0 ? 'pt-4 border-t border-border-soft' : ''}>
            <FactRow facts={r} />
          </div>
        ))}
      </div>
    </section>
  );
}

/** The identity facts every Customer Identification result shows. */
export interface IdentityFields {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dob?: string;
  idExpiryDate?: string;
  nationality?: string;
  gender?: string;
  idTypeLabel?: string;
  companyName?: string;
  occupation?: string;
}

/**
 * One list of facts for every journey, so the card reads the same everywhere. The content follows the context:
 * the document type is left out where the agent already chose it (`showDocumentType` false), and Sponsor and
 * Occupation are always shown (blank when the record holds none).
 */
export function identityFacts(f: IdentityFields, opts: { showDocumentType?: boolean } = {}): Fact[] {
  const { showDocumentType = true } = opts;
  return [
    { icon: 'user', label: 'First Name', value: f.firstName ?? '' },
    { icon: 'users', label: 'Middle Name(s)', value: f.middleName ?? '' },
    { icon: 'user', label: 'Last Name', value: f.lastName ?? '' },
    { icon: 'calendar', label: 'Date of Birth', value: f.dob ?? '' },
    { icon: 'calendar', label: 'ID Expiry Date', value: f.idExpiryDate ?? '' },
    { icon: 'globe', label: 'Nationality', value: f.nationality ?? '' },
    { icon: 'gender', label: 'Gender', value: f.gender ?? '' },
    ...(showDocumentType ? [{ icon: 'idCard' as const, label: 'Document Type', value: f.idTypeLabel ?? '' }] : []),
    // Sponsor and Occupation are shown for every customer - new or existing, whatever the segment - and read blank when the record holds none.
    { icon: 'building' as const, label: 'Sponsor', value: f.companyName ?? '' },
    { icon: 'idCard' as const, label: 'Occupation', value: f.occupation ?? '' },
  ];
}
