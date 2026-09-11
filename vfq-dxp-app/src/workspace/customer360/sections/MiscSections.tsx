import { DataTable } from '../../../components/primitives/DataTable';
import { Badge } from '../../../components/primitives/Badge';
import type { Customer360Data } from '../../../engines/customer360Engine';

// Seven of Customer 360's thirteen sections are single-purpose read-only
// views over data customer360Engine already joined — no unique interaction
// logic distinguishes them the way Mobile/Fibre/Billing/Orders/Tickets have
// their own. Grouped in one file rather than seven near-identical
// boilerplate files; each is still a real, independently reachable tab.

export function InteractionsSection({ data }: { data: Customer360Data }) {
  return (
    <DataTable
      rows={data.activities}
      rowKey={(r) => String(r.activityNumber)}
      emptyMessage="No interaction history on file."
      columns={[
        { key: 'transactionDate', header: 'Date' },
        { key: 'channel', header: 'Channel' },
        { key: 'topic', header: 'Topic' },
        { key: 'comments', header: 'Comments' },
        {
          key: 'status',
          header: 'Status',
          render: (r) => <Badge variant={r.status === 'Solved' ? 'success' : 'filled-neutral'}>{String(r.status)}</Badge>,
        },
      ]}
    />
  );
}

export function DocumentsSection({ data }: { data: Customer360Data }) {
  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-[length:var(--fs-body-lg)] font-medium text-fg mb-2">Signed forms (CAF)</h3>
        <DataTable
          rows={data.cafForms}
          rowKey={(r) => String(r.cafId)}
          emptyMessage="No signed forms on file."
          columns={[
            { key: 'formId', header: 'Form' },
            { key: 'signedDate', header: 'Signed' },
            { key: 'signatureMethod', header: 'Method' },
            { key: 'orderId', header: 'Order #' },
          ]}
        />
      </section>
      <section>
        <h3 className="text-[length:var(--fs-body-lg)] font-medium text-fg mb-2">Identity documents</h3>
        <DataTable
          rows={data.identityDocuments}
          rowKey={(r) => String(r.identityDocumentId)}
          emptyMessage="No identity documents on file."
          columns={[
            { key: 'documentType', header: 'Type' },
            { key: 'documentNumber', header: 'Number' },
            { key: 'validationPath', header: 'Validation path' },
            {
              key: 'status',
              header: 'Status',
              render: (r) => <Badge variant={r.status === 'Validated' ? 'success' : 'filled-neutral'}>{String(r.status)}</Badge>,
            },
          ]}
        />
      </section>
    </div>
  );
}

export function NotificationsSection({ data }: { data: Customer360Data }) {
  return (
    <DataTable
      rows={data.notifications}
      rowKey={(r) => String(r.messageId)}
      emptyMessage="No notifications on file for this customer's orders."
      columns={[
        { key: 'dbTimestamp', header: 'Sent' },
        { key: 'orderId', header: 'Order #' },
        { key: 'smsText', header: 'Message' },
        { key: 'state', header: 'Delivery state' },
      ]}
    />
  );
}

export function ConsentSection({ data }: { data: Customer360Data }) {
  const profile = data.billingProfiles[0];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-[var(--radius-card)] border border-border-soft bg-bg p-5">
      <div>
        <div className="text-[length:var(--fs-caption)] text-muted">Preferred language</div>
        <div className="text-fg text-[length:var(--fs-body)]">{data.customer.preferredLanguage ?? '—'}</div>
      </div>
      <div>
        <div className="text-[length:var(--fs-caption)] text-muted">Bill medium</div>
        <div className="text-fg text-[length:var(--fs-body)]">{String(profile?.billMedium ?? '—')}</div>
      </div>
      <div>
        <div className="text-[length:var(--fs-caption)] text-muted">AutoPay</div>
        <div className="text-fg text-[length:var(--fs-body)]">
          <Badge variant={profile?.autoPayStatus === 'Enrolled' ? 'success' : 'filled-neutral'}>
            {String(profile?.autoPayStatus ?? 'Not on file')}
          </Badge>
        </div>
      </div>
    </div>
  );
}

export function ProductsAssetsSection({ data }: { data: Customer360Data }) {
  return (
    <DataTable
      rows={data.installedAssets}
      rowKey={(r) => String(r.installedAssetId)}
      emptyMessage="No installed products or assets on file."
      columns={[
        { key: 'productServiceName', header: 'Product / service' },
        { key: 'serviceId', header: 'Service ID' },
        { key: 'effectiveFrom', header: 'Since' },
        {
          key: 'status',
          header: 'Status',
          render: (r) => <Badge variant={r.status === 'Active' ? 'success' : 'filled-neutral'}>{String(r.status)}</Badge>,
        },
      ]}
    />
  );
}

export function RelationshipHierarchySection({ data }: { data: Customer360Data }) {
  const hasHierarchy = data.accounts.some((a) => a.parentAccountId || (a.subAccountIds && a.subAccountIds.length > 0));
  if (!hasHierarchy) {
    return <p className="text-muted text-[length:var(--fs-body)]">This customer has no parent/sub-account relationships on file.</p>;
  }
  return (
    <div className="space-y-2">
      {data.accounts.map((account) => (
        <div key={account.accountId} className="rounded-[var(--radius-card)] border border-border-soft bg-bg p-4">
          <div className="font-medium text-fg">{account.accountType}</div>
          <div className="text-fg-2 text-[length:var(--fs-caption)] mt-0.5">
            {account.accountId}
            {account.parentAccountId && ` · reports to ${account.parentAccountId}`}
            {account.subAccountIds && account.subAccountIds.length > 0 && ` · sub-accounts: ${account.subAccountIds.join(', ')}`}
          </div>
        </div>
      ))}
    </div>
  );
}

export function RecentActivitiesSection({ data }: { data: Customer360Data }) {
  type TimelineEntry = { at: string; label: string };
  const entries: TimelineEntry[] = [
    ...data.activities.map((a) => ({ at: String(a.transactionDate ?? ''), label: `${a.topic ?? a.journey ?? 'Activity'} — ${a.comments ?? ''}` })),
    ...data.payments.map((p) => ({ at: String(p.capturedAt ?? ''), label: `Payment captured — ${p.chargeType ?? ''} (${p.amountQar ?? ''} QAR)` })),
    ...data.identityDocuments.map((d) => ({ at: String(d.scannedAt ?? ''), label: `Identity document scanned — ${d.documentType ?? ''}` })),
  ]
    .filter((e) => e.at)
    .sort((a, b) => (a.at < b.at ? 1 : -1));

  if (entries.length === 0) {
    return <p className="text-muted text-[length:var(--fs-body)]">No dated activity on file for this customer yet.</p>;
  }
  return (
    <ul className="space-y-2">
      {entries.map((entry, i) => (
        <li key={i} className="flex gap-3 rounded-[var(--radius-card)] border border-border-soft bg-bg p-3">
          <span className="text-muted text-[length:var(--fs-caption)] shrink-0 w-40">{entry.at}</span>
          <span className="text-fg text-[length:var(--fs-body)]">{entry.label}</span>
        </li>
      ))}
    </ul>
  );
}
