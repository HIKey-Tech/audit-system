'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Star, Pencil, Trash2, FileText } from 'lucide-react';
import { toast } from 'sonner';

import { Table, type Column } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { wpTemplatesApi } from '@/lib/api/settings';
import type { WorkingPaperTemplateDto } from '@/lib/types/domain';
import { WPTemplateSlideOver } from './WPTemplateSlideOver';

const AUDIT_TYPE_TONE: Record<string, 'blue' | 'green' | 'amber' | 'purple' | 'gray'> = {
  it: 'blue',
  financial: 'green',
  compliance: 'amber',
  all: 'gray',
};

export const WorkingPaperTemplatesTab = (): JSX.Element => {
  const qc = useQueryClient();
  const [slideOpen, setSlideOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<WorkingPaperTemplateDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkingPaperTemplateDto | null>(null);

  const query = useQuery({
    queryKey: ['settings', 'wp-templates'],
    queryFn: wpTemplatesApi.list,
  });

  const setDefaultMut = useMutation({
    mutationFn: (id: string) => wpTemplatesApi.setDefault(id),
    onSuccess: () => {
      toast.success('Default template updated');
      qc.invalidateQueries({ queryKey: ['settings', 'wp-templates'] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Failed to set default'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => wpTemplatesApi.remove(id),
    onSuccess: () => {
      toast.success('Template removed');
      qc.invalidateQueries({ queryKey: ['settings', 'wp-templates'] });
      setDeleteTarget(null);
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Failed to remove template'),
  });

  const columns: Column<WorkingPaperTemplateDto>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (t) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-text-primary">{t.name}</p>
          {t.description && (
            <p className="truncate text-[11px] text-text-secondary">{t.description}</p>
          )}
        </div>
      ),
    },
    {
      key: 'auditType',
      header: 'Audit Type',
      width: '140px',
      render: (t) => (
        <Badge tone={AUDIT_TYPE_TONE[t.auditType] ?? 'gray'}>
          {t.auditType.toUpperCase()}
        </Badge>
      ),
    },
    {
      key: 'sections',
      header: 'Sections',
      width: '100px',
      render: (t) => (
        <span className="text-text-secondary">{t.sections.length}</span>
      ),
    },
    {
      key: 'isDefault',
      header: 'Default',
      width: '100px',
      render: (t) =>
        t.isDefault ? (
          <Badge tone="green">
            <Star className="mr-1 h-2.5 w-2.5" />
            Default
          </Badge>
        ) : (
          <span className="text-text-muted text-xs">—</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '240px',
      render: (t) => (
        <div className="flex items-center justify-end gap-1.5">
          {!t.isDefault && (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Star className="h-3.5 w-3.5" />}
              onClick={(e) => {
                e.stopPropagation();
                setDefaultMut.mutate(t.id);
              }}
              isLoading={setDefaultMut.isPending}
            >
              Set default
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Pencil className="h-3.5 w-3.5" />}
            onClick={(e) => {
              e.stopPropagation();
              setEditTarget(t);
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
              setDeleteTarget(t);
            }}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          {query.data?.length ?? 0} template{(query.data?.length ?? 0) !== 1 ? 's' : ''}
        </p>
        <Button
          leftIcon={<Plus className="h-4 w-4" />}
          size="sm"
          onClick={() => {
            setEditTarget(null);
            setSlideOpen(true);
          }}
        >
          Create Template
        </Button>
      </div>

      <Table<WorkingPaperTemplateDto>
        columns={columns}
        data={query.data}
        rowKey={(t) => t.id}
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => query.refetch()}
        emptyState={
          <EmptyState
            icon={<FileText className="h-4 w-4" />}
            title="No working paper templates"
            description="Create a template to standardise how auditors document their work."
            action={
              <Button
                size="sm"
                leftIcon={<Plus className="h-3.5 w-3.5" />}
                onClick={() => {
                  setEditTarget(null);
                  setSlideOpen(true);
                }}
              >
                Create Template
              </Button>
            }
          />
        }
      />

      <WPTemplateSlideOver
        open={slideOpen}
        onClose={() => {
          setSlideOpen(false);
          setEditTarget(null);
        }}
        template={editTarget}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`Remove template "${deleteTarget?.name}"?`}
        description="This will deactivate the template. It cannot be restored."
        confirmLabel="Remove template"
        variant="danger"
        isLoading={deleteMut.isPending}
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
