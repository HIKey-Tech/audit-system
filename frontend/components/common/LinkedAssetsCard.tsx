'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Boxes } from 'lucide-react';

import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { assetsApi } from '@/lib/api/assets';
import { humanizeStatus } from '@/lib/utils/status';

/**
 * Shows the assets linked to a finding or a risk, closing the audit→asset
 * navigation gap (previously only the asset side showed these links).
 */
export function LinkedAssetsCard({
  scope,
  id,
}: {
  scope: 'finding' | 'risk';
  id: string;
}): JSX.Element {
  const { data, isLoading } = useQuery({
    queryKey: ['assets', scope, id],
    queryFn: () => (scope === 'finding' ? assetsApi.listForFinding(id) : assetsApi.listForRisk(id)),
    enabled: Boolean(id),
  });

  return (
    <Card>
      <CardHeader title="Linked assets" subtitle={`${data?.length ?? 0} in scope`} />
      {isLoading ? (
        <Skeleton className="h-4 w-2/3" />
      ) : !data || data.length === 0 ? (
        <EmptyState compact icon={<Boxes className="h-4 w-4" />} title="No linked assets" />
      ) : (
        <ul className="divide-y divide-border">
          {data.map((a) => (
            <li key={a.id} className="flex items-center justify-between py-2">
              <Link href={`/assets/${a.id}`} className="min-w-0">
                <p className="truncate text-sm font-medium text-primary hover:underline">{a.name}</p>
                <p className="font-mono text-[11px] text-text-secondary">{a.assetTag}</p>
              </Link>
              <div className="flex items-center gap-1.5">
                <Badge tone="gray">{humanizeStatus(a.assetType)}</Badge>
                <Badge tone={a.criticality === 'critical' || a.criticality === 'high' ? 'red' : 'gray'}>
                  {humanizeStatus(a.criticality)}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
