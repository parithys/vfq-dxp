import { useEffect, useState } from 'react';
import { Input } from '../primitives/Input';
import { Select } from '../primitives/Select';
import { Icon } from '../primitives/Icon';
import * as mockDataEngine from '../../engines/mockDataEngine';

export interface DoiSelection {
  deviceName: string;
  devicePriceQar: number;
  installmentMonths: number;
  downPaymentQar: number;
  monthlyInstallmentQar: number;
  colour?: string;
  storage?: string;
  imei?: string;
  handoverMethod?: 'Store pickup' | 'Courier delivery';
  doiRead?: boolean;
  doiAccepted?: boolean;
}

interface DoiRecord {
  deviceName: string;
  devicePriceQar: number;
  downPaymentQar: number;
  installmentMonths: number;
  monthlyInstallmentQar: number;
  colourOptions: string[];
  storageOptions: string[];
  catalogStockStatus: 'In Stock' | 'Delivery Only';
  catalogStockNote: string;
  tradeInBonusQar: number | null;
}

interface DeviceInstallmentStepProps {
  value: DoiSelection | undefined;
  defaultCreditLimitQar: number | undefined;
  onChange: (value: DoiSelection | undefined) => void;
  /** For the "Plan + add-ons" / "Monthly total" summary rows — the plan step
   * runs earlier in this wizard, so these are already chosen by the time an
   * agent reaches this step. */
  planProductId: string | undefined;
  planDiscountId: string | undefined;
  planAddonIds: string[];
}

const INSTALLMENT_OPTIONS = [6, 12, 24];

const PHONE_ICON = 'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z M11 18h2';
const SIM_ONLY_ICON = 'M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M14 3v4h4 M4 4l16 16';
const CHECK_ICON = 'M20 6L9 17l-5-5';
const BOX_ICON = 'M21 8l-9-5-9 5 9 5 9-5z M3 8v8l9 5 9-5V8 M3 8l9 5 9-5';
const TRUCK_ICON = 'M3 7h11v10H3z M14 10h4l3 3v4h-7z M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M17.5 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z';
const WARN_ICON = 'M12 3l9 16H3l9-16z M12 10v4 M12 17h.01';

// "Device selection" & "Device on Installment (DOI) Declaration" — Mobile
// Postpaid's Device & DOI step. DOI = Device on Installment (BR-114/BR-106/
// BR-329, domain-model.md ENT-029) — not "Declaration of Intent"; no DXP
// layout is evidenced for this screen (it's explicitly greenfield per
// gap-resolution-stage-k.md's DOI entry), whose own recommendation is to
// model it on the evidenced Plan step's shape: catalogue tile grid -> detail/
// breakdown panel -> edit a financial parameter -> continue. Catalogue stays
// the real device-installments.json entries (not invented SKUs); colour/
// storage/stock/trade-in/handover are presentational elaboration in that
// same spirit, consistent with device-installments.json's own price/down-
// payment data rather than replacing it.
export function DeviceInstallmentStep({
  value,
  defaultCreditLimitQar,
  onChange,
  planProductId,
  planDiscountId,
  planAddonIds,
}: DeviceInstallmentStepProps) {
  const [catalogue, setCatalogue] = useState<DoiRecord[]>([]);
  const [planAddonsMonthlyQar, setPlanAddonsMonthlyQar] = useState(0);

  useEffect(() => {
    mockDataEngine.list<DoiRecord>('device-installments').then((all) => {
      const seen = new Set<string>();
      const distinct = all.filter((r) => (seen.has(r.deviceName) ? false : (seen.add(r.deviceName), true)));
      setCatalogue(distinct);
    });
  }, []);

  useEffect(() => {
    if (!planProductId) {
      setPlanAddonsMonthlyQar(0);
      return;
    }
    Promise.all([
      mockDataEngine.list<{ productId: string; mrcQAR: number; type: string }>('products'),
      mockDataEngine.list<{ addonDiscountId: string; price: number; category: string }>('addons-discounts'),
    ]).then(([products, discounts]) => {
      const plan = products.find((p) => p.productId === planProductId);
      const discount = discounts.find((d) => d.addonDiscountId === planDiscountId);
      const addonsTotal = products.filter((p) => planAddonIds.includes(p.productId)).reduce((sum, a) => sum + a.mrcQAR, 0);
      setPlanAddonsMonthlyQar(Math.round((plan?.mrcQAR ?? 0) * (1 + (discount?.price ?? 0)) + addonsTotal));
    });
  }, [planProductId, planDiscountId, planAddonIds]);

  const selectedDevice = catalogue.find((d) => d.deviceName === value?.deviceName);

  const selectDevice = (device: DoiRecord | null) => {
    if (!device) {
      onChange(undefined);
      return;
    }
    onChange({
      deviceName: device.deviceName,
      devicePriceQar: device.devicePriceQar,
      installmentMonths: device.installmentMonths,
      downPaymentQar: device.downPaymentQar,
      monthlyInstallmentQar: device.monthlyInstallmentQar,
      colour: device.colourOptions[0],
      storage: device.storageOptions[0],
      handoverMethod: 'Store pickup',
      doiRead: false,
      doiAccepted: false,
    });
  };

  const setMonths = (months: number) => {
    if (!value) return;
    onChange({ ...value, installmentMonths: months, monthlyInstallmentQar: Math.round((value.devicePriceQar - value.downPaymentQar) / months) });
  };

  const creditLimit = defaultCreditLimitQar ?? 1000;
  const eligible = !value || value.devicePriceQar <= creditLimit * 5;
  const totalContractValue = value ? value.downPaymentQar + value.monthlyInstallmentQar * value.installmentMonths : 0;
  const monthlyTotal = value ? value.monthlyInstallmentQar + planAddonsMonthlyQar : planAddonsMonthlyQar;

  return (
    <div className="space-y-6">
      <div className="rounded-[var(--radius-card)] border border-border-soft bg-bg overflow-hidden">
        <div className="px-5 py-4 border-b border-border-soft bg-surface">
          <h3 className="text-fg font-semibold text-[length:var(--fs-body-lg)]">Device selection</h3>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-fg-2 text-[length:var(--fs-caption)]">Bundle a device</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => selectDevice(null)}
              className={`text-left rounded-[var(--radius-card)] border p-4 ${
                !value ? 'border-[var(--field-card-selected)] bg-[var(--field-card-selected-bg)] shadow-[var(--shadow-selected-ring)]' : 'border-border-soft hover:border-[var(--field-card-selected)]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-fg font-medium">
                  <Icon path={SIM_ONLY_ICON} className="w-4.5 h-4.5 text-accent" />
                  SIM only
                </span>
                {!value && <Icon path={CHECK_ICON} className="w-4 h-4 text-[var(--field-card-selected)]" />}
              </div>
              <p className="text-muted text-[length:var(--fs-caption)] mt-1">No device on this contract</p>
            </button>
            {catalogue.map((d) => {
              const selected = value?.deviceName === d.deviceName;
              return (
                <button
                  key={d.deviceName}
                  onClick={() => selectDevice(d)}
                  className={`text-left rounded-[var(--radius-card)] border p-4 ${
                    selected ? 'border-[var(--field-card-selected)] bg-[var(--field-card-selected-bg)] shadow-[var(--shadow-selected-ring)]' : 'border-border-soft hover:border-[var(--field-card-selected)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-fg font-medium">
                      <Icon path={PHONE_ICON} className="w-4.5 h-4.5 text-accent" />
                      {d.deviceName}
                    </span>
                    {selected && <Icon path={CHECK_ICON} className="w-4 h-4 text-[var(--field-card-selected)]" />}
                  </div>
                  <p className="text-muted text-[length:var(--fs-caption)] mt-1">
                    From {d.storageOptions[0]} · {d.installmentMonths}-month instalment
                  </p>
                  <p className="text-fg font-bold mt-2">QAR {d.monthlyInstallmentQar}/mo</p>
                </button>
              );
            })}
          </div>

          {value && selectedDevice && (
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="Colour"
                  value={value.colour ?? selectedDevice.colourOptions[0]}
                  onChange={(e) => onChange({ ...value, colour: e.target.value })}
                  options={selectedDevice.colourOptions.map((c) => ({ value: c, label: c }))}
                />
                <Select
                  label="Storage"
                  value={value.storage ?? selectedDevice.storageOptions[0]}
                  onChange={(e) => onChange({ ...value, storage: e.target.value })}
                  options={selectedDevice.storageOptions.map((s) => ({ value: s, label: s }))}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-[var(--radius-badge-pill)] px-2.5 py-1 text-[length:var(--fs-tag)] font-medium ${
                    selectedDevice.catalogStockStatus === 'In Stock'
                      ? 'bg-[color-mix(in_oklab,var(--success),white_85%)] text-success'
                      : 'bg-[color-mix(in_oklab,var(--warn),white_80%)] text-[var(--warn-text)]'
                  }`}
                >
                  <Icon path={selectedDevice.catalogStockStatus === 'In Stock' ? BOX_ICON : TRUCK_ICON} className="w-3.5 h-3.5" />
                  {selectedDevice.catalogStockNote}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-[var(--radius-badge-pill)] px-2.5 py-1 text-[length:var(--fs-tag)] font-medium ${
                    eligible ? 'border border-accent text-accent' : 'bg-[color-mix(in_oklab,var(--danger),white_85%)] text-danger'
                  }`}
                >
                  <Icon path={CHECK_ICON} className="w-3.5 h-3.5" />
                  {eligible ? 'Eligible for instalment' : 'Not eligible'}
                </span>
                {selectedDevice.tradeInBonusQar && (
                  <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-badge-pill)] px-2.5 py-1 text-[length:var(--fs-tag)] font-medium bg-[color-mix(in_oklab,var(--accent),white_85%)] text-accent">
                    QAR {selectedDevice.tradeInBonusQar} trade-in bonus applied
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="IMEI"
                  placeholder="15-digit IMEI"
                  value={value.imei ?? ''}
                  onChange={(e) => onChange({ ...value, imei: e.target.value })}
                />
                <div>
                  <label className="text-[length:var(--fs-label)] text-[var(--field-label-disabled)] block mb-1">Upfront payment</label>
                  <div className="rounded-[var(--field-radius)] border border-[var(--field-border-disabled)] bg-bg px-3 py-2 text-[var(--field-label-disabled)]">
                    QAR {value.downPaymentQar}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-fg-2 text-[length:var(--fs-caption)]">Instalment term</span>
                <div className="flex gap-1">
                  {INSTALLMENT_OPTIONS.map((m) => (
                    <button
                      key={m}
                      onClick={() => setMonths(m)}
                      className={`px-3 py-1 rounded-[var(--radius-button)] border text-[length:var(--fs-caption)] ${
                        value.installmentMonths === m ? 'border-[var(--field-card-selected)] bg-[var(--field-card-selected)] text-white' : 'border-border-soft text-fg-2'
                      }`}
                    >
                      {m} mo
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[var(--radius-card)] border border-border-soft divide-y divide-border-soft">
                {[
                  ['Instalment term', `${value.installmentMonths} months`],
                  ['Device instalment', `QAR ${value.monthlyInstallmentQar}/mo`],
                  ['Upfront due today', `QAR ${value.downPaymentQar}`],
                  ['Total contract value', `QAR ${totalContractValue}`],
                  ['Plan + add-ons', `QAR ${planAddonsMonthlyQar}/mo`],
                ].map(([label, val]) => (
                  <div key={label} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-fg-2 text-[length:var(--fs-body)]">{label}</span>
                    <span className="text-fg text-[length:var(--fs-body)]">{val}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-fg-2 text-[length:var(--fs-body)]">Monthly total</span>
                  <span className="text-accent font-bold text-[length:var(--fs-body)]">QAR {monthlyTotal}/mo</span>
                </div>
              </div>

              <div>
                <p className="text-fg font-medium mb-2">Handover method</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(
                    [
                      { method: 'Store pickup' as const, icon: BOX_ICON, note: 'Villaggio Mall — Doha' },
                      { method: 'Courier delivery' as const, icon: TRUCK_ICON, note: 'Signature on receipt, 3–5 days' },
                    ]
                  ).map((h) => (
                    <button
                      key={h.method}
                      onClick={() => onChange({ ...value, handoverMethod: h.method })}
                      className={`text-left rounded-[var(--radius-card)] border p-3 flex items-center justify-between gap-2 ${
                        value.handoverMethod === h.method
                          ? 'border-[var(--field-card-selected)] bg-[var(--field-card-selected-bg)] shadow-[var(--shadow-selected-ring)]'
                          : 'border-border-soft hover:border-[var(--field-card-selected)]'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Icon path={h.icon} className="w-4.5 h-4.5 text-accent" />
                        <span>
                          <span className="block text-fg font-medium">{h.method}</span>
                          <span className="block text-muted text-[length:var(--fs-caption)]">{h.note}</span>
                        </span>
                      </span>
                      {value.handoverMethod === h.method && <Icon path={CHECK_ICON} className="w-4 h-4 text-[var(--field-card-selected)] shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {value && (
        <div className="rounded-[var(--radius-card)] border border-border-soft bg-bg overflow-hidden">
          <div className="px-5 py-4 border-b border-border-soft bg-surface flex items-center justify-between">
            <h3 className="text-fg font-semibold text-[length:var(--fs-body-lg)]">Device on Installment (DOI) Declaration</h3>
            <span className="text-muted text-[length:var(--fs-caption)]">BR-114</span>
          </div>
          <div className="p-5 space-y-3">
            <div className="flex items-start gap-2 rounded-[var(--radius-card)] border border-[var(--warn)] bg-[color-mix(in_oklab,var(--warn),white_88%)] px-4 py-3">
              <Icon path={WARN_ICON} className="w-4.5 h-4.5 text-[var(--warn-text)] shrink-0 mt-0.5" />
              <div>
                <p className="text-fg font-medium text-[length:var(--fs-body)]">Customer must confirm the DOI terms before continuing</p>
                <p className="text-fg-2 text-[length:var(--fs-caption)] mt-0.5">
                  Confirms the customer understands the instalment term, monthly payments, and early-settlement terms (BR-114).
                </p>
              </div>
            </div>
            <label className="flex items-start gap-2 text-[length:var(--fs-body)] text-fg cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 accent-[var(--field-selected)]"
                checked={value.doiRead ?? false}
                onChange={(e) => onChange({ ...value, doiRead: e.target.checked })}
              />
              <span>
                <span className="block">DOI terms read to customer</span>
                <span className="block text-muted text-[length:var(--fs-caption)]">Agent confirms the terms were read aloud in the customer's preferred language.</span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-[length:var(--fs-body)] text-fg cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 accent-[var(--field-selected)]"
                checked={value.doiAccepted ?? false}
                onChange={(e) => onChange({ ...value, doiAccepted: e.target.checked })}
              />
              <span>
                <span className="block">Customer accepts the declaration</span>
                <span className="block text-muted text-[length:var(--fs-caption)]">Recorded against the tracking record and CAF.</span>
              </span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
