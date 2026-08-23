import { getAllRoutes, getRbacForPersona } from './configEngine';
import type { Route } from '../types/config';

// Persona simulation per frontend-architecture.md §8 — a dev/demo "login-as"
// affordance, NOT a security boundary. Absence of an RBAC entry means "not
// evidenced", which we treat conservatively as hidden, never as "allow".
//
// RBAC coverage is genuinely sparse in the evidence (145 entries across 213
// screens/66 personas — see rbac-matrix.md). Gating the top-level 16-module
// sidebar itself by RBAC would render it near-empty for most personas, which
// reads as broken rather than evidence-accurate. So the sidebar always lists
// all 16 modules (module names are IA, not access grants); RBAC instead gates
// per-screen visibility inside a module and per-action guards, which is where
// the evidence actually says something concrete — see screensVisibleFor().

export function screensVisibleFor(personaId: string, allScreensInModule: Route[]): {
  route: Route;
  permissionLevel: string | null;
}[] {
  return allScreensInModule.map((route) => ({
    route,
    permissionLevel: permissionLevelFor(personaId, route.screenId),
  }));
}

export function visibleRoutesFor(personaId: string): Route[] {
  const rbac = getRbacForPersona(personaId);
  const visibleScreenIds = new Set(rbac.map((r) => r.screenId));
  return getAllRoutes().filter((r) => visibleScreenIds.has(r.screenId));
}

export function canAccessScreen(personaId: string, screenId: string): boolean {
  return getRbacForPersona(personaId).some((r) => r.screenId === screenId);
}

export function permissionLevelFor(personaId: string, screenId: string): string | null {
  const entry = getRbacForPersona(personaId).find((r) => r.screenId === screenId);
  return entry?.permissionLevel ?? null;
}

const ACTION_LEVELS = ['View', 'Create', 'Edit', 'Approve', 'Full'];

export function canPerformAction(personaId: string, screenId: string, minLevel: string): boolean {
  const level = permissionLevelFor(personaId, screenId);
  if (!level) return false;
  return ACTION_LEVELS.indexOf(level) >= ACTION_LEVELS.indexOf(minLevel);
}
