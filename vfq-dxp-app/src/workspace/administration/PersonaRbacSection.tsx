import { useState } from 'react';
import { getAllPersonas, getRbacForPersona } from '../../engines/configEngine';
import { Badge } from '../../components/primitives/Badge';

const PERMISSION_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'filled-neutral'> = {
  Create: 'success',
  Edit: 'warning',
  View: 'filled-neutral',
  Conditional: 'danger',
};

export function PersonaRbacSection() {
  const personas = getAllPersonas();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(personas[0]?.id);

  const filtered = personas.filter(
    (p) => p.name.toLowerCase().includes(query.toLowerCase()) || p.type.toLowerCase().includes(query.toLowerCase())
  );
  const selected = personas.find((p) => p.id === selectedId);
  const rbac = selected ? getRbacForPersona(selected.id) : [];

  return (
    <div>
      <div className="flex gap-6 items-start">
        <div className="w-80 shrink-0">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search personas…"
            className="w-full rounded-[var(--radius-button)] border border-border-soft bg-bg px-3 py-2 text-fg text-[length:var(--fs-body)] placeholder:text-muted focus:outline-none focus-visible:shadow-[var(--focus-ring)] mb-3"
          />
          <div className="rounded-[var(--radius-card)] border border-border-soft bg-bg max-h-[60vh] overflow-y-auto divide-y divide-border-soft">
            {filtered.map((persona) => (
              <button
                key={persona.id}
                onClick={() => setSelectedId(persona.id)}
                className={`w-full text-left px-4 py-3 hover:bg-surface ${selectedId === persona.id ? 'bg-surface-warm' : ''}`}
              >
                <div className="font-medium text-fg text-[length:var(--fs-body)] truncate">{persona.name}</div>
                <div className="text-fg-2 text-[length:var(--fs-caption)] truncate">{persona.type}</div>
              </button>
            ))}
            {filtered.length === 0 && <p className="px-4 py-6 text-center text-muted">No personas match “{query}”.</p>}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {selected && (
            <>
              <div className="rounded-[var(--radius-card)] border border-border-soft bg-bg p-5 mb-4">
                <h2 className="text-[length:var(--fs-h5)] font-medium text-fg mb-1">{selected.name}</h2>
                <p className="text-fg-2 text-[length:var(--fs-caption)] mb-3">{selected.type}</p>
                <p className="text-fg-2 text-[length:var(--fs-body)] mb-2">{selected.responsibilities}</p>
                {selected.permissions && (
                  <p className="text-fg-2 text-[length:var(--fs-caption)]">
                    <span className="font-medium text-fg">Permissions: </span>
                    {selected.permissions}
                  </p>
                )}
              </div>

              <h3 className="text-[length:var(--fs-body-lg)] font-medium text-fg mb-2">Screen access ({rbac.length})</h3>
              <div className="rounded-[var(--radius-card)] border border-border-soft bg-bg divide-y divide-border-soft">
                {rbac.length === 0 && <p className="px-4 py-6 text-center text-muted">No RBAC entries evidenced for this persona.</p>}
                {rbac.map((entry) => (
                  <div key={entry.id} className="px-4 py-3 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-fg text-[length:var(--fs-body)] truncate">{entry.screenName}</div>
                      <div className="text-fg-2 text-[length:var(--fs-caption)] truncate">{entry.actionsAllowed || '—'}</div>
                    </div>
                    <Badge variant={PERMISSION_VARIANT[entry.permissionLevel] ?? 'filled-neutral'}>{entry.permissionLevel}</Badge>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-8 rounded-[var(--radius-card)] border border-dashed border-border-soft p-5">
        <Badge variant="filled-neutral">Not yet built</Badge>
        <p className="text-fg-2 text-[length:var(--fs-body)] mt-2">
          User management, system configuration, and audit logging aren't implemented in this build. This directory is read-only
          against the existing persona/RBAC configuration.
        </p>
      </div>
    </div>
  );
}
