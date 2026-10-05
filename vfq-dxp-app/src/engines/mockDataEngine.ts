// Simulates a backend entirely in the browser (frontend-architecture.md §7).
// Each mock-data/*.json file is keyed by its own filename (e.g. "leads" -> leads.json).

const SEED_FILES = [
  'accounts', 'account-level-products', 'addons-discounts', 'addresses', 'adjustments',
  'apn-records', 'appointments', 'audit-trail', 'authorised-contacts', 'bell-notifications',
  'billing-buckets', 'billing-profiles', 'bills', 'bulk-activation-orders', 'bulk-notes',
  'bulk-sms-orders', 'caf-forms', 'call-detail-records', 'campaigns',
  'catalog-change-requests', 'catalog-items', 'channel-performance',
  'commitment-penalties', 'consumer-deposits', 'contacts-b2b2c', 'cpe-devices', 'credit-limits',
  'cross-sales-offers', 'customer-activities', 'customer-communications', 'customer-contacts',
  'customers', 'deposit-bundles', 'digital-engagement', 'customer-overview-extras', 'customer-overview-demo', 'telesales-demo-catalog', 'device-installments',
  'donor-details', 'enterprise-accounts', 'enterprise-form-types', 'enterprise-invoices',
  'fnp-portin-orders', 'future-dated-orders', 'gigahome-acceptance-forms', 'gigahome-osntv-subscriptions',
  'home-move-cases', 'identity-documents', 'ims-site-zsb', 'in-platform-balances', 'installation-checklists',
  'installed-assets',
  'inventory-transfers', 'iot-sim-devices', 'iptv-stb-bundles', 'kid-address-records', 'kid-service-points',
  'leads', 'line-items', 'nas-records', 'mnp-application-forms', 'mnp-portin-orders', 'multi-sim-lines', 'numbers',
  'order-approvals', 'orders', 'osb-notifications', 'park-my-number-plans', 'passport-to-qid-updates',
  'payments', 'port-out-tickets', 'price-exceptions', 'products', 'qtickets', 'reject-reasons',
  'rfs-records',
  'service-usage', 'sim-swap-orders', 'sims', 'smart-devices', 'sms-templates', 'star-number-tiers',
  'statements-of-account', 'tasks', 'technician-resources', 'tnc-summary-bullets', 'tnc-full-text', 'qatar-areas', 'ton-cases', 'trouble-tickets',
  'uim-inventory-records', 'users-agents', 'vodafone-ids', 'volumetric-discounts', 'wfm-activities',
] as const;

/** Where a mock-data file is served from. */
export const mockDataUrl = (name: string): string => `/mock-data/${name}.json`;

export type EntityKind = (typeof SEED_FILES)[number];

type Store = Record<string, Record<string, unknown>[]>;

let store: Store | null = null;
let seeding: Promise<Store> | null = null;

const LATENCY_MIN = 200;
const LATENCY_MAX = 600;

function latency<T>(value: T): Promise<T> {
  const ms = LATENCY_MIN + Math.random() * (LATENCY_MAX - LATENCY_MIN);
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function idFieldFor(records: Record<string, unknown>[]): string {
  if (!records.length) return 'id';
  const keys = Object.keys(records[0]);
  return keys.find((k) => /Id$/.test(k)) ?? keys[0];
}

export async function seedMockData(): Promise<Store> {
  if (store) return store;
  if (seeding) return seeding;
  seeding = (async (): Promise<Store> => {
    const entries = await Promise.all(
      SEED_FILES.map(async (name) => {
        const res = await fetch(mockDataUrl(name));
        if (!res.ok) return [name, []] as const;
        const data = (await res.json()) as Record<string, unknown>[];
        return [name, data] as const;
      })
    );
    const seeded: Store = Object.fromEntries(entries);
    store = seeded;
    return seeded;
  })();
  return seeding;
}

function requireStore(): Store {
  if (!store) throw new Error('Mock data not seeded yet - call seedMockData() during app boot.');
  return store;
}

export async function list<T = Record<string, unknown>>(kind: EntityKind): Promise<T[]> {
  return latency((requireStore()[kind] ?? []) as T[]);
}

export async function get<T = Record<string, unknown>>(kind: EntityKind, id: string): Promise<T | undefined> {
  const records = requireStore()[kind] ?? [];
  const field = idFieldFor(records);
  return latency(records.find((r) => r[field] === id) as T | undefined);
}

export async function create<T extends Record<string, unknown>>(kind: EntityKind, record: T): Promise<T> {
  const s = requireStore();
  if (!s[kind]) s[kind] = [];
  s[kind].push(record);
  return latency(record);
}

export async function update<T extends Record<string, unknown>>(
  kind: EntityKind,
  id: string,
  patch: Partial<T>
): Promise<T | undefined> {
  const records = requireStore()[kind] ?? [];
  const field = idFieldFor(records);
  const idx = records.findIndex((r) => r[field] === id);
  if (idx === -1) return latency(undefined);
  records[idx] = { ...records[idx], ...patch };
  return latency(records[idx] as T);
}

/**
 * Delete a record outright. Added 2026-09-27 for "Abandon Order", which
 * discards a DRAFT order the agent has decided not to place.
 *
 * Deliberately a real delete and not a status flip: a draft was never an order
 * anyone placed, so leaving an 'Abandoned' row behind would put records in the
 * order list for activations that never happened. A SUBMITTED order should
 * still be cancelled via its own lifecycle (see `transition`) rather than
 * removed - this is for the pre-submission draft only.
 *
 * Returns whether anything was removed, so a caller can tell a real deletion
 * from a no-op on an id that had already gone.
 */
export async function remove(kind: EntityKind, id: string): Promise<boolean> {
  const records = requireStore()[kind] ?? [];
  const field = idFieldFor(records);
  const idx = records.findIndex((r) => r[field] === id);
  if (idx === -1) return latency(false);
  records.splice(idx, 1);
  return latency(true);
}

// Validates an entity's lifecycle transition against domain-model.md's evidenced
// state machine (frontend-architecture.md §7) rather than allowing any-to-any state change.
export function transition(
  allowedStates: string[][],
  currentState: string,
  toState: string
): { ok: boolean; reason?: string } {
  const legal = allowedStates.some(([from, to]) => from === currentState && to === toState);
  if (!legal) {
    return { ok: false, reason: `Illegal transition: ${currentState} -> ${toState}` };
  }
  return { ok: true };
}

export function resetMockData(): void {
  store = null;
  seeding = null;
}
