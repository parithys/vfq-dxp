import { Link, useNavigate } from 'react-router-dom';
import { getAllRoutes } from '../../engines/configEngine';
import { useCustomerContext } from '../../stores/customerContextStore';
import { Icon } from '../../components/primitives/Icon';
import { Badge } from '../../components/primitives/Badge';
import { Button } from '../../components/primitives/Button';
import type { ZoneSize } from './dashboardLayout';

const ICONS = {
  ticket: 'M4 9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1.5a1.5 1.5 0 0 0 0 3V15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1.5a1.5 1.5 0 0 0 0-3V9z',
  checkCircle: 'M21 11.5a9 9 0 1 1-5.3-8.2 M21 4.5l-9 9-3-3',
  users: 'M8 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M2.5 20c.6-3.4 3-5.5 5.5-5.5s4.9 2.1 5.5 5.5 M16.5 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M15.5 13.2c2.2.5 3.9 2.3 4.3 4.8',
  simCard: 'M8 3h8l4 4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M9 12h6 M9 16h6',
  refresh: 'M3 12a9 9 0 0 1 15.3-6.4L21 8 M21 3v5h-5 M21 12a9 9 0 0 1-15.3 6.4L3 16 M3 21v-5h5',
  openArrow: 'M7 17L17 7 M7 7h10v10',
  mobile: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M11 18h2',
  wifi: 'M5 12.5a9 9 0 0 1 14 0 M8 16a5 5 0 0 1 8 0 M12 19.5h.01',
  chart: 'M4 20V10 M10 20V4 M16 20v-7 M22 20H2',
  tag: 'M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2a2 2 0 0 1-.6-1.4V4a1 1 0 0 1 1-1h8a2 2 0 0 1 1.4.6l7.4 7.4a2 2 0 0 1 0 2.8z M7.5 7.5h.01',
  alert: 'M12 3l9.5 17H2.5z M12 9v5 M12 17h.01',
  users2: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1 M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
};

export interface ZoneTile {
  key: string;
  label: string;
  count: number;
  /** Absent for a read-only zone, so the tile renders inert. */
  to?: string;
  loadingKind?: string;
}

export interface ZoneCard {
  label: string;
  sub: string;
  value: string | number;
  icon: string;
  loadingKind?: string;
}

export interface ZoneAction {
  label: string;
  screenId?: string;
  path?: string;
}

export interface ZoneSpec {
  heading: string;
  headingIcon: string;
  tiles: ZoneTile[];
  cards: ZoneCard[];
  actions: ZoneAction[];
  /** Rendered under the cards - recently viewed customers, or recently
   * updated catalogue items. */
  listTitle?: string;
  listEmpty?: string;
  listItems?: { id: string; primary: string; secondary: string; to?: string; badge?: string }[];
}

export const ZONE_ICONS = ICONS;

/** Grid density follows the zone's size, so the same zone definition serves a
 * full-width Customer-First dashboard and a half-width Hybrid column. */
function gridCols(size: ZoneSize, full: string, half: string) {
  return size === 'half' ? half : full;
}

export function DashboardZone({
  spec,
  size,
  readOnly,
  loading,
  errors,
}: {
  spec: ZoneSpec;
  size: ZoneSize;
  readOnly: boolean;
  loading: Record<string, boolean>;
  errors: Record<string, string | undefined>;
}) {
  const navigate = useNavigate();
  const clearActiveCustomer = useCustomerContext((s) => s.clearActiveCustomer);

  // A collapsed zone still renders its heading so the Focus control's effect is
  // legible - you can see what you de-emphasised rather than it vanishing.
  if (size === 'collapsed') {
    return (
      <section className="rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg px-5 py-4">
        <div className="flex items-center gap-2.5 text-fg-2">
          <Icon path={spec.headingIcon} className="w-4.5 h-4.5 text-accent shrink-0" />
          <span className="font-medium text-[length:var(--fs-body)]">{spec.heading}</span>
          <span className="text-muted text-[length:var(--fs-caption)] ml-auto">
            {spec.tiles.length + spec.cards.length} metrics hidden by Focus
          </span>
        </div>
      </section>
    );
  }

  const launch = (action: ZoneAction) => {
    if (action.path) {
      navigate(action.path);
      return;
    }
    const route = action.screenId ? getAllRoutes().find((r) => r.screenId === action.screenId) : undefined;
    if (!route) return;
    clearActiveCustomer();
    navigate(route.path);
  };

  const value = (v: string | number, kind?: string) => {
    if (kind && loading[kind]) return '-';
    if (kind && errors[kind]) {
      return (
        <span className="text-danger text-[length:var(--fs-body)]" title={errors[kind]}>
          Failed to load
        </span>
      );
    }
    return v;
  };

  return (
    <section className="min-w-0">
      <h2 className="flex items-center gap-2.5 text-[length:var(--fs-body-lg)] font-medium text-fg mb-3">
        <Icon path={spec.headingIcon} className="w-4.5 h-4.5 text-accent shrink-0" />
        {spec.heading}
      </h2>

      {spec.tiles.length > 0 && (
        <div className={`grid gap-4 mb-6 ${gridCols(size, 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5', 'grid-cols-3')}`}>
          {spec.tiles.map((tile) => {
            const body = (
              <>
                <div className="text-[length:var(--fs-h3)] font-extrabold text-fg">
                  {value(tile.count, tile.loadingKind)}
                </div>
                <div className="text-fg-2 text-[length:var(--fs-caption)] mt-1">{tile.label}</div>
              </>
            );
            const shell = 'rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg p-4';
            if (readOnly || !tile.to) return <div key={tile.key} className={shell}>{body}</div>;
            return (
              <Link
                key={tile.key}
                to={tile.to}
                className={`${shell} hover:border-[var(--field-card-hover-border)] hover:ring-1 hover:ring-inset hover:ring-[var(--field-card-hover-border)] hover:bg-[var(--field-card-hover-bg)] hover:-translate-y-0.5 transition-all`}
              >
                {body}
              </Link>
            );
          })}
        </div>
      )}

      {spec.cards.length > 0 && (
        <div className={`grid gap-4 mb-6 ${gridCols(size, 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3', 'grid-cols-1 sm:grid-cols-2')}`}>
          {spec.cards.map((card) => (
            // Fixed height so every card is the same size whatever its title length, with the figure pinned to the bottom.
            <div key={card.label} className="rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg p-5 h-[11.5rem] flex flex-col">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="min-w-0">
                  <div className="font-medium text-fg text-[length:var(--fs-body)]">{card.label}</div>
                  <div className="text-muted text-[length:var(--fs-caption)]">{card.sub}</div>
                </div>
                <span className="w-9 h-9 rounded-full bg-surface-warm text-accent flex items-center justify-center shrink-0">
                  <Icon path={card.icon} className="w-4.5 h-4.5" />
                </span>
              </div>
              <div className="mt-auto text-[length:var(--fs-h3)] font-extrabold text-fg">
                {value(card.value, card.loadingKind)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick actions are suppressed entirely for a read-only role rather than
          rendered disabled - a row of dead buttons is worse than their absence. */}
      {!readOnly && spec.actions.length > 0 && (
        <>
          <h3 className="text-[length:var(--fs-body-lg)] font-medium text-fg mb-3">Quick actions</h3>
          <div className="flex flex-wrap gap-2 mb-6">
            {spec.actions.map((action) => (
              // The palette's soft pink fill (2026-09-27), standardised across
              // every secondary/clickable button in the app - see
              // ProductLinePage.tsx's category chips, the first place this
              // treatment landed. This was an outlined, unfilled button before,
              // the one shape in this family that had never picked up the fill.
              // It is the only one of the four that is a real <button> on a
              // button-shaped box, so it is the one that became the variant.
              <Button
                key={action.label}
                variant="secondary-rect"
                compact
                onClick={() => launch(action)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </>
      )}

      {spec.listTitle && (
        <>
          <h3 className="text-[length:var(--fs-body-lg)] font-medium text-fg mb-3">{spec.listTitle}</h3>
          {(spec.listItems ?? []).length === 0 && (
            <p className="text-muted text-[length:var(--fs-body)]">{spec.listEmpty}</p>
          )}
          <div className="space-y-2">
            {(spec.listItems ?? []).map((item) => {
              const body = (
                <>
                  <div className="min-w-0">
                    <div className="font-medium text-fg text-[length:var(--fs-body)] truncate">{item.primary}</div>
                    <div className="text-fg-2 text-[length:var(--fs-caption)] truncate">{item.secondary}</div>
                  </div>
                  {item.badge ? (
                    <Badge variant="filled-neutral">{item.badge}</Badge>
                  ) : (
                    <Icon path={ICONS.openArrow} className="w-4 h-4 text-muted shrink-0" />
                  )}
                </>
              );
              const shell =
                'flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg px-4 py-3';
              if (readOnly || !item.to) return <div key={item.id} className={shell}>{body}</div>;
              return (
                <Link
                  key={item.id}
                  to={item.to}
                  className={`${shell} hover:border-[var(--field-card-hover-border)] hover:ring-1 hover:ring-inset hover:ring-[var(--field-card-hover-border)] hover:bg-[var(--field-card-hover-bg)] hover:-translate-y-0.5 transition-all`}
                >
                  {body}
                </Link>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
