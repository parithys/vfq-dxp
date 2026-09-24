import { Badge } from '../../../components/primitives/Badge';
import type { CustomerRecord, AccountRecord } from '../../../engines/customer360Engine';

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

export function ProfileSection({ customer, accounts }: { customer: CustomerRecord; accounts: AccountRecord[] }) {
  const activeCount = accounts.filter((a) => a.status === 'Active').length;

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
          right={activeCount > 0 ? <Badge variant="success">{activeCount} ACTIVE</Badge> : undefined}
        />
        {accounts.length === 0 && <p className="text-muted text-[length:var(--fs-body)]">No accounts on file.</p>}
        <div className="space-y-3">
          {accounts.map((account) => (
            <div key={account.accountId} className="flex items-center gap-2.5">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${account.status === 'Active' ? 'bg-success' : 'bg-muted'}`}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <div className="text-fg text-[length:var(--fs-body)] truncate">{account.accountType}</div>
                <div className="text-muted text-[length:var(--fs-caption)] truncate">{account.accountId} · {account.status}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
