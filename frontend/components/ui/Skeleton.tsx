import { cn } from '@/lib/utils/cn';

export const Skeleton = ({
  className,
}: {
  className?: string;
}): JSX.Element => (
  <div className={cn('animate-pulse rounded-md bg-slate-200/70', className)} />
);

export const SkeletonText = ({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}): JSX.Element => (
  <div className={cn('space-y-2', className)}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        className={cn('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')}
      />
    ))}
  </div>
);

export const StatCardSkeleton = (): JSX.Element => (
  <div className="rounded-lg border border-border bg-surface-elevated p-5 shadow-card">
    <Skeleton className="h-3 w-24 mb-3" />
    <Skeleton className="h-8 w-20 mb-3" />
    <Skeleton className="h-2 w-full" />
  </div>
);

export const TableSkeleton = ({
  rows = 5,
  cols = 5,
}: {
  rows?: number;
  cols?: number;
}): JSX.Element => (
  <div className="overflow-hidden rounded-lg border border-border bg-surface-elevated">
    <div className="border-b border-border bg-surface-alt px-4 py-3">
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3" />
        ))}
      </div>
    </div>
    <div className="divide-y divide-border">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="px-4 py-4">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className={cn('h-3', c === 0 ? 'w-3/4' : 'w-1/2')} />
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

export const ListSkeleton = ({ rows = 6 }: { rows?: number }): JSX.Element => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-3">
        <Skeleton className="h-2 w-2 rounded-full" />
        <Skeleton className="h-3 flex-1" />
        <Skeleton className="h-3 w-20" />
      </div>
    ))}
  </div>
);
