import { usePersonaStore } from '../stores/personaStore';
import { getAllPersonas, getRbacForPersona } from '../engines/configEngine';
import { Select } from '../components/primitives/Select';

// Dev/demo "login-as" control per frontend-architecture.md §8 — not a real auth boundary.
export function PersonaSwitcher() {
  const { activePersonaId, setActivePersona } = usePersonaStore();
  const personas = getAllPersonas();
  const rbacCount = getRbacForPersona(activePersonaId).length;

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border-soft bg-bg">
      <span className="text-[length:var(--fs-caption-upper)] uppercase tracking-wide text-muted">Logged in as</span>
      <div className="w-80">
        <Select
          value={activePersonaId}
          onChange={(e) => setActivePersona(e.target.value)}
          options={personas.map((p) => ({ value: p.id, label: p.name }))}
        />
      </div>
      <span className="text-[length:var(--fs-caption)] text-muted">
        {rbacCount > 0 ? `${rbacCount} evidenced RBAC entries` : 'No RBAC entries evidenced for this persona'}
      </span>
    </div>
  );
}
