import type { ReactNode } from 'react';
import { Icon } from '../../../components/primitives/Icon';
import { DataTable } from '../../../components/primitives/DataTable';
import type { Customer360Data } from '../../../engines/customer360Engine';
import type { CustomerService } from '../../../engines/customerServicesEngine';
import { accountInformationResolvers, overdueTicketCount } from './accountInformationResolvers';
import { AccountHierarchySection } from './AccountHierarchySection';
import { Card, Row, ViewToggle } from './retailCards';

const PERSON_ICON = 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z';
const DETAILS_ICON = 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h8';
const NETWORK_ICON = 'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M8.6 13.5l6.8 4 M15.4 6.5l-6.8 4';
const HIERARCHY_ICON = 'M10 3h4v4h-4z M3 17h4v4H3z M17 17h4v4h-4z M12 7v5 M5 17v-5h14v5';
const STATUS_ICON = 'M3 5h18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M1 10h22';
const CLOCK_ICON = 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2';
const ORDERS_ICON = 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M9 15l2 2 4-4';

function formatDate(iso: unknown): string {
  const d = new Date(String(iso));
  return Number.isNaN(d.getTime()) ? String(iso ?? '') : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * The Retail Sales Agent's Account Information tab: six cards over the same Customer 360 data the standard
 * Account Information topic reads. A row with no data on file is left out rather than filled in.
 */
export function RetailAccountInformation({ data, services }: { data: Customer360Data; services: CustomerService[] }) {
  const info = (key: string) => accountInformationResolvers[key]?.({ data, services }) as ReactNode | undefined;
  const byCategory = new Map<string, number>();
  for (const s of services) byCategory.set(s.category, (byCategory.get(s.category) ?? 0) + 1);
  const creditLimit = data.creditLimits[0];
  const creditValue = creditLimit ? `QAR ${String(creditLimit.creditLimitQar ?? creditLimit.creditLimitQAR ?? '-')}` : undefined;
  const milestones = [...data.activities].sort((a, b) => String(b.transactionDate ?? '').localeCompare(String(a.transactionDate ?? ''))).slice(0, 5);

  return (
    <div>
      <h2 className="flex items-center gap-3 text-fg font-semibold text-[length:var(--fs-h4)] pb-3 mb-4 border-b border-border-soft">
        <Icon path={PERSON_ICON} className="w-6 h-6" />
        Account Information
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <Card icon={DETAILS_ICON} title="Account Details">
          <dl>
            <Row label="Primary MSISDN" value={info('Primary MSISDN')} />
            <Row label="Account Manager Name" requirement="AM name" value={info('AM name')} />
            <Row label="Account Manager Mobile" requirement="AM mobile" value={info('AM mobile')} />
            <Row label="Account Manager Email" requirement="AM Email" value={info('AM Email')} />
            <Row label="Availability / escalation contact" value={info('Availability/escalation contact')} />
            <Row label="Segment" value={data.customer.segment} />
          </dl>
        </Card>

        <Card icon={NETWORK_ICON} title="Service Type & Connections">
          <p className="text-fg font-semibold text-[length:var(--fs-body)] py-3">Total Number of Connections</p>
          {services.length === 0 ? (
            <p className="text-fg-2 text-[length:var(--fs-body)]">No connections on file.</p>
          ) : (
            <dl className="rounded-[var(--radius-card)] border border-border-soft px-3">
              <Row label="Total (Per Account)" value={services.length} end />
              {[...byCategory.entries()].map(([c, n]) => (
                <Row key={c} label={c} value={n} end />
              ))}
            </dl>
          )}
        </Card>

        <Card icon={HIERARCHY_ICON} title="Account Hierarchy">
          <dl>
            <ViewToggle label="Account Hierarchy">
              <AccountHierarchySection data={data} />
            </ViewToggle>
            <Row label="All Billing Profiles" value={data.billingProfiles.length} end />
            <Row label="Installed Assets" value={data.installedAssets.length} end />
            <ViewToggle label="Contact Hierarchy">
              <DataTable
                rows={data.contacts}
                rowKey={(r) => String(r.contactRecordId)}
                emptyMessage="No contacts on file for this customer."
                columns={[
                  { key: 'firstName', header: 'First Name' },
                  { key: 'lastName', header: 'Last Name' },
                  { key: 'idType', header: 'ID Type' },
                ]}
              />
            </ViewToggle>
          </dl>
        </Card>

        <Card icon={STATUS_ICON} title="Account Status">
          <dl>
            <Row label="Current Dunning Stage" value={info('Current Dunning Stage')} />
            <Row label="Credit Limit" value={creditValue} />
            <Row label="Overdue TT" value={overdueTicketCount(data)} />
          </dl>
        </Card>

        <Card icon={CLOCK_ICON} title="Recent Milestones or Interactions">
          {milestones.length === 0 ? (
            <p className="text-fg-2 text-[length:var(--fs-body)] pt-3">No activity on file for this customer.</p>
          ) : (
            <dl>
              {milestones.map((a) => (
                <div key={String(a.activityNumber)} className="grid grid-cols-[7rem_1fr] gap-4 py-2 border-b border-border-soft last:border-0 text-[length:var(--fs-body)]">
                  <dt className="text-fg-2">{formatDate(a.transactionDate)}</dt>
                  <dd className="text-fg">{String(a.topic ?? '-')}</dd>
                </div>
              ))}
            </dl>
          )}
        </Card>

        <Card icon={ORDERS_ICON} title="Orders & Trouble Tickets">
          <dl>
            <Row label="All Orders" value={data.orders.length} end />
            <Row label="All Trouble Tickets" value={data.tickets.length} end />
          </dl>
        </Card>
      </div>
    </div>
  );
}
