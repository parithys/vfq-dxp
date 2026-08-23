import { getValidationRulesForField } from './configEngine';

// Validation Engine per frontend-architecture.md §5 — a React Hook Form resolver
// helper that looks up field-level validation by field label rather than
// hardcoding per-field logic. Backed by config/validation-rules.json's
// Field-Level entries (281 of 418), sourced from field-inventory.md.

export function requiredMessageFor(fieldLabel: string): string {
  const rules = getValidationRulesForField(fieldLabel);
  const withMessage = rules.find((r) => String(r.description).toLowerCase().includes('error message'));
  if (withMessage) {
    const match = String(withMessage.description).match(/Error message:\s*"([^"]+)"/i);
    if (match) return match[1];
  }
  return `${fieldLabel} is required.`;
}

export function validationDescriptionFor(fieldLabel: string): string | null {
  const rules = getValidationRulesForField(fieldLabel);
  return rules.length ? String(rules[0].description) : null;
}

export function isRequired(fieldLabel: string): boolean {
  return getValidationRulesForField(fieldLabel).length > 0;
}
