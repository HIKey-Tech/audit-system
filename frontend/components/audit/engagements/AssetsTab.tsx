'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Server, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table, type Column } from '@/components/ui/Table';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { SlideOver } from '@/components/ui/SlideOver';
import { FormField } from '@/components/ui/FormField';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { assetsApi } from '@/lib/api/assets';
import type { Asset, AuditEngagementDetail } from '@/lib/types/domain';
import { usePermissions } from '@/lib/hooks/usePermissions';
import {
  ASSET_SCOPE_ROLES,
  assetClassificationTone,
  assetLabel,
  assetRatingTone,
} from '@/lib/utils/assets';

export const AssetsTab = ({ engagement }: { engagement: AuditEngagementDetail }): JSX.Element => {
  const qc = useQueryClient();
  const { canLinkAssets } = usePermissions();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [assetId, setAssetId] = useState('');
  const [scopeRole, setScopeRole] = useState('primary');
  const [scopeReason, setScopeReason] = useState('');
  const [unlinkTarget, setUnlinkTarget] = useState<Asset | null>(null);

  const list = useQuery({
    queryKey: ['engagements', engagement.id, 'assets'],
    queryFn: () => assetsApi.listForEngagement(engagement.id),
  });

  const candidates = useQuery({
    queryKey: ['assets', 'engagement-candidates', search],
    queryFn: () => assetsApi.list({ pageSize: 50, search: search || undefined }),
    enabled: open,
  });

  const link = useMutation({
    mutationFn: () =>
      assetsApi.linkToEngagement(engagement.id, {
        assetId,
        scopeRole,
        scopeReason: scopeReason.trim() || null,
      }),
    onSuccess: () => {
      toast.success('Asset added to engagement scope');
      qc.invalidateQueries({ queryKey: ['engagements', engagement.id, 'assets'] });
      qc.invalidateQueries({ queryKey: ['asset'] });
      setOpen(false);
      setAssetId('');
      setScopeRole('primary');
      setScopeReason('');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to link asset'),
  });

  const unlink = useMutation({
    mutationFn: (asset: Asset) => assetsApi.unlinkFromEngagement(engagement.id, asset.id),
    onSuccess: () => {
      toast.success('Asset removed from engagement scope');
      setUnlinkTarget(null);
      qc.invalidateQueries({ queryKey: ['engagements', engagement.id, 'assets'] });
      qc.invalidateQueries({ queryKey: ['asset'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to unlink asset'),
  });

  const linkedIds = new Set(list.data?.map((asset) => asset.id) ?? []);
  const availableCandidates = candidates.data?.items.filter((asset) => !linkedIds.has(asset.id)) ?? [];

  const columns: Column<Asset>[] = [
    {
      key: 'asset',
      header: 'Asset',
      render: (asset) => (
        <div className="min-w-0">
          <Link href={`/assets/${asset.id}`} className="font-medium text-primary hover:underline">
            {asset.name}
          </Link>
          <p className="mt-0.5 font-mono text-xs text-text-secondary">{asset.assetTag}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      width: '150px',
      render: (asset) => <Badge tone="gray">{assetLabel(asset.assetType)}</Badge>,
    },
    {
      key: 'criticality',
      header: 'Criticality',
      width: '130px',
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
      width: '180px',
      render: (asset) => asset.owner?.displayName || asset.owner?.email || '—',
    },
    {
      key: 'actions',
      header: '',
      width: '70px',
      align: 'right',
      render: (asset) => canLinkAssets ? (
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-red-50 hover:text-danger"
          onClick={() => setUnlinkTarget(asset)}
          aria-label={`Remove ${asset.name} from engagement`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ) : null,
    },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Assets in scope</h2>
          <p className="text-xs text-text-secondary">Systems, services, information assets, and dependencies relevant to this audit.</p>
        </div>
        {canLinkAssets && (
          <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setOpen(true)}>
            Link asset
          </Button>
        )}
      </div>

      <Card padded={false}>
        <Table
          columns={columns}
          data={list.data}
          rowKey={(asset) => asset.id}
          isLoading={list.isLoading}
          isError={list.isError}
          onRetry={() => list.refetch()}
          density="compact"
          emptyState={
            <EmptyState
              icon={<Server className="h-4 w-4" />}
              title="No assets linked"
              description="Link assets to define the technology, data, and service scope of this engagement."
              action={
                canLinkAssets ? (
                  <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setOpen(true)}>
                    Link asset
                  </Button>
                ) : undefined
              }
            />
          }
        />
      </Card>

      <SlideOver
        open={open}
        onClose={() => setOpen(false)}
        title="Link asset to engagement"
        description="Add an asset to the audit scope and describe how it is used."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => link.mutate()} isLoading={link.isPending} disabled={!assetId}>Link asset</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <FormField label="Find asset">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tag, name, hostname, serial…" />
          </FormField>
          <FormField label="Asset" required>
            <Select value={assetId} onChange={(event) => setAssetId(event.target.value)} disabled={candidates.isLoading}>
              <option value="">{candidates.isLoading ? 'Loading assets…' : 'Select asset…'}</option>
              {availableCandidates.map((asset) => (
                <option key={asset.id} value={asset.id}>{asset.assetTag} — {asset.name}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Scope role" required>
            <Select value={scopeRole} onChange={(event) => setScopeRole(event.target.value)}>
              {ASSET_SCOPE_ROLES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </FormField>
          <FormField label="Scope reason">
            <Textarea rows={4} value={scopeReason} onChange={(event) => setScopeReason(event.target.value)} />
          </FormField>
          <Card>
            <CardHeader title="Scope guidance" className="mb-2" />
            <p className="text-xs leading-5 text-text-secondary">
              Primary assets are directly audited. Supporting assets provide dependency context. Excluded references are documented for traceability but kept outside test scope.
            </p>
          </Card>
        </div>
      </SlideOver>

      <ConfirmDialog
        open={Boolean(unlinkTarget)}
        title="Remove asset from engagement?"
        description={unlinkTarget ? `${unlinkTarget.assetTag} will no longer appear in this engagement scope.` : undefined}
        confirmLabel="Remove"
        isLoading={unlink.isPending}
        onCancel={() => setUnlinkTarget(null)}
        onConfirm={() => {
          if (unlinkTarget) unlink.mutate(unlinkTarget);
        }}
      />
    </div>
  );
};
