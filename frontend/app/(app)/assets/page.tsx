'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Database, Plus, Search, Server, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Table, type Column } from '@/components/ui/Table';
import { Input, Select } from '@/components/ui/Input';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { AssetFormSlideOver } from '@/components/assets/AssetFormSlideOver';
import { assetsApi } from '@/lib/api/assets';
import type { Asset } from '@/lib/types/domain';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useQueryFilters } from '@/lib/hooks/useQueryFilters';
import { useSearchInput } from '@/lib/hooks/useSearchInput';
import { formatDate } from '@/lib/utils/format';
import {
  ASSET_RATINGS,
  ASSET_SOURCE_SYSTEMS,
  ASSET_STATUSES,
  ASSET_TYPES,
  DATA_CLASSIFICATIONS,
  assetClassificationTone,
  assetLabel,
  assetRatingTone,
} from '@/lib/utils/assets';

export default function AssetsPage(): JSX.Element {
  const router = useRouter();
  const qc = useQueryClient();
  const perms = usePermissions();
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null);

  const { values, set } = useQueryFilters({
    page: '1',
    search: '',
    assetType: '',
    status: '',
    criticality: '',
    dataClassification: '',
    sourceSystem: '',
    freshness: '',
    sortBy: 'created_at',
    sortOrder: 'desc',
  });
  const page = Math.max(1, Number(values.page) || 1);

  const [searchInput, setSearchInput] = useSearchInput(
    values.search,
    useCallback((next: string) => set({ search: next, page: '1' }), [set]),
  );

  const queryFilters = {
    page,
    pageSize: 20,
    search: values.search || undefined,
    assetType: values.assetType || undefined,
    status: values.status || undefined,
    criticality: values.criticality || undefined,
    dataClassification: values.dataClassification || undefined,
    sourceSystem: values.sourceSystem || undefined,
    stale: values.freshness === 'stale' ? true : undefined,
    unattested: values.freshness === 'unattested' ? true : undefined,
    sortBy: values.sortBy,
    sortOrder: values.sortOrder as 'asc' | 'desc',
  };

  const query = useQuery({
    queryKey: ['assets', 'list', queryFilters],
    queryFn: () => assetsApi.list(queryFilters),
    enabled: perms.canReadAssets,
  });

  const remove = useMutation({
    mutationFn: (asset: Asset) => assetsApi.remove(asset.id),
    onSuccess: () => {
      toast.success('Asset deleted');
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ['assets'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to delete asset'),
  });

  const columns: Column<Asset>[] = [
    {
      // Keys of sortable columns are the backend sort field names.
      key: 'name',
      header: 'Asset',
      sortable: true,
      render: (asset) => (
        <div className="min-w-0">
          <p className="font-medium text-text-primary">{asset.name}</p>
          <p className="mt-0.5 font-mono text-xs text-text-secondary">{asset.assetTag}</p>
        </div>
      ),
    },
    {
      key: 'asset_type',
      header: 'Type',
      width: '150px',
      sortable: true,
      render: (asset) => <Badge tone="gray">{assetLabel(asset.assetType)}</Badge>,
    },
    {
      key: 'criticality',
      header: 'Criticality',
      width: '130px',
      sortable: true,
      render: (asset) => <Badge tone={assetRatingTone(asset.criticality)}>{assetLabel(asset.criticality)}</Badge>,
    },
    {
      key: 'classification',
      header: 'Classification',
      width: '150px',
      render: (asset) => <Badge tone={assetClassificationTone(asset.dataClassification)}>{assetLabel(asset.dataClassification)}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      width: '110px',
      render: (asset) => <StatusBadge status={asset.status} />,
    },
    {
      key: 'owner',
      header: 'Owner',
      width: '170px',
      render: (asset) => (
        <span className="text-sm text-text-secondary">
          {asset.owner?.displayName || `${asset.owner?.firstName ?? ''} ${asset.owner?.lastName ?? ''}`.trim() || '—'}
        </span>
      ),
    },
    {
      key: 'source',
      header: 'Source',
      width: '130px',
      render: (asset) => <span className="text-xs text-text-secondary">{assetLabel(asset.sourceSystem)}</span>,
    },
    {
      key: 'last_seen_at',
      header: 'Freshness',
      width: '160px',
      sortable: true,
      render: (asset) => (
        <div className="text-xs text-text-secondary">
          <p>Seen: {asset.lastSeenAt ? formatDate(asset.lastSeenAt) : 'Never'}</p>
          <p>Attested: {asset.lastAttestedAt ? formatDate(asset.lastAttestedAt) : 'Never'}</p>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '70px',
      render: (asset) => (
        perms.canDeleteAssets ? (
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-red-50 hover:text-danger"
            onClick={(event) => {
              event.stopPropagation();
              setDeleteTarget(asset);
            }}
            aria-label={`Delete ${asset.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null
      ),
      align: 'right',
    },
  ];

  if (!perms.canReadAssets) {
    return (
      <div>
        <PageHeader title="Assets" subtitle="Asset registry, ownership, and audit linkage." />
        <Card>
          <EmptyState icon={<Server className="h-4 w-4" />} title="You do not have access to the asset registry" />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Assets"
        subtitle="Asset registry, ownership, classification, attestations, and audit links."
        actions={
          perms.canCreateAssets ? (
            <Button
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => setFormOpen(true)}
            >
              New asset
            </Button>
          ) : null
        }
      />

      <Card padded className="mb-4">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-7">
          <Input
            className="xl:col-span-2"
            placeholder="Search tag, name, hostname, serial, source…"
            aria-label="Search assets"
            leftIcon={<Search className="h-4 w-4" />}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <Select value={values.assetType} aria-label="Filter by type" onChange={(event) => set({ assetType: event.target.value, page: '1' })}>
            <option value="">All types</option>
            {ASSET_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
          <Select value={values.status} aria-label="Filter by status" onChange={(event) => set({ status: event.target.value, page: '1' })}>
            <option value="">All statuses</option>
            {ASSET_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
          <Select value={values.criticality} aria-label="Filter by criticality" onChange={(event) => set({ criticality: event.target.value, page: '1' })}>
            <option value="">All criticalities</option>
            {ASSET_RATINGS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
          <Select value={values.dataClassification} aria-label="Filter by classification" onChange={(event) => set({ dataClassification: event.target.value, page: '1' })}>
            <option value="">All classifications</option>
            {DATA_CLASSIFICATIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
          <Select value={values.sourceSystem} aria-label="Filter by source system" onChange={(event) => set({ sourceSystem: event.target.value, page: '1' })}>
            <option value="">All sources</option>
            {ASSET_SOURCE_SYSTEMS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
          <Select value={values.freshness} aria-label="Filter by freshness" onChange={(event) => set({ freshness: event.target.value, page: '1' })}>
            <option value="">All freshness</option>
            <option value="stale">Stale / never seen</option>
            <option value="unattested">Unattested / overdue</option>
          </Select>
        </div>
      </Card>

      <Table<Asset>
        columns={columns}
        data={query.data?.items}
        rowKey={(asset) => asset.id}
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => query.refetch()}
        onRowClick={(asset) => router.push(`/assets/${asset.id}`)}
        sortBy={values.sortBy}
        sortOrder={values.sortOrder as 'asc' | 'desc'}
        onSortChange={(key, order) => set({ sortBy: key, sortOrder: order, page: '1' })}
        emptyState={
          <EmptyState
            icon={<Database className="h-4 w-4" />}
            title="No assets registered"
            description="Create the first asset record to start linking systems, services, and information assets to audits."
            action={
              perms.canCreateAssets ? (
                <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setFormOpen(true)}>
                  New asset
                </Button>
              ) : undefined
            }
          />
        }
        pagination={
          query.data
            ? {
                page: query.data.meta.page,
                pageSize: query.data.meta.pageSize,
                total: query.data.meta.total,
                onPageChange: (p) => set({ page: String(p) }),
              }
            : undefined
        }
      />

      <AssetFormSlideOver
        open={formOpen}
        asset={null}
        canAdmin={perms.canAdminAssets}
        onClose={() => setFormOpen(false)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete asset?"
        description={deleteTarget ? `${deleteTarget.assetTag} will be deactivated and hidden from registry reads.` : undefined}
        confirmLabel="Delete asset"
        isLoading={remove.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) remove.mutate(deleteTarget);
        }}
      />
    </div>
  );
}
