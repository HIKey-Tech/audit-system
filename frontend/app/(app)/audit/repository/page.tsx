'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Archive, Download, FileText, Search } from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Table, type Column } from '@/components/ui/Table';
import { Input, Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { repositoryApi, type RepositoryCategory, type RepositoryCategoryFilter, type RepositoryItem } from '@/lib/api/repository';
import { formatDateTime, formatFileSize, formatNumber } from '@/lib/utils/format';
import { usePermission } from '@/hooks/usePermission';

// ─────────────────────────────────────────────────────────────
// Category presentation
// ─────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<RepositoryCategory, string> = {
  audit_record: 'Audit Record',
  supporting_document: 'Supporting Document',
  evidence: 'Evidence',
  other: 'Other',
};

const CATEGORY_TONES: Record<RepositoryCategory, 'green' | 'blue' | 'purple' | 'gray'> = {
  audit_record: 'green',
  supporting_document: 'blue',
  evidence: 'purple',
  other: 'gray',
};

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

export default function RepositoryPage(): JSX.Element | null {
  const router = useRouter();
  const canRead = usePermission('engagement:read');

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<RepositoryCategoryFilter>('all');

  useEffect(() => {
    if (!canRead) router.replace('/dashboard');
  }, [canRead, router]);

  const list = useQuery({
    queryKey: ['audit-repository', { page, search, category }],
    queryFn: () =>
      repositoryApi.list({
        page,
        pageSize: 30,
        search: search || undefined,
        category,
      }),
    enabled: canRead,
  });

  const download = useMutation({
    mutationFn: ({ id, fileName }: { id: string; fileName: string }) => repositoryApi.download(id, fileName),
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to download'),
  });

  const columns: Column<RepositoryItem>[] = [
    {
      key: 'fileName',
      header: 'File',
      render: (item) => (
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden />
          <span className="truncate font-medium text-text-primary">{item.fileName}</span>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Type',
      width: '180px',
      render: (item) => <Badge tone={CATEGORY_TONES[item.category]}>{CATEGORY_LABELS[item.category]}</Badge>,
    },
    {
      key: 'engagement',
      header: 'Engagement',
      width: '260px',
      render: (item) =>
        item.engagement ? (
          <div className="min-w-0">
            <p className="truncate text-text-primary">{item.engagement.title}</p>
            <p className="truncate text-[11px] font-mono text-text-secondary">{item.engagement.referenceNumber}</p>
          </div>
        ) : (
          <span className="text-text-secondary">—</span>
        ),
    },
    {
      key: 'uploadedBy',
      header: 'Uploaded By',
      width: '170px',
      render: (item) => <span className="text-text-secondary">{item.uploadedBy?.name ?? '—'}</span>,
    },
    {
      key: 'uploadedAt',
      header: 'Date',
      width: '160px',
      render: (item) => <span className="text-xs text-text-secondary">{formatDateTime(item.uploadedAt)}</span>,
    },
    {
      key: 'fileSize',
      header: 'Size',
      width: '100px',
      align: 'right',
      render: (item) => <span className="text-xs tabular-nums text-text-secondary">{formatFileSize(item.fileSize)}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '130px',
      render: (item) => (
        <div className="flex items-center justify-end">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Download className="h-3.5 w-3.5" />}
            isLoading={download.isPending && download.variables?.id === item.id}
            onClick={() => download.mutate({ id: item.id, fileName: item.fileName })}
          >
            Download
          </Button>
        </div>
      ),
    },
  ];

  if (!canRead) return null;

  return (
    <div>
      <PageHeader
        title="Evidence Repository"
        subtitle="Central, secure store of all audit records, supporting documents, and evidence — searchable across every engagement."
        actions={
          list.data ? (
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Total items</p>
              <p className="text-lg font-semibold tabular-nums text-text-primary">{formatNumber(list.data.meta.total)}</p>
            </div>
          ) : null
        }
      />

      <Card padded className="mb-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input
            className="sm:col-span-2"
            placeholder="Search by file name or engagement"
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
              setCategory(e.target.value as RepositoryCategoryFilter);
              setPage(1);
            }}
          >
            <option value="all">All types</option>
            <option value="audit_record">Audit Records</option>
            <option value="supporting_document">Supporting Documents</option>
            <option value="evidence">Evidence</option>
          </Select>
        </div>
      </Card>

      <Table<RepositoryItem>
        columns={columns}
        data={list.data?.items}
        rowKey={(item) => item.id}
        isLoading={list.isLoading}
        isError={list.isError}
        onRetry={() => list.refetch()}
        emptyState={
          <EmptyState
            icon={<Archive className="h-4 w-4" />}
            title="No items found"
            description="Adjust the type filter or search to broaden the results."
          />
        }
        density="compact"
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
    </div>
  );
}
