'use client';

import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Download, History, Lock, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Select } from '@/components/ui/Input';
import { Table, type Column } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SystemDocumentSlideOver, type DocumentPanelMode } from '@/components/system-audit/SystemDocumentSlideOver';
import { StatTile } from '@/components/system-audit/shared';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useQueryFilters } from '@/lib/hooks/useQueryFilters';
import { useSearchInput } from '@/lib/hooks/useSearchInput';
import { systemAuditApi, type SystemDocument, type SystemDocumentType } from '@/lib/api/system-audit';
import { DOC_TYPE_LABELS } from '@/lib/system-audit';
import { formatDate } from '@/lib/utils/format';

export default function SystemDocumentationPage(): JSX.Element {
  const qc = useQueryClient();
  const { hasPermission } = usePermissions();
  const canRead = hasPermission('sysdoc:read');
  const canManage = hasPermission('sysdoc:manage');
  const [panel, setPanel] = useState<{ mode: DocumentPanelMode; doc?: SystemDocument } | null>(null);
  const [toDelete, setToDelete] = useState<SystemDocument | null>(null);

  const { values, set } = useQueryFilters({ page: '1', docType: '', attention: '', status: 'active', search: '' });
  const page = Math.max(1, Number(values.page) || 1);
  const [searchInput, setSearchInput] = useSearchInput(values.search, useCallback((next: string) => set({ search: next, page: '1' }), [set]));

  const docs = useQuery({
    queryKey: ['system-audit', 'documentation', values],
    queryFn: () =>
      systemAuditApi.listDocuments({
        page,
        pageSize: 20,
        docType: (values.docType || undefined) as SystemDocumentType | undefined,
        status: values.status as 'active' | 'archived',
        reviewState: values.attention === 'overdue' || values.attention === 'due_soon' ? values.attention : undefined,
        contractState: values.attention === 'expired' || values.attention === 'expiring' ? values.attention : undefined,
        search: values.search || undefined,
      }),
    enabled: canRead,
  });
  const summary = useQuery({ queryKey: ['system-audit', 'documentation', 'summary'], queryFn: () => systemAuditApi.documentSummary(), enabled: canRead });

  const remove = useMutation({
    mutationFn: (id: string) => systemAuditApi.deleteDocument(id),
    onSuccess: () => { toast.success('Document removed'); setToDelete(null); qc.invalidateQueries({ queryKey: ['system-audit'] }); },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not remove the document'),
  });

  if (!canRead) {
    return (
      <div>
        <PageHeader title="System documentation" />
        <Card><EmptyState icon={<Lock className="h-4 w-4" />} title="You do not have access to the documentation library" /></Card>
      </div>
    );
  }

  const columns: Column<SystemDocument>[] = [
    {
      key: 'title',
      header: 'Document',
      render: (d) => (
        <div>
          <p className="font-medium text-text-primary">{d.title}{d.versionLabel && <span className="ml-1.5 text-xs font-normal text-text-muted">{d.versionLabel}</span>}</p>
          <p className="text-xs text-text-secondary">{d.file.fileName} · v{d.file.versionNumber}{d.vendor ? ` · ${d.vendor}` : ''}</p>
        </div>
      ),
    },
    { key: 'type', header: 'Type', render: (d) => <Badge tone="gray" size="xs">{DOC_TYPE_LABELS[d.docType]}</Badge>, width: '170px' },
    {
      key: 'scope',
      header: 'Audit scope',
      render: (d) => <span className="text-xs text-text-secondary">{[d.universe?.name, d.asset ? `${d.asset.assetTag} ${d.asset.name}` : null].filter(Boolean).join(' · ') || '—'}</span>,
      width: '200px',
    },
    { key: 'owner', header: 'Owner', render: (d) => <span className="text-xs text-text-secondary">{d.owner?.name ?? '—'}</span>, width: '150px' },
    {
      key: 'dates',
      header: 'Review / expiry',
      render: (d) => (
        <div className="space-y-0.5 text-xs">
          {d.reviewDueDate && <p className="flex items-center gap-1">Review {formatDate(d.reviewDueDate)} {d.reviewState !== 'ok' && d.reviewState && <Badge status={d.reviewState} size="xs">{d.reviewState === 'overdue' ? 'Overdue' : 'Due soon'}</Badge>}</p>}
          {d.expiryDate && <p className="flex items-center gap-1">Expires {formatDate(d.expiryDate)} {d.contractState !== 'ok' && d.contractState && <Badge status={d.contractState} size="xs">{d.contractState === 'expired' ? 'Expired' : 'Expiring'}</Badge>}</p>}
          {!d.reviewDueDate && !d.expiryDate && <span className="text-text-muted">—</span>}
        </div>
      ),
      width: '230px',
    },
    {
      key: 'actions',
      header: '',
      render: (d) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <IconButton label="Download" onClick={() => systemAuditApi.downloadDocument(d.id).catch((e: Error) => toast.error(e.message))}><Download className="h-4 w-4" /></IconButton>
          {canManage && (
            <>
              <IconButton label="Upload new version" onClick={() => setPanel({ mode: 'version', doc: d })}><History className="h-4 w-4" /></IconButton>
              <IconButton label="Edit" onClick={() => setPanel({ mode: 'edit', doc: d })}><Pencil className="h-4 w-4" /></IconButton>
              <IconButton label="Remove" onClick={() => setToDelete(d)}><Trash2 className="h-4 w-4" /></IconButton>
            </>
          )}
        </div>
      ),
      width: '150px',
      align: 'right',
    },
  ];

  const sm = summary.data;
  return (
    <div>
      <PageHeader
        title="System documentation"
        subtitle="Policies, procedures, architecture and network diagrams, process manuals, continuity plans, and IT contracts."
        breadcrumbs={[{ label: 'System audit', href: '/system-audit' }, { label: 'System documentation' }]}
        actions={canManage ? <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setPanel({ mode: 'create' })}>Add document</Button> : null}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Documents" value={sm?.total ?? '—'} />
        <StatTile label="Past review date" value={sm?.reviewOverdue ?? '—'} tone={(sm?.reviewOverdue ?? 0) > 0 ? 'bad' : 'neutral'} hint={<button type="button" className="text-primary hover:underline" onClick={() => set({ attention: 'overdue', page: '1' })}>Show</button>} />
        <StatTile label="Review due in 30 days" value={sm?.reviewDueSoon ?? '—'} tone={(sm?.reviewDueSoon ?? 0) > 0 ? 'warn' : 'neutral'} />
        <StatTile label="Contracts expiring / expired" value={sm ? `${sm.contractsExpiring} / ${sm.contractsExpired}` : '—'} tone={(sm?.contractsExpired ?? 0) > 0 ? 'bad' : (sm?.contractsExpiring ?? 0) > 0 ? 'warn' : 'neutral'} hint={<button type="button" className="text-primary hover:underline" onClick={() => set({ attention: 'expiring', docType: '', page: '1' })}>Show</button>} />
      </div>

      <Card padded className="mb-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input placeholder="Search title, description, vendor" aria-label="Search documents" leftIcon={<Search className="h-4 w-4" />} value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          <Select value={values.docType} aria-label="Type" onChange={(e) => set({ docType: e.target.value, page: '1' })}>
            <option value="">All types</option>
            {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Select value={values.attention} aria-label="Needs attention" onChange={(e) => set({ attention: e.target.value, page: '1' })}>
            <option value="">Any review state</option>
            <option value="overdue">Review overdue</option>
            <option value="due_soon">Review due soon</option>
            <option value="expired">Contract expired</option>
            <option value="expiring">Contract expiring</option>
          </Select>
          <Select value={values.status} aria-label="Status" onChange={(e) => set({ status: e.target.value, page: '1' })}>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </Select>
        </div>
      </Card>

      <Table<SystemDocument>
        columns={columns}
        data={docs.data?.items}
        rowKey={(d) => d.id}
        isLoading={docs.isLoading}
        isError={docs.isError}
        onRetry={() => docs.refetch()}
        emptyState={
          <EmptyState
            icon={<BookOpen className="h-4 w-4" />}
            title="No documents"
            description="Add the IT policies, architecture diagrams, process manuals, continuity plans, and contracts auditors need."
            action={canManage ? <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setPanel({ mode: 'create' })}>Add document</Button> : undefined}
          />
        }
        pagination={docs.data ? { page: docs.data.meta.page, pageSize: docs.data.meta.pageSize, total: docs.data.meta.total, onPageChange: (p) => set({ page: String(p) }) } : undefined}
      />

      <SystemDocumentSlideOver
        open={panel !== null}
        onClose={() => setPanel(null)}
        mode={panel?.mode ?? 'create'}
        document={panel?.doc}
        initialType={(values.docType || undefined) as SystemDocumentType | undefined}
      />
      <ConfirmDialog
        open={toDelete !== null}
        title="Remove this document?"
        description={toDelete ? `"${toDelete.title}" will be removed from the library. Its file history is kept.` : undefined}
        confirmLabel="Remove"
        variant="danger"
        isLoading={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

const IconButton = ({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }): JSX.Element => (
  <button type="button" aria-label={label} title={label} onClick={onClick} className="rounded p-1.5 text-text-muted hover:bg-surface-alt hover:text-primary">
    {children}
  </button>
);
