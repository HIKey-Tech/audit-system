'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Plus, TrendingUp, Pencil } from 'lucide-react';

import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Table, type Column } from '@/components/ui/Table';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { riskApi } from '@/lib/api/risk';
import { findingsApi } from '@/lib/api/audit';
import { formatDateTime } from '@/lib/utils/format';
import { riskScoreLabel, riskScoreTone, humanizeStatus } from '@/lib/utils/status';
import type { RiskAssessment } from '@/lib/types/domain';
import { NewAssessmentSlideOver } from '@/components/risk/NewAssessmentSlideOver';
import { RiskFormSlideOver } from '@/components/risk/RiskFormSlideOver';
import { LinkedAssetsCard } from '@/components/common/LinkedAssetsCard';

export default function RiskDetailPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const { canManageAuditProgramme: canWrite } = usePermissions();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const risk = useQuery({
    queryKey: ['risk', id],
    queryFn: () => riskApi.get(id),
    enabled: Boolean(id),
  });

  const assessments = useQuery({
    queryKey: ['risk', id, 'assessments'],
    queryFn: () => riskApi.listAssessments(id),
    enabled: Boolean(id),
  });

  const trend = useQuery({
    queryKey: ['risk', id, 'trend'],
    queryFn: () => riskApi.getTrend(id),
    enabled: Boolean(id),
  });

  // Findings that cite this risk — closes the finding→risk loop (a finding shows
  // its risk; now the risk shows the findings that reference it).
  const linkedFindings = useQuery({
    queryKey: ['risk', id, 'findings'],
    queryFn: () => findingsApi.list({ riskId: id, pageSize: 50 }),
    enabled: Boolean(id),
  });

  if (risk.isError) {
    return (
      <div>
        <PageHeader title="Risk" breadcrumbs={[{ label: 'Risk Register', href: '/risk' }]} />
        <Card>
          <ErrorState onRetry={() => risk.refetch()} />
        </Card>
      </div>
    );
  }

  if (risk.isLoading || !risk.data) {
    return (
      <div>
        <PageHeader title="Loading…" breadcrumbs={[{ label: 'Risk Register', href: '/risk' }]} />
        <Card>
          <Skeleton className="h-4 w-1/3 mb-3" />
          <Skeleton className="h-3 w-2/3" />
        </Card>
      </div>
    );
  }

  const r = risk.data;
  const t = riskScoreTone(r.currentScore);

  const columns: Column<RiskAssessment>[] = [
    {
      key: 'date',
      header: 'Date',
      render: (a) => <span className="text-xs text-text-secondary">{formatDateTime(a.assessedAt)}</span>,
      width: '170px',
    },
    {
      key: 'assessor',
      header: 'Assessor',
      render: (a) => <span className="text-text-primary">{a.assessorName}</span>,
      width: '180px',
    },
    {
      key: 'l',
      header: 'L',
      render: (a) => <span className="tabular-nums">{a.likelihood}</span>,
      width: '60px',
      align: 'center',
    },
    {
      key: 'i',
      header: 'I',
      render: (a) => <span className="tabular-nums">{a.impact}</span>,
      width: '60px',
      align: 'center',
    },
    {
      key: 'score',
      header: 'Score',
      width: '120px',
      render: (a) => {
        const tone = riskScoreTone(a.score);
        return (
          <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ${tone.bg} ${tone.text} ${tone.ring}`}>
            {a.score}
          </span>
        );
      },
    },
    {
      key: 'notes',
      header: 'Notes',
      render: (a) => <span className="text-text-secondary line-clamp-1">{a.notes ?? '—'}</span>,
    },
  ];

  return (
    <div>
      <PageHeader
        title={r.title}
        subtitle={r.description ?? undefined}
        breadcrumbs={[
          { label: 'Risk Register', href: '/risk' },
          { label: r.title },
        ]}
        actions={
          <div className="flex gap-2">
            <Link href="/risk">
              <Button variant="secondary" leftIcon={<ArrowLeft className="h-4 w-4" />}>
                Back
              </Button>
            </Link>
            {canWrite && (
              <>
                <Button variant="secondary" leftIcon={<Pencil className="h-4 w-4" />} onClick={() => setEditOpen(true)}>
                  Edit
                </Button>
                <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
                  New assessment
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Risk profile" />
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Score</dt>
              <dd className="mt-1">
                <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-semibold ring-1 ${t.bg} ${t.text} ${t.ring}`}>
                  {r.currentScore} · {riskScoreLabel(r.currentScore)}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Status</dt>
              <dd className="mt-1"><StatusBadge status={r.status} /></dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Category</dt>
              <dd className="mt-1"><Badge tone="gray">{r.categoryName}</Badge></dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Owner</dt>
              <dd className="mt-1 text-sm text-text-primary">{r.ownerName}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Likelihood × Impact</dt>
              <dd className="mt-1 text-sm text-text-primary">{r.currentLikelihood} × {r.currentImpact}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Linked entity</dt>
              <dd className="mt-1 text-sm text-text-primary">
                {r.universeName ? (
                  <Link href={`/audit/universe/${r.universeId}`} className="text-primary hover:underline font-medium">
                    {r.universeName}
                  </Link>
                ) : (
                  <span className="text-text-secondary">None</span>
                )}
              </dd>
            </div>
          </dl>
        </Card>

        <Card>
          <CardHeader title="Score trend" subtitle="Recent assessment scores" />
          {trend.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : !trend.data || trend.data.length < 2 ? (
            <EmptyState compact icon={<TrendingUp className="h-4 w-4" />} title="Not enough data yet" />
          ) : (
            <Sparkline data={trend.data} />
          )}
        </Card>
      </div>

      <Card className="mt-6" padded={false}>
        <div className="px-5 pt-5 pb-3">
          <CardHeader title="Assessment history" subtitle="Newest first" className="mb-0" />
        </div>
        <Table<RiskAssessment>
          columns={columns}
          data={assessments.data}
          rowKey={(a) => a.id}
          isLoading={assessments.isLoading}
          density="compact"
          emptyState={<EmptyState compact title="No assessments yet" />}
          className="rounded-none border-0 border-t border-border"
        />
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Linked findings" subtitle={`${linkedFindings.data?.items?.length ?? 0} cite this risk`} />
          {linkedFindings.isLoading ? (
            <Skeleton className="h-4 w-2/3" />
          ) : !linkedFindings.data?.items?.length ? (
            <EmptyState compact title="No findings reference this risk" />
          ) : (
            <ul className="divide-y divide-border">
              {linkedFindings.data.items.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2 py-2">
                  <Link href={`/audit/findings/${f.id}`} className="min-w-0">
                    <p className="truncate text-sm font-medium text-primary hover:underline">{f.title}</p>
                    <p className="font-mono text-[11px] text-text-secondary">{f.engagementReference}</p>
                  </Link>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <StatusBadge status={f.severity} />
                    <Badge tone="gray">{humanizeStatus(f.status)}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <LinkedAssetsCard scope="risk" id={id} />
      </div>

      <NewAssessmentSlideOver open={open} onClose={() => setOpen(false)} riskId={r.id} />
      <RiskFormSlideOver open={editOpen} onClose={() => setEditOpen(false)} risk={r} />
    </div>
  );
}

const Sparkline = ({ data }: { data: RiskAssessment[] }): JSX.Element => {
  // Sort oldest -> newest for visualisation
  const ordered = [...data].sort(
    (a, b) => new Date(a.assessedAt).getTime() - new Date(b.assessedAt).getTime(),
  );
  const w = 240;
  const h = 60;
  const max = 25;
  const step = ordered.length === 1 ? 0 : w / (ordered.length - 1);
  const pts = ordered.map((a, i) => `${i * step},${h - (a.score / max) * h}`).join(' ');
  const last = ordered[ordered.length - 1];
  const tone = riskScoreTone(last.score);

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" aria-hidden>
        <polyline
          fill="none"
          stroke={tone.hex}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={pts}
        />
        {ordered.map((a, i) => (
          <circle
            key={a.id}
            cx={i * step}
            cy={h - (a.score / max) * h}
            r={i === ordered.length - 1 ? 4 : 2.5}
            fill={tone.hex}
          />
        ))}
      </svg>
      <p className="mt-2 text-xs text-text-secondary">
        Latest score <span className="font-semibold text-text-primary">{last.score}</span> recorded {formatDateTime(last.assessedAt)}
      </p>
    </div>
  );
};
