import type { Customer360Data } from '../../../engines/customer360Engine';
import type { CustomerService } from '../../../engines/customerServicesEngine';

/**
 * customer360-fields.json's Assets topic is per-line (MSISDN Status, Plan
 * Name, activation dates, …), not per-customer - a customer with 4 lines
 * can't be represented by one flat "Plan Name: X" row. This resolves the
 * topic's fields against ONE specific service where possible.
 *
 * Only services built from the `installedAssets` join in
 * customerServicesEngine.ts (generic broadband/mobile lines carrying a real
 * serviceId/installedAssetId) match cleanly - verified against this corpus:
 * the customer's own primary mobile line (`ref` = their phone number) and
 * GigaHome/IPTV subscriptions (`ref` = their own subscription ids) have NO
 * matching installedAssets row or order at all, so most per-line fields are
 * genuinely unavailable for them, not a resolver bug. `service === undefined`
 * resolves only the account-level shared fields (balance, usage, DOI) that
 * this corpus doesn't split by individual line.
 */
export function buildAssetsFieldResolver(service: CustomerService | undefined, data: Customer360Data) {
  const asset = service
    ? data.installedAssets.find((ia) => ia.serviceId === service.ref || ia.installedAssetId === service.ref)
    : undefined;
  const order = service ? data.orders.find((o) => o.msisdn === service.ref) : undefined;
  const addon = asset ? data.addonsDiscounts.find((ad) => ad.planId === asset.promotion) : undefined;
  const balance = data.inPlatformBalances[0];
  const usage = data.serviceUsage[0];
  const doi = data.deviceInstallments[0];

  return (details: string): React.ReactNode | undefined => {
    switch (details) {
      case 'MSISDN Status (Active, Suspended, Barred)':
        return (asset?.status as string | undefined) ?? (service ? data.accounts[0]?.status : undefined);
      case 'Plan Name':
        return (asset?.productServiceName as string | undefined) ?? (service?.label);
      case 'MSISDN Activation Date':
      case 'Postpaid Activation Date':
        return asset?.postpaidActivationDate as string | undefined;
      case 'Plan Activation Date':
        return asset?.effectiveFrom as string | undefined;
      case 'Sim serial':
        return order?.simSerial as string | undefined;
      case 'Pending Discounts':
        return addon && addon.category === 'Discount' && addon.isLockedReadOnly === false ? String(addon.name) : undefined;
      case 'Active Add-on':
        return addon && addon.category !== 'Discount' ? String(addon.name) : undefined;
      case 'Active Discount':
        return addon && addon.category === 'Discount' ? String(addon.name) : undefined;
      case 'Existing Discounts Expiry Date':
        return addon?.durationMonths !== null && addon?.durationMonths !== undefined
          ? `${String(addon.durationMonths)} month(s) from activation`
          : undefined;
      case 'Current Balance (Data,Voice, Text, Primary Balance)':
        return balance
          ? `Data ${String(balance.dataBalanceGB ?? '-')} GB · Voice ${String(balance.voiceBalanceMinutes ?? '-')} min · SMS ${String(balance.smsBalanceCount ?? '-')} · Main ${String(balance.mainBalanceQAR ?? '-')} QAR`
          : undefined;
      case 'Usage Behaviour (High Data, High Roaming, High Local Call, High International Calls)':
        return usage
          ? `Data ${String(usage.currentDataUsageGB ?? '-')} GB · Voice ${String(usage.currentVoiceUsageMinutes ?? '-')} min this period`
          : undefined;
      case 'DOI Handset Type':
        return doi?.deviceName as string | undefined;
      case 'DOI Price':
        return doi?.devicePriceQar !== undefined ? `${String(doi.devicePriceQar)} QAR` : undefined;
      case 'DOI Remaining Amount': {
        if (!doi) return undefined;
        const price = Number(doi.devicePriceQar ?? 0);
        const down = Number(doi.downPaymentQar ?? 0);
        return `${Math.max(0, price - down)} QAR`;
      }
      case 'DOI Tennure':
        return doi?.installmentMonths !== undefined ? `${String(doi.installmentMonths)} months` : undefined;
      default:
        return undefined;
    }
  };
}
