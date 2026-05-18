'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Star, Eye, Pencil, Trash2, BookOpen } from 'lucide-react';
import { toast } from 'sonner';

import { Table, type Column } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { reportTemplatesApi } from '@/lib/api/settings';
import type { ReportTemplateDto } from '@/lib/types/domain';
import { ReportTemplateViewSlideOver } from './ReportTemplateViewSlideOver';
import { ReportTemplateFormSlideOver } from './ReportTemplateFormSlideOver';

export const ReportTemplatesTab = (): JSX.Element => {
  const qc = useQueryClient();
  const [viewTarget, setViewTarget] = useState<ReportTemplateDto | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ReportTemplateDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ReportTemplateDto | null>(null);

  const query = useQuery({
    queryKey: ['settings', 'report-templates'],
    queryFn: reportTemplatesApi.list,
  });

  const setDefaultMut = useMutation({
    mutationFn: (id: string) => reportTemplatesApi.setDefault(id),
    onSuccess: () => {
      toast.success('Default report template updated');
      qc.invalidateQueries({ queryKey: ['settings', 'report-templates'] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Failed to set default'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => reportTemplatesApi.remove(id),
    onSuccess: () => {
      toast.success('Template removed');
      qc.invalidateQueries({ queryKey: ['settings', 'report-templates'] });
      setDeleteTarget(null);
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Failed to remove template'),
  });

  const columns: Column<ReportTemplateDto>[] = [
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
      key: 'sections',
      header: 'Sections',
      width: '100px',
      render: (t) => (
        <span className="text-text-secondary">{t.sections.length}</span>
      ),
    },
    {
      key: 'variables',
      header: 'Variables',
      width: '100px',
      render: (t) => (
        <span className="text-text-secondary">{t.availableVariables.length}</span>
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
      width: '280px',
      render: (t) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Eye className="h-3.5 w-3.5" />}
            onClick={(e) => {
              e.stopPropagation();
              setViewTarget(t);
            }}
          >
            View
          </Button>
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
              setFormOpen(true);
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
            setFormOpen(true);
          }}
        >
          Create Template
        </Button>
      </div>

      <Table<ReportTemplateDto>
        columns={columns}
        data={query.data}
        rowKey={(t) => t.id}
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => query.refetch()}
        emptyState={
          <EmptyState
            icon={<BookOpen className="h-4 w-4" />}
            title="No report templates"
            description="Create a report template to standardise audit report structure."
            action={
              <Button
                size="sm"
                leftIcon={<Plus className="h-3.5 w-3.5" />}
                onClick={() => {
                  setEditTarget(null);
                  setFormOpen(true);
                }}
              >
                Create Template
              </Button>
            }
          />
        }
      />

      {viewTarget && (
        <ReportTemplateViewSlideOver
          open={Boolean(viewTarget)}
          onClose={() => setViewTarget(null)}
          template={viewTarget}
        />
      )}

      <ReportTemplateFormSlideOver
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditTarget(null);
        }}
        template={editTarget}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`Remove template "${deleteTarget?.name}"?`}
        description="This will deactivate the template and cannot be undone."
        confirmLabel="Remove template"
        variant="danger"
        isLoading={deleteMut.isPending}
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
