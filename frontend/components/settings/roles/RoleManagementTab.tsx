'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Lock, Pencil, Trash2, ShieldCheck, Users } from 'lucide-react';
import { toast } from 'sonner';

import { Table, type Column } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { rolesApi } from '@/lib/api/settings';
import type { RoleListDto } from '@/lib/types/domain';
import { CreateRoleSlideOver } from './CreateRoleSlideOver';
import { EditPermissionsSlideOver } from './EditPermissionsSlideOver';

export const RoleManagementTab = (): JSX.Element => {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editPermsRole, setEditPermsRole] = useState<RoleListDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoleListDto | null>(null);

  const query = useQuery({
    queryKey: ['settings', 'roles'],
    queryFn: rolesApi.list,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => rolesApi.remove(id),
    onSuccess: () => {
      toast.success('Role deleted');
      qc.invalidateQueries({ queryKey: ['settings', 'roles'] });
      setDeleteTarget(null);
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Failed to delete role'),
  });

  const columns: Column<RoleListDto>[] = [
    {
      key: 'name',
      header: 'Role',
      render: (r) => (
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-text-primary truncate">{r.name}</span>
          {r.isSystem && (
            <Badge tone="purple">
              <Lock className="mr-1 h-2.5 w-2.5" />
              System
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (r) => (
        <span className="text-text-secondary text-sm">
          {r.description ?? <span className="italic text-text-muted">No description</span>}
        </span>
      ),
    },
    {
      key: 'permissions',
      header: 'Permissions',
      width: '140px',
      render: (r) => (
        <Badge tone="blue">
          {r.permissions.length} permission{r.permissions.length !== 1 ? 's' : ''}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '200px',
      render: (r) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Pencil className="h-3.5 w-3.5" />}
            onClick={(e) => {
              e.stopPropagation();
              setEditPermsRole(r);
            }}
          >
            Permissions
          </Button>
          {!r.isSystem && (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Trash2 className="h-3.5 w-3.5 text-danger" />}
              className="text-danger hover:text-danger hover:bg-red-50"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(r);
              }}
            >
              Delete
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-text-secondary">
            {query.data?.length ?? 0} role{(query.data?.length ?? 0) !== 1 ? 's' : ''}
          </p>
        </div>
        <Button
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={() => setCreateOpen(true)}
          size="sm"
        >
          Create Role
        </Button>
      </div>

      <Table<RoleListDto>
        columns={columns}
        data={query.data}
        rowKey={(r) => r.id}
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => query.refetch()}
        emptyState={
          <EmptyState
            icon={<Users className="h-4 w-4" />}
            title="No roles defined"
            description="Create your first custom role to start managing access."
            action={
              <Button
                size="sm"
                leftIcon={<Plus className="h-3.5 w-3.5" />}
                onClick={() => setCreateOpen(true)}
              >
                Create Role
              </Button>
            }
          />
        }
      />

      <CreateRoleSlideOver open={createOpen} onClose={() => setCreateOpen(false)} />

      {editPermsRole && (
        <EditPermissionsSlideOver
          role={editPermsRole}
          open={Boolean(editPermsRole)}
          onClose={() => setEditPermsRole(null)}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`Delete role "${deleteTarget?.name}"?`}
        description="This cannot be undone. Users assigned this role will lose its permissions."
        confirmLabel="Delete role"
        variant="danger"
        isLoading={deleteMut.isPending}
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
