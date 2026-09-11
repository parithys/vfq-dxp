// Staff ID -> role mapping for automatic role detection at login (per user
// spec, not evidenced in the source corpus). Maps each fixed demo Staff ID to
// the closest-matching existing persona in config/personas.json so RBAC,
// greeting, and profile resolution downstream are unaffected — only how the
// role is *selected* changes (auto from Staff ID instead of a manual picker).
export interface StaffIdRoleEntry {
  personaId: string;
  roleLabel: string;
}

export const STAFF_ID_ROLE_MAP: Record<string, StaffIdRoleEntry> = {
  VFQ12341: { personaId: 'PERSONA-001', roleLabel: 'Retail Agent' },
  VFQ12342: { personaId: 'PERSONA-005', roleLabel: 'Back Office / Fulfilment' },
  VFQ12343: { personaId: 'PERSONA-019', roleLabel: 'Manager / Approver' },
  VFQ12344: { personaId: 'PERSONA-002', roleLabel: 'Enterprise Account Manager' },
  VFQ12345: { personaId: 'PERSONA-025', roleLabel: 'Field Technician' },
  VFQ12346: { personaId: 'PERSONA-008', roleLabel: 'IT Operations' },
};

export const DEFAULT_PERSONA_ID = 'PERSONA-001';

/** Normalizes "VFQ-12341", "vfq 12341", "VFQ12341" to the same lookup key. */
export function resolveRoleFromStaffId(staffId: string): StaffIdRoleEntry | undefined {
  const normalized = staffId.replace(/[\s-]/g, '').toUpperCase();
  return STAFF_ID_ROLE_MAP[normalized];
}
