'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Table, type Column } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { ShieldAlert } from 'lucide-react';
import { dashboardApi } from '@/lib/api/dashboard';
import { riskScoreLabel, riskScoreTone } from '@/lib/utils/status';
import type { TopRiskItem } from '@/lib/types/domain';

export const TopRisksTable = (): JSX.Element => {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard', 'risks'],
    queryFn: () => dashboardApi.getRisks(),
  });

  const columns: Column<TopRiskItem>[] = [
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
      key: 'score',
      header: 'Score',
      render: (r) => {
        const t = riskScoreTone(r.score);
        return (
          <span
            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ${t.bg} ${t.text} ${t.ring}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
            {r.score} · {riskScoreLabel(r.score)}
          </span>
        );
      },
      width: '170px',
    },
    {
      key: 'category',
      header: 'Category',
      render: (r) => <Badge tone="gray">{r.categoryName}</Badge>,
      width: '140px',
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <StatusBadge status={r.status} />,
      width: '120px',
    },
    {
      key: 'owner',
      header: 'Owner',
      render: (r) => <span className="text-text-secondary">{r.ownerName}</span>,
      width: '180px',
    },
  ];

  return (
    <Card padded={false}>
      <div className="px-5 pt-5 pb-3 flex items-start justify-between">
        <CardHeader title="Top Risks" subtitle="Highest current scores" className="mb-0" />
        <Link href="/risk" className="text-xs font-medium text-primary hover:underline">
          View all
        </Link>
      </div>
      <Table<TopRiskItem>
        data={data?.topFiveRisks}
        rowKey={(r) => r.id}
        columns={columns}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        emptyState={
          <EmptyState
            compact
            icon={<ShieldAlert className="h-4 w-4" />}
            title="No risks recorded yet"
          />
        }
        density="compact"
        className="rounded-none border-0 border-t border-border"
      />
    </Card>
  );
};
