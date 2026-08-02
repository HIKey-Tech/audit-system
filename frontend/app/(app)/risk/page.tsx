'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, ShieldAlert, Clock } from 'lucide-react';

import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Table, type Column } from '@/components/ui/Table';
import { Input, Select } from '@/components/ui/Input';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useQueryFilters } from '@/lib/hooks/useQueryFilters';
import { useSearchInput } from '@/lib/hooks/useSearchInput';
import { riskApi } from '@/lib/api/risk';
import { formatDate, formatNumber } from '@/lib/utils/format';
import { riskScoreLabel, riskScoreTone } from '@/lib/utils/status';
import type { Risk } from '@/lib/types/domain';
import { RiskFormSlideOver } from '@/components/risk/RiskFormSlideOver';
import { RiskCategoriesTab } from '@/components/risk/RiskCategoriesTab';

const TABS: TabItem[] = [
  { key: 'register', label: 'Register' },
  { key: 'monitoring', label: 'Monitoring' },
  { key: 'categories', label: 'Categories' },
];

type RiskTab = 'register' | 'monitoring' | 'categories';

export default function RiskPage(): JSX.Element {
  const { hasPermission } = usePermissions();
  const canWrite = hasPermission('risk:create');
  // The URL is the single source of truth for the tab — no local copy to drift.
  const { values, set } = useQueryFilters({ tab: 'register' });
  const tab: RiskTab =
    values.tab === 'monitoring' || values.tab === 'categories' ? values.tab : 'register';
  const [open, setOpen] = useState(false);

  return (
    <div>
      <PageHeader
        title="Risk Register"
        subtitle="Enterprise risk inventory, scored and monitored continuously."
        actions={
          canWrite && tab === 'register' ? (
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
              New Risk
            </Button>
          ) : null
        }
      />

      <Card padded className="mb-4">
        <Tabs tabs={TABS} active={tab} onChange={(k) => set({ tab: k })} />
      </Card>

      {tab === 'register' ? (
        <RegisterTab onOpenNew={() => setOpen(true)} canWrite={canWrite} />
      ) : tab === 'monitoring' ? (
        <MonitoringTab />
      ) : (
        <RiskCategoriesTab />
      )}

      <RiskFormSlideOver open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

// ============================================================
// Register tab
// ============================================================
const RegisterTab = ({
  onOpenNew,
  canWrite,
}: {
  onOpenNew: () => void;
  canWrite: boolean;
}): JSX.Element => {
  const router = useRouter();
  const { values, set } = useQueryFilters({
    page: '1',
    search: '',
    categoryId: '',
    status: '',
    scoreBand: '',
    sortBy: 'current_score',
    sortOrder: 'desc',
  });
  const page = Math.max(1, Number(values.page) || 1);

  const [searchInput, setSearchInput] = useSearchInput(
    values.search,
    useCallback((next: string) => set({ search: next, page: '1' }), [set]),
  );

  const categories = useQuery({
    queryKey: ['risk', 'categories'],
    queryFn: () => riskApi.listCategories({ isActive: true }),
  });

  const queryFilters = {
    page,
    pageSize: 20,
    search: values.search || undefined,
    categoryId: values.categoryId || undefined,
    status: values.status || undefined,
    scoreBand: (values.scoreBand || undefined) as 'critical' | 'high' | 'medium' | 'low' | undefined,
    sortBy: values.sortBy,
    sortOrder: values.sortOrder as 'asc' | 'desc',
  };

  const query = useQuery({
    queryKey: ['risk', 'register', queryFilters],
    queryFn: () => riskApi.list(queryFilters),
  });

  const columns: Column<Risk>[] = [
    {
      // Keys of sortable columns are the backend sort field names.
      key: 'title',
      header: 'Risk',
      sortable: true,
      render: (r) => <span className="font-medium text-text-primary">{r.title}</span>,
    },
    {
      key: 'category',
      header: 'Category',
      render: (r) => <Badge tone="gray">{r.categoryName}</Badge>,
      width: '140px',
    },
    {
      key: 'current_score',
      header: 'Score',
      sortable: true,
      render: (r) => {
        const t = riskScoreTone(r.currentScore);
        return (
          <span
            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ${t.bg} ${t.text} ${t.ring}`}
          >
            {r.currentScore} · {riskScoreLabel(r.currentScore)}
          </span>
        );
      },
      width: '160px',
    },
    {
      key: 'l',
      header: 'L',
      render: (r) => <span className="tabular-nums">{r.currentLikelihood}</span>,
      width: '50px',
      align: 'center',
    },
    {
      key: 'i',
      header: 'I',
      render: (r) => <span className="tabular-nums">{r.currentImpact}</span>,
      width: '50px',
      align: 'center',
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <StatusBadge status={r.status} />,
      width: '110px',
    },
    {
      key: 'owner',
      header: 'Owner',
      render: (r) => <span className="text-text-secondary">{r.ownerName}</span>,
      width: '170px',
    },
    {
      key: 'lastAssessed',
      header: 'Last assessed',
      render: (r) => (
        <span className="text-xs text-text-secondary">
          {r.lastAssessedAt ? formatDate(r.lastAssessedAt) : 'Never'}
        </span>
      ),
      width: '130px',
    },
  ];

  return (
    <>
      <Card padded className="mb-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Input
            placeholder="Search…"
            aria-label="Search risks"
            leftIcon={<Search className="h-4 w-4" />}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <Select
            value={values.categoryId}
            aria-label="Filter by category"
            onChange={(e) => set({ categoryId: e.target.value, page: '1' })}
          >
            <option value="">All categories</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select
            value={values.status}
            aria-label="Filter by status"
            onChange={(e) => set({ status: e.target.value, page: '1' })}
          >
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="mitigated">Mitigated</option>
            <option value="accepted">Accepted</option>
            <option value="closed">Closed</option>
          </Select>
          <Select
            value={values.scoreBand}
            aria-label="Filter by score band"
            onChange={(e) => set({ scoreBand: e.target.value, page: '1' })}
          >
            <option value="">All score bands</option>
            <option value="critical">Critical (20-25)</option>
            <option value="high">High (13-19)</option>
            <option value="medium">Medium (6-12)</option>
            <option value="low">Low (1-5)</option>
          </Select>
        </div>
      </Card>

      <Table<Risk>
        columns={columns}
        data={query.data?.items}
        rowKey={(r) => r.id}
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => query.refetch()}
        onRowClick={(r) => router.push(`/risk/${r.id}`)}
        sortBy={values.sortBy}
        sortOrder={values.sortOrder as 'asc' | 'desc'}
        onSortChange={(key, order) => set({ sortBy: key, sortOrder: order, page: '1' })}
        emptyState={
          <EmptyState
            icon={<ShieldAlert className="h-4 w-4" />}
            title="No risks recorded"
            description="Add your first risk to start the GBB enterprise risk register."
            action={
              canWrite ? (
                <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={onOpenNew}>
                  New risk
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
                onPageChange: (p) => set({ page: String(p) }),
              }
            : undefined
        }
      />
    </>
  );
};

// ============================================================
// Monitoring tab
// ============================================================
const MonitoringTab = (): JSX.Element => {
  const summary = useQuery({
    queryKey: ['risk', 'monitoring', 'summary'],
    queryFn: () => riskApi.getSummary(),
  });
  const high = useQuery({
    queryKey: ['risk', 'monitoring', 'high'],
    queryFn: () => riskApi.getHighRisk(),
  });
  const stale = useQuery({
    queryKey: ['risk', 'monitoring', 'stale'],
    queryFn: () => riskApi.getAttentionRequired(),
  });

  const columns: Column<Risk>[] = [
    { key: 'title', header: 'Risk', render: (r) => <span className="font-medium">{r.title}</span> },
    { key: 'category', header: 'Category', render: (r) => <Badge tone="gray">{r.categoryName}</Badge>, width: '140px' },
    {
      key: 'score',
      header: 'Score',
      width: '120px',
      render: (r) => {
        const t = riskScoreTone(r.currentScore);
        return (
          <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ${t.bg} ${t.text} ${t.ring}`}>
            {r.currentScore}
          </span>
        );
      },
    },
    { key: 'owner', header: 'Owner', render: (r) => <span className="text-text-secondary">{r.ownerName}</span>, width: '170px' },
    {
      key: 'last',
      header: 'Last assessed',
      width: '130px',
      render: (r) => (
        <span className="text-xs text-text-secondary">
          {r.lastAssessedAt ? formatDate(r.lastAssessedAt) : 'Never'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">High risk items</p>
          {summary.isLoading ? <Skeleton className="h-8 w-20 mt-2" /> : (
            <p className="mt-2 text-3xl font-semibold tabular-nums text-text-primary">
              {formatNumber((summary.data?.byScoreBand?.critical ?? 0) + (summary.data?.byScoreBand?.high ?? 0))}
            </p>
          )}
          <p className="text-xs text-text-secondary mt-1">Critical + High band</p>
        </Card>
        <Card>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">Stale risks</p>
          {stale.isLoading ? <Skeleton className="h-8 w-20 mt-2" /> : (
            <p className="mt-2 text-3xl font-semibold tabular-nums text-text-primary">
              {formatNumber(stale.data?.length ?? 0)}
            </p>
          )}
          <p className="text-xs text-text-secondary mt-1">Not assessed in 90 days</p>
        </Card>
        <Card>
          <CardHeader title="Organisation summary" />
          {summary.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ) : (
            <ul className="space-y-1.5 text-xs">
              {(['critical', 'high', 'medium', 'low'] as const).map((b) => (
                <li key={b} className="flex items-center justify-between">
                  <StatusBadge status={b} size="xs" withDot />
                  <span className="font-semibold tabular-nums text-text-primary">
                    {summary.data?.byScoreBand?.[b] ?? 0}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card padded={false}>
        <div className="px-5 pt-5 pb-3">
          <CardHeader title="Top risks" subtitle="Highest current scores" className="mb-0" />
        </div>
        <Table<Risk>
          columns={columns}
          data={high.data?.slice(0, 5)}
          rowKey={(r) => r.id}
          isLoading={high.isLoading}
          isError={high.isError}
          onRetry={() => high.refetch()}
          density="compact"
          emptyState={
            <EmptyState compact icon={<Clock className="h-4 w-4" />} title="No high-risk items" />
          }
          className="rounded-none border-0 border-t border-border"
        />
      </Card>
    </div>
  );
};

