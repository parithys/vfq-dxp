import { Icon } from './Icon';

const CHEVRON_LEFT = 'M15 18l-6-6 6-6';
const CHEVRON_RIGHT = 'M9 18l6-6-6-6';

/**
 * The one pager: previous, numbered pages, next. Pages are 1-based. The current page is the primary red chip; the rest are
 * quiet. Renders nothing when there is only one page. Used under every paged table and list.
 */
export function Pager({ page, pages, onPage, className = '' }: { page: number; pages: number; onPage: (page: number) => void; className?: string }) {
  if (pages <= 1) return null;
  const step = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-button)] text-fg-2 hover:bg-[var(--icon-tile-bg)] hover:text-fg disabled:opacity-40 disabled:hover:bg-transparent focus:outline-none focus-visible:shadow-[var(--focus-ring)] transition-colors';
  return (
    <nav aria-label="Pagination" className={`flex flex-wrap items-center gap-1 ${className}`}>
      <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)} className={step}>
        <Icon path={CHEVRON_LEFT} className="h-4 w-4" />
      </button>
      {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onPage(p)}
          aria-label={`Page ${p}`}
          aria-current={p === page ? 'page' : undefined}
          className={`h-9 min-w-9 shrink-0 rounded-[var(--radius-button)] px-2 text-[length:var(--fs-body)] focus:outline-none focus-visible:shadow-[var(--focus-ring)] transition-colors ${
            p === page ? 'bg-[image:var(--accent-gradient)] text-accent-on font-bold' : 'text-fg-2 hover:bg-[var(--icon-tile-bg)] hover:text-fg'
          }`}
        >
          {p}
        </button>
      ))}
      <button type="button" aria-label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)} className={step}>
        <Icon path={CHEVRON_RIGHT} className="h-4 w-4" />
      </button>
    </nav>
  );
}
