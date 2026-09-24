import type { Persona, PersonaApproach } from '../../types/config';

// The dashboard is ONE route rendering one or two zones. Approach decides which
// zones and in what order; a Hybrid role additionally gets a Focus control that
// re-orders and re-sizes the same two zones.
//
// Crucially it does NOT navigate or refetch: both zones mount and load their
// data unconditionally, so switching Focus is pure layout. That is what makes
// "the same dashboard route, re-ordered" true rather than merely claimed.

export type ZoneId = 'customer-ops' | 'product-work';
export type ZoneSize = 'full' | 'half' | 'collapsed';
export type FocusMode = 'customer-ops' | 'both' | 'product';

export interface ZonePlacement {
  id: ZoneId;
  size: ZoneSize;
}

export interface DashboardLayout {
  zones: ZonePlacement[];
  /** Only Hybrid gets the control — the other approaches have one zone, so
   * there is nothing to focus between. */
  showFocusControl: boolean;
  /** View Only: suppress every quick action and make tiles non-navigating. */
  readOnly: boolean;
  heading: string;
  subtitle: string;
}

/** Which flavour of work the product zone shows. Product-First covers five very
 * different roles — "product-first" for a Field Engineer means work-item-first,
 * not catalogue management — so the zone keeps one structure and swaps content
 * by persona group. */
export type ProductZoneVariant = 'catalogue' | 'fulfilment' | 'field';

export function productZoneVariantFor(persona: Persona | undefined): ProductZoneVariant {
  if (!persona) return 'catalogue';
  if (persona.group === 'Field Operations & Workforce Management') return 'field';
  if (persona.group === 'Order Fulfilment & Back Office') return 'fulfilment';
  // Platform Administration owns the catalogue; Management/oversight roles see
  // it too, since their Hybrid zone is about product and channel performance.
  return 'catalogue';
}

export function focusFromParam(raw: string | null): FocusMode {
  return raw === 'customer-ops' || raw === 'product' ? raw : 'both';
}

export function layoutFor(
  approach: PersonaApproach,
  focus: FocusMode,
  firstName: string
): DashboardLayout {
  switch (approach) {
    case 'Product-First':
      return {
        zones: [{ id: 'product-work', size: 'full' }],
        showFocusControl: false,
        readOnly: false,
        heading: `Welcome back, ${firstName}!`,
        subtitle: "Here's how your queues and portfolio are performing today.",
      };

    case 'Hybrid':
      return {
        zones:
          focus === 'customer-ops'
            ? [{ id: 'customer-ops', size: 'full' }, { id: 'product-work', size: 'collapsed' }]
            : focus === 'product'
              // Reversed, so the focused zone leads rather than merely growing.
              ? [{ id: 'product-work', size: 'full' }, { id: 'customer-ops', size: 'collapsed' }]
              : [{ id: 'customer-ops', size: 'half' }, { id: 'product-work', size: 'half' }],
        showFocusControl: true,
        readOnly: false,
        heading: `Welcome back, ${firstName}!`,
        subtitle: 'Customer operations and product performance, in one view.',
      };

    case 'None':
      return {
        zones: [{ id: 'customer-ops', size: 'full' }],
        showFocusControl: false,
        readOnly: true,
        heading: `Welcome back, ${firstName}!`,
        subtitle: 'Read-only view. You can review records and approve or reject orders.',
      };

    case 'Customer-First':
    default:
      return {
        zones: [{ id: 'customer-ops', size: 'full' }],
        showFocusControl: false,
        readOnly: false,
        heading: `Welcome back, ${firstName}!`,
        subtitle: "Here's what's happening across the platform right now.",
      };
  }
}
