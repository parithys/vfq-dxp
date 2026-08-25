import type {
  Route,
  Persona,
  RbacEntry,
  BusinessRule,
  ValidationRule,
  DomainEntity,
  ModuleHierarchyEntry,
} from '../types/config';

interface ConfigData {
  routes: Route[];
  personas: Persona[];
  rbac: RbacEntry[];
  businessRules: BusinessRule[];
  validationRules: ValidationRule[];
  domainSchema: DomainEntity[];
  moduleHierarchy: ModuleHierarchyEntry[];
  designTokens: Record<string, string>;
  /** REQ-id -> evidenced screen ids, mechanically extracted from
   * traceability-matrix.md's "Screens:" lines. Only 70 of 295 requirements
   * cite a screen — see screenGrouping.ts for how this partial evidence is
   * used (and where it falls back to a heuristic). */
  reqToScreens: Record<string, string[]>;
  journeyCatalogueMap: JourneyCatalogueMap;
}

/** Crosswalk between CRM_Journeys_Final_Updated_with_Type.xlsx (Page Type
 * sheet, Unique ID column) and this app's screens/modules — see that
 * workbook's Mapping Report sheet for the full mapped/unmapped list and
 * rationale. Only screens/modules with a confident, manually-verified name
 * match are present; anything absent here simply has no journey ID to show. */
interface JourneyCatalogueMap {
  journeys: Record<string, { name: string; type: string }>;
  screens: Record<string, string[]>;
  modules: Record<string, string[]>;
}

const EMPTY_JOURNEY_CATALOGUE_MAP: JourneyCatalogueMap = { journeys: {}, screens: {}, modules: {} };

let cache: ConfigData | null = null;
let loading: Promise<ConfigData> | null = null;

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

// Boot-time loader per frontend-architecture.md §10 — no screen/component
// should fetch config/*.json directly; always go through the accessors below.
export async function loadConfig(): Promise<ConfigData> {
  if (cache) return cache;
  if (loading) return loading;
  loading = (async () => {
    const [routes, personas, rbac, businessRules, validationRules, domainSchema, moduleHierarchy, designTokens, reqToScreens] =
      await Promise.all([
        fetchJson<Route[]>('/config/routes.json'),
        fetchJson<Persona[]>('/config/personas.json'),
        fetchJson<RbacEntry[]>('/config/rbac.json'),
        fetchJson<BusinessRule[]>('/config/business-rules.json'),
        fetchJson<ValidationRule[]>('/config/validation-rules.json'),
        fetchJson<DomainEntity[]>('/config/domain-schema.json'),
        fetchJson<ModuleHierarchyEntry[]>('/config/module-hierarchy.json'),
        fetchJson<Record<string, string>>('/config/design-tokens.json'),
        fetchJson<Record<string, string[]>>('/config/req-to-screens.json'),
      ]);
    // Fetched separately, with a silent fallback to "no mappings" — this file
    // is purely additive (traceability-ID badges), so a missing/broken copy
    // must never fail app boot the way a missing core config file should.
    const journeyCatalogueMap = await fetchJson<JourneyCatalogueMap>('/config/journey-catalogue-map.json').catch(
      () => EMPTY_JOURNEY_CATALOGUE_MAP
    );
    cache = { routes, personas, rbac, businessRules, validationRules, domainSchema, moduleHierarchy, designTokens, reqToScreens, journeyCatalogueMap };
    return cache;
  })();
  return loading;
}

function requireConfig(): ConfigData {
  if (!cache) {
    throw new Error('Config not loaded yet — call loadConfig() during app boot before using accessors.');
  }
  return cache;
}

export function getAllRoutes(): Route[] {
  return requireConfig().routes;
}

export function getAllModules(): ModuleHierarchyEntry[] {
  return requireConfig().moduleHierarchy;
}

export function getAllPersonas(): Persona[] {
  return requireConfig().personas;
}

export function getRoutesForModule(moduleId: string): Route[] {
  const mod = requireConfig().moduleHierarchy.find((m) => m.moduleId === moduleId);
  if (!mod) return [];
  return requireConfig().routes.filter((r) => r.module === mod.module);
}

export function getPersona(personaId: string): Persona | undefined {
  return requireConfig().personas.find((p) => p.id === personaId);
}

export function getRbacFor(personaId: string, screenId: string): RbacEntry | undefined {
  return requireConfig().rbac.find((r) => r.personaId === personaId && r.screenId === screenId);
}

export function getRbacForPersona(personaId: string): RbacEntry[] {
  return requireConfig().rbac.filter((r) => r.personaId === personaId);
}

export function getBusinessRule(ruleId: string): BusinessRule | undefined {
  return requireConfig().businessRules.find((r) => r.id === ruleId);
}

export function getValidationRulesForField(fieldLabel: string): ValidationRule[] {
  const needle = fieldLabel.toLowerCase();
  return requireConfig().validationRules.filter(
    (v) => v.validationType === 'Field-Level' && String(v.name).toLowerCase().includes(needle)
  );
}

export function getDomainEntity(entityId: string): DomainEntity | undefined {
  return requireConfig().domainSchema.find((e) => e.id === entityId);
}

export function getDesignToken(name: string): string | undefined {
  return requireConfig().designTokens[name];
}

export function getReqToScreens(): Record<string, string[]> {
  return requireConfig().reqToScreens;
}

/** Unique IDs from the CRM Journeys catalogue mapped onto this screen, if
 * any — empty when the screen has no confident match (see journey-catalogue-
 * map.json's _comment and the workbook's Mapping Report sheet). */
export function getJourneyIdsForScreen(screenId: string): string[] {
  return requireConfig().journeyCatalogueMap.screens[screenId] ?? [];
}

/** Same as getJourneyIdsForScreen, but for a module card. */
export function getJourneyIdsForModule(moduleId: string): string[] {
  return requireConfig().journeyCatalogueMap.modules[moduleId] ?? [];
}

export function getJourneyMeta(journeyId: string): { name: string; type: string } | undefined {
  return requireConfig().journeyCatalogueMap.journeys[journeyId];
}

export function isConfigLoaded(): boolean {
  return cache !== null;
}
