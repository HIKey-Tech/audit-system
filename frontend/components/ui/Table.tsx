'use client';

import { ReactNode } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { TableSkeleton } from './Skeleton';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T, index: number) => ReactNode;
  className?: string;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'right' | 'center';
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[] | undefined;
  rowKey: (row: T, index: number) => string;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  emptyState?: ReactNode;
  onRowClick?: (row: T) => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSortChange?: (key: string, order: 'asc' | 'desc') => void;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
  };
  className?: string;
  density?: 'compact' | 'comfortable';
}

export function Table<T>({
  columns,
  data,
  rowKey,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  emptyState,
  onRowClick,
  sortBy,
  sortOrder,
  onSortChange,
  pagination,
  className,
  density = 'comfortable',
}: TableProps<T>): JSX.Element {
  if (isLoading) {
    return <TableSkeleton rows={5} cols={columns.length} />;
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-border bg-surface-elevated p-10 text-center">
        <p className="text-sm text-danger">
          {errorMessage || 'Failed to load data.'}
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 text-xs font-medium text-primary hover:underline"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  const rows = data ?? [];
  const isEmpty = rows.length === 0;
  const padding = density === 'compact' ? 'px-3 py-2' : 'px-4 py-3';

  const handleSort = (col: Column<T>) => {
    if (!col.sortable || !onSortChange) return;
    const nextOrder: 'asc' | 'desc' =
      sortBy === col.key && sortOrder === 'asc' ? 'desc' : 'asc';
    onSortChange(col.key, nextOrder);
  };

  return (
    <div className={cn('overflow-hidden rounded-lg border border-border bg-surface-elevated', className)}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-surface-alt">
            <tr>
              {columns.map((col) => {
                const sortable = Boolean(col.sortable && onSortChange);
                const active = sortBy === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    style={col.width ? { width: col.width } : undefined}
                    className={cn(
                      'text-[11px] uppercase tracking-wider font-semibold text-text-secondary',
                      padding,
                      col.align === 'right' && 'text-right',
                      col.align === 'center' && 'text-center',
                      col.align !== 'right' && col.align !== 'center' && 'text-left',
                      col.className,
                    )}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => handleSort(col)}
                        className={cn(
                          'inline-flex items-center gap-1 hover:text-text-primary',
                          active && 'text-text-primary',
                        )}
                      >
                        {col.header}
                        {active ? (
                          sortOrder === 'asc' ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )
                        ) : (
                          <ChevronsUpDown className="h-3 w-3 opacity-50" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-white">
            {isEmpty ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-0">
                  {emptyState}
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr
                  key={rowKey(row, idx)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    idx % 2 === 1 && 'bg-surface-alt/50',
                    onRowClick && 'cursor-pointer hover:bg-surface-hover',
                    'transition-colors',
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'text-sm text-text-primary',
                        padding,
                        col.align === 'right' && 'text-right',
                        col.align === 'center' && 'text-center',
                      )}
                    >
                      {col.render(row, idx)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {pagination && pagination.total > pagination.pageSize && (
        <Pagination {...pagination} />
      )}
    </div>
  );
}

const Pagination = ({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}): JSX.Element => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between border-t border-border bg-surface-alt px-4 py-3">
      <p className="text-xs text-text-secondary">
        Showing <span className="font-medium text-text-primary">{start.toLocaleString()}</span>
        {' '}to{' '}
        <span className="font-medium text-text-primary">{end.toLocaleString()}</span>
        {' '}of{' '}
        <span className="font-medium text-text-primary">{total.toLocaleString()}</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="h-8 px-3 text-xs font-medium text-text-secondary hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed rounded-md hover:bg-white"
        >
          Previous
        </button>
        <span className="text-xs text-text-secondary px-2">
          Page <span className="text-text-primary font-medium">{page}</span> of {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="h-8 px-3 text-xs font-medium text-text-secondary hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed rounded-md hover:bg-white"
        >
          Next
        </button>
      </div>
    </div>
  );
};
