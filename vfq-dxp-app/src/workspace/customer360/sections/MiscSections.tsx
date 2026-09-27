import { useState } from 'react';
import { DataTable } from '../../../components/primitives/DataTable';
import { Badge } from '../../../components/primitives/Badge';
import { Tooltip } from '../../../components/primitives/Tooltip';
import { Icon } from '../../../components/primitives/Icon';
import { Button, PRIMARY_SURFACE } from '../../../components/primitives/Button';
import { Drawer } from '../../../components/primitives/Drawer';
import { Select } from '../../../components/primitives/Select';
import { Input } from '../../../components/primitives/Input';
import { Textarea } from '../../../components/primitives/Textarea';
import { downloadCsv } from '../../../engines/csvExport';
import { useNotificationStore } from '../../../stores/notificationStore';
import { useEntityStore } from '../../../stores/entityStore';
import type { Customer360Data } from '../../../engines/customer360Engine';

const DOWNLOAD_ICON = 'M12 15V3 M7 10l5 5 5-5 M4 21h16';

// CUS-001-ATT-01-B: one shared download affordance for every attachment
// table - reuses the CSV-export pattern already established for Profile
// Export/Invoice Download rather than fabricating real file storage.
function useAttachmentDownload() {
  const pushToast = useNotificationStore((s) => s.pushToast);
  return (label: string, id: string, row: Record<string, unknown>) => {
    downloadCsv(`${label}-${id}.csv`, [row]);
    pushToast('success', `${label} ${id} downloaded.`);
  };
}

function DownloadButton({ onClick }: { onClick: () => void }) {
  return (
    <Tooltip content="Download" placement="top">
      <button onClick={(e) => { e.stopPropagation(); onClick(); }} aria-label="Download attachment" className="text-muted hover:text-fg p-1">
        <Icon path={DOWNLOAD_ICON} className="w-4 h-4" />
      </button>
    </Tooltip>
  );
}

type AttachmentFilter = 'Active' | 'Archived';
function ActiveArchivedToggle({ value, onChange }: { value: AttachmentFilter; onChange: (v: AttachmentFilter) => void }) {
  return (
    <div className="inline-flex rounded-[var(--radius-button)] border border-border-soft overflow-hidden text-[length:var(--fs-caption)]">
      {(['Active', 'Archived'] as const).map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`px-3 py-1.5 font-medium ${value === opt ? `${PRIMARY_SURFACE} enabled:hover:bg-[image:var(--accent-gradient-hover)]` : 'bg-bg text-fg-2 hover:bg-surface'}`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

// Seven of Customer 360's thirteen sections are single-purpose read-only
// views over data customer360Engine already joined - no unique interaction
// logic distinguishes them the way Mobile/Fibre/Billing/Orders/Tickets have
// their own. Grouped in one file rather than seven near-identical
// boilerplate files; each is still a real, independently reachable tab.

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[length:var(--fs-caption-upper)] uppercase tracking-wide font-semibold text-fg mb-2">{children}</h3>;
}

const INTERACTION_CHANNELS = ['Email', 'SMS', 'Phone', 'Call Center', 'Store', 'Digital App'] as const;

// CUS-001-VEW-01: channel taxonomy now includes Email/SMS/Phone alongside
// the pre-existing Call Center/Store/Digital App values, so the requirement
// is satisfiable regardless of which channel an interaction was actually
// logged through. CUS-001-VEW-02: Log Interaction generates a real unique
// interaction ID at creation time (INT-<timestamp>), unlike the seeded
// activityNumber values on legacy rows, which predate this action existing.
export function InteractionsSection({
  data,
  onLogged,
}: {
  data: Customer360Data;
  /** Customer360Layout's `data` state is a one-time fetch, not reactive to
   * entityStore mutations - without this callback, a just-logged interaction
   * would only appear after navigating away and back (the record is
   * correctly persisted either way, but the visible table would go stale
   * until then). Mirrors DemographicEditDrawer's onSaved pattern. */
  onLogged?: (record: Record<string, unknown>) => void;
}) {
  const createRecord = useEntityStore((s) => s.createRecord);
  const pushToast = useNotificationStore((s) => s.pushToast);
  const [logOpen, setLogOpen] = useState(false);
  const [channel, setChannel] = useState<(typeof INTERACTION_CHANNELS)[number]>('Phone');
  const [topic, setTopic] = useState('');
  const [comments, setComments] = useState('');
  const [saving, setSaving] = useState(false);

  const accountId = data.accounts[0]?.accountId;

  const logInteraction = async () => {
    if (!accountId || !topic.trim()) return;
    setSaving(true);
    const interactionId = `INT-${Date.now().toString().slice(-8)}`;
    const record = {
      activityNumber: interactionId,
      accountId,
      channel,
      topic,
      comments,
      status: 'Solved',
      transactionDate: new Date().toISOString().slice(0, 10),
    };
    await createRecord('customer-activities', record);
    onLogged?.(record);
    setSaving(false);
    setLogOpen(false);
    setTopic('');
    setComments('');
    pushToast('success', `Interaction ${interactionId} logged.`);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <SectionTitle>Interactions</SectionTitle>
        <Button variant="primary-rect" compact onClick={() => setLogOpen(true)}>
          Log Interaction
        </Button>
      </div>
      <DataTable
        rows={data.activities}
        rowKey={(r) => String(r.activityNumber)}
        emptyMessage="No interaction history on file."
        columns={[
          { key: 'activityNumber', header: 'Interaction ID' },
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
      <Drawer
        open={logOpen}
        onClose={() => setLogOpen(false)}
        title="Log Interaction"
        footer={
          <>
            <Button variant="ghost-rect" onClick={() => setLogOpen(false)}>Cancel</Button>
            <Button variant="primary-rect" disabled={saving || !topic.trim()} onClick={logInteraction}>
              {saving ? 'Logging…' : 'Log Interaction'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Channel"
            value={channel}
            onChange={(e) => setChannel(e.target.value as (typeof INTERACTION_CHANNELS)[number])}
            options={INTERACTION_CHANNELS.map((c) => ({ value: c, label: c }))}
          />
          <Input label="Topic" value={topic} onChange={(e) => setTopic(e.target.value)} />
          <Textarea label="Comments" value={comments} onChange={(e) => setComments(e.target.value)} />
        </div>
      </Drawer>
    </div>
  );
}

// CUS-001-VEW-03: sent SMS/email communications tied directly to the
// customer (customer-communications.json), not scoped to order-triggered
// SMS the way NotificationsSection's osb-notifications join is - that join
// stays as-is for its own order-notification purpose; this is the general
// "sent communications" view the requirement actually asks for.
export function CommunicationsSection({ data }: { data: Customer360Data }) {
  return (
    <DataTable
      rows={data.communications}
      rowKey={(r) => String(r.communicationId)}
      emptyMessage="No sent communications on file for this customer."
      columns={[
        { key: 'sentAt', header: 'Sent' },
        {
          key: 'channel',
          header: 'Channel',
          render: (r) => <Badge variant={r.channel === 'Email' ? 'accent' : 'filled-neutral'}>{String(r.channel)}</Badge>,
        },
        { key: 'subject', header: 'Subject' },
        { key: 'messageText', header: 'Message' },
        { key: 'deliveryState', header: 'Delivery State' },
      ]}
    />
  );
}

// CUS-001-ATT-01-A/B, ATT-03/ATT-01-C: one Active/Archived toggle serves
// both attachment tables - this is the single implementation that satisfies
// ATT-03 and its source-register duplicate ATT-01-C at once, per the audit's
// Phase 3 finding that the BRSD's own redundancy should not be propagated
// into two separate code paths. CAF forms carry `status`; identity documents
// carry `docStatus` (kept distinct from their pre-existing `status` field,
// which is a *validation* status, not an archival one).
export function DocumentsSection({ data }: { data: Customer360Data }) {
  const [filter, setFilter] = useState<AttachmentFilter>('Active');
  const download = useAttachmentDownload();
  const cafRows = data.cafForms.filter((r) => (r.status ?? 'Active') === filter);
  const idRows = data.identityDocuments.filter((r) => (r.docStatus ?? 'Active') === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionTitle>Attachments</SectionTitle>
        <ActiveArchivedToggle value={filter} onChange={setFilter} />
      </div>
      <section>
        <SectionTitle>Signed forms (CAF)</SectionTitle>
        <DataTable
          rows={cafRows}
          rowKey={(r) => String(r.cafId)}
          emptyMessage={`No ${filter.toLowerCase()} signed forms on file.`}
          columns={[
            { key: 'formId', header: 'Form' },
            { key: 'signedDate', header: 'Signed' },
            { key: 'uploadDateTime', header: 'Upload Date/Time' },
            { key: 'serviceReference', header: 'Service Reference' },
            { key: 'signatureMethod', header: 'Method' },
            {
              key: 'status',
              header: 'Status',
              render: (r) => <Badge variant={r.status === 'Archived' ? 'filled-neutral' : 'success'}>{String(r.status ?? 'Active')}</Badge>,
            },
            { key: 'download', header: '', sortable: false, render: (r) => <DownloadButton onClick={() => download('CAF', String(r.cafId), r)} /> },
          ]}
        />
      </section>
      <section>
        <SectionTitle>Identity documents</SectionTitle>
        <DataTable
          rows={idRows}
          rowKey={(r) => String(r.identityDocumentId)}
          emptyMessage={`No ${filter.toLowerCase()} identity documents on file.`}
          columns={[
            { key: 'documentType', header: 'Type' },
            { key: 'documentNumber', header: 'Number' },
            { key: 'uploadDateTime', header: 'Upload Date/Time' },
            { key: 'serviceReference', header: 'Service Reference' },
            { key: 'validationPath', header: 'Validation path' },
            {
              key: 'status',
              header: 'Validation Status',
              render: (r) => <Badge variant={r.status === 'Validated' ? 'success' : 'filled-neutral'}>{String(r.status)}</Badge>,
            },
            {
              key: 'docStatus',
              header: 'Archive Status',
              render: (r) => <Badge variant={r.docStatus === 'Archived' ? 'filled-neutral' : 'success'}>{String(r.docStatus ?? 'Active')}</Badge>,
            },
            { key: 'download', header: '', sortable: false, render: (r) => <DownloadButton onClick={() => download('Identity-Document', String(r.identityDocumentId), r)} /> },
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
    <div className="rounded-[var(--radius-card)] border border-border-soft bg-bg p-5">
      <SectionTitle>Consent &amp; Preferences</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <div className="text-[length:var(--fs-caption)] text-muted">Preferred language</div>
          <div className="text-fg text-[length:var(--fs-body)]">{data.customer.preferredLanguage ?? '-'}</div>
        </div>
        <div>
          <div className="text-[length:var(--fs-caption)] text-muted">Bill medium</div>
          <div className="text-fg text-[length:var(--fs-body)]">{String(profile?.billMedium ?? '-')}</div>
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
    </div>
  );
}

export function ProductsAssetsSection({ data }: { data: Customer360Data }) {
  return (
    <div>
      <SectionTitle>Products &amp; Assets</SectionTitle>
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
    </div>
  );
}

export function RecentActivitiesSection({ data }: { data: Customer360Data }) {
  type TimelineEntry = { at: string; label: string };
  const entries: TimelineEntry[] = [
    ...data.activities.map((a) => ({ at: String(a.transactionDate ?? ''), label: `${a.topic ?? a.journey ?? 'Activity'} - ${a.comments ?? ''}` })),
    ...data.payments.map((p) => ({ at: String(p.capturedAt ?? ''), label: `Payment captured - ${p.chargeType ?? ''} (${p.amountQar ?? ''} QAR)` })),
    ...data.identityDocuments.map((d) => ({ at: String(d.scannedAt ?? ''), label: `Identity document scanned - ${d.documentType ?? ''}` })),
  ]
    .filter((e) => e.at)
    .sort((a, b) => (a.at < b.at ? 1 : -1));

  if (entries.length === 0) {
    return <p className="text-muted text-[length:var(--fs-body)]">No dated activity on file for this customer yet.</p>;
  }
  return (
    <div>
      <SectionTitle>Recent Activities</SectionTitle>
      <ul className="space-y-2">
        {entries.map((entry, i) => (
          <li key={i} className="flex gap-3 rounded-[var(--radius-card)] border border-border-soft bg-bg p-3">
            <span className="text-muted text-[length:var(--fs-caption)] shrink-0 w-40">{entry.at}</span>
            <span className="text-fg text-[length:var(--fs-body)]">{entry.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
