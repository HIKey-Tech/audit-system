'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Search, UserCog } from 'lucide-react';

import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Table, type Column } from '@/components/ui/Table';
import { Input, Select } from '@/components/ui/Input';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { usersApi } from '@/lib/api/users';
import { initialsFromName } from '@/lib/utils/format';
import { UserFormSlideOver } from '@/components/users/UserFormSlideOver';
import { UserDetailSlideOver } from '@/components/users/UserDetailSlideOver';
import type { UserDto } from '@/lib/types/domain';

type UserAction = 'activate' | 'deactivate' | 'delete';

export default function UsersPage(): JSX.Element {
  const { user: currentUser, canManageUsers, canDeactivateUsers, canDeleteUsers } = usePermissions();
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleId, setRoleId] = useState('');
  const [slideOpen, setSlideOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<UserDto | null>(null);
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    type: UserAction;
    user: UserDto;
  } | null>(null);

  const query = useQuery({
    queryKey: ['users', { page, search, roleId }],
    queryFn: () =>
      usersApi.list({
        page,
        pageSize: 20,
        search: search || undefined,
        roleId: roleId || undefined,
      }),
  });

  const rolesQuery = useQuery({
    queryKey: ['users', 'roles'],
    queryFn: () => usersApi.getRoles(),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      isActive ? usersApi.activate(id) : usersApi.deactivate(id),
    onSuccess: (updated) => {
      toast.success(updated.isActive ? 'User activated' : 'User deactivated');
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['users', updated.id] });
      setPendingAction(null);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to update user status'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess: () => {
      toast.success('User deleted');
      qc.invalidateQueries({ queryKey: ['users'] });
      if (pendingAction?.user.id === detailUserId) setDetailUserId(null);
      setPendingAction(null);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to delete user'),
  });

  const openCreate = () => {
    setEditTarget(null);
    setSlideOpen(true);
  };

  const openEdit = (u: UserDto, ev: React.MouseEvent) => {
    ev.stopPropagation();
    setEditTarget(u);
    setSlideOpen(true);
  };

  const confirmAction = () => {
    if (!pendingAction) return;

    if (pendingAction.type === 'activate') {
      statusMut.mutate({ id: pendingAction.user.id, isActive: true });
      return;
    }

    if (pendingAction.type === 'deactivate') {
      statusMut.mutate({ id: pendingAction.user.id, isActive: false });
      return;
    }

    deleteMut.mutate(pendingAction.user.id);
  };

  const columns: Column<UserDto>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (u) => (
        <div className="flex items-center gap-3 min-w-0">
          <Avatar
            initials={initialsFromName(u.firstName, u.lastName, u.displayName)}
            size="sm"
            tone="navy"
          />
          <div className="min-w-0">
            <p className="truncate font-medium text-text-primary">
              {u.displayName ?? `${u.firstName} ${u.lastName}`}
            </p>
            <p className="truncate text-[11px] text-text-secondary">{u.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'jobTitle',
      header: 'Job Title',
      render: (u) => (
        <span className="text-text-secondary">{u.jobTitle ?? '—'}</span>
      ),
      width: '180px',
    },
    {
      key: 'department',
      header: 'Department',
      render: (u) => (
        <span className="text-text-secondary">{u.department ?? '—'}</span>
      ),
      width: '160px',
    },
    {
      key: 'roles',
      header: 'Roles',
      render: (u) =>
        u.roles.length === 0 ? (
          <span className="text-text-muted text-xs">—</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {u.roles.slice(0, 2).map((r) => (
              <Badge key={r.id} tone="blue">
                {r.name.replace(/_/g, ' ')}
              </Badge>
            ))}
            {u.roles.length > 2 && (
              <Badge tone="gray">+{u.roles.length - 2}</Badge>
            )}
          </div>
        ),
      width: '220px',
    },
    {
      key: 'status',
      header: 'Status',
      render: (u) => (
        <StatusBadge status={u.isActive ? 'active' : 'inactive'} withDot />
      ),
      width: '100px',
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '280px',
      render: (u) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(ev) => {
              ev.stopPropagation();
              setDetailUserId(u.id);
            }}
          >
            View
          </Button>
          {canManageUsers && (
            <Button variant="ghost" size="sm" onClick={(ev) => openEdit(u, ev)}>
              Edit
            </Button>
          )}
          {canDeactivateUsers && u.id !== currentUser.id && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(ev) => {
                ev.stopPropagation();
                setPendingAction({
                  type: u.isActive ? 'deactivate' : 'activate',
                  user: u,
                });
              }}
            >
              {u.isActive ? 'Deactivate' : 'Activate'}
            </Button>
          )}
          {canDeleteUsers && u.id !== currentUser.id && (
            <Button
              variant="ghost"
              size="sm"
              className="text-danger hover:text-danger"
              onClick={(ev) => {
                ev.stopPropagation();
                setPendingAction({ type: 'delete', user: u });
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
      <PageHeader
        title="Users"
        subtitle="System users and their role assignments within the GBB IAMS platform."
        actions={
          canManageUsers ? (
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>
              New User
            </Button>
          ) : null
        }
      />

      <Card padded className="mb-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            placeholder="Search by name or email…"
            leftIcon={<Search className="h-4 w-4" />}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <Select
            value={roleId}
            onChange={(e) => {
              setRoleId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All roles</option>
            {(rolesQuery.data ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name.replace(/_/g, ' ')}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <Table<UserDto>
        columns={columns}
        data={query.data?.items}
        rowKey={(u) => u.id}
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => query.refetch()}
        onRowClick={(u) => setDetailUserId(u.id)}
        emptyState={
          <EmptyState
            icon={<UserCog className="h-4 w-4" />}
            title="No users found"
            description="Create the first user to grant access to the GBB IAMS platform."
            action={
              canManageUsers ? (
                <Button
                  size="sm"
                  leftIcon={<Plus className="h-3.5 w-3.5" />}
                  onClick={openCreate}
                >
                  New User
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

      <UserFormSlideOver
        open={slideOpen}
        onClose={() => setSlideOpen(false)}
        user={editTarget}
      />

      <UserDetailSlideOver
        userId={detailUserId}
        onClose={() => setDetailUserId(null)}
      />

      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={
          pendingAction?.type === 'delete'
            ? 'Delete user?'
            : pendingAction?.type === 'deactivate'
              ? 'Deactivate user?'
              : 'Activate user?'
        }
        description={
          pendingAction ? (
            <span>
              {pendingAction.type === 'delete'
                ? 'This soft-deletes the user and removes them from normal user lists.'
                : pendingAction.type === 'deactivate'
                  ? 'This blocks the user from signing in until reactivated.'
                  : 'This allows the user to sign in again.'}
            </span>
          ) : null
        }
        confirmLabel={
          pendingAction?.type === 'delete'
            ? 'Delete'
            : pendingAction?.type === 'deactivate'
              ? 'Deactivate'
              : 'Activate'
        }
        variant={pendingAction?.type === 'activate' ? 'primary' : 'danger'}
        isLoading={statusMut.isPending || deleteMut.isPending}
        onConfirm={confirmAction}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
}
