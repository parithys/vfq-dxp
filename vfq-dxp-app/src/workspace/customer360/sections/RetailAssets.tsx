import type { ReactNode } from 'react';
import { Badge } from '../../../components/primitives/Badge';
import { DataTable } from '../../../components/primitives/DataTable';
import { Icon } from '../../../components/primitives/Icon';
import type { Customer360Data } from '../../../engines/customer360Engine';
import type { CustomerService } from '../../../engines/customerServicesEngine';
import { buildAssetsFieldResolver } from './assetsResolvers';
import { Card, Row } from './retailCards';

const ASSETS_ICON = 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M2 12h20 M12 2a15 15 0 0 1 0 20 M12 2a15 15 0 0 0 0 20';
const PHONE_ICON = 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z';
const DOC_ICON = 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h8';
const CHART_ICON = 'M6 20V10 M12 20V4 M18 20v-6';
const DEVICE_ICON = 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z M12 18h.01';

const DATE_FIELDS = new Set(['MSISDN Activation Date', 'Postpaid Activation Date', 'Plan Activation Date']);

function formatDate(v: unknown): string {
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(v: unknown): string {
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return `${formatDate(v)} ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
}

function statusVariant(status: string) {
  if (/^active$/i.test(status)) return 'tag-green' as const;
  if (/suspend|barred/i.test(status)) return 'danger' as const;
  return 'filled-neutral' as const;
}

/**
 * The Retail Sales Agent's Assets tab: a per-line MSISDN table, then Plan & Usage, Usage Behaviour, Device / App
 * and DOI cards. Per-line fields come from the same resolver as the standard Assets topic, so a value the app
 * has no data for shows "-" in the table and is left out of the cards.
 */
export function RetailAssets({ data, services }: { data: Customer360Data; services: CustomerService[] }) {
  const mobile = services.filter((s) => s.tab === 'mobile');
  const resolverFor = (s?: CustomerService) => buildAssetsFieldResolver(s, data);
  const account = data.accounts[0];
  const creditLimit = data.creditLimits[0];
  const billLimit = creditLimit ? `QAR ${String(creditLimit.creditLimitQar ?? creditLimit.creditLimitQAR ?? '-')}` : undefined;
  // Barring is held per account (not per line); the stored status is shown as it is.
  const barring = (account as unknown as { barringStatus?: string } | undefined)?.barringStatus;

  const lineValue = (s: CustomerService, details: string): ReactNode => {
    const v = resolverFor(s)(details);
    if (v === undefined || v === null || v === '') return '-';
    return DATE_FIELDS.has(details) ? formatDate(v) : v;
  };

  const lines = mobile.map((s, i) => ({ s, n: i + 1 }));
  const primary = mobile[0];
  const r = resolverFor(primary);
  const plan = (details: string): ReactNode | undefined => {
    const v = r(details);
    return v === undefined || v === null || v === '' ? undefined : DATE_FIELDS.has(details) ? formatDate(v) : v;
  };
  const digital = data.digitalEngagement[0];
  const field = (details: string): ReactNode | undefined => {
    const v = resolverFor(undefined)(details);
    return v === undefined || v === null || v === '' ? undefined : v;
  };

  return (
    <div className="space-y-4">
      <h2 className="flex items-center gap-3 text-fg font-semibold text-[length:var(--fs-h4)] pb-3 border-b border-border-soft">
        <Icon path={ASSETS_ICON} className="w-6 h-6" />
        Assets
      </h2>

      <Card icon={PHONE_ICON} title="MSISDN Assets">
        <DataTable
          rows={lines}
          rowKey={(l) => l.s.ref}
          emptyMessage="No mobile lines on file for this customer."
          columns={[
            { key: 'n', header: '#', sortable: false },
            { key: 'msisdn', header: 'MSISDN', sortable: false, render: (l) => l.s.identifier },
            { key: 'plan', header: 'Plan Name', sortable: false, render: (l) => lineValue(l.s, 'Plan Name') },
            {
              key: 'status',
              header: 'MSISDN Status',
              sortable: false,
              render: (l) => {
                const st = lineValue(l.s, 'MSISDN Status (Active, Suspended, Barred)');
                return typeof st === 'string' && st !== '-' ? <Badge variant={statusVariant(st)}>{st}</Badge> : '-';
              },
            },
            { key: 'billLimit', header: 'Bill Limit', sortable: false, render: () => billLimit ?? '-' },
            { key: 'addon', header: 'Active Add-on', sortable: false, render: (l) => lineValue(l.s, 'Active Add-on') },
            { key: 'discount', header: 'Active Discount', sortable: false, render: (l) => lineValue(l.s, 'Active Discount') },
            { key: 'pending', header: 'Pending Discounts', sortable: false, render: (l) => lineValue(l.s, 'Pending Discounts') },
            { key: 'barring', header: 'Any Barring Flags', sortable: false, render: () => barring ?? '-' },
            { key: 'msisdnAct', header: 'MSISDN Activation Date', sortable: false, render: (l) => lineValue(l.s, 'MSISDN Activation Date') },
            { key: 'postAct', header: 'Postpaid Activation Date', sortable: false, render: (l) => lineValue(l.s, 'Postpaid Activation Date') },
            { key: 'planAct', header: 'Plan Activation Date', sortable: false, render: (l) => lineValue(l.s, 'Plan Activation Date') },
            { key: 'repeat', header: 'Repeat Call Flag', sortable: false, render: () => '-' },
          ]}
        />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <Card icon={DOC_ICON} title="Plan & Usage Details">
          <dl>
            <Row label="Plan Name" value={plan('Plan Name')} />
            <Row label="Bill Limit" value={billLimit} />
            <Row label="Active Add-on" value={plan('Active Add-on')} />
            <Row label="Active Discount" value={plan('Active Discount')} />
            <Row label="Pending Discounts" value={plan('Pending Discounts')} />
            <Row label="Existing Discounts Expiry Date" value={plan('Existing Discounts Expiry Date')} />
            <Row label="Any Barring Flags" value={barring} />
            <Row label="MSISDN Activation Date" value={plan('MSISDN Activation Date')} />
            <Row label="Postpaid Activation Date" value={plan('Postpaid Activation Date')} />
            <Row label="Plan Activation Date" value={plan('Plan Activation Date')} />
          </dl>
        </Card>

        <Card icon={CHART_ICON} title="Usage Behaviour">
          <dl>
            <Row label="Usage Behaviour" value={field('Usage Behaviour (High Data, High Roaming, High Local Call, High International Calls)')} />
            <Row label="Last Recharge Amount" value={field('Last Recharge Amount')} />
            <Row label="Last Recharge Type" value={field('Last Recharge Type')} />
            <Row label="10 Recent Usages (Data, Calls, Text, OOB)" value={field('10 Recent Usages (Data, Calls, Text, OOB)')} />
            <Row label="Current Balance (Data, Voice, Text, Primary Balance)" value={field('Current Balance (Data,Voice, Text, Primary Balance)')} />
          </dl>
        </Card>

        <div className="space-y-4 min-w-0">
          <Card icon={DEVICE_ICON} title="Device / App Information">
            <dl>
              <Row label="App Recent/Last Login (Date & Time)" value={digital?.appLastLoginAt ? formatDateTime(digital.appLastLoginAt) : undefined} />
              <Row label="App Active User" value={digital ? <Badge variant={digital.appActiveUser ? 'tag-green' : 'filled-neutral'}>{digital.appActiveUser ? 'Yes' : 'No'}</Badge> : undefined} />
              <Row label="App Digital Adoption %" value={field('App Digital Adoption %')} />
              <Row label="App Version" value={field('App Version')} />
              <Row label="Registered Email ID" value={data.customer.email} />
            </dl>
          </Card>
          <Card icon={DEVICE_ICON} title="Existing DOI View">
            <dl>
              <Row label="DOI Handset Type" value={field('DOI Handset Type')} />
              <Row label="DOI Price" value={field('DOI Price')} />
              <Row label="DOI Remaining Amount" value={field('DOI Remaining Amount')} />
              <Row label="DOI Tenure" value={field('DOI Tennure')} />
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
