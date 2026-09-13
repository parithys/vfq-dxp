import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from './Button';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  /** Renders this column's value as a real link to a specific destination,
   * independent of any other column's link or the row's own onRowClick — use
   * this instead of onRowClick when different columns in the same row point
   * to different pages (e.g. a ticket # column linking to the ticket, a
   * customer column linking to that customer's 360 record). Return undefined
   * for a given row to fall back to plain text (e.g. no customerId on file). */
  linkTo?: (row: T) => string | undefined;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  loading?: boolean;
  pageSize?: number;
}

// Backs every list/grid screen (Lead lists, Order queues, Asset grids) per
// component-catalogue.md §1 — Assumed shape (no design-system analog).
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  emptyMessage = 'No records.',
  loading,
  pageSize = 50,
}: DataTableProps<T>) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const pagedRows = rows.slice(currentPage * pageSize, currentPage * pageSize + pageSize);
  const showPager = rows.length > pageSize;

  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, row: T) => {
    if (event.key === 'Enter') {
      onRowClick?.(row);
    } else if (event.key === ' ') {
      event.preventDefault();
      onRowClick?.(row);
    }
  };

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--table-border)] bg-bg">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[length:var(--fs-body)]">
          <thead className="bg-[var(--table-header-bg)] text-fg-2">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className="px-4 py-3 font-semibold text-[length:var(--fs-caption-upper)]">
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6 text-center text-muted">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6 text-center text-muted">
                  {emptyMessage}
                </td>
              </tr>
            )}
            {!loading &&
              pagedRows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={() => onRowClick?.(row)}
                  tabIndex={onRowClick ? 0 : undefined}
                  role={onRowClick ? 'button' : undefined}
                  onKeyDown={onRowClick ? (event) => handleRowKeyDown(event, row) : undefined}
                  className={`border-t border-[var(--table-border)] transition-colors ${onRowClick ? 'cursor-pointer hover:bg-surface' : ''}`}
                >
                  {columns.map((col, colIndex) => {
                    const value = (row as Record<string, unknown>)[col.key] ?? '—';
                    const linkHref = col.linkTo?.(row);
                    // Falls back to the first-column link cue only when the table
                    // still uses whole-row onRowClick (no per-column linkTo defined
                    // anywhere) — tables using linkTo get real per-column links
                    // instead, so this legacy heuristic doesn't double up with them.
                    const hasAnyColumnLink = columns.some((c) => c.linkTo);
                    const isLinkCol = colIndex === 0 && Boolean(onRowClick) && !hasAnyColumnLink;
                    return (
                      <td key={col.key} className="px-4 py-3.5 text-fg">
                        {col.render ? (
                          col.render(row)
                        ) : linkHref ? (
                          <Link
                            to={linkHref}
                            onClick={(event) => event.stopPropagation()}
                            className="block max-w-xs truncate text-accent font-medium hover:underline"
                            title={String(value)}
                          >
                            {String(value)}
                          </Link>
                        ) : (
                          <span
                            className={`block max-w-xs truncate ${isLinkCol ? 'text-accent font-medium hover:underline' : ''}`}
                            title={String(value)}
                          >
                            {String(value)}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {!loading && showPager && (
        <div className="flex items-center justify-between border-t border-[var(--table-border)] px-4 py-2">
          <Button
            variant="ghost-rect"
            compact
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
          >
            Previous
          </Button>
          <span className="text-[length:var(--fs-caption)] text-fg-2">
            Page {currentPage + 1} of {pageCount}
          </span>
          <Button
            variant="ghost-rect"
            compact
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={currentPage >= pageCount - 1}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
