import { DataTable } from '../../../components/primitives/DataTable';
import type { Customer360Data } from '../../../engines/customer360Engine';

/** Customer 360's "Account/Contact Lead" tab, over data.leads (leads.json,
 * joined by mobile number against this customer's phone). */
export function AccountContactLeadSection({ data }: { data: Customer360Data }) {
  return (
    <DataTable
      rows={data.leads}
      rowKey={(r) => String(r.leadId)}
      emptyMessage="No leads on file for this customer's mobile number."
      columns={[
        { key: 'leadId', header: 'Lead #' },
        { key: 'serviceNeeded', header: 'Lead Type' },
        { key: 'mobileNumber', header: 'MSISDN' },
        { key: 'ownerId', header: 'Created By' },
        { key: 'status', header: 'Lead Status' },
      ]}
    />
  );
}
