'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, Search, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Table, type Column } from '@/components/ui/Table';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { documentsApi } from '@/lib/api/documents';
import { formatDate } from '@/lib/utils/format';
import { usePermission } from '@/hooks/usePermission';
import type { DocumentDto } from '@/lib/types/domain';

const ENTITY_LABELS: Record<string, string> = {
  audit_engagement: 'Engagement',
  audit_working_paper: 'Working Paper',
  audit_finding: 'Finding',
  audit_evidence: 'Evidence',
};

const extensionOf = (fileName: string): string => {
  const dot = fileName.lastIndexOf('.');
  if (dot === -1 || dot === fileName.length - 1) return 'FILE';
  return fileName.slice(dot + 1).toUpperCase();
};

const linkedToLabel = (entityType: string | null): string => {
  if (!entityType) return 'Standalone';
  return ENTITY_LABELS[entityType] ?? entityType;
};

export default function DocumentsPage(): JSX.Element | null {
  const qc = useQueryClient();
  // Personal storage: every authenticated user can view their own documents, so
  // viewing is not gated on a permission. Upload/delete remain permission-gated.
  const canWrite = usePermission('document:write');
  const canDelete = usePermission('document:delete');

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [entityType, setEntityType] = useState('');
  const [pendingDelete, setPendingDelete] = useState<DocumentDto | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const list = useQuery({
    queryKey: ['documents', { page, search, entityType }],
    queryFn: () =>
      documentsApi.list({
        page,
        pageSize: 20,
        search: search.trim() || undefined,
        entityType: entityType || undefined,
      }),
  });

  const upload = useMutation({
    mutationFn: (file: File) => documentsApi.upload(file),
    onSuccess: () => {
      toast.success('Document uploaded');
      qc.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to upload'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => documentsApi.remove(id),
    onSuccess: () => {
      toast.success('Document deleted');
      setPendingDelete(null);
      qc.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to delete'),
  });

  const download = useMutation({
    mutationFn: ({ id, fileName }: { id: string; fileName: string }) =>
      documentsApi.download(id, fileName),
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to download'),
  });

  const columns: Column<DocumentDto>[] = [
    {
      key: 'fileName',
      header: 'File Name',
      render: (d) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-text-primary">{d.fileName}</p>
          {d.versionNumber > 1 && (
            <p className="text-[11px] text-text-muted">Version {d.versionNumber}</p>
          )}
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (d) => <Badge tone="gray">{extensionOf(d.fileName)}</Badge>,
      width: '110px',
    },
    {
      key: 'linkedTo',
      header: 'Linked To',
      render: (d) => (
        <span className="text-text-secondary">{linkedToLabel(d.entityType)}</span>
      ),
      width: '160px',
    },
    {
      key: 'uploadedBy',
      header: 'Uploaded By',
      render: (d) => (
        <span className="text-text-secondary">{d.uploadedByName || '—'}</span>
      ),
      width: '180px',
    },
    {
      key: 'date',
      header: 'Date',
      render: (d) => <span className="text-text-secondary">{formatDate(d.createdAt)}</span>,
      width: '130px',
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: canDelete ? '170px' : '120px',
      render: (d) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Download className="h-3.5 w-3.5" />}
            isLoading={download.isPending && download.variables?.id === d.id}
            onClick={() => download.mutate({ id: d.id, fileName: d.fileName })}
          >
            Download
          </Button>
          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Trash2 className="h-3.5 w-3.5" />}
              onClick={() => setPendingDelete(d)}
              aria-label={`Delete ${d.fileName}`}
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Documents"
        subtitle="Your uploaded files. Only you can see the documents listed here."
        actions={
          canWrite ? (
            <Button
              leftIcon={<Upload className="h-4 w-4" />}
              onClick={() => inputRef.current?.click()}
              isLoading={upload.isPending}
            >
              Upload Document
            </Button>
          ) : null
        }
      />
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload.mutate(f);
          e.target.value = '';
        }}
      />

      <Card padded className="mb-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_220px]">
          <Input
            placeholder="Search by file name…"
            leftIcon={<Search className="h-4 w-4" />}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <Select
            value={entityType}
            onChange={(e) => {
              setEntityType(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All entity types</option>
            <option value="audit_engagement">Engagement</option>
            <option value="audit_working_paper">Working Paper</option>
            <option value="audit_finding">Finding</option>
            <option value="audit_evidence">Evidence</option>
          </Select>
        </div>
      </Card>

      <Table<DocumentDto>
        columns={columns}
        data={list.data?.items}
        rowKey={(d) => d.id}
        isLoading={list.isLoading}
        isError={list.isError}
        onRetry={() => list.refetch()}
        emptyState={
          <EmptyState
            icon={<FileText className="h-4 w-4" />}
            title="No documents yet"
            description={
              search || entityType
                ? 'No documents match the current filters.'
                : 'Upload a file to get started.'
            }
            action={
              canWrite && !search && !entityType ? (
                <Button
                  size="sm"
                  leftIcon={<Upload className="h-3.5 w-3.5" />}
                  onClick={() => inputRef.current?.click()}
                  isLoading={upload.isPending}
                >
                  Upload Document
                </Button>
              ) : undefined
            }
          />
        }
        pagination={
          list.data
            ? {
                page: list.data.meta.page,
                pageSize: list.data.meta.pageSize,
                total: list.data.meta.total,
                onPageChange: setPage,
              }
            : undefined
        }
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete document?"
        description={
          pendingDelete
            ? `“${pendingDelete.fileName}” will be removed. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        variant="danger"
        isLoading={remove.isPending}
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete.id)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
