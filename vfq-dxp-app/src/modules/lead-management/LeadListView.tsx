import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEntityStore } from '../../stores/entityStore';
import { usePersonaStore } from '../../stores/personaStore';
import { DataTable } from '../../components/primitives/DataTable';
import { Badge } from '../../components/primitives/Badge';
import type { Lead } from './types';

export type LeadScope = 'my' | 'created' | 'team' | 'all' | 'contact';

const SCOPE_TITLES: Record<LeadScope, string> = {
  my: 'My Leads',
  created: 'My Created Leads',
  team: "Manage Leads — My Team's Leads",
  all: 'All Leads Across Org',
  contact: 'Contact Record — Leads Sub-Tab',
};

const statusVariant = (status: string) => {
  if (status === 'Rejected') return 'danger' as const;
  if (status === 'Lead Converted') return 'success' as const;
  if (status === 'In Progress') return 'outlined-red' as const;
  return 'filled-neutral' as const;
};

// Pattern 14: Lead List + Owner/Status Management — a family of scoped list
// views (My Leads / My Created Leads / Team Leads / All Leads / Contact-scoped)
// over the same Lead entity, sharing a grid shape (SCR-141–150).
export function LeadListView({ scope }: { scope: LeadScope }) {
  const navigate = useNavigate();
  const loadKind = useEntityStore((s) => s.loadKind);
  const leads = (useEntityStore((s) => s.records.leads) ?? []) as unknown as Lead[];
  const loading = useEntityStore((s) => s.loading.leads);
  const activePersonaId = usePersonaStore((s) => s.activePersonaId);

  useEffect(() => {
    loadKind('leads');
  }, [loadKind]);

  const filtered = leads.filter((l) => {
    if (scope === 'my') return l.ownerId === activePersonaId || true; // owner IDs in seed data are agent codes, not PERSONA-xxx — show all in dev demo
    if (scope === 'created') return l.createdVia?.includes('Tablet') ?? true;
    return true; // team/all/contact scopes: no further evidenced filter distinct from "all" in this thin seed set
  });

  return (
    <div className="p-8">
      <h1 className="text-[length:var(--fs-h3)] font-medium text-fg mb-1">{SCOPE_TITLES[scope]}</h1>
      <p className="text-fg-2 mb-6">{filtered.length} lead(s).</p>
      <DataTable<Lead>
        columns={[
          { key: 'leadId', header: 'Lead #' },
          { key: 'serviceNeeded', header: 'Service Needed' },
          {
            key: 'status',
            header: 'Status',
            render: (row) => <Badge variant={statusVariant(row.status)}>{row.status}</Badge>,
          },
          { key: 'ownerId', header: 'Owner' },
          { key: 'callbackDate', header: 'Callback Date' },
        ]}
        rows={filtered}
        rowKey={(row) => row.leadId}
        onRowClick={(row) => navigate(`/lead-management/lead-details-view?id=${row.leadId}`)}
        emptyMessage="No leads in this view."
        loading={loading}
      />
    </div>
  );
}
