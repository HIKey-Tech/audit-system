'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Pencil } from 'lucide-react';

import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Table, type Column } from '@/components/ui/Table';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { universeApi } from '@/lib/api/audit';
import { formatDate, formatNumber } from '@/lib/utils/format';
import { humanizeStatus, riskScoreLabel, riskScoreTone } from '@/lib/utils/status';
import { UniverseFormSlideOver } from '@/components/audit/universe/UniverseFormSlideOver';
import type {
  UniverseLinkedRisk,
  UniverseEngagementHistory,
} from '@/lib/types/domain';

export default function UniverseDetailPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const router = useRouter();
  const { canManageAuditProgramme: canWrite } = usePermissions();
  const [editOpen, setEditOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['universe', id],
    queryFn: () => universeApi.get(id),
    enabled: Boolean(id),
  });

  if (isError) {
    return (
      <div>
        <PageHeader
          title="Auditable entity"
          breadcrumbs={[{ label: 'Audit Universe', href: '/audit/universe' }, { label: 'Details' }]}
        />
        <Card>
          <ErrorState onRetry={() => refetch()} />
        </Card>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div>
        <PageHeader
          title="Loading…"
          breadcrumbs={[{ label: 'Audit Universe', href: '/audit/universe' }]}
        />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <Skeleton className="h-4 w-1/3 mb-4" />
            <Skeleton className="h-3 w-2/3 mb-2" />
            <Skeleton className="h-3 w-1/2" />
          </Card>
          <Card>
            <Skeleton className="h-3 w-1/3 mb-3" />
            <Skeleton className="h-32 w-full" />
          </Card>
        </div>
      </div>
    );
  }

  const t = riskScoreTone(data.riskScore);
  const riskColumns: Column<UniverseLinkedRisk>[] = [
    {
      key: 'title',
      header: 'Risk',
      render: (r) => (
        <Link href={`/risk/${r.id}`} className="font-medium text-text-primary hover:text-primary">
          {r.title}
        </Link>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (r) => <Badge tone="gray">{r.categoryName}</Badge>,
      width: '140px',
    },
    {
      key: 'score',
      header: 'Score',
      render: (r) => {
        const tone = riskScoreTone(r.currentScore);
        return (
          <span
            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ${tone.bg} ${tone.text} ${tone.ring}`}
          >
            {r.currentScore}
          </span>
        );
      },
      width: '90px',
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <StatusBadge status={r.status} />,
      width: '110px',
    },
  ];

  const engagementColumns: Column<UniverseEngagementHistory>[] = [
    {
      key: 'reference',
      header: 'Reference',
      render: (e) => (
        <Link href={`/audit/engagements/${e.id}`} className="font-mono text-xs text-primary hover:underline">
          {e.referenceNumber}
        </Link>
      ),
      width: '140px',
    },
    {
      key: 'title',
      header: 'Title',
      render: (e) => <span className="text-text-primary">{e.title}</span>,
    },
    {
      key: 'type',
      header: 'Type',
      render: (e) => <Badge tone="gray">{humanizeStatus(e.auditType)}</Badge>,
      width: '120px',
    },
    {
      key: 'status',
      header: 'Status',
      render: (e) => <StatusBadge status={e.status} />,
      width: '120px',
    },
    {
      key: 'dates',
      header: 'Dates',
      render: (e) => (
        <span className="text-text-secondary text-xs">
          {e.startDate ? formatDate(e.startDate) : '—'} → {e.endDate ? formatDate(e.endDate) : '—'}
        </span>
      ),
      width: '180px',
    },
  ];

  return (
    <div>
      <PageHeader
        title={data.name}
        subtitle={data.description ?? undefined}
        breadcrumbs={[
          { label: 'Audit Universe', href: '/audit/universe' },
          { label: data.name },
        ]}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" leftIcon={<ArrowLeft className="h-4 w-4" />} onClick={() => router.push('/audit/universe')}>
              Back
            </Button>
            {canWrite && (
              <Button leftIcon={<Pencil className="h-4 w-4" />} onClick={() => setEditOpen(true)}>
                Edit
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Entity details" />
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Category</dt>
              <dd className="mt-1"><Badge tone="gray">{humanizeStatus(data.category)}</Badge></dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Status</dt>
              <dd className="mt-1"><StatusBadge status={data.status} /></dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Owner</dt>
              <dd className="mt-1 text-sm text-text-primary">{data.ownerName}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Audit frequency</dt>
              <dd className="mt-1 text-sm text-text-primary">{humanizeStatus(data.auditFrequency)}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Risk score</dt>
              <dd className="mt-1">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ${t.bg} ${t.text} ${t.ring}`}
                >
                  {formatNumber(data.riskScore)} · {riskScoreLabel(data.riskScore)}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Last audited</dt>
              <dd className="mt-1 text-sm text-text-primary">
                {data.lastAuditedAt ? formatDate(data.lastAuditedAt) : 'Never'}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Open findings</dt>
              <dd className="mt-1 text-sm">
                {typeof data.openFindingsCount === 'number' && data.openFindingsCount > 0 ? (
                  <Link
                    href={`/audit/findings?universeId=${data.id}`}
                    className="font-semibold text-danger hover:underline"
                  >
                    {data.openFindingsCount} unresolved
                  </Link>
                ) : (
                  <span className="text-text-primary">None</span>
                )}
              </dd>
            </div>
          </dl>
        </Card>

        <Card>
          <CardHeader title="Linked Risks" subtitle={`${data.linkedRisks?.length ?? 0} on register`} />
          {!data.linkedRisks || data.linkedRisks.length === 0 ? (
            <EmptyState compact title="No linked risks" />
          ) : (
            <Table<UniverseLinkedRisk>
              columns={riskColumns}
              data={data.linkedRisks}
              rowKey={(r) => r.id}
              density="compact"
              className="rounded-md"
            />
          )}
        </Card>
      </div>

      <Card className="mt-6" padded={false}>
        <div className="px-5 pt-5 pb-3">
          <CardHeader title="Engagement history" subtitle="Audits run against this entity" className="mb-0" />
        </div>
        <Table<UniverseEngagementHistory>
          columns={engagementColumns}
          data={data.engagementHistory ?? []}
          rowKey={(r) => r.id}
          emptyState={<EmptyState compact title="No engagements yet" />}
          density="compact"
          className="rounded-none border-0 border-t border-border"
        />
      </Card>

      <UniverseFormSlideOver
        open={editOpen}
        onClose={() => setEditOpen(false)}
        entity={data}
      />
    </div>
  );
}
