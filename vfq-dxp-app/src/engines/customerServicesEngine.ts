import type { AccountRecord, CustomerRecord } from './customer360Engine';

/** Which Customer 360 tab owns a service type - the tab a link opens. */
export type ServiceTab = 'mobile' | 'fibre' | 'assets';

/**
 * Display categories for the grouped view, in display order.
 *
 * Derived from the 2026-09-25 example list, restricted to what this corpus
 * can actually evidence. Two of that list's categories are deliberately
 * absent rather than rendered as zero:
 *
 *   - 'GigaHome 5G' - nothing distinguishes an FWA/5G home service from fibre
 *     in any dataset here. There is no field to read.
 *   - 'Fixed Line' - accounts.json has "Consumer Fixed Line (GigaHome)", but
 *     that is the fibre account, not a separate fixed-voice service; counting
 *     it would double-count the GigaHome subscription hanging off it.
 *
 * Both are left in this list so the order is stable if the data arrives later
 * - a category with no services simply never renders.
 */
export const SERVICE_CATEGORY_ORDER = [
  'Prepaid',
  'Postpaid',
  'GigaHome Fibre',
  'GigaHome 5G',
  'TV / Entertainment',
  'Fixed Line',
  'Smart Devices',
] as const;

export type ServiceCategory = (typeof SERVICE_CATEGORY_ORDER)[number];

export interface CustomerService {
  /**
   * Identifies this service in a deep link. The target tab matches on it to
   * decide which service to load, so it must be stable and unique within a
   * customer - an MSISDN, a service id, a bundle id or a device number.
   */
  ref: string;
  tab: ServiceTab;
  /** Which grouped row this service counts towards. */
  category: ServiceCategory;
  /** What the agent reads: "GigaHome 300 + OSNtv Basic", "Postpaid mobile line". */
  label: string;
  /** The clickable identifier, shown as the link text. */
  identifier: string;
  /** Only where the source carries one - these vocabularies are not uniform. */
  status?: string;
}

interface InstalledAsset {
  installedAssetId?: string;
  accountId?: string;
  productServiceName?: string;
  serviceId?: string;
  status?: string;
}
interface GigahomeSubscription {
  id?: string;
  customerId?: string;
  status?: string;
  acceptanceForm?: { planName?: string };
}
interface IptvBundle {
  iptvBundleId?: string;
  accountId?: string;
  stbCount?: number;
  removedByCustomer?: boolean;
}
interface SmartDevice {
  id?: string;
  customerId?: string;
  deviceCategory?: string;
  assignedNumber?: string;
}

export interface ServiceSources {
  accounts: AccountRecord[];
  installedAssets: InstalledAsset[];
  gigahome: GigahomeSubscription[];
  iptvBundles: IptvBundle[];
  smartDevices: SmartDevice[];
}

// Which tab and category an installed asset belongs under, from its product
// name. The dataset has no service-type field, so the name is the only signal
// - matched on rather than guessed at, and anything unrecognised lands in
// Products & Assets rather than being forced into Mobile or Fibre.
function classifyProductName(name: string): { tab: ServiceTab; category: ServiceCategory } {
  if (/prepaid/i.test(name)) return { tab: 'mobile', category: 'Prepaid' };
  if (/postpaid|mobile|sim/i.test(name)) return { tab: 'mobile', category: 'Postpaid' };
  if (/iptv|osn|\btv\b/i.test(name)) return { tab: 'fibre', category: 'TV / Entertainment' };
  if (/broadband|fibre|fiber|gigahome|home/i.test(name)) return { tab: 'fibre', category: 'GigaHome Fibre' };
  return { tab: 'assets', category: 'Smart Devices' };
}

// Every active Vodafone service a customer holds, across the datasets that
// carry one - not just their mobile lines.
//
// Built because "Active lines" could only ever count MOBILE lines: the two
// count fields on the customer record are mobile-only, so a customer whose
// service is fibre or IoT read as having nothing at all. CUST-1003 holds an
// active GigaHome subscription and CUST-1004 holds GigaHome plus a smart plug,
// and both were reported as having no services.
//
// TWO LINKAGE RULES, deliberately different:
//
//   - customerId-keyed sources (gigahome, smart devices) resolve directly.
//   - account-keyed sources (installed assets, IPTV bundles) resolve through
//     accounts.json, which is the OWNER OF RECORD.
//
// That second rule matters because the seed contradicts itself on ACC-5004:
// accounts.json assigns it to CUST-2001 as an Enterprise parent, while four
// other files attach CUST-1004's credit limit, fibre and IoT device to it.
// Following accounts.json for account-keyed lookups keeps one answer rather
// than attributing the same service to two customers. The contradiction is a
// reference-data defect and is logged, not papered over here.
//
// Sources deliberately NOT used, because nothing links them to a customer:
// cpe-devices (customerId and accountId are null on all five records) and
// multi-sim-lines (customerId null on all four). Including them would mean
// inventing an owner.
export function listCustomerServices(customer: CustomerRecord, sources: ServiceSources): CustomerService[] {
  const services: CustomerService[] = [];
  const myAccountIds = new Set(
    sources.accounts.filter((a) => a.customerId === customer.customerId).map((a) => a.accountId)
  );

  // The mobile line the customer's own number identifies. Gated on lineType
  // rather than on `phone` alone: every customer record has a phone, but only
  // a customer with a live mobile line has a relationship on it, and a contact
  // number for a fibre-only customer is not a mobile service.
  if (customer.lineType && customer.phone) {
    services.push({
      ref: customer.phone,
      tab: 'mobile',
      // lineType IS the category for the customer's own number.
      category: customer.lineType === 'Prepaid' ? 'Prepaid' : 'Postpaid',
      label: `${customer.lineType} mobile line`,
      identifier: customer.phone,
    });
  }

  for (const asset of sources.installedAssets) {
    if (!asset.accountId || !myAccountIds.has(asset.accountId)) continue;
    // The only source here with a real status vocabulary, so it is the only
    // one that can be filtered on "Active" honestly.
    if (asset.status !== 'Active') continue;
    const name = asset.productServiceName ?? 'Installed service';
    const { tab, category } = classifyProductName(name);
    services.push({
      ref: asset.serviceId ?? asset.installedAssetId ?? name,
      tab,
      category,
      label: name,
      identifier: asset.serviceId ?? asset.installedAssetId ?? '-',
      status: asset.status,
    });
  }

  for (const sub of sources.gigahome) {
    if (sub.customerId !== customer.customerId) continue;
    // Statuses here are 'Try & Buy trial' / 'active subscription' /
    // 'Home Move / TON' - all live subscriptions in different lifecycle
    // states, none of them the literal 'Active' used above. They are shown
    // rather than filtered, so the agent sees WHICH state.
    services.push({
      ref: sub.id ?? 'gigahome',
      tab: 'fibre',
      // Counted as FIBRE, not also as TV, even though the plan name bundles
      // OSNtv ("GigaHome 500 + OSNtv Premium"). It is one subscription; the
      // TV package rides on it. Counting it twice would make the category
      // totals sum to more services than the customer holds.
      category: 'GigaHome Fibre',
      label: sub.acceptanceForm?.planName ?? 'GigaHome / OSNtv',
      identifier: sub.id ?? '-',
      status: sub.status,
    });
  }

  for (const bundle of sources.iptvBundles) {
    if (!bundle.accountId || !myAccountIds.has(bundle.accountId)) continue;
    if (bundle.removedByCustomer) continue;
    services.push({
      ref: bundle.iptvBundleId ?? 'iptv',
      tab: 'fibre',
      category: 'TV / Entertainment',
      label: bundle.stbCount ? `IPTV (${bundle.stbCount} STB)` : 'IPTV',
      identifier: bundle.iptvBundleId ?? '-',
    });
  }

  for (const device of sources.smartDevices) {
    if (device.customerId !== customer.customerId) continue;
    services.push({
      ref: device.assignedNumber ?? device.id ?? 'device',
      tab: 'assets',
      category: 'Smart Devices',
      // Capitalised at the boundary: the source stores 'smart plug' and
      // 'indoor tracker' lower-case, mid-sentence style.
      label: device.deviceCategory
        ? device.deviceCategory.charAt(0).toUpperCase() + device.deviceCategory.slice(1)
        : 'Smart device',
      identifier: device.assignedNumber ?? device.id ?? '-',
    });
  }

  return services;
}

export interface ServiceCategoryGroup {
  category: ServiceCategory;
  /** How many services the customer holds in this category. */
  count: number;
  /** Which Customer 360 tab the category opens. */
  tab: ServiceTab;
}

// The grouped view: one row per category the customer actually holds, in
// SERVICE_CATEGORY_ORDER, with a count.
//
// Empty categories are omitted rather than shown as "(0)" - a zero is not a
// fact about this customer, it is the absence of one, and six zero rows would
// bury the one or two that matter.
//
// The tab comes from the category's own services rather than a second
// category->tab table, so a category can never be shown against a tab none of
// its services live on.
export function groupServicesByCategory(services: CustomerService[]): ServiceCategoryGroup[] {
  return SERVICE_CATEGORY_ORDER.flatMap((category) => {
    const inCategory = services.filter((s) => s.category === category);
    if (inCategory.length === 0) return [];
    return [{ category, count: inCategory.length, tab: inCategory[0].tab }];
  });
}
