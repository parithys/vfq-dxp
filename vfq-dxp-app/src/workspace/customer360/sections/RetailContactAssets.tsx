import { useState } from 'react';
import type { ReactNode } from 'react';
import { Badge } from '../../../components/primitives/Badge';
import { DataTable } from '../../../components/primitives/DataTable';
import { Icon } from '../../../components/primitives/Icon';
import type { Customer360Data } from '../../../engines/customer360Engine';
import { contactAssetsResolvers } from './contactAssetsResolvers';

const GROUP_ICON = 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75';
const TARGET_ICON = 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z';
const TAG_ICON = 'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z M7 7h.01';
const STAR_ICON = 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z';
const DOC_ICON = 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h8';
const HOME_ICON = 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10';
const CHEVRON = 'M9 18l6-6-6-6';
const INFO_ICON = 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 16v-4 M12 8h.01';

const OFFER_COLUMNS = [
  { key: 'offerName', header: 'Offer', sortable: false },
  { key: 'offerType', header: 'Type', sortable: false },
  { key: 'priorityCode', header: 'Priority', sortable: false },
  { key: 'addOnMonthly', header: 'Add-on / month (QAR)', sortable: false },
  { key: 'status', header: 'Status', sortable: false },
];

/** A card with a status row and a "Details" row that opens the supporting records under it. */
function OfferCard({ icon, title, label, status, detailLabel, details }: { icon: string; title: string; label: string; status: ReactNode | undefined; detailLabel: string; details?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg min-w-0">
      <h3 className="flex items-center gap-3 text-fg font-semibold text-[length:var(--fs-body-lg)] px-4 py-3 border-b border-border-soft">
        <Icon path={icon} className="w-5 h-5 shrink-0" />
        {title}
      </h3>
      <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-border-soft text-[length:var(--fs-body)]">
        <span className="text-fg-2">{label}</span>
        <span className="text-fg font-medium">{status ?? '-'}</span>
      </div>
      {details ? (
        <>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="w-full flex items-center justify-between gap-4 px-4 py-3 text-[length:var(--fs-body)] hover:bg-surface"
          >
            <span className="text-fg-2">Details</span>
            <span className="inline-flex items-center gap-3 text-fg">
              {detailLabel}
              <Icon path={CHEVRON} className={`w-4 h-4 transition-transform ${open ? 'rotate-90' : ''}`} />
            </span>
          </button>
          {open && <div className="px-4 pb-4">{details}</div>}
        </>
      ) : (
        <div className="flex items-center justify-between gap-4 px-4 py-3 text-[length:var(--fs-body)]">
          <span className="text-fg-2">Details</span>
          <span className="text-muted">No details on file</span>
        </div>
      )}
    </section>
  );
}

/**
 * The Retail Sales Agent's Contact/Assets Information tab: five offer / eligibility cards. Values come from the
 * same resolvers as the standard topic. This corpus's cross-sales offers don't join to most customers, so a card
 * with nothing on file says so instead of showing a default.
 */
export function RetailContactAssets({ data }: { data: Customer360Data }) {
  const f = (key: string) => contactAssetsResolvers[key]?.(data) as string | undefined;
  const offers = data.crossSalesOffers;
  const discountOffers = offers.filter((o) => Number(o.addOnMonthly ?? 0) > 0);
  const nextBest = [...offers].sort((a, b) => String(a.priorityCode ?? '').localeCompare(String(b.priorityCode ?? '')))[0];
  const fixedName = f('Fixed Line Offer');
  const fixedOffers = offers.filter((o) => /fixed|cross sell/i.test(String(o.offerType)));
  const doi = data.deviceInstallments[0];
  const doiStatus = f('DOI Eligibility');
  const table = (rows: Record<string, unknown>[]) => (
    <DataTable rows={rows} rowKey={(r) => String(r.offerId)} columns={OFFER_COLUMNS} />
  );

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg p-5 space-y-4">
      <div className="flex items-center gap-4">
        <span className="w-11 h-11 rounded-full bg-[var(--surface-warm)] text-accent flex items-center justify-center shrink-0">
          <Icon path={GROUP_ICON} className="w-6 h-6" />
        </span>
        <div>
          <h2 className="text-fg font-semibold text-[length:var(--fs-h4)] leading-tight">Contact/Assets Information</h2>
          <p className="text-fg-2 text-[length:var(--fs-body)]">Offers, eligibility and other contact/asset related information.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="space-y-4 min-w-0">
          <OfferCard
            icon={TARGET_ICON}
            title="CVM / Targeted Offers"
            label="CVM / Targeted offers"
            status={offers.length > 0 ? <Badge variant="tag-green">Available</Badge> : undefined}
            detailLabel="View applicable offers"
            details={offers.length > 0 ? table(offers) : undefined}
          />
          <OfferCard
            icon={STAR_ICON}
            title="Next Best Offer"
            label="Next Best Offer"
            status={f('Next Best Offer')}
            detailLabel="View offer details"
            details={nextBest ? table([nextBest]) : undefined}
          />
          <OfferCard
            icon={HOME_ICON}
            title="Fixed Line Offer"
            label="Fixed Line Offer"
            status={fixedName}
            detailLabel="View offer details"
            details={fixedOffers.length > 0 ? table(fixedOffers) : undefined}
          />
        </div>
        <div className="space-y-4 min-w-0">
          <OfferCard
            icon={TAG_ICON}
            title="Eligible Discount"
            label="Eligible Discount"
            status={discountOffers.length > 0 ? <Badge variant="tag-green">Eligible</Badge> : undefined}
            detailLabel="View eligible discounts"
            details={discountOffers.length > 0 ? table(discountOffers) : undefined}
          />
          <OfferCard
            icon={DOC_ICON}
            title="DOI Eligibility"
            label="DOI Eligibility"
            status={doiStatus ? <Badge variant={/^eligible$/i.test(doiStatus) ? 'tag-green' : 'filled-neutral'}>{doiStatus}</Badge> : undefined}
            detailLabel="View eligibility details"
            details={
              doi ? (
                <DataTable
                  rows={[doi]}
                  rowKey={(r) => String(r.id)}
                  columns={[
                    { key: 'deviceName', header: 'Device', sortable: false },
                    { key: 'eligibilityListMembership', header: 'Eligibility', sortable: false },
                    { key: 'qcbCreditCheckStatus', header: 'QCB Check', sortable: false },
                    { key: 'accountStanding', header: 'Account Standing', sortable: false },
                  ]}
                />
              ) : undefined
            }
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 text-muted text-[length:var(--fs-caption)]">
        <Icon path={INFO_ICON} className="w-4 h-4" />
        Data as per available systems
      </div>
    </div>
  );
}
