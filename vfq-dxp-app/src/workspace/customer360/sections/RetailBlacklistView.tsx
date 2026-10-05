import type { ReactNode } from 'react';
import { Badge } from '../../../components/primitives/Badge';
import { Button } from '../../../components/primitives/Button';
import { Icon } from '../../../components/primitives/Icon';
import { computeBillingSummary, type Customer360Data } from '../../../engines/customer360Engine';

const SHIELD_ICON = 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z';
const CHECK_ICON = 'M20 6L9 17l-5-5';
const ALERT_ICON = 'M12 9v4 M12 17h.01 M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z';
const REFRESH_ICON = 'M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0 1 14.85-3.36L23 10 M1 14l4.64 4.36A9 9 0 0 0 20.49 15';
const INFO_ICON = 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 16v-4 M12 8h.01';

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg p-5">
      <h3 className="text-fg font-semibold text-[length:var(--fs-body-lg)] pb-3 mb-4 border-b border-border-soft">{title}</h3>
      {children}
    </section>
  );
}

function Stacked({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="py-3 border-b border-border-soft last:border-0">
      <div className="text-fg-2 text-[length:var(--fs-body)]">{label}</div>
      <div className="text-fg font-medium text-[length:var(--fs-body)]">{value}</div>
    </div>
  );
}

function Inline({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-border-soft last:border-0 text-[length:var(--fs-body)]">
      <span className="text-fg-2">{label}</span>
      <span className="text-fg font-medium">{value}</span>
    </div>
  );
}

/**
 * The Retail Sales Agent's Blacklist View tab. No dedicated blacklist dataset exists, so this reads the
 * blacklist flag on the customer record and the account / billing fields the standard Blacklist View topic
 * already uses; a value the app doesn't hold shows "-".
 */
export function RetailBlacklistView({ data, onRefresh }: { data: Customer360Data; onRefresh: () => void }) {
  const blacklisted = Boolean(data.customer.blacklisted);
  const category = data.customer.blacklistCategory as string | undefined;
  const { outstanding, latestBill } = computeBillingSummary(data);
  const accountNumber = data.accounts.length > 0 ? data.accounts.map((a) => a.accountId).join(', ') : '-';
  const msisdns = Array.from(new Set([data.customer.phone, ...data.contacts.map((c) => c.cellNumber as string | undefined)].filter(Boolean))) as string[];
  const status = blacklisted ? (category ? `Blacklisted - ${category}` : 'Blacklisted') : 'Whitelisted';

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <span className="w-11 h-11 rounded-full bg-[var(--surface-warm)] text-accent flex items-center justify-center shrink-0">
            <Icon path={SHIELD_ICON} className="w-6 h-6" />
          </span>
          <div>
            <h2 className="text-fg font-semibold text-[length:var(--fs-h4)] leading-tight">Blacklist View</h2>
            <p className="text-fg-2 text-[length:var(--fs-body)]">View blacklist details associated with the customer.</p>
          </div>
        </div>
        <Button variant="secondary-rect" compact onClick={onRefresh}>
          <Icon path={REFRESH_ICON} className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      <Panel title="Blacklist Status">
        <div
          className={`rounded-[var(--radius-card)] p-4 flex items-center gap-4 ${
            blacklisted ? 'bg-[color-mix(in_oklab,var(--danger),var(--bg)_92%)]' : 'bg-[color-mix(in_oklab,var(--success),var(--bg)_90%)]'
          }`}
        >
          <span className={`w-12 h-12 rounded-full text-white flex items-center justify-center shrink-0 ${blacklisted ? 'bg-danger' : 'bg-success'}`}>
            <Icon path={blacklisted ? ALERT_ICON : CHECK_ICON} className="w-6 h-6" />
          </span>
          <div>
            <div className={`font-semibold text-[length:var(--fs-body-lg)] ${blacklisted ? 'text-danger' : 'text-success'}`}>{blacklisted ? 'Blacklisted' : 'Whitelisted'}</div>
            <div className="text-fg-2 text-[length:var(--fs-body)]">
              {blacklisted ? (category ? `Blacklist record found for this customer: ${category}.` : 'Blacklist record found for this customer.') : 'No blacklist record found for this customer.'}
            </div>
          </div>
        </div>
      </Panel>

      <Panel title="Blacklist Details">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8">
          <div>
            <Inline label="Blacklisted ID Status" value={<Badge variant={blacklisted ? 'danger' : 'tag-green'}>{status}</Badge>} />
            <Inline label="Account Number" value={accountNumber} />
            <Inline label="Total amount" value={`QAR ${outstanding}`} />
          </div>
          <div className="md:border-l md:border-border-soft md:pl-8">
            <Stacked label="Bill Period" value={latestBill ? String(latestBill.billPeriod) : '-'} />
            <Stacked label="Bill Number" value={latestBill ? String(latestBill.billId) : '-'} />
          </div>
          <div className="md:border-l md:border-border-soft md:pl-8">
            <Stacked label="MSISDNs" value={msisdns.length > 0 ? msisdns.join(', ') : '-'} />
          </div>
        </div>
      </Panel>

      {!blacklisted && (
        <div className="rounded-[var(--radius-card)] bg-[color-mix(in_oklab,var(--info),var(--bg)_92%)] text-fg p-4 flex items-center gap-3 text-[length:var(--fs-body)]">
          <Icon path={INFO_ICON} className="w-6 h-6 text-[var(--info)] shrink-0" />
          No blacklist records found for the selected customer.
        </div>
      )}

      <div className="flex items-center justify-end gap-2 text-muted text-[length:var(--fs-caption)]">
        <Icon path={INFO_ICON} className="w-4 h-4" />
        Data as per available systems
      </div>
    </div>
  );
}
