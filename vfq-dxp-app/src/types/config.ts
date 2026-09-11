export interface Route {
  routeId: string;
  path: string;
  screenId: string;
  screenName: string;
  screenType: string;
  module: string;
  personaAccess: string;
}

export interface Persona {
  id: string;
  name: string;
  type: string;
  responsibilities: string;
  permissions: string;
  restrictedFeatures: string;
  confidence: string;
}

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
