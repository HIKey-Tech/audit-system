'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';

import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { StatusBadge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';

import { engagementsApi } from '@/lib/api/audit';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { nextEngagementStatus } from '@/lib/utils/status';
import { OverviewTab } from '@/components/audit/engagements/OverviewTab';
import { WorkingPapersTab } from '@/components/audit/engagements/WorkingPapersTab';
import { EvidenceTab } from '@/components/audit/engagements/EvidenceTab';
import { FindingsTab } from '@/components/audit/engagements/FindingsTab';
import { ChecklistsTab } from '@/components/audit/engagements/ChecklistsTab';
import { ReportTab } from '@/components/audit/engagements/ReportTab';
import { FollowUpTab } from '@/components/audit/engagements/FollowUpTab';
import { StatusStepper } from '@/components/audit/engagements/StatusStepper';

type TabKey =
  | 'overview'
  | 'working-papers'
  | 'evidence'
  | 'findings'
  | 'checklists'
  | 'report'
  | 'follow-up';

const TAB_DEFS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'working-papers', label: 'Working Papers' },
  { key: 'evidence', label: 'Evidence' },
  { key: 'findings', label: 'Findings' },
  { key: 'checklists', label: 'Checklists' },
  { key: 'report', label: 'Report' },
  { key: 'follow-up', label: 'Follow-up' },
];

export default function EngagementDetailPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const [tab, setTab] = useState<TabKey>('overview');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['engagements', id],
    queryFn: () => engagementsApi.get(id),
    enabled: Boolean(id),
  });

  const qc = useQueryClient();
  const { hasPermission } = usePermissions();
  const canAdvanceEngagement = hasPermission('engagement:update');

  const advanceMutation = useMutation({
    mutationFn: (status: string) => engagementsApi.updateStatus(id, status),
    onSuccess: () => {
      toast.success('Status updated');
      qc.invalidateQueries({ queryKey: ['engagements', id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const nextStatus = data ? nextEngagementStatus(data.status) : null;

  if (isError) {
    return (
      <div>
        <PageHeader title="Engagement" breadcrumbs={[{ label: 'Engagements', href: '/audit/engagements' }]} />
        <Card>
          <ErrorState onRetry={() => refetch()} />
        </Card>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div>
        <PageHeader title="Loading…" breadcrumbs={[{ label: 'Engagements', href: '/audit/engagements' }]} />
        <Card>
          <Skeleton className="h-4 w-1/3 mb-3" />
          <Skeleton className="h-3 w-2/3 mb-2" />
          <Skeleton className="h-3 w-1/2" />
        </Card>
      </div>
    );
  }

  const tabs: TabItem[] = TAB_DEFS.map((t) => ({
    key: t.key,
    label: t.label,
    count:
      t.key === 'findings'
        ? data.findings?.length ?? 0
        : t.key === 'working-papers'
          ? data.workingPapers?.length ?? 0
          : t.key === 'evidence'
            ? data.evidence?.length ?? 0
            : null,
  }));

  return (
    <div>
      <PageHeader
        title={data.title}
        subtitle={`Reference ${data.referenceNumber}`}
        breadcrumbs={[
          { label: 'Engagements', href: '/audit/engagements' },
          { label: data.referenceNumber },
        ]}
        actions={
          <div className="flex items-center gap-3">
            <StatusBadge status={data.status} />
            <Link href="/audit/engagements">
              <Button variant="secondary" leftIcon={<ArrowLeft className="h-4 w-4" />}>
                Back
              </Button>
            </Link>
          </div>
        }
      />

      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
        {data.planTitle ? (
          <span>
            From plan:{' '}
            <span className="font-medium text-text-primary">{data.planTitle}</span>
          </span>
        ) : (
          <span className="rounded bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
            Ad-hoc
          </span>
        )}
        {data.universeName && (
          <>
            <span className="text-border">·</span>
            <span>
              Auditing:{' '}
              <span className="font-medium text-text-primary">{data.universeName}</span>
            </span>
          </>
        )}
      </div>

      <StatusStepper
        engagement={data}
        onAdvance={nextStatus ? () => advanceMutation.mutate(nextStatus) : undefined}
        isAdvancing={advanceMutation.isPending}
        canAdvance={canAdvanceEngagement && Boolean(nextStatus)}
      />

      <div className="mb-6">
        <Tabs tabs={tabs} active={tab} onChange={(k) => setTab(k as TabKey)} />
      </div>

      {tab === 'overview' && <OverviewTab engagement={data} />}
      {tab === 'working-papers' && <WorkingPapersTab engagement={data} />}
      {tab === 'evidence' && <EvidenceTab engagement={data} />}
      {tab === 'findings' && <FindingsTab engagement={data} />}
      {tab === 'checklists' && <ChecklistsTab engagement={data} />}
      {tab === 'report' && <ReportTab engagement={data} />}
      {tab === 'follow-up' && <FollowUpTab engagement={data} />}
    </div>
  );
}
