'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Link2, Pencil, Plus, Server, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Table, type Column } from '@/components/ui/Table';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { AssetFormSlideOver } from '@/components/assets/AssetFormSlideOver';
import { AssetRelationshipSlideOver } from '@/components/assets/AssetRelationshipSlideOver';
import { AssetAttestationSlideOver } from '@/components/assets/AssetAttestationSlideOver';
import { AssetSourceSlideOver } from '@/components/assets/AssetSourceSlideOver';
import { assetsApi } from '@/lib/api/assets';
import type { Asset, AssetAttestation, AssetLink, AssetRelationship, AssetSource } from '@/lib/types/domain';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { formatDate, formatDateTime } from '@/lib/utils/format';
import {
  assetClassificationTone,
  assetLabel,
  assetRatingTone,
} from '@/lib/utils/assets';

const TABS: TabItem[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'relationships', label: 'Relationships' },
  { key: 'attestations', label: 'Attestations' },
  { key: 'sources', label: 'Sources' },
  { key: 'audit', label: 'Audit context' },
];

export default function AssetDetailPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const qc = useQueryClient();
  const perms = usePermissions();
  const [tab, setTab] = useState('overview');
  const [editOpen, setEditOpen] = useState(false);
  const [relationshipOpen, setRelationshipOpen] = useState(false);
  const [attestOpen, setAttestOpen] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [relationshipDeleteTarget, setRelationshipDeleteTarget] = useState<AssetRelationship | null>(null);

  const asset = useQuery({
    queryKey: ['asset', id],
    queryFn: () => assetsApi.get(id),
    enabled: Boolean(id) && perms.canReadAssets,
  });

  const relationships = useQuery({
    queryKey: ['asset', id, 'relationships'],
    queryFn: () => assetsApi.listRelationships(id),
    enabled: Boolean(id) && perms.canReadAssets && tab === 'relationships',
  });

  const attestations = useQuery({
    queryKey: ['asset', id, 'attestations'],
    queryFn: () => assetsApi.listAttestations(id),
    enabled: Boolean(id) && perms.canReadAssets && tab === 'attestations',
  });

  const sources = useQuery({
    queryKey: ['asset', id, 'sources'],
    queryFn: () => assetsApi.listSources(id),
    enabled: Boolean(id) && perms.canReadAssets && tab === 'sources',
  });

  const auditContext = useQuery({
    queryKey: ['asset', id, 'audit-context'],
    queryFn: () => assetsApi.getAuditContext(id),
    enabled: Boolean(id) && perms.canReadAssets && tab === 'audit',
  });

  const deleteRelationship = useMutation({
    mutationFn: (relationship: AssetRelationship) => assetsApi.deleteRelationship(id, relationship.id),
    onSuccess: () => {
      toast.success('Relationship removed');
      setRelationshipDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ['asset', id, 'relationships'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to remove relationship'),
  });

  if (!perms.canReadAssets) {
    return (
      <div>
        <PageHeader title="Asset" breadcrumbs={[{ label: 'Assets', href: '/assets' }]} />
        <Card>
          <EmptyState icon={<Server className="h-4 w-4" />} title="You do not have access to this asset" />
        </Card>
      </div>
    );
  }

  if (asset.isError) {
    return (
      <div>
        <PageHeader title="Asset" breadcrumbs={[{ label: 'Assets', href: '/assets' }]} />
        <Card>
          <ErrorState onRetry={() => asset.refetch()} />
        </Card>
      </div>
    );
  }

  if (asset.isLoading || !asset.data) {
    return (
      <div>
        <PageHeader title="Loading…" breadcrumbs={[{ label: 'Assets', href: '/assets' }]} />
        <Card>
          <Skeleton className="mb-3 h-4 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
        </Card>
      </div>
    );
  }

  const current = asset.data;
  const canAttestCurrentAsset =
    perms.canAttestAssets &&
    (perms.canAdminAssets || current.ownerId === perms.user.id || current.custodianId === perms.user.id);

  return (
    <div>
      <PageHeader
        title={current.name}
        subtitle={`${current.assetTag} · ${assetLabel(current.assetType)}`}
        breadcrumbs={[
          { label: 'Assets', href: '/assets' },
          { label: current.assetTag },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/assets">
              <Button variant="secondary" leftIcon={<ArrowLeft className="h-4 w-4" />}>Back</Button>
            </Link>
            {canAttestCurrentAsset && (
              <Button variant="secondary" leftIcon={<CheckCircle2 className="h-4 w-4" />} onClick={() => setAttestOpen(true)}>
                Attest
              </Button>
            )}
            {perms.canUpdateAssets && (
              <Button leftIcon={<Pencil className="h-4 w-4" />} onClick={() => setEditOpen(true)}>
                Edit asset
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-4">
        <MetricCard label="Status" value={<StatusBadge status={current.status} />} />
        <MetricCard label="Criticality" value={<Badge tone={assetRatingTone(current.criticality)}>{assetLabel(current.criticality)}</Badge>} />
        <MetricCard label="Classification" value={<Badge tone={assetClassificationTone(current.dataClassification)}>{assetLabel(current.dataClassification)}</Badge>} />
        <MetricCard label="Last attested" value={current.lastAttestedAt ? formatDate(current.lastAttestedAt) : 'Never'} />
      </div>

      <Card padded className="mb-4">
        <Tabs tabs={TABS} active={tab} onChange={setTab} />
      </Card>

      {tab === 'overview' && <OverviewTab asset={current} />}
      {tab === 'relationships' && (
        <RelationshipsTab
          asset={current}
          canUpdate={perms.canUpdateAssets}
          relationships={relationships.data}
          isLoading={relationships.isLoading}
          onAdd={() => setRelationshipOpen(true)}
          onDelete={setRelationshipDeleteTarget}
        />
      )}
      {tab === 'attestations' && (
        <AttestationsTab
          canAttest={canAttestCurrentAsset}
          attestations={attestations.data}
          isLoading={attestations.isLoading}
          onAdd={() => setAttestOpen(true)}
        />
      )}
      {tab === 'sources' && (
        <SourcesTab
          canAdmin={perms.canAdminAssets}
          sources={sources.data}
          isLoading={sources.isLoading}
          onAdd={() => setSourceOpen(true)}
        />
      )}
      {tab === 'audit' && (
        <AuditContextTab links={[
          ...(auditContext.data?.universeLinks ?? []),
          ...(auditContext.data?.engagementLinks ?? []),
          ...(auditContext.data?.findingLinks ?? []),
          ...(auditContext.data?.riskLinks ?? []),
          ...(auditContext.data?.evidenceLinks ?? []),
        ]} isLoading={auditContext.isLoading} />
      )}

      <AssetFormSlideOver open={editOpen} asset={current} canAdmin={perms.canAdminAssets} onClose={() => setEditOpen(false)} />
      <AssetRelationshipSlideOver open={relationshipOpen} assetId={current.id} onClose={() => setRelationshipOpen(false)} />
      <AssetAttestationSlideOver open={attestOpen} assetId={current.id} onClose={() => setAttestOpen(false)} />
      <AssetSourceSlideOver open={sourceOpen} assetId={current.id} onClose={() => setSourceOpen(false)} />

      <ConfirmDialog
        open={Boolean(relationshipDeleteTarget)}
        title="Remove relationship?"
        description="This only removes the relationship record. It does not delete either asset."
        confirmLabel="Remove"
        isLoading={deleteRelationship.isPending}
        onCancel={() => setRelationshipDeleteTarget(null)}
        onConfirm={() => {
          if (relationshipDeleteTarget) deleteRelationship.mutate(relationshipDeleteTarget);
        }}
      />
    </div>
  );
}

const MetricCard = ({ label, value }: { label: string; value: string | JSX.Element }): JSX.Element => (
  <Card>
    <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">{label}</p>
    <div className="mt-2 text-sm font-semibold text-text-primary">{value}</div>
  </Card>
);

const Info = ({ label, value }: { label: string; value: string | JSX.Element | null | undefined }): JSX.Element => (
  <div>
    <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">{label}</dt>
    <dd className="mt-1 text-sm text-text-primary">{value || '—'}</dd>
  </div>
);

const OverviewTab = ({ asset }: { asset: Asset }): JSX.Element => (
  <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
    <Card className="lg:col-span-2">
      <CardHeader title="Asset profile" />
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Info label="Asset tag" value={<span className="font-mono">{asset.assetTag}</span>} />
        <Info label="Type" value={assetLabel(asset.assetType)} />
        <Info label="Lifecycle" value={assetLabel(asset.lifecycleState)} />
        <Info label="Category" value={asset.category} />
        <Info label="Owner" value={asset.owner?.displayName || `${asset.owner?.firstName ?? ''} ${asset.owner?.lastName ?? ''}`.trim()} />
        <Info label="Custodian" value={asset.custodian?.displayName || `${asset.custodian?.firstName ?? ''} ${asset.custodian?.lastName ?? ''}`.trim()} />
        <Info label="Department" value={asset.department} />
        <Info label="Location" value={asset.location} />
        <Info label="Environment" value={asset.environment} />
        <Info label="Source" value={`${assetLabel(asset.sourceSystem)}${asset.sourceId ? ` · ${asset.sourceId}` : ''}`} />
        <Info label="Created" value={formatDateTime(asset.createdAt)} />
        <Info label="Updated" value={formatDateTime(asset.updatedAt)} />
      </dl>
      {asset.description && <p className="mt-5 text-sm leading-6 text-text-secondary">{asset.description}</p>}
    </Card>

    <Card>
      <CardHeader title="Technical details" />
      <dl className="space-y-4">
        <Info label="Hostname" value={asset.hostname} />
        <Info label="IP address" value={asset.ipAddress} />
        <Info label="Serial" value={asset.serialNumber} />
        <Info label="Manufacturer" value={asset.manufacturer} />
        <Info label="Model" value={asset.model} />
        <Info label="Operating system" value={[asset.osName, asset.osVersion].filter(Boolean).join(' ')} />
        <Info label="Supplier" value={asset.supplier} />
      </dl>
    </Card>

    <Card className="lg:col-span-3">
      <CardHeader title="Metadata" subtitle="Additional JSON context captured with the asset." />
      {asset.metadata ? (
        <pre className="max-h-72 overflow-auto rounded-md border border-border bg-surface-alt p-3 text-xs text-text-secondary">
          {JSON.stringify(asset.metadata, null, 2)}
        </pre>
      ) : (
        <EmptyState compact title="No metadata recorded" />
      )}
    </Card>
  </div>
);

const RelationshipsTab = ({
  asset,
  canUpdate,
  relationships,
  isLoading,
  onAdd,
  onDelete,
}: {
  asset: Asset;
  canUpdate: boolean;
  relationships?: AssetRelationship[];
  isLoading: boolean;
  onAdd: () => void;
  onDelete: (relationship: AssetRelationship) => void;
}): JSX.Element => {
  const columns: Column<AssetRelationship>[] = [
    {
      key: 'direction',
      header: 'Direction',
      width: '120px',
      render: (relationship) => relationship.sourceAssetId === asset.id ? <Badge tone="blue">Outgoing</Badge> : <Badge tone="gray">Incoming</Badge>,
    },
    {
      key: 'asset',
      header: 'Linked asset',
      render: (relationship) => {
        const linked = relationship.sourceAssetId === asset.id ? relationship.targetAsset : relationship.sourceAsset;
        return linked ? (
          <Link href={`/assets/${linked.id}`} className="font-medium text-primary hover:underline">
            {linked.assetTag} — {linked.name}
          </Link>
        ) : '—';
      },
    },
    {
      key: 'type',
      header: 'Relationship',
      width: '160px',
      render: (relationship) => <Badge tone="gray">{assetLabel(relationship.relationshipType)}</Badge>,
    },
    {
      key: 'description',
      header: 'Description',
      render: (relationship) => <span className="text-text-secondary">{relationship.description ?? '—'}</span>,
    },
    {
      key: 'actions',
      header: '',
      width: '60px',
      align: 'right',
      render: (relationship) => canUpdate ? (
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-red-50 hover:text-danger"
          onClick={() => onDelete(relationship)}
          aria-label="Remove relationship"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ) : null,
    },
  ];

  return (
    <Card padded={false}>
      <div className="flex items-center justify-between px-5 pb-3 pt-5">
        <CardHeader title="Asset relationships" subtitle="Dependencies, hosting, integrations, and support links." className="mb-0" />
        {canUpdate && <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={onAdd}>Add</Button>}
      </div>
      <Table
        columns={columns}
        data={relationships}
        rowKey={(relationship) => relationship.id}
        isLoading={isLoading}
        density="compact"
        emptyState={<EmptyState compact icon={<Link2 className="h-4 w-4" />} title="No relationships recorded" />}
        className="rounded-none border-0 border-t border-border"
      />
    </Card>
  );
};

const AttestationsTab = ({
  canAttest,
  attestations,
  isLoading,
  onAdd,
}: {
  canAttest: boolean;
  attestations?: AssetAttestation[];
  isLoading: boolean;
  onAdd: () => void;
}): JSX.Element => {
  const columns: Column<AssetAttestation>[] = [
    { key: 'status', header: 'Status', width: '160px', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'by', header: 'Attested by', width: '220px', render: (row) => row.attestedBy?.displayName || row.attestedBy?.email || row.attestedById },
    { key: 'at', header: 'Date', width: '180px', render: (row) => <span className="text-xs text-text-secondary">{formatDateTime(row.attestedAt)}</span> },
    { key: 'notes', header: 'Notes', render: (row) => <span className="text-text-secondary">{row.notes ?? '—'}</span> },
  ];

  return (
    <Card padded={false}>
      <div className="flex items-center justify-between px-5 pb-3 pt-5">
        <CardHeader title="Attestation history" subtitle="Ownership and accuracy confirmations." className="mb-0" />
        {canAttest && <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={onAdd}>Attest</Button>}
      </div>
      <Table
        columns={columns}
        data={attestations}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        density="compact"
        emptyState={<EmptyState compact title="No attestations yet" />}
        className="rounded-none border-0 border-t border-border"
      />
    </Card>
  );
};

const SourcesTab = ({
  canAdmin,
  sources,
  isLoading,
  onAdd,
}: {
  canAdmin: boolean;
  sources?: AssetSource[];
  isLoading: boolean;
  onAdd: () => void;
}): JSX.Element => {
  const columns: Column<AssetSource>[] = [
    { key: 'system', header: 'System', width: '160px', render: (row) => <Badge tone="gray">{assetLabel(row.sourceSystem)}</Badge> },
    { key: 'sourceId', header: 'Source ID', render: (row) => <span className="font-mono text-xs">{row.sourceId}</span> },
    { key: 'status', header: 'Sync status', width: '130px', render: (row) => <StatusBadge status={row.syncStatus} /> },
    { key: 'lastSynced', header: 'Last synced', width: '180px', render: (row) => row.lastSyncedAt ? formatDateTime(row.lastSyncedAt) : '—' },
  ];

  return (
    <Card padded={false}>
      <div className="flex items-center justify-between px-5 pb-3 pt-5">
        <CardHeader title="Source records" subtitle="Provenance from approved systems and manual entry." className="mb-0" />
        {canAdmin && <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={onAdd}>Add source</Button>}
      </div>
      <Table
        columns={columns}
        data={sources}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        density="compact"
        emptyState={<EmptyState compact title="No source records" />}
        className="rounded-none border-0 border-t border-border"
      />
    </Card>
  );
};

const linkHref = (link: AssetLink): string | null => {
  if (link.linkedEntityType === 'audit_universe') return `/audit/universe/${link.linkedEntityId}`;
  if (link.linkedEntityType === 'audit_engagement') return `/audit/engagements/${link.linkedEntityId}`;
  if (link.linkedEntityType === 'audit_finding') return `/audit/findings/${link.linkedEntityId}`;
  if (link.linkedEntityType === 'risk_register') return `/risk/${link.linkedEntityId}`;
  return null;
};

const AuditContextTab = ({ links, isLoading }: { links: AssetLink[]; isLoading: boolean }): JSX.Element => {
  const columns: Column<AssetLink>[] = [
    { key: 'type', header: 'Entity type', width: '180px', render: (link) => <Badge tone="gray">{assetLabel(link.linkedEntityType)}</Badge> },
    {
      key: 'entity',
      header: 'Entity ID',
      render: (link) => {
        const href = linkHref(link);
        return href ? (
          <Link href={href} className="font-mono text-xs text-primary hover:underline">{link.linkedEntityId}</Link>
        ) : (
          <span className="font-mono text-xs text-text-secondary">{link.linkedEntityId}</span>
        );
      },
    },
    { key: 'context', header: 'Context', render: (link) => link.scopeRole || link.impactSummary || link.linkReason || '—' },
    { key: 'created', header: 'Linked', width: '170px', render: (link) => <span className="text-xs text-text-secondary">{formatDateTime(link.createdAt)}</span> },
  ];

  return (
    <Card padded={false}>
      <div className="px-5 pb-3 pt-5">
        <CardHeader title="Audit context" subtitle="Where this asset is used in universe, engagements, findings, risks, and evidence." className="mb-0" />
      </div>
      <Table
        columns={columns}
        data={links}
        rowKey={(link) => link.id}
        isLoading={isLoading}
        density="compact"
        emptyState={<EmptyState compact title="No audit links recorded" />}
        className="rounded-none border-0 border-t border-border"
      />
    </Card>
  );
};
