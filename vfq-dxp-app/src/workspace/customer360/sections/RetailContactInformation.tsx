import type { ReactNode } from 'react';
import { Badge } from '../../../components/primitives/Badge';
import { Button } from '../../../components/primitives/Button';
import { DataTable } from '../../../components/primitives/DataTable';
import { Icon } from '../../../components/primitives/Icon';
import type { Customer360Data } from '../../../engines/customer360Engine';
import type { CustomerService } from '../../../engines/customerServicesEngine';
import { contactInformationResolvers } from './contactInformationResolvers';
import { Card, Row, ViewToggle } from './retailCards';

const PERSON_ICON = 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z';
const PHONE_ICON = 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z';
const GROUP_ICON = 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75';
const EDIT_ICON = 'M12 20h9 M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z';
const INFO_ICON = 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 16v-4 M12 8h.01';

function formatDate(v: unknown): string | undefined {
  if (!v) return undefined;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * The Retail Sales Agent's Contact Information tab: personal information, contact details and authorised
 * persons, read through the same resolvers as the standard Contact Information topic. A row with no data on
 * file is left out; Edit appears only for roles allowed to edit customer records.
 */
export function RetailContactInformation({ data, services, onEdit }: { data: Customer360Data; services: CustomerService[]; onEdit?: () => void }) {
  const ctx = { data, services };
  const f = (key: string): ReactNode | undefined => contactInformationResolvers[key]?.(ctx) as ReactNode | undefined;
  const tenure = (data.overviewDemo[0]?.contactMeta as { tenure?: string } | undefined)?.tenure || undefined;
  const blacklisted = Boolean(data.customer.blacklisted);
  const qcb = f('QCB Check');
  const authorised = data.authorisedContacts.length;

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <span className="w-11 h-11 rounded-full bg-[var(--surface-warm)] text-accent flex items-center justify-center shrink-0">
            <Icon path={PERSON_ICON} className="w-6 h-6" />
          </span>
          <div>
            <h2 className="text-fg font-semibold text-[length:var(--fs-h4)] leading-tight">Contact Information</h2>
            <p className="text-fg-2 text-[length:var(--fs-body)]">View and manage contact details for the customer.</p>
          </div>
        </div>
        {onEdit && (
          <Button variant="secondary-rect" compact onClick={onEdit}>
            <Icon path={EDIT_ICON} className="w-4 h-4" />
            Edit
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Card icon={PERSON_ICON} title="Personal Information">
          <dl>
            <Row label="Full Name" value={f('First Name & Last Name (Full Name)')} end />
            <Row label="ID Number" value={f('ID Number')} end />
            <Row label="ID Status" value={<Badge variant={blacklisted ? 'danger' : 'tag-green'}>{blacklisted ? 'Blacklisted' : 'Whitelisted'}</Badge>} end />
            <Row label="Preferred Language" value={f('Preferred Language')} end />
            <Row label="Tenure" value={tenure} end />
            <Row label="Date of Birth" value={formatDate(data.contacts[0]?.dob ?? data.customer.dob)} end />
          </dl>
        </Card>

        <Card icon={PHONE_ICON} title="Contact Details">
          <dl>
            <Row label="Email" value={f('Email')} end />
            <Row label="Notification MSISDN" value={f('Notification MSISDN')} end />
            <Row label="QCB Check" value={qcb ? <Badge variant={/clear|passed/i.test(String(qcb)) ? 'tag-green' : 'filled-neutral'}>{qcb}</Badge> : undefined} end />
            <Row label="Total Number of Connections" value={f('Total Number of Connections')} end />
          </dl>
        </Card>

        <Card icon={GROUP_ICON} title="Authorised Person(s)">
          <dl>
            {authorised > 0 ? (
              <ViewToggle label={`Authorized person(s) (${authorised})`}>
                <DataTable
                  rows={data.authorisedContacts}
                  rowKey={(r) => String(r.authorisedPersonId)}
                  columns={[
                    { key: 'name', header: 'Name' },
                    { key: 'jobTitle', header: 'Job Title' },
                    { key: 'email', header: 'Email' },
                    { key: 'roles', header: 'Roles', render: (r) => (Array.isArray(r.roles) ? r.roles.join(', ') : '-') },
                  ]}
                />
              </ViewToggle>
            ) : (
              <Row label="Authorized person(s)" value={0} end />
            )}
            <Row label="Authorized Role" value={f('Authorized Role')} end />
            <Row label="Authorized Mobile" value={f('Authorized Mobile')} end />
            <Row label="Authorized email" value={f('Authorized email')} end />
          </dl>
        </Card>
      </div>

      <div className="flex items-center justify-end gap-2 text-muted text-[length:var(--fs-caption)]">
        <Icon path={INFO_ICON} className="w-4 h-4" />
        Data as per available systems
      </div>
    </div>
  );
}
