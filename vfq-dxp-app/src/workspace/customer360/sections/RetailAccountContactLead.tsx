import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Badge } from '../../../components/primitives/Badge';
import { Button } from '../../../components/primitives/Button';
import { Icon } from '../../../components/primitives/Icon';
import type { Customer360Data } from '../../../engines/customer360Engine';
import { leadResolvers } from './leadResolvers';

const GROUP_ICON = 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75';
const DOC_ICON = 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h8';
const PLUS_ICON = 'M12 5v14 M5 12h14';
const INFO_ICON = 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 16v-4 M12 8h.01';

// The app's existing lead-creation entry (the dashboard's "Start a Lead" quick action).
const CREATE_LEAD_ROUTE = '/sales';

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-border-soft last:border-0 text-[length:var(--fs-body)]">
      <dt className="text-fg-2">{label}</dt>
      <dd className="text-fg font-medium text-right min-w-0 break-words">{value}</dd>
    </div>
  );
}

/**
 * The Retail Sales Agent's Account/Contact Lead tab: the lead on file for this customer, and Create Lead. The
 * lead join is by mobile number and matches few customers, so with no lead on file every field shows "-".
 */
export function RetailAccountContactLead({ data }: { data: Customer360Data }) {
  const navigate = useNavigate();
  const f = (key: string) => {
    const v = leadResolvers[key]?.(data);
    return v === undefined || v === null || v === '' ? '-' : (v as ReactNode);
  };
  const status = leadResolvers['Lead Status']?.(data) as string | undefined;

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <span className="w-11 h-11 rounded-full bg-[var(--surface-warm)] text-accent flex items-center justify-center shrink-0">
            <Icon path={GROUP_ICON} className="w-6 h-6" />
          </span>
          <div>
            <h2 className="text-fg font-semibold text-[length:var(--fs-h4)] leading-tight">Account Contact Lead</h2>
            <p className="text-fg-2 text-[length:var(--fs-body)]">View and manage lead information associated with this account or contact.</p>
          </div>
        </div>
        <Button variant="primary-rect" onClick={() => navigate(CREATE_LEAD_ROUTE)}>
          <Icon path={PLUS_ICON} className="w-4 h-4" />
          Create Lead
        </Button>
      </div>

      <section className="rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg">
        <h3 className="flex items-center gap-3 text-fg font-semibold text-[length:var(--fs-body-lg)] px-5 py-4 border-b border-border-soft">
          <Icon path={DOC_ICON} className="w-5 h-5" />
          Lead Details
        </h3>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-10 px-5">
          <div>
            <Field label="Lead Type" value={f('Lead Type')} />
            <Field label="MSISDN" value={f('MSISDN')} />
            <Field label="Created By" value={f('Created By')} />
          </div>
          <div className="md:border-l md:border-border-soft md:pl-10">
            <Field label="Comments" value={f('Comments')} />
            <Field label="Lead Status" value={status ? <Badge variant={/^(open|new)$/i.test(status) ? 'info' : 'filled-neutral'}>{status}</Badge> : '-'} />
          </div>
        </dl>
      </section>

      <div className="rounded-[var(--radius-card)] bg-[color-mix(in_oklab,var(--info),var(--bg)_92%)] text-fg p-4 flex items-center gap-3 text-[length:var(--fs-body)]">
        <Icon path={INFO_ICON} className="w-6 h-6 text-[var(--info)] shrink-0" />
        Lead information helps track sales opportunities related to this account or contact.
      </div>
    </div>
  );
}
