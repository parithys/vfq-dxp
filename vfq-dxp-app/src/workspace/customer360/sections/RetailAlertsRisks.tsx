import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { DataTable } from '../../../components/primitives/DataTable';
import { ErrorBanner } from '../../../components/primitives/ErrorBanner';
import { Icon } from '../../../components/primitives/Icon';
import { computeBillingSummary, type Customer360Data } from '../../../engines/customer360Engine';
import { useEntityStore } from '../../../stores/entityStore';

const BELL_ICON = 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0';
const WARN_ICON = 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01';
const INFO_ICON = 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 16v-4 M12 8h.01';
const NOTE_ICON = 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h8';

type Tone = 'danger' | 'warning' | 'info' | 'neutral';

const TONE_CARD: Record<Tone, string> = {
  danger: 'border-[var(--danger-border)] bg-[color-mix(in_oklab,var(--danger),var(--bg)_94%)]',
  warning: 'border-[var(--warn-border)] bg-[var(--warn-bg)]',
  info: 'border-[var(--info-border)] bg-[color-mix(in_oklab,var(--info),var(--bg)_94%)]',
  neutral: 'border-[var(--field-card-border)] bg-[var(--surface)]',
};
const TONE_TEXT: Record<Tone, string> = {
  danger: 'text-danger',
  warning: 'text-[var(--warn-text)]',
  info: 'text-[var(--info)]',
  neutral: 'text-fg',
};

interface AlertCard {
  title: string;
  value?: string;
  caption: string;
  tone: Tone;
  icon: string;
}

interface BulkNote {
  noteId: string;
  content: string;
  accountIds: string[];
  postedAt: string;
  createdBy?: string;
}

const CLOSED_STAGE = /^(none|no dunning|current)$/i;

function formatDate(iso: unknown): string | undefined {
  if (!iso) return undefined;
  const d = new Date(String(iso));
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function Panel({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg p-4 min-w-0">
      <h3 className="flex items-center gap-3 text-fg font-semibold text-[length:var(--fs-body-lg)] pb-3">
        <Icon path={icon} className="w-5 h-5 shrink-0" />
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * The Retail Sales Agent's Alerts & Risks tab: alert cards, the alert details table and bulk notes. Only
 * alerts the customer's data actually supports appear - nothing is defaulted.
 */
export function RetailAlertsRisks({ data }: { data: Customer360Data }) {
  const { outstanding, latestBill } = computeBillingSummary(data);
  const dunning = data.billingProfiles[0]?.collectionStage as string | undefined;
  const dunningActive = Boolean(dunning) && !CLOSED_STAGE.test(String(dunning));
  const pendingSimSwaps = data.simSwapOrders.filter((s) => /pending/i.test(String(s.status))).length;
  const due = outstanding > 0 ? formatDate(latestBill?.dueDate) : undefined;

  const cards: AlertCard[] = [
    {
      title: 'Outstanding Balance',
      value: `QAR ${outstanding}`,
      caption: due ? `Since ${due}` : outstanding > 0 ? 'Overdue balance' : 'No overdue balance',
      tone: outstanding > 0 ? 'danger' : 'neutral',
      icon: WARN_ICON,
    },
    ...(dunning
      ? [{ title: 'Dunning Stage', value: dunning, caption: dunningActive ? `Account in ${dunning}` : 'No dunning on the account', tone: dunningActive ? ('warning' as const) : ('neutral' as const), icon: WARN_ICON }]
      : []),
    ...(pendingSimSwaps > 0
      ? [{ title: 'Pending SIM Swap', caption: `${pendingSimSwaps} request${pendingSimSwaps === 1 ? '' : 's'} pending`, tone: 'warning' as const, icon: INFO_ICON }]
      : []),
  ];

  const details: { alert: string; details: string; value: string; date: string }[] = [
    { alert: 'Outstanding Balance', details: 'Total outstanding amount', value: `QAR ${outstanding}`, date: due ?? '-' },
    ...(dunning ? [{ alert: 'Dunning Stage', details: 'Current dunning stage for the account', value: dunning, date: '-' }] : []),
    ...(pendingSimSwaps > 0 ? [{ alert: 'Pending SIM Swap', details: 'SIM swap request status', value: 'Pending', date: '-' }] : []),
  ];

  const notes = (useEntityStore((s) => s.records['bulk-notes']) ?? []) as unknown as BulkNote[];
  const loadKind = useEntityStore((s) => s.loadKind);
  const loading = useEntityStore((s) => s.loading['bulk-notes']);
  const loadError = useEntityStore((s) => s.errors['bulk-notes']);
  useEffect(() => {
    loadKind('bulk-notes');
  }, [loadKind]);
  const accountIds = data.accounts.map((a) => a.accountId);
  const applicable = notes
    .filter((n) => n.accountIds.some((id) => accountIds.includes(id)))
    .sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());

  return (
    <div className="space-y-4">
      <h2 className="flex items-center gap-3 text-fg font-semibold text-[length:var(--fs-h4)] pb-3 border-b border-border-soft">
        <Icon path={BELL_ICON} className="w-6 h-6" />
        Alerts &amp; Risks
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.title} className={`rounded-[var(--radius-card)] border p-4 flex items-start gap-4 ${TONE_CARD[c.tone]}`}>
            <Icon path={c.icon} className={`w-7 h-7 shrink-0 mt-1 ${TONE_TEXT[c.tone]}`} />
            <div className="min-w-0">
              <div className="text-fg text-[length:var(--fs-body)]">{c.title}</div>
              {c.value && <div className={`font-bold text-[length:var(--fs-h4)] leading-tight ${TONE_TEXT[c.tone]}`}>{c.value}</div>}
              <div className="text-fg-2 text-[length:var(--fs-body)] mt-1">{c.caption}</div>
            </div>
          </div>
        ))}
      </div>

      <Panel icon={WARN_ICON} title="Alert Details">
        <DataTable
          rows={details.map((d, i) => ({ ...d, n: i + 1 }))}
          rowKey={(r) => r.alert}
          columns={[
            { key: 'n', header: '#', sortable: false },
            { key: 'alert', header: 'Alert / Risk', sortable: false },
            { key: 'details', header: 'Details', sortable: false },
            { key: 'value', header: 'Status / Value', sortable: false },
            { key: 'date', header: 'Date', sortable: false },
            { key: 'remarks', header: 'Remarks', sortable: false, render: () => '-' },
          ]}
        />
      </Panel>

      <Panel icon={NOTE_ICON} title="Bulk Notes">
        <ErrorBanner message={loadError} />
        {loading ? (
          <p className="text-muted text-[length:var(--fs-body)]">Loading…</p>
        ) : (
          <DataTable
            rows={applicable}
            rowKey={(r) => r.noteId}
            emptyMessage="No bulk notes apply to this customer's accounts."
            columns={[
              { key: 'postedAt', header: 'Date', sortable: false, render: (r) => formatDate(r.postedAt) },
              { key: 'content', header: 'Notes', sortable: false },
              { key: 'createdBy', header: 'Added By', sortable: false, render: (r) => r.createdBy ?? '-' },
            ]}
          />
        )}
      </Panel>
    </div>
  );
}
