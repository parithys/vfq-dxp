import { useState } from 'react';
import { DataTable } from '../../../components/primitives/DataTable';
import { Icon } from '../../../components/primitives/Icon';
import { Select } from '../../../components/primitives/Select';
import type { Customer360Data } from '../../../engines/customer360Engine';

const AUDIT_ICON = 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z';

interface AuditRow {
  id: string;
  at: string;
  /** The source value was a date with no time of day. */
  dateOnly: boolean;
  type: string;
  details: string;
  by: string;
}

const ALL = 'all';

function formatWhen(iso: string, dateOnly: boolean): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  if (dateOnly) return date;
  return `${date} ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
}

const str = (v: unknown): string | undefined => (v === undefined || v === null || v === '' ? undefined : String(v));

/**
 * The Retail Sales Agent's Audit Trail tab: one chronological list across orders, activities, trouble tickets
 * and account / contact field changes (the five things the field "Audit Trail (Orders, Contact, Account,
 * Activity, TT)" names), filterable by type. Read-only; every row is an existing record, nothing is derived.
 */
export function RetailAuditTrail({ data }: { data: Customer360Data }) {
  const [type, setType] = useState(ALL);

  const rows: AuditRow[] = [
    ...data.orders.map((o) => ({
      id: `ord-${String(o.orderId)}`,
      at: String(o.createdAt ?? ''),
      dateOnly: false,
      type: 'Order',
      details: `${str(o.orderType) ?? 'Order'} (${String(o.orderId)})`,
      by: str(o.createdBy) ?? '-',
    })),
    ...data.activities.map((a) => ({
      id: `act-${String(a.activityNumber)}`,
      at: String(a.transactionDate ?? ''),
      dateOnly: !/T/.test(String(a.transactionDate ?? '')),
      type: 'Activity',
      details: str(a.journey) ?? str(a.comments) ?? String(a.activityNumber),
      by: str(a.agentId) ?? '-',
    })),
    ...data.tickets.map((t) => ({
      id: `tt-${String(t.ticketId)}`,
      at: String(t.createdAt ?? ''),
      dateOnly: false,
      type: 'Trouble Ticket',
      details: `${str(t.actualIssue) ?? str(t.category) ?? 'Ticket'} (${String(t.ticketId)})`,
      by: str(t.createdBy) ?? '-',
    })),
    ...data.auditTrail.map((r) => ({
      id: `aud-${String(r.auditId)}`,
      at: String(r.timestamp ?? ''),
      dateOnly: false,
      type: str(r.recordType) ?? 'Account',
      details: `${str(r.fieldModified) ?? 'Field'} updated`,
      by: str(r.employeeUser) ?? '-',
    })),
  ]
    .filter((r) => r.at)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const types = [...new Set(rows.map((r) => r.type))];
  const shown = (type === ALL ? rows : rows.filter((r) => r.type === type)).map((r, i) => ({ ...r, n: i + 1, when: formatWhen(r.at, r.dateOnly) }));

  return (
    <div>
      <h2 className="flex items-center gap-3 text-fg font-semibold text-[length:var(--fs-h4)] pb-3 mb-3 border-b border-border-soft">
        <Icon path={AUDIT_ICON} className="w-6 h-6" />
        Audit Trail
      </h2>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <p className="text-fg-2 text-[length:var(--fs-body)]">Audit Trail (Orders, Contact, Account, Activity, TT)</p>
        <div className="w-48">
          <Select
            aria-label="Filter by type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            options={[{ value: ALL, label: 'All Types' }, ...types.map((t) => ({ value: t, label: t }))]}
          />
        </div>
      </div>
      <DataTable
        rows={shown}
        rowKey={(r) => r.id}
        emptyMessage="No audit entries on file for this customer."
        columns={[
          { key: 'n', header: '#', sortable: false },
          { key: 'when', header: 'Date & Time', sortable: false },
          { key: 'type', header: 'Type', sortable: false },
          { key: 'details', header: 'Details', sortable: false },
          { key: 'by', header: 'Performed By', sortable: false },
        ]}
      />
    </div>
  );
}
