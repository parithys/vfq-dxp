import { useEffect, useState } from 'react';
import { Badge } from '../primitives/Badge';
import * as mockDataEngine from '../../engines/mockDataEngine';

export interface DoiSelection {
  deviceName: string;
  devicePriceQar: number;
  installmentMonths: number;
  downPaymentQar: number;
  monthlyInstallmentQar: number;
}

interface DoiRecord {
  deviceName: string;
  devicePriceQar: number;
}

interface DeviceInstallmentStepProps {
  value: DoiSelection | undefined;
  defaultCreditLimitQar: number | undefined;
  onChange: (value: DoiSelection | undefined) => void;
}

const INSTALLMENT_OPTIONS = [6, 12, 24];
// A device's down payment scales with price so higher-value handsets aren't
// eligible on a near-zero down payment — modeled on the evidenced DOI
// records' price-to-down-payment ratios (device-installments.json: ~16-21%).
const DOWN_PAYMENT_RATE = 0.2;

// "Device & DOI" (reference flow step 7) — optional handset-on-installment
// selection. Catalogue is the distinct device/price pairs evidenced in
// device-installments.json (Pattern: existing DOI records, not a fabricated
// SKU list). Eligibility ties back to the Eligibility Gate's computed default
// credit limit (BR-076) rather than a disconnected pass/fail, since no
// separate QCB-credit-check mock endpoint is evidenced for this journey.
export function DeviceInstallmentStep({ value, defaultCreditLimitQar, onChange }: DeviceInstallmentStepProps) {
  const [catalogue, setCatalogue] = useState<DoiRecord[]>([]);

  useEffect(() => {
    mockDataEngine.list<DoiRecord>('device-installments').then((all) => {
      const seen = new Set<string>();
      const distinct = all.filter((r) => (seen.has(r.deviceName) ? false : (seen.add(r.deviceName), true)));
      setCatalogue(distinct);
    });
  }, []);

  const selectDevice = (device: DoiRecord | null) => {
    if (!device) {
      onChange(undefined);
      return;
    }
    const months = value?.installmentMonths ?? 12;
    const downPaymentQar = Math.round(device.devicePriceQar * DOWN_PAYMENT_RATE);
    onChange({
      deviceName: device.deviceName,
      devicePriceQar: device.devicePriceQar,
      installmentMonths: months,
      downPaymentQar,
      monthlyInstallmentQar: Math.round((device.devicePriceQar - downPaymentQar) / months),
    });
  };

  const setMonths = (months: number) => {
    if (!value) return;
    onChange({ ...value, installmentMonths: months, monthlyInstallmentQar: Math.round((value.devicePriceQar - value.downPaymentQar) / months) });
  };

  const creditLimit = defaultCreditLimitQar ?? 1000;
  const eligible = !value || value.devicePriceQar <= creditLimit * 5;

  return (
    <div className="space-y-4">
      <p className="text-fg-2 text-[length:var(--fs-caption)]">Add a device on installment, or continue with a SIM-only activation.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => selectDevice(null)}
          className={`text-left rounded-[var(--radius-card)] border p-4 ${!value ? 'border-accent bg-surface-warm' : 'border-border-soft hover:border-accent'}`}
        >
          <span className="text-fg font-medium">No device (SIM only)</span>
        </button>
        {catalogue.map((d) => (
          <button
            key={d.deviceName}
            onClick={() => selectDevice(d)}
            className={`text-left rounded-[var(--radius-card)] border p-4 ${
              value?.deviceName === d.deviceName ? 'border-accent bg-surface-warm' : 'border-border-soft hover:border-accent'
            }`}
          >
            <div className="flex justify-between">
              <span className="text-fg font-medium">{d.deviceName}</span>
              <span className="text-fg">QR {d.devicePriceQar}</span>
            </div>
          </button>
        ))}
      </div>

      {value && (
        <div className="rounded-[var(--radius-card)] border border-border-soft bg-surface p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-fg-2 text-[length:var(--fs-caption)]">Installment term</span>
            <div className="flex gap-1">
              {INSTALLMENT_OPTIONS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMonths(m)}
                  className={`px-3 py-1 rounded-[var(--radius-button)] border text-[length:var(--fs-caption)] ${
                    value.installmentMonths === m ? 'border-accent bg-accent text-accent-on' : 'border-border-soft text-fg-2'
                  }`}
                >
                  {m} mo
                </button>
              ))}
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-3 text-[length:var(--fs-body)]">
            <div>
              <dt className="text-[length:var(--fs-caption)] text-muted">Down payment</dt>
              <dd className="text-fg">QR {value.downPaymentQar}</dd>
            </div>
            <div>
              <dt className="text-[length:var(--fs-caption)] text-muted">Monthly installment</dt>
              <dd className="text-fg">QR {value.monthlyInstallmentQar}</dd>
            </div>
            <div>
              <dt className="text-[length:var(--fs-caption)] text-muted">Device price</dt>
              <dd className="text-fg">QR {value.devicePriceQar}</dd>
            </div>
          </dl>
          {eligible ? (
            <div className="flex items-center gap-2">
              <Badge variant="success">DOI eligible</Badge>
              <span className="text-[length:var(--fs-caption)] text-fg-2">Within 5x the account's QR {creditLimit} default credit limit.</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Badge variant="danger">Not eligible</Badge>
              <span className="text-[length:var(--fs-caption)] text-fg-2">
                Device price exceeds 5x the account's QR {creditLimit} default credit limit — choose a lower-value device or a longer term with a higher
                down payment.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
