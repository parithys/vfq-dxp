import { Badge } from '../../../components/primitives/Badge';
import { Icon } from '../../../components/primitives/Icon';
import { Card, Row } from './retailCards';

const GAVEL_ICON = 'M14 13l-8.5 8.5a2.12 2.12 0 0 1-3-3L11 10 M16 16l6-6 M8 8l6-6 M9 7l8 8 M21 11l-8-8';
const STAR_ICON = 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z';
const DEVICE_ICON = 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z M12 18h.01';
const INFO_ICON = 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 16v-4 M12 8h.01';

/**
 * One penalty category's rows. The app holds no per-customer Star Number or Device penalty record (its
 * commitment-penalties data covers disconnection / port-out / upgrade penalties, a different category), so every
 * row reads "N/A" or "-" rather than borrowing a figure from another category.
 */
function PenaltyCard({ icon, title }: { icon: string; title: string }) {
  return (
    <Card icon={icon} title={title}>
      <dl>
        <Row label="Penalty Status" value={<Badge variant="filled-neutral">N/A</Badge>} end />
        <Row label="Details" value="-" end />
        <Row label="Penalty Amount" value="-" end />
        <Row label="Applied Date" value="-" end />
        <Row label="Expiry Date" value="-" end />
        <Row label="Remarks" value="-" end />
      </dl>
    </Card>
  );
}

/** The Retail Sales Agent's Penalty View tab: Star number Penalty and Device Penalty (Fiber & 5G). */
export function RetailPenaltyView() {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg p-5 space-y-4">
      <div className="flex items-center gap-4">
        <span className="w-11 h-11 rounded-full bg-[var(--surface-warm)] text-accent flex items-center justify-center shrink-0">
          <Icon path={GAVEL_ICON} className="w-6 h-6" />
        </span>
        <div>
          <h2 className="text-fg font-semibold text-[length:var(--fs-h4)] leading-tight">Penalty View</h2>
          <p className="text-fg-2 text-[length:var(--fs-body)]">View penalty information associated with this customer.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <PenaltyCard icon={STAR_ICON} title="Star number Penalty" />
        <PenaltyCard icon={DEVICE_ICON} title="Device Penalty (Fiber & 5G)" />
      </div>

      <div className="rounded-[var(--radius-card)] bg-[color-mix(in_oklab,var(--info),var(--bg)_92%)] text-fg p-4 flex items-center gap-3 text-[length:var(--fs-body)]">
        <Icon path={INFO_ICON} className="w-6 h-6 text-[var(--info)] shrink-0" />
        Penalty information is sourced from available systems.
      </div>
    </div>
  );
}
