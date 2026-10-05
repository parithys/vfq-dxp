import { useState } from 'react';
import type { ReactNode } from 'react';
import { Badge } from '../../../components/primitives/Badge';
import { Button } from '../../../components/primitives/Button';
import { Icon } from '../../../components/primitives/Icon';
import type { Customer360Data } from '../../../engines/customer360Engine';
import { AddressEditDrawer, type AddressRecord } from './AddressSection';
import { Row } from './retailCards';

const PIN_ICON = 'M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z';
const HOME_ICON = 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10';
const BUILDING_ICON = 'M6 2h12a1 1 0 0 1 1 1v19H5V3a1 1 0 0 1 1-1z M9 6h2 M13 6h2 M9 10h2 M13 10h2 M9 14h2 M13 14h2 M10 22v-4h4v4';
const EDIT_ICON = 'M12 20h9 M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z';
const INFO_ICON = 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 16v-4 M12 8h.01';

function AddressCard({ icon, title, badge, address }: { icon: string; title: string; badge?: ReactNode; address: AddressRecord }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg min-w-0">
      <h3 className="flex items-center gap-3 text-fg font-semibold text-[length:var(--fs-body-lg)] px-4 py-3 border-b border-border-soft">
        <Icon path={icon} className="w-5 h-5 shrink-0" />
        {title}
        {badge}
      </h3>
      <dl className="px-4">
        <Row label="Zone" value={address.zone ? `Zone ${address.zone}` : undefined} end />
        <Row label="Street" value={address.streetNo ? `Street ${address.streetNo}` : undefined} end />
        <Row label="Building" value={address.buildingNo ? `Building ${address.buildingNo}` : undefined} end />
      </dl>
    </section>
  );
}

/**
 * The Retail Sales Agent's Account Address tab: the National Address and Open UI Address cards for the primary
 * address, and an Edit button that opens the existing address editor (verification-gated, raising a change
 * ticket). Both cards read the same address record in this corpus, as the standard topic does.
 */
export function RetailAccountAddress({
  data,
  canEdit,
  requireVerification,
  onTicketCreated,
}: {
  data: Customer360Data;
  canEdit: boolean;
  requireVerification: (action: () => void) => void;
  onTicketCreated: (ticket: Record<string, unknown>) => void;
}) {
  const [addresses, setAddresses] = useState<AddressRecord[]>(() => data.addresses as unknown as AddressRecord[]);
  const [editing, setEditing] = useState<AddressRecord | null>(null);
  const address = addresses.find((a) => a.primaryStatus === 'Primary') ?? addresses[0];

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <span className="w-11 h-11 rounded-full bg-[var(--surface-warm)] text-accent flex items-center justify-center shrink-0">
            <Icon path={PIN_ICON} className="w-6 h-6" />
          </span>
          <div>
            <h2 className="text-fg font-semibold text-[length:var(--fs-h4)] leading-tight">Account Address</h2>
            <p className="text-fg-2 text-[length:var(--fs-body)]">View and manage address information for the customer.</p>
          </div>
        </div>
        {address && canEdit && (
          <Button variant="secondary-rect" compact onClick={() => requireVerification(() => setEditing(address))}>
            <Icon path={EDIT_ICON} className="w-4 h-4" />
            Edit
          </Button>
        )}
      </div>

      {address ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <AddressCard icon={HOME_ICON} title="National Address" badge={address.primaryStatus === 'Primary' ? <Badge variant="tag-red">Primary</Badge> : undefined} address={address} />
          <AddressCard icon={BUILDING_ICON} title="Open UI Address" address={address} />
        </div>
      ) : (
        <p className="text-fg-2 text-[length:var(--fs-body)]">No addresses on file for this customer.</p>
      )}

      <div className="flex items-center justify-end gap-2 text-muted text-[length:var(--fs-caption)]">
        <Icon path={INFO_ICON} className="w-4 h-4" />
        Data as per available systems
      </div>

      {editing && (
        <AddressEditDrawer
          address={editing}
          customerId={data.customer.customerId}
          readOnly={!canEdit}
          onClose={() => setEditing(null)}
          onSaved={(patch) => setAddresses((prev) => prev.map((a) => (a.id === editing.id ? { ...a, ...patch } : a)))}
          onTicketCreated={onTicketCreated}
        />
      )}
    </div>
  );
}
