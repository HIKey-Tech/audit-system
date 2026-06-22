'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Network, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Table, type Column } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { directoryApi, type DirectoryMappingDto } from '@/lib/api/directory';
import { DirectoryMappingSlideOver } from './DirectoryMappingSlideOver';

export const DirectoryMappingsTab = (): JSX.Element => {
  const qc = useQueryClient();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('settings:manage');

  const [slideOpen, setSlideOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<DirectoryMappingDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DirectoryMappingDto | null>(null);

  const query = useQuery({
    queryKey: ['settings', 'directory-mappings'],
    queryFn: directoryApi.list,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => directoryApi.remove(id),
    onSuccess: () => {
      toast.success('Mapping removed');
      qc.invalidateQueries({ queryKey: ['settings', 'directory-mappings'] });
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to remove mapping'),
  });

  const syncMut = useMutation({
    mutationFn: () => directoryApi.syncNow(),
    onSuccess: (res) => {
      toast.success(
        `Sync complete — ${res.usersProcessed} user${res.usersProcessed === 1 ? '' : 's'} reconciled, ${res.deactivated} deactivated`,
      );
      qc.invalidateQueries({ queryKey: ['settings', 'directory-mappings'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Directory sync failed'),
  });

  const columns: Column<DirectoryMappingDto>[] = [
    {
      key: 'adGroupName',
      header: 'Azure AD Group',
      render: (m) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-text-primary">{m.adGroupName}</p>
          <p className="truncate font-mono text-[11px] text-text-secondary">{m.adGroupId}</p>
        </div>
      ),
    },
    {
      key: 'roleName',
      header: 'IAMS Role',
      width: '200px',
      render: (m) => <Badge tone="blue">{m.roleName ?? m.roleId}</Badge>,
    },
    {
      key: 'isActive',
      header: 'Status',
      width: '110px',
      render: (m) =>
        m.isActive ? (
          <Badge tone="green">Active</Badge>
        ) : (
          <Badge tone="gray">Inactive</Badge>
        ),
    },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: '',
            align: 'right' as const,
            width: '180px',
            render: (m: DirectoryMappingDto) => (
              <div className="flex items-center justify-end gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Pencil className="h-3.5 w-3.5" />}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditTarget(m);
                    setSlideOpen(true);
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Trash2 className="h-3.5 w-3.5 text-danger" />}
                  className="text-danger hover:text-danger hover:bg-red-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(m);
                  }}
                >
                  Delete
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">
          {query.data?.length ?? 0} mapping{(query.data?.length ?? 0) !== 1 ? 's' : ''}
          <span className="ml-2 text-text-muted">
            · Azure AD group membership grants the mapped IAMS role on sign-in.
          </span>
        </p>
        {canManage && (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
              onClick={() => syncMut.mutate()}
              isLoading={syncMut.isPending}
            >
              Sync now
            </Button>
            <Button
              leftIcon={<Plus className="h-4 w-4" />}
              size="sm"
              onClick={() => {
                setEditTarget(null);
                setSlideOpen(true);
              }}
            >
              New mapping
            </Button>
          </div>
        )}
      </div>

      <Table<DirectoryMappingDto>
        columns={columns}
        data={query.data}
        rowKey={(m) => m.id}
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => query.refetch()}
        emptyState={
          <EmptyState
            icon={<Network className="h-4 w-4" />}
            title="No directory mappings"
            description="Map an Azure AD security group to an IAMS role so members are granted access automatically when they sign in."
            action={
              canManage ? (
                <Button
                  size="sm"
                  leftIcon={<Plus className="h-3.5 w-3.5" />}
                  onClick={() => {
                    setEditTarget(null);
                    setSlideOpen(true);
                  }}
                >
                  New mapping
                </Button>
              ) : undefined
            }
          />
        }
      />

      <DirectoryMappingSlideOver
        open={slideOpen}
        onClose={() => {
          setSlideOpen(false);
          setEditTarget(null);
        }}
        mapping={editTarget}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`Remove mapping for "${deleteTarget?.adGroupName}"?`}
        description="Members of this group will no longer be granted the mapped role on their next sign-in or sync. Existing manual role assignments are unaffected."
        confirmLabel="Remove mapping"
        variant="danger"
        isLoading={deleteMut.isPending}
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
