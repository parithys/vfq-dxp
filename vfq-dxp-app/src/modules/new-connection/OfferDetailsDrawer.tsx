import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '../../components/primitives/Button';
import { Drawer } from '../../components/primitives/Drawer';
import { Icon } from '../../components/primitives/Icon';
import { useNotificationStore } from '../../stores/notificationStore';

// The "View details" drawer on a Recommended-offers card (2026-10-04 design: Recommended-offers-02).
// Every value shown comes from the offer / its linked plans; nothing here is typed in per offer.

/** The offer fields the drawer reads - structural, so the step's own Offer type satisfies it. */
export interface OfferDetails {
  offerName: string;
  offerDescription: string;
  monthlyRental: number;
  campaignCode: string;
  status: string;
  offerType?: string;
  priorityCode?: string;
  treatmentCode?: string;
  channel?: string;
  promotionId?: string;
  addOnMonthly?: number;
}

const ICONS = {
  close: 'M6 6l12 12 M18 6L6 18',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  right: 'M9 18l6-6-6-6',
  gift: 'M20 12v9H4v-9 M2 7h20v5H2z M12 21V7 M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7z M12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z',
  house: 'M3 11l9-8 9 8 M5 10v10h14V10 M10 20v-6h4v6',
  phone: 'M8 2h8a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z M11 18h2',
  service: 'M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M9 8h6 M9 12h6 M9 16h4',
  tag: 'M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z M7.5 7.5h.01',
  card: 'M3 6h18v12H3z M3 10h18 M6 15h4',
  megaphone: 'M3 11v3a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z M15 9a4 4 0 0 1 0 6 M18 6a8 8 0 0 1 0 12',
  sparkles: 'M12 3v4 M12 17v4 M3 12h4 M17 12h4 M6 6l2.5 2.5 M15.5 15.5L18 18 M6 18l2.5-2.5 M15.5 8.5L18 6',
  bars: 'M4 20v-6 M10 20V4 M16 20V10 M22 20H2',
  share:
    'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M8.6 13.5l6.8 4 M15.4 6.5l-6.8 4',
  status: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M8.4 12.3l2.4 2.4 4.8-5.2',
  cube: 'M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z M12 12l8-4.5 M12 12v9 M12 12L4 7.5',
  doc: 'M7 3h8l4 4v14H7z M15 3v4h4 M9 13h6 M9 17h6',
  external: 'M14 4h6v6 M20 4l-9 9 M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
};

const PANEL = 'rounded-[var(--radius-card)] border border-border-soft bg-bg';

/** A titled, collapsible block. The chevron points the way the block will move: up while open. */
function Section({ title, defaultOpen = true, chevronWhenOpen = 'up', children }: { title: string; defaultOpen?: boolean; chevronWhenOpen?: 'up' | 'down'; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  const openIcon = chevronWhenOpen === 'up' ? ICONS.up : ICONS.down;
  const closedIcon = chevronWhenOpen === 'up' ? ICONS.down : ICONS.up;
  return (
    <section className="space-y-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-[var(--radius-button)] text-left focus:outline-none focus-visible:shadow-[var(--focus-ring)]"
      >
        <h3 className="text-fg font-bold text-[length:var(--fs-h5)]">{title}</h3>
        <Icon path={open ? openIcon : closedIcon} className="w-5 h-5 text-fg" />
      </button>
      {open && children}
    </section>
  );
}

function IconDisc({ path, className = '' }: { path: string; className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full ${className}`}>
      <Icon path={path} className="w-5 h-5" />
    </span>
  );
}

export function OfferDetailsDrawer({
  offer,
  serviceLabel,
  fixedService,
  highlight,
  includedNames,
  selected,
  onSelect,
  onClose,
}: {
  /** The offer whose details are open; null keeps the drawer closed. */
  offer: OfferDetails | null;
  serviceLabel: string;
  /** True for the home services (fixed line, FWA): they get the house artwork, the rest the handset. */
  fixedService: boolean;
  /** One line of what the linked plan includes, read from its product record; null hides the banner. */
  highlight: { title: string; subtitle: string } | null;
  includedNames: string[];
  selected: boolean;
  /** Selects this offer (a no-op to the caller if it already is). The drawer closes after. */
  onSelect: () => void;
  onClose: () => void;
}) {
  const pushToast = useNotificationStore((s) => s.pushToast);
  // Keep the last offer rendered while the drawer slides out, so its content does not vanish mid-animation.
  const [shown, setShown] = useState<OfferDetails | null>(offer);
  if (offer && offer !== shown) setShown(offer);
  const o = offer ?? shown;

  const rows: { icon: string; label: string; value?: string; pill?: boolean }[] = o
    ? [
        { icon: ICONS.service, label: 'Service', value: serviceLabel },
        { icon: ICONS.tag, label: 'Offer type', value: o.offerType },
        { icon: ICONS.card, label: 'Monthly rental', value: `QR ${o.monthlyRental}${serviceLabel.includes('Prepaid') ? '' : '/mo'}` },
        { icon: ICONS.card, label: 'Add-on (monthly)', value: o.addOnMonthly ? `QR ${o.addOnMonthly}/mo` : undefined },
        { icon: ICONS.service, label: 'Campaign code', value: o.campaignCode },
        { icon: ICONS.megaphone, label: 'Promotion', value: o.promotionId },
        { icon: ICONS.sparkles, label: 'Treatment', value: o.treatmentCode },
        { icon: ICONS.bars, label: 'Priority', value: o.priorityCode },
        { icon: ICONS.share, label: 'Channel', value: o.channel },
        { icon: ICONS.status, label: 'Status', value: o.status, pill: true },
      ].filter((r) => r.value)
    : [];

  const header = (
    <div className="flex items-center justify-between px-6 pt-5 pb-3 shrink-0">
      <span className="text-muted text-[length:var(--fs-caption)] uppercase tracking-wide">Offer details</span>
      <button type="button" onClick={onClose} aria-label="Close" className="text-fg hover:text-accent rounded-[var(--radius-button)] focus:outline-none focus-visible:shadow-[var(--focus-ring)]">
        <Icon path={ICONS.close} className="w-6 h-6" />
      </button>
    </div>
  );

  const footer = (
    <div className="grid w-full grid-cols-2 gap-4">
      <Button variant="ghost-rect" onClick={onClose} className="w-full justify-center">
        Close
      </Button>
      <Button
        variant="primary-rect"
        className="w-full justify-center"
        onClick={() => {
          if (!selected) onSelect();
          onClose();
        }}
      >
        {selected ? 'Selected' : 'Select this offer'}
        {!selected && <Icon path={ICONS.right} className="w-4 h-4" />}
      </Button>
    </div>
  );

  return (
    <Drawer
      open={offer !== null}
      onClose={onClose}
      title={o?.offerName ?? 'Offer details'}
      header={header}
      footer={footer}
      widthClassName="w-[30vw] min-w-[420px]"
      bodyClassName="px-6 pb-6 pt-2"
    >
      {o && (
        <div className="space-y-6">
          {/* Offer summary */}
          <div className="flex items-start gap-4">
            <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[var(--radius-card)] bg-surface-warm">
              <IconDisc path={fixedService ? ICONS.house : ICONS.phone} className="h-16 w-16 bg-bg text-accent" />
            </span>
            <div className="min-w-0 space-y-2">
              <h2 className="text-fg font-bold text-[length:var(--fs-h4)] leading-tight">{o.offerName}</h2>
              <p className="text-fg-2 text-[length:var(--fs-body)]">{o.offerDescription}</p>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-[var(--radius-pill)] bg-surface-warm text-accent px-3 py-1 text-[length:var(--fs-caption)] font-medium">{o.status}</span>
                {o.offerType && <span className="rounded-[var(--radius-pill)] bg-surface text-fg-2 px-3 py-1 text-[length:var(--fs-caption)] font-medium">{o.offerType}</span>}
              </div>
            </div>
          </div>

          {/* What the plan includes */}
          {highlight && (
            <div className="relative overflow-hidden rounded-[var(--radius-card)] bg-surface-warm px-5 py-4 flex items-center gap-4">
              <Icon path={ICONS.gift} className="w-9 h-9 shrink-0 text-accent" />
              <div className="min-w-0 pr-16">
                <p className="text-fg font-bold text-[length:var(--fs-body)]">{highlight.title}</p>
                <p className="text-fg-2 text-[length:var(--fs-caption)]">{highlight.subtitle}</p>
              </div>
              <svg viewBox="0 0 120 80" className="absolute right-0 top-0 h-full w-28" aria-hidden="true" preserveAspectRatio="xMaxYMid slice">
                <circle cx="95" cy="40" r="46" fill="var(--accent)" fillOpacity="0.12" />
                <circle cx="120" cy="40" r="32" fill="var(--accent)" fillOpacity="0.45" />
              </svg>
            </div>
          )}

          <Section title="Offer information">
            <dl className={`${PANEL} px-4`}>
              {rows.map((r, i) => (
                <div key={r.label} className="flex items-center gap-4">
                  <IconDisc path={r.icon} className="h-10 w-10 bg-surface text-fg-2" />
                  <div className={`flex flex-1 items-center justify-between gap-4 py-4 ${i > 0 ? 'border-t border-border-soft' : ''}`}>
                    <dt className="text-fg-2 text-[length:var(--fs-body)]">{r.label}</dt>
                    <dd className="text-right">
                      {r.pill ? (
                        <span className="rounded-[var(--radius-pill)] bg-[color-mix(in_oklab,var(--success),var(--bg)_88%)] text-success px-3 py-1 text-[length:var(--fs-caption)] font-medium">{r.value}</span>
                      ) : (
                        <span className="text-fg text-[length:var(--fs-body)]">{r.value}</span>
                      )}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>
          </Section>

          {includedNames.length > 0 && (
            <Section title="Included plans and add-ons">
              <div className={`${PANEL} p-4 flex items-start gap-4`}>
                <IconDisc path={ICONS.cube} className="h-14 w-14 bg-surface-warm text-accent" />
                <div className="space-y-2 pt-1">
                  <p className="text-fg-2 text-[length:var(--fs-body)]">
                    {includedNames.length} item{includedNames.length === 1 ? '' : 's'} included
                  </p>
                  <ul className="space-y-1">
                    {includedNames.map((n) => (
                      <li key={n} className="flex items-center gap-3 text-fg text-[length:var(--fs-body)]">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                        {n}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Section>
          )}

          <Section title="Need more information?" chevronWhenOpen="down">
            <div className={`${PANEL} p-4 flex items-center gap-4`}>
              <IconDisc path={ICONS.doc} className="h-14 w-14 bg-surface text-fg-2" />
              <div className="flex-1">
                <p className="text-fg font-medium text-[length:var(--fs-body)]">Related documents</p>
                <p className="text-fg-2 text-[length:var(--fs-caption)]">Terms, conditions and more</p>
              </div>
              {/* No offer documents exist in the app yet, so this says so instead of going nowhere. */}
              <button
                type="button"
                onClick={() =>
                  pushToast('info', 'No documents are attached to this offer yet', { key: 'offer-documents' })
                }
                className="inline-flex items-center gap-2 rounded-[var(--radius-button)] text-accent font-medium text-[length:var(--fs-body)] hover:underline focus:outline-none focus-visible:shadow-[var(--focus-ring)]"
              >
                View documents
                <Icon path={ICONS.external} className="w-4 h-4" />
              </button>
            </div>
          </Section>
        </div>
      )}
    </Drawer>
  );
}
