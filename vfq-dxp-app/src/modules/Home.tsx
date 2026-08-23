import { Link } from 'react-router-dom';
import { getAllModules, getPersona } from '../engines/configEngine';
import { usePersonaStore } from '../stores/personaStore';

// Pattern 15: App/Module Launcher Home Screen (Tile Grid) — "Welcome back <Name>!"
// tile-grid landing page, each tile a CRM module launcher. Evidenced across
// SCR-040/053/056/077/107/119/168/176/187 per reusable-patterns.md.
export function Home() {
  const activePersonaId = usePersonaStore((s) => s.activePersonaId);
  const persona = getPersona(activePersonaId);
  const modules = getAllModules();

  return (
    <div className="p-8">
      <h1 className="text-[length:var(--fs-h2)] font-medium text-fg mb-1">Welcome back{persona ? `, ${persona.name.split('(')[0].trim()}` : ''}!</h1>
      <p className="text-fg-2 mb-8">Choose a module to get started.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {modules.map((m) => (
          <Link
            key={m.moduleId}
            to={`/${m.moduleSlug}`}
            className="rounded-[var(--radius-card)] border border-border-soft bg-bg p-5 hover:shadow-raised hover:border-accent transition-all"
          >
            <div className="text-[length:var(--fs-h5)] font-medium text-fg mb-1">{m.module}</div>
            <div className="text-[length:var(--fs-caption)] text-muted">{m.screenCount} screens</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
