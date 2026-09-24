// THE nav manifest: one closed set of primary destinations, from which each
// role gets a filtered and reordered subset (see engines/navigationEngine.ts).
//
// This supersedes the previous "six fixed primary workspaces that can never
// grow past six" rule. That cap was a Customer-First-only assumption — a
// Hybrid role such as a Regional Manager or Supervisor legitimately spans both
// the customer and product halves of the platform, which is nine items. The
// load-bearing half of the old rule is kept and strengthened:
//
//   INV-1  The manifest is a CLOSED SET. Adding a journey or screen must never
//          add a nav item — new journeys become actions inside a workspace or
//          a Customer 360 product tab. NAV_MANIFEST_SIZE below is asserted in
//          dev, so growing the rail is a deliberate edit, not an accident.
//   INV-2  At most NAV_MAX_TOP_LEVEL top-level items per role. Extra depth is
//          expressed as `children`, never as new top-level keys.
//
// Why a TS module rather than config JSON: `icon` is SVG path geometry (code,
// not data), `to` must match a literal <Route path> in router.tsx, and
// router.tsx needs the manifest at module-eval time — before loadConfig()
// resolves, which configEngine's accessors require. Precedent for IA-as-const
// already exists here (QUICK_ACTIONS, MODULE_DESCRIPTIONS).

export type NavKey =
  | 'dashboard'
  | 'mobile'
  | 'mobile.new-connections'
  | 'mobile.existing-service'
  | 'mobile.number-services'
  | 'mobile.sim-device'
  | 'mobile.support'
  | 'fibre-home'
  | 'fibre-home.new-connections'
  | 'fibre-home.existing-service'
  | 'fibre-home.relocation'
  | 'fibre-home.equipment'
  | 'fibre-home.support'
  | 'customer-search'
  | 'sales'
  | 'operations'
  | 'leads'
  | 'support'
  | 'orders'
  | 'administration';

export interface NavPlannedCopy {
  summary: string;
  capabilities: string[];
  /** Built module slugs worth launching meanwhile, so the placeholder
   * signposts rather than dead-ends. */
  relatedModuleSlugs?: string[];
  relatedWorkspaces?: { label: string; to: string }[];
}

export interface NavItem {
  key: NavKey;
  label: string;
  to: string;
  end?: boolean;
  /** SVG path data for <Icon path=…>. */
  icon: string;
  children?: NavItem[];
  /** Workspace-level analogue of screenRegistry's getScreenComponent(): when
   * false the route exists and is navigable, but renders <WorkspaceNotYetBuilt>.
   *
   * Declarative only — the Sidebar deliberately does NOT style unbuilt items
   * differently (no dimming or disabled state); a planned destination looks and
   * behaves like any other, and its page carries the explanation. This field
   * records which destinations are placeholder-backed and pairs with `planned`
   * below. */
  implemented: boolean;
  /** Required when implemented === false. */
  planned?: NavPlannedCopy;
  /** When set, the item additionally requires this feature grant. Used for
   * destinations that are a genuine access boundary rather than plain IA —
   * today only Administration. Everything else is IA: the label tells you the
   * platform has the area, the screens inside it are access-gated. */
  requiresFeature?: string;
}

const ICONS = {
  dashboard: 'M4 4h7v7H4z M13 4h7v4h-7z M13 11h7v9h-7z M4 14h7v6H4z',
  mobile: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M11 18h2',
  fibreHome: 'M5 12.5a9 9 0 0 1 14 0 M8 16a5 5 0 0 1 8 0 M12 19.5h.01',
  newConnection: 'M12 5v14 M5 12h14',
  existingService: 'M21 12a9 9 0 0 1-9 9 9 9 0 0 1-8.5-6 M3 12a9 9 0 0 1 9-9 9 9 0 0 1 8.5 6 M21 3v6h-6 M3 21v-6h6',
  numberServices: 'M9 3L7 21 M17 3l-2 18 M3.5 8.5h17 M3 15.5h17',
  simDevice: 'M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M9 9h6v6H9z',
  relocation: 'M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  equipment: 'M14.7 6.3a4 4 0 0 1 5 5L21 12l-9 9-3-3 9-9z M7 17l-3 3',
  lifebuoy: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M5.6 5.6l3.2 3.2 M15.2 15.2l3.2 3.2 M18.4 5.6l-3.2 3.2 M8.8 15.2l-3.2 3.2',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.3-4.3',
  sales: 'M4 16l6-6 4 4 6-8 M14 6h6v6',
  operations: 'M3 12h3l2.5 6 3-13 3 9 2-3h4',
  leads: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1 M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19 8v6 M22 11h-6',
  support:
    'M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z M12 9v3 M12 15h.01',
  orders:
    'M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1z M6 6h12v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z M9 13l2 2 4-4',
  administration: 'M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6z M9.5 12l2 2 3-3',
};

export const NAV_MANIFEST: readonly NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', to: '/', end: true, icon: ICONS.dashboard, implemented: true },
  // Mobile and Fibre & Home are the two primary product lines. They replaced a
  // single "Products" parent whose children were just the two line names — that
  // extra level added a click without adding information. Each line now owns its
  // journey categories directly, and each category is a real destination
  // (ProductLinePage) rather than a placeholder.
  {
    key: 'mobile',
    label: 'Mobile',
    to: '/mobile',
    icon: ICONS.mobile,
    implemented: true,
    children: [
      { key: 'mobile.new-connections', label: 'New Connections', to: '/mobile/new-connections', icon: ICONS.newConnection, implemented: true },
      { key: 'mobile.existing-service', label: 'Existing Service', to: '/mobile/existing-service', icon: ICONS.existingService, implemented: true },
      { key: 'mobile.number-services', label: 'Number Services', to: '/mobile/number-services', icon: ICONS.numberServices, implemented: true },
      { key: 'mobile.sim-device', label: 'SIM & Device', to: '/mobile/sim-device', icon: ICONS.simDevice, implemented: true },
      { key: 'mobile.support', label: 'Support', to: '/mobile/support', icon: ICONS.lifebuoy, implemented: true },
    ],
  },
  {
    key: 'fibre-home',
    label: 'Fibre & Home',
    to: '/fibre-home',
    icon: ICONS.fibreHome,
    implemented: true,
    children: [
      { key: 'fibre-home.new-connections', label: 'New Connections', to: '/fibre-home/new-connections', icon: ICONS.newConnection, implemented: true },
      { key: 'fibre-home.existing-service', label: 'Existing Service', to: '/fibre-home/existing-service', icon: ICONS.existingService, implemented: true },
      { key: 'fibre-home.relocation', label: 'Relocation', to: '/fibre-home/relocation', icon: ICONS.relocation, implemented: true },
      { key: 'fibre-home.equipment', label: 'Equipment', to: '/fibre-home/equipment', icon: ICONS.equipment, implemented: true },
      { key: 'fibre-home.support', label: 'Support', to: '/fibre-home/support', icon: ICONS.lifebuoy, implemented: true },
    ],
  },
  { key: 'customer-search', label: 'Customer Search', to: '/customer-search', icon: ICONS.search, implemented: true },
  { key: 'sales', label: 'Sales', to: '/sales', icon: ICONS.sales, implemented: true },
  {
    key: 'operations',
    label: 'Operations',
    to: '/operations',
    icon: ICONS.operations,
    implemented: false,
    planned: {
      summary:
        'An operations console consolidating the work queues that today live inside individual '
        + 'modules: fulfilment, field activities, appointments and bulk jobs.',
      capabilities: [
        'Unified work queue across fulfilment and field operations',
        'WFM activity and appointment scheduling',
        'Bulk job monitoring',
        'SLA and ageing views per queue',
      ],
      relatedModuleSlugs: ['order-management', 'sim-number-management', 'pre-to-post-migration'],
      relatedWorkspaces: [
        { label: 'Orders', to: '/orders' },
        { label: 'Support', to: '/support' },
      ],
    },
  },
  { key: 'leads', label: 'Leads', to: '/leads', icon: ICONS.leads, implemented: true },
  { key: 'support', label: 'Support', to: '/support', icon: ICONS.support, implemented: true },
  { key: 'orders', label: 'Orders', to: '/orders', icon: ICONS.orders, implemented: true },
  {
    key: 'administration',
    label: 'Administration',
    to: '/administration',
    icon: ICONS.administration,
    implemented: true,
    // The one nav item that is an access boundary rather than IA: it exposes
    // the role/access directory and backoffice notification config.
    requiresFeature: 'workspace.admin-role-access-viewer',
  },
];

function flatten(items: readonly NavItem[]): NavItem[] {
  return items.flatMap((i) => [i, ...(i.children ? flatten(i.children) : [])]);
}

export const NAV_BY_KEY: ReadonlyMap<NavKey, NavItem> = new Map(
  flatten(NAV_MANIFEST).map((i) => [i.key, i])
);

/** Closed-set guard (INV-1). Growing the rail must be a deliberate edit here.
 * 20 = 10 top-level destinations (including the 2 product lines) + the 10
 * product-line journey categories. */
export const NAV_MANIFEST_SIZE = 20;
/** Top-level cap per role (INV-2). 10 is the maximum reachable by
 * construction: the widest approach ordering is Hybrid at 9, plus
 * Administration for the three roles that hold its feature grant. */
export const NAV_MAX_TOP_LEVEL = 10;

if (import.meta.env.DEV && NAV_BY_KEY.size !== NAV_MANIFEST_SIZE) {
  throw new Error(
    `navManifest: expected ${NAV_MANIFEST_SIZE} entries, found ${NAV_BY_KEY.size}. `
    + 'The manifest is a closed set (INV-1) — if you genuinely need another primary destination, '
    + 'update NAV_MANIFEST_SIZE deliberately. Otherwise the new journey belongs inside an '
    + 'existing workspace.'
  );
}

export function navItemByPath(pathname: string): NavItem | undefined {
  return flatten(NAV_MANIFEST).find((i) => i.to === pathname);
}
