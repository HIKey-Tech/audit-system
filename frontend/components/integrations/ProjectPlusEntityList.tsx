'use client';

import { FormEvent, ReactNode, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { projectPlusApi, ProjectPlusEntity } from '@/lib/api/projectplus';

interface Props {
  enabled: boolean;
  pageSize?: number;
  /** Optional per-row action (e.g. "Link to engagement"). */
  renderAction?: (entity: ProjectPlusEntity, customerType: string) => ReactNode;
}

/** Read-only lookup of Project Plus entities by customer type, with search and paging. */
export const ProjectPlusEntityList = ({ enabled, pageSize = 10, renderAction }: Props): JSX.Element => {
  const [customerType, setCustomerType] = useState('');
  const [search, setSearch] = useState('');
  const [submitted, setSubmitted] = useState<{ customerType: string; search: string } | null>(null);
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ['integration', 'projectplus', 'entities', submitted, page, pageSize],
    queryFn: () =>
      projectPlusApi.listEntities({
        customerType: submitted!.customerType,
        search: submitted!.search || undefined,
        page,
        pageSize,
      }),
    enabled: enabled && Boolean(submitted),
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!customerType.trim()) return;
    setPage(1);
    setSubmitted({ customerType: customerType.trim(), search: search.trim() });
  };

  const items = query.data?.items ?? [];
  const meta = query.data?.meta;

  return (
    <div className="space-y-3">
      <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
        <Input
          value={customerType}
          onChange={(e) => setCustomerType(e.target.value)}
          placeholder="Customer type (e.g. vendor)"
          aria-label="Customer type"
          className="max-w-[220px]"
        />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, reference, RC or TIN"
          aria-label="Search entities"
          className="max-w-sm"
        />
        <Button type="submit" size="sm" leftIcon={<Search className="h-3.5 w-3.5" />} isLoading={query.isFetching}>
          Search
        </Button>
      </form>

      {!submitted ? (
        <p className="py-4 text-center text-xs text-text-muted">Enter a customer type to look up Project Plus entities.</p>
      ) : query.isLoading ? (
        <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
      ) : query.isError ? (
        <p className="py-4 text-sm text-danger">
          {query.error instanceof Error ? query.error.message : 'Could not load Project Plus entities.'}
        </p>
      ) : items.length === 0 ? (
        <EmptyState title="No matching entities" description="Nothing in Project Plus matched this lookup." />
      ) : (
        <>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {items.map((e) => (
              <li key={`${e.referenceCode}-${e.fullName}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-text-primary">{e.fullName}</p>
                    {e.status && <Badge tone={e.status.toLowerCase() === 'active' ? 'green' : 'gray'}>{e.status}</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {[e.referenceCode && `Ref ${e.referenceCode}`, e.entityType, e.entitySubType, e.rcNumber && `RC ${e.rcNumber}`, e.tin && `TIN ${e.tin}`]
                      .filter(Boolean)
                      .join(' · ') || 'No identifiers on record'}
                  </p>
                </div>
                {renderAction?.(e, submitted.customerType)}
              </li>
            ))}
          </ul>
          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-text-secondary">
              <span>{meta.total} entities · page {meta.page} of {meta.totalPages}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" disabled={!meta.hasPrev} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <Button size="sm" variant="secondary" disabled={!meta.hasNext} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
