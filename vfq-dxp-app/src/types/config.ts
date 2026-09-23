export interface Route {
  routeId: string;
  path: string;
  screenId: string;
  screenName: string;
  screenType: string;
  module: string;
  personaAccess: string;
}

/** Drives navigation, landing experience, search scope and IA per persona
 * (VFQ operational role table, 2026-09-23). 'None' is the read-only
 * View Only role, which gets no approach-specific treatment. */
export type PersonaApproach = 'Customer-First' | 'Product-First' | 'Hybrid' | 'None';

/** Which session reference number the persona's channel produces. Carried
 * forward from the Staff-ID/Channel/Context-card table that previously
 * existed only as a comment in staffIdRoleMap.ts with no consumer — it now
 * drives the header context chip. */
export type PersonaContextCard =
  | 'Queue Number + Ticket Number'
  | 'CTI Reference only'
  | 'Hidden';

/** Ordered weakest → strongest; personaEngine.canPerformAction compares by index. */
export type PermissionLevel = 'View' | 'Create' | 'Edit' | 'Approve' | 'Full';

/** In-surface action gates. Distinct from a feature key by design:
 * a feature key exists for every *navigable surface*, a capability for every
 * *action gate inside* one. A capability never duplicates a feature key. */
export type PersonaCapability =
  | 'agent-self-service'
  | 'edit-customer-records'
  | 'invoice-actions'
  | 'view-bell-notifications'
  | 'backoffice-config'
  | 'ticket-resolve'
  | 'ticket-reassign-queue'
  | 'ticket-audit-trail'
  | 'task-assign'
  | 'agent-oversight';

export interface PersonaFeatureGrant {
  key: string;
  level: PermissionLevel;
  /** Display-only note surfaced in the role/access viewer. Replaces
   * rbac.json's actionsRestricted; it documents intent and is not enforced. */
  restrictions?: string;
}

/** The 26 VFQ operational roles. Replaced the previous 66 evidence-cited
 * personas on 2026-09-24 — those are archived, with their RBAC evidence, at
 * reference/blueprint/legacy/. Consequence worth knowing: grants here are
 * EXHAUSTIVE and AUTHORITATIVE, so absence of a grant means *deliberately
 * not granted*. That inverts the previous stance ("not evidenced, never
 * allow"), which existed only because the 66-persona RBAC matrix was sparse
 * source-derived evidence rather than a decided access model. */
export interface Persona {
  id: string;
  staffId: string;
  name: string;
  group: string;
  /** Verbatim from the role table, e.g. "CBU + EBU", "CBU / EBU / Shared". */
  businessUnitLabel: string;
  businessUnits: ('CBU' | 'EBU' | 'Shared' | 'Corporate')[];
  approach: PersonaApproach;
  description: string;
  channel: string;
  contextCard: PersonaContextCard;
  /** users-agents.json userId — a deterministic 1:1 identity binding. */
  identityUserId: string;
  capabilities: PersonaCapability[];
  features: PersonaFeatureGrant[];
  /** 66-persona ids this role absorbs. Feeds the archived-evidence panel in
   * the role/access viewer only — never an access decision. */
  legacyPersonaIds: string[];
  provenance: string;
}

export interface FeatureCatalogueEntry {
  key: string;
  name: string;
  area: string;
  surface: 'module' | 'workspace';
  /** routes.json screen ids. Deliberately MAY include ids that are catalogued
   * but not registered via registerScreen() — those render as visible
   * "Not built" placeholder rows, which is how a granted-but-unimplemented
   * feature stays visible instead of disappearing. Empty for workspace
   * surfaces routed directly in router.tsx with no SCR- id. */
  screenIds: string[];
}

/** Archived 66-persona RBAC evidence (rbac-legacy-66.json). Retained for
 * traceability back to rbac-matrix.md's per-row source quotes and shown in
 * the role/access viewer's collapsed evidence panel. Grants no access. */
export interface RbacEntry {
  id: string;
  personaId: string;
  personaName: string;
  screenId: string;
  screenName: string;
  permissionLevel: string;
  actionsAllowed: string;
  actionsRestricted: string;
  confidence: string;
}

export interface BusinessRule {
  id: string;
  [key: string]: unknown;
}

/** Agent 360 AAV-01: "maintain a configured approval matrix for each task
 * category." Neither the requirement nor its linked data field (DF-AGT-011,
 * which actually describes an unrelated Bell Notification field — one of
 * the BRSD's own known ID mismatches) specifies real category/role content,
 * so approval-matrix.json's mapping is a representative placeholder
 * pending VFQ's confirmed matrix, not sourced business truth. */
export interface ApprovalMatrixEntry {
  category: string;
  requiredRole: string;
}

export interface ValidationRule {
  id: string;
  [key: string]: unknown;
}

export interface DomainEntity {
  id: string;
  name: string;
  description: string;
  attributes: string;
  relationships: string;
  lifecycleStates?: string;
  validationRules?: string;
}

export interface ModuleFeature {
  feature: string;
  capabilities: string[];
  relatedEntityIds: string[];
  relatedJourneyIds: string[];
  relatedRequirementIds: string[];
}

export interface SubModule {
  subModule: string;
  features: ModuleFeature[];
}

export interface ModuleHierarchyEntry {
  moduleId: string;
  module: string;
  moduleSlug: string;
  screenCount: number;
  subModules: SubModule[];
}
