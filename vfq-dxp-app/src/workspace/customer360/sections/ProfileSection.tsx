import { Badge } from '../../../components/primitives/Badge';
import type { CustomerRecord, AccountRecord } from '../../../engines/customer360Engine';

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[length:var(--fs-caption)] text-muted">{label}</div>
      <div className="text-fg text-[length:var(--fs-body)]">{value ?? '—'}</div>
    </div>
  );
}

export function ProfileSection({ customer, accounts }: { customer: CustomerRecord; accounts: AccountRecord[] }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-[var(--radius-card)] border border-border-soft bg-bg p-5">
        <Field label="Customer ID" value={customer.customerId} />
        <Field label={customer.idType} value={customer.qid} />
        <Field label="Date of birth" value={customer.dob} />
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

      <div>
        <h3 className="text-[length:var(--fs-body-lg)] font-medium text-fg mb-2">Accounts</h3>
        {accounts.length === 0 && <p className="text-muted text-[length:var(--fs-body)]">No accounts on file.</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {accounts.map((account) => (
            <div key={account.accountId} className="rounded-[var(--radius-card)] border border-border-soft bg-bg p-4">
              <div className="font-medium text-fg text-[length:var(--fs-body)]">{account.accountType}</div>
              <div className="text-fg-2 text-[length:var(--fs-caption)] mt-0.5">
                {account.accountId} · <Badge variant={account.status === 'Active' ? 'success' : 'filled-neutral'}>{account.status}</Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
