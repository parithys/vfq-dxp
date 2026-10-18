import type { ReactNode } from 'react';

/**
 * The page header every screen uses (same band as the Customer 360 header): full-bleed charcoal (white text), bottom border only,
 * 20px padding, bold title with an optional description under it. Badges sit beside the title and actions at the
 * right.
 *
 * `bleed` (default) pulls the band out to the page edges by cancelling the 32px padding of the page wrapper it is
 * placed in (every screen wraps its content in `p-8`). Pass `bleed={false}` where the header is not the first thing
 * inside a padded page - an embedded tab, or a layout that supplies its own padding.
 */
export function PageHeader({
  title,
  description,
  badges,
  actions,
  bleed = true,
}: {
  title: ReactNode;
  description?: ReactNode;
  badges?: ReactNode;
  actions?: ReactNode;
  bleed?: boolean;
}) {
  return (
    <header className={`${bleed ? '-mx-8 -mt-8 mb-6' : 'mb-5'} px-5 py-3 bg-charcoal-panel text-on-dark border-b border-[var(--field-card-border)]`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-[length:var(--fs-h4)] font-bold text-on-dark break-words min-w-0">{title}</h1>
        {badges}
        {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
      </div>
      {description && <div className="text-on-dark-2 text-[length:var(--fs-body)]">{description}</div>}
    </header>
  );
}
