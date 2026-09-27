import * as React from 'react';
import { cn } from '@/lib/ui/cn';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from './States';

type Column<R> = {
  key: string;
  header: React.ReactNode;
  render?: (row: R) => React.ReactNode;
  align?: 'left' | 'right';
  mono?: boolean;
  muted?: boolean;
  width?: number | string;
};

type DataTableProps<R> = {
  columns: Column<R>[];
  rows: R[];
  rowKey: (row: R) => string | number;
  loading?: boolean;
  skeletonRows?: number;
  error?: string;
  onRetry?: () => void;
  empty?: { title?: string; description?: string };
  toolbar?: React.ReactNode;
  footer?: React.ReactNode;
  onRowClick?: (row: R) => void;
  caption?: string;
  className?: string;
};

/** Full-width table: inverted header, ruled rows, skeleton while loading, empty and error states built in. */
function DataTable<R>({
  columns,
  rows,
  rowKey,
  loading = false,
  skeletonRows = 5,
  error,
  onRetry,
  empty,
  toolbar,
  footer,
  onRowClick,
  caption,
  className,
}: DataTableProps<R>): React.ReactElement {
  let body: React.ReactNode = null;
  if (loading) {
    body = Array.from({ length: skeletonRows }, (_, i) => (
      <tr key={`skeleton-${i}`}>
        {columns.map((col, j) => (
          <td key={col.key}>
            <Skeleton style={{ width: j === 0 ? '70%' : 48, height: 12 }} />
          </td>
        ))}
      </tr>
    ));
  } else if (!error && rows.length) {
    body = rows.map((row) => (
      <tr
        key={rowKey(row)}
        className={onRowClick ? 'is-clickable' : undefined}
        onClick={onRowClick ? () => onRowClick(row) : undefined}
      >
        {columns.map((col) => (
          <td
            key={col.key}
            className={cn(col.align === 'right' && 'is-right', col.mono && 'is-mono', col.muted && 'is-muted') || undefined}
          >
            {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
          </td>
        ))}
      </tr>
    ));
  }

  return (
    <div className={cn('prr-table-card', className)}>
      {toolbar && <div className="prr-table-toolbar">{toolbar}</div>}
      <div className="prr-table-scroll">
        <table className="prr-table" aria-busy={loading || undefined}>
          {caption && <caption className="prr-sr">{caption}</caption>}
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={col.align === 'right' ? 'is-right' : undefined}
                  style={col.width !== undefined ? { width: col.width } : undefined}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          {body && <tbody>{body}</tbody>}
        </table>
        {!loading && error && (
          <div className="prr-table-msg">
            <ErrorState title="Could not load rows" message={error} onRetry={onRetry} />
          </div>
        )}
        {!loading && !error && rows.length === 0 && (
          <EmptyState title={empty?.title ?? 'No rows found'} description={empty?.description} />
        )}
      </div>
      {footer && <div className="prr-table-foot">{footer}</div>}
    </div>
  );
}

export { DataTable };
export type { Column, DataTableProps };
