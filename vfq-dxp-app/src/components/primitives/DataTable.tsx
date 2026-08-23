import type { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  loading?: boolean;
}

// Backs every list/grid screen (Lead lists, Order queues, Asset grids) per
// component-catalogue.md §1 — Assumed shape (no design-system analog).
export function DataTable<T>({ columns, rows, rowKey, onRowClick, emptyMessage = 'No records.', loading }: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border-soft">
      <table className="w-full text-left text-[length:var(--fs-body)]">
        <thead className="bg-surface text-fg-2">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="px-4 py-2 font-medium text-[length:var(--fs-caption-upper)] uppercase tracking-wide">
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
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={() => onRowClick?.(row)}
                className={`border-t border-border-soft ${onRowClick ? 'cursor-pointer hover:bg-surface' : ''}`}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-2 text-fg">
                    {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
