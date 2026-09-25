import type { AccountRecord, CustomerRecord } from './customer360Engine';

/** Which Customer 360 tab owns a service type - the tab a link opens. */
export type ServiceTab = 'mobile' | 'fibre' | 'assets';

export interface CustomerService {
  /**
   * Identifies this service in a deep link. The target tab matches on it to
   * decide which service to load, so it must be stable and unique within a
   * customer - an MSISDN, a service id, a bundle id or a device number.
   */
  ref: string;
  tab: ServiceTab;
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

// Which tab an installed asset belongs under, from its product name. The
// dataset has no service-type field, so the name is the only signal - matched
// on rather than guessed at, and anything unrecognised lands in Products &
// Assets instead of being forced into Mobile or Fibre.
function tabForProductName(name: string): ServiceTab {
  if (/mobile|sim|postpaid|prepaid/i.test(name)) return 'mobile';
  if (/broadband|fibre|fiber|gigahome|iptv|osn|home/i.test(name)) return 'fibre';
  return 'assets';
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
    services.push({
      ref: asset.serviceId ?? asset.installedAssetId ?? name,
      tab: tabForProductName(name),
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
      label: bundle.stbCount ? `IPTV (${bundle.stbCount} STB)` : 'IPTV',
      identifier: bundle.iptvBundleId ?? '-',
    });
  }

  for (const device of sources.smartDevices) {
    if (device.customerId !== customer.customerId) continue;
    services.push({
      ref: device.assignedNumber ?? device.id ?? 'device',
      tab: 'assets',
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
