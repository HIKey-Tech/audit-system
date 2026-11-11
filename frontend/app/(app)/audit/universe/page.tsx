'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Globe, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Table, type Column } from '@/components/ui/Table';
import { Input, Select } from '@/components/ui/Input';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue';
import { universeApi } from '@/lib/api/audit';
import { formatDate, formatNumber } from '@/lib/utils/format';
import { humanizeStatus, riskScoreLabel, riskScoreTone } from '@/lib/utils/status';
import type { AuditUniverseEntity } from '@/lib/types/domain';
import { UniverseFormSlideOver } from '@/components/audit/universe/UniverseFormSlideOver';

export default function UniverseListPage(): JSX.Element {
  const router = useRouter();
  const qc = useQueryClient();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('universe:create');
  const canUpdate = hasPermission('universe:update');
  const canDelete = hasPermission('universe:delete');

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [auditFrequency, setAuditFrequency] = useState('');
  const [status, setStatus] = useState('');
  const [slideOpen, setSlideOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<AuditUniverseEntity | null>(null);
  const [deletingEntity, setDeletingEntity] = useState<AuditUniverseEntity | null>(null);

  const debouncedSearch = useDebouncedValue(search, 300);

  const query = useQuery({
    queryKey: ['universe', { page, search: debouncedSearch, category, auditFrequency, status }],
    queryFn: () =>
      universeApi.list({
        page,
        pageSize: 20,
        search: debouncedSearch || undefined,
        category: category || undefined,
        auditFrequency: auditFrequency || undefined,
        status: status || undefined,
      }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => universeApi.remove(id),
    onSuccess: () => {
      toast.success('Entity removed from audit universe');
      qc.invalidateQueries({ queryKey: ['universe'] });
      qc.invalidateQueries({ queryKey: ['plans', 'recommendations'] });
      qc.invalidateQueries({ queryKey: ['plans'] });
      setDeletingEntity(null);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to remove entity');
      setDeletingEntity(null);
    },
  });

  const columns: Column<AuditUniverseEntity>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (e) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-text-primary">{e.name}</p>
          {e.description && (
            <p className="truncate text-[11px] text-text-secondary">{e.description}</p>
          )}
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (e) => <Badge tone="gray">{humanizeStatus(e.category)}</Badge>,
      width: '130px',
    },
    {
      key: 'owner',
      header: 'Owners',
      render: (e) => {
        const allNames =
          e.owners && e.owners.length > 0
            ? e.owners.map((o) => o.name).filter(Boolean).join(', ')
            : e.ownerName;
        const extraCount = (e.owners?.length ?? 1) - 1;
        return (
          <div className="flex items-center gap-1.5 min-w-0" title={allNames}>
            <span className="truncate text-text-secondary">{e.ownerName || '—'}</span>
            {extraCount > 0 && (
              <Badge tone="gray" className="shrink-0 text-[10px] py-0 px-1.5">
                +{extraCount}
              </Badge>
            )}
          </div>
        );
      },
      width: '200px',
    },
    {
      key: 'risk',
      header: 'Risk Score',
      render: (e) => {
        const t = riskScoreTone(e.riskScore);
        return (
          <span
            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ${t.bg} ${t.text} ${t.ring}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
            {formatNumber(e.riskScore)} · {riskScoreLabel(e.riskScore)}
          </span>
        );
      },
      width: '165px',
    },
    {
      key: 'frequency',
      header: 'Frequency',
      render: (e) => <span className="text-text-secondary">{humanizeStatus(e.auditFrequency)}</span>,
      width: '125px',
    },
    {
      key: 'lastAudited',
      header: 'Last Audited',
      render: (e) => (
        <span className="text-text-secondary">
          {e.lastAuditedAt ? formatDate(e.lastAuditedAt) : 'Never'}
        </span>
      ),
      width: '125px',
    },
    {
      key: 'status',
      header: 'Status',
      render: (e) => <StatusBadge status={e.status} />,
      width: '105px',
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: canUpdate || canDelete ? '155px' : '85px',
      render: (e) => (
        <div className="inline-flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(ev) => {
              ev.stopPropagation();
              router.push(`/audit/universe/${e.id}`);
            }}
          >
            View
          </Button>
          {canUpdate && (
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Edit ${e.name}`}
              title="Edit entity"
              onClick={(ev) => {
                ev.stopPropagation();
                setEditingEntity(e);
                setSlideOpen(true);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Remove ${e.name}`}
              title="Remove entity"
              className="text-danger hover:text-danger"
              onClick={(ev) => {
                ev.stopPropagation();
                setDeletingEntity(e);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Audit Universe"
        subtitle="Departments, systems, processes, assets and projects in the audit scope."
        actions={
          canCreate ? (
            <Button
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => {
                setEditingEntity(null);
                setSlideOpen(true);
              }}
            >
              New Entity
            </Button>
          ) : null
        }
      />

      <Card padded className="mb-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            placeholder="Search by name or description…"
            leftIcon={<Search className="h-4 w-4" />}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <Select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All categories</option>
            <option value="department">Department</option>
            <option value="system">System</option>
            <option value="process">Process</option>
            <option value="asset">Asset</option>
            <option value="project">Project</option>
          </Select>
          <Select
            value={auditFrequency}
            onChange={(e) => {
              setAuditFrequency(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All frequencies</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="biannual">Bi-annual</option>
            <option value="annual">Annual</option>
            <option value="on_demand">On-Demand</option>
          </Select>
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>
      </Card>

      <Table<AuditUniverseEntity>
        columns={columns}
        data={query.data?.items}
        rowKey={(r) => r.id}
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => query.refetch()}
        onRowClick={(row) => router.push(`/audit/universe/${row.id}`)}
        emptyState={
          <EmptyState
            icon={<Globe className="h-4 w-4" />}
            title="No auditable entities yet"
            description="Add your first entity to start defining the GBB audit universe."
            action={
              canCreate ? (
                <Button
                  size="sm"
                  leftIcon={<Plus className="h-3.5 w-3.5" />}
                  onClick={() => {
                    setEditingEntity(null);
                    setSlideOpen(true);
                  }}
                >
                  New Entity
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
                onPageChange: setPage,
              }
            : undefined
        }
      />

      <UniverseFormSlideOver
        open={slideOpen}
        entity={editingEntity}
        onClose={() => {
          setSlideOpen(false);
          setEditingEntity(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(deletingEntity)}
        title="Remove auditable entity"
        description={
          deletingEntity
            ? `Remove "${deletingEntity.name}" from the Audit Universe? Entities referenced by audit plans, engagements, risks, assets, or system documents cannot be removed and must be deactivated instead.`
            : undefined
        }
        confirmLabel="Remove entity"
        isLoading={deleteMut.isPending}
        onCancel={() => setDeletingEntity(null)}
        onConfirm={() => {
          if (deletingEntity) deleteMut.mutate(deletingEntity.id);
        }}
      />
    </div>
  );
}
