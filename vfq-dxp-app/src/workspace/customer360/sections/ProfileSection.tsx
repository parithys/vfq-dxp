import { Link } from 'react-router-dom';
import { Badge } from '../../../components/primitives/Badge';
import type { CustomerRecord, AccountRecord } from '../../../engines/customer360Engine';
import { groupServicesByCategory, type CustomerService } from '../../../engines/customerServicesEngine';

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[length:var(--fs-caption)] text-muted">{label}</div>
      <div className="text-fg text-[length:var(--fs-body)]">{value ?? '-'}</div>
    </div>
  );
}

function SectionHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-[length:var(--fs-caption-upper)] uppercase tracking-wide font-semibold text-fg">{title}</h3>
      {right}
    </div>
  );
}

export function ProfileSection({
  customer,
  accounts,
  services,
}: {
  customer: CustomerRecord;
  accounts: AccountRecord[];
  services: CustomerService[];
}) {
  // Linked Services counts CONNECTIONS grouped by category as of 2026-09-25,
  // not accounts. It listed one row per account record before, which answered
  // a question nobody asks at this panel ("which account ids exist") and could
  // not answer the one they do ("what does this customer actually have") - a
  // single account can carry a mobile line, fibre and IPTV at once.
  //
  // Same grouper the queue notification's Active lines breakdown uses, so the
  // two cannot disagree about what a customer holds.
  const groups = groupServicesByCategory(services);
  const serviceCount = services.length;

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      <div className="flex-1 min-w-0 rounded-[var(--radius-card)] border border-border-soft bg-bg p-5">
        <SectionHeader title="Personal Information" right={<span className="text-[length:var(--fs-caption)] text-muted">ID: {customer.customerId}</span>} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label={customer.idType} value={customer.qid} />
          <Field label="Date of birth" value={customer.dob} />
          <Field label="Age" value={customer.age} />
          <Field label="Gender" value={customer.gender} />
          <Field label="Nationality" value={customer.nationality} />
          <Field label="Segment" value={customer.segment} />
          <Field label="Preferred language" value={customer.preferredLanguage} />
          <Field label="Email" value={customer.email} />
          <Field label="Phone" value={customer.phone} />
          <Field
            label="MOI validation"
            value={
              customer.moiValidationStatus ? (
                <Badge variant={customer.moiValidationStatus === 'Verified' ? 'success' : 'filled-neutral'}>
                  {customer.moiValidationStatus}
                </Badge>
              ) : undefined
            }
          />
          {customer.blacklisted && (
            <Field label="Status" value={<Badge variant="danger">Blacklisted</Badge>} />
          )}
        </div>
      </div>

      <div className="w-full lg:w-72 shrink-0 rounded-[var(--radius-card)] border border-border-soft bg-bg p-5">
        <SectionHeader
          title="Linked Services"
          right={serviceCount > 0 ? <Badge variant="success">{serviceCount} ACTIVE</Badge> : undefined}
        />
        {serviceCount === 0 && (
          <p className="text-muted text-[length:var(--fs-body)]">
            {accounts.length === 0 ? 'No accounts on file.' : 'No active connections on this account.'}
          </p>
        )}
        <ul className="space-y-1">
          {groups.map((group) => (
            <li key={group.category}>
              {/* A real <Link>, not a button with link styling: it is
                  right-clickable, middle-clickable and announced as a link,
                  which a div with an onClick is not.
                  
                  Targets this same customer with `tab` in location state -
                  the identical mechanism the queue notification's service
                  links use, so there is one deep-link path rather than two.
                  Customer360Layout re-applies that state per navigation, which
                  is what makes it work when the target path is the path
                  already open.

                  No serviceRef: a category opens its tab without singling out
                  one service, so nothing arrives highlighted. */}
              <Link
                to={`/customer/${customer.customerId}`}
                state={{ tab: group.tab }}
                aria-label={`${group.category}: ${group.count} ${group.count === 1 ? 'service' : 'services'} - open the ${group.tab} tab`}
                className="group flex items-center justify-between gap-3 -mx-2 px-2 py-1.5 rounded-[var(--radius-button)] hover:bg-surface"
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0 bg-success" aria-hidden="true" />
                  <span className="text-accent text-[length:var(--fs-body)] truncate underline decoration-accent/30 underline-offset-2 group-hover:decoration-accent">
                    {group.category}
                  </span>
                </span>
                {/* The count is the fact this panel exists to give, so it
                    keeps --fg emphasis rather than taking the link colour. */}
                <span className="text-fg font-semibold text-[length:var(--fs-body)] shrink-0">{group.count}</span>
              </Link>
            </li>
          ))}
        </ul>
        {/* Accounts are still worth stating - a category count says what the
            customer has, not how many billing relationships it sits across -
            but as one line rather than the whole panel. */}
        {accounts.length > 0 && (
          <p className="text-muted text-[length:var(--fs-caption)] mt-4 pt-3 border-t border-border-soft">
            Across {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'}
            {accounts.filter((a) => a.status === 'Active').length !== accounts.length &&
              ` (${accounts.filter((a) => a.status === 'Active').length} active)`}
          </p>
        )}
      </div>
    </div>
  );
}
