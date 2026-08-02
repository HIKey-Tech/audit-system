'use client';

import { useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
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
import { OverviewTab } from '@/components/audit/engagements/OverviewTab';
import { WorkingPapersTab } from '@/components/audit/engagements/WorkingPapersTab';
import { EvidenceTab } from '@/components/audit/engagements/EvidenceTab';
import { EvidenceRequestsTab } from '@/components/audit/engagements/EvidenceRequestsTab';
import { AssetsTab } from '@/components/audit/engagements/AssetsTab';
import { FindingsTab } from '@/components/audit/engagements/FindingsTab';
import { ChecklistsTab } from '@/components/audit/engagements/ChecklistsTab';
import { ReportTab } from '@/components/audit/engagements/ReportTab';
import { FollowUpTab } from '@/components/audit/engagements/FollowUpTab';
import { StatusStepper } from '@/components/audit/engagements/StatusStepper';

type TabKey =
  | 'overview'
  | 'working-papers'
  | 'evidence'
  | 'requests'
  | 'assets'
  | 'findings'
  | 'checklists'
  | 'report'
  | 'follow-up';

// Ordered to mirror the fieldwork lifecycle: test controls → document work →
// attach evidence → raise findings → report → follow up. Assets is scope
// reference material, so it sits last.
const TAB_DEFS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'checklists', label: 'Checklists' },
  { key: 'working-papers', label: 'Working Papers' },
  { key: 'evidence', label: 'Evidence' },
  { key: 'requests', label: 'Evidence Requests' },
  { key: 'findings', label: 'Findings' },
  { key: 'report', label: 'Report' },
  { key: 'follow-up', label: 'Follow-up' },
  { key: 'assets', label: 'Assets' },
];

export default function EngagementDetailPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const router = useRouter();
  const searchParams = useSearchParams();

  // Tab lives in the URL so refreshes keep their place and other screens can
  // deep-link straight to e.g. ?tab=report.
  const tabParam = searchParams?.get('tab');
  const tab: TabKey = TAB_DEFS.some((t) => t.key === tabParam) ? (tabParam as TabKey) : 'overview';
  const setTab = useCallback(
    (k: TabKey) => {
      router.replace(k === 'overview' ? `/audit/engagements/${id}` : `/audit/engagements/${id}?tab=${k}`, { scroll: false });
    },
    [router, id],
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['engagements', id],
    queryFn: () => engagementsApi.get(id),
    enabled: Boolean(id),
  });

  const { canReadAssets } = usePermissions();

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

  const vc = data.viewerContext;
  // Internal-team-only restriction (not a "wait until X happens" gate — see
  // resolveViewerContext) — keep the tab visible but disabled with a reason,
  // rather than removing it, so a restricted auditee sees "not for your role"
  // instead of the feature appearing to not exist.
  const RESTRICTED_TAB_REASON = "Internal audit material — not visible to your role on this engagement.";
  const tabs: TabItem[] = TAB_DEFS
    .filter((t) => t.key !== 'assets' || canReadAssets)
    .map((t) => {
      const restricted =
        !!vc &&
        ((t.key === 'working-papers' && !vc.canViewWorkingPapers) ||
          (t.key === 'evidence' && !vc.canViewInternalEvidence) ||
          (t.key === 'checklists' && !vc.canViewChecklists));
      return { ...t, disabled: restricted, disabledReason: restricted ? RESTRICTED_TAB_REASON : undefined };
    })
    .map((t) => ({
      key: t.key,
      label: t.label,
      disabled: t.disabled,
      disabledReason: t.disabledReason,
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
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">
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

      <StatusStepper engagement={data} onNavigateTab={(k) => setTab(k as TabKey)} />

      <div className="mb-6">
        <Tabs tabs={tabs} active={tab} onChange={(k) => setTab(k as TabKey)} />
      </div>

      {tab === 'overview' && <OverviewTab engagement={data} />}
      {tab === 'working-papers' && vc?.canViewWorkingPapers !== false && <WorkingPapersTab engagement={data} />}
      {tab === 'evidence' && vc?.canViewInternalEvidence !== false && <EvidenceTab engagement={data} />}
      {tab === 'requests' && <EvidenceRequestsTab engagement={data} />}
      {tab === 'assets' && canReadAssets && <AssetsTab engagement={data} />}
      {tab === 'findings' && <FindingsTab engagement={data} />}
      {tab === 'checklists' && vc?.canViewChecklists !== false && <ChecklistsTab engagement={data} />}
      {tab === 'report' && <ReportTab engagement={data} />}
      {tab === 'follow-up' && <FollowUpTab engagement={data} />}
    </div>
  );
}
