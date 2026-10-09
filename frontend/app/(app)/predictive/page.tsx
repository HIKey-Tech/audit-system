'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Brain, CheckCircle2, ChevronRight, Clock3, Lightbulb, ThumbsDown, ThumbsUp } from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { predictiveApi, type PredictiveFeedback, type PredictiveInsight, type PredictiveSeverity } from '@/lib/api/predictive';
import { formatDateTime, formatNumber } from '@/lib/utils/format';

const REFRESH_MS = 60_000;

const severityTone: Record<PredictiveSeverity, 'gray' | 'yellow' | 'orange' | 'red'> = {
  low: 'gray',
  medium: 'yellow',
  high: 'orange',
  critical: 'red',
};

export default function PredictivePage(): JSX.Element | null {
  const { hasPermission } = usePermissions();
  const allowed = hasPermission('predictive:read');
  const queryClient = useQueryClient();
  const overview = useQuery({
    queryKey: ['predictive', 'overview'],
    queryFn: predictiveApi.getOverview,
    enabled: allowed,
    refetchInterval: REFRESH_MS,
    staleTime: REFRESH_MS - 5_000,
  });
  const feedback = useMutation({
    mutationFn: ({ insightId, value }: { insightId: string; value: PredictiveFeedback }) =>
      predictiveApi.recordFeedback(insightId, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['predictive', 'overview'] });
      toast.success('Feedback recorded');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not record feedback'),
  });

  if (!allowed) return null;

  if (overview.isLoading) {
    return <PredictiveLoadingState />;
  }

  if (overview.isError || !overview.data) {
    return (
      <div>
        <PageHeader title="Audit intelligence" subtitle="Explainable live-data early warnings and next best actions." />
        <ErrorState error={overview.error} onRetry={() => overview.refetch()} />
      </div>
    );
  }

  const data = overview.data;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit intelligence"
        subtitle="Live workflow early warnings, next actions, and learning data for future validated forecasting."
        actions={(
          <Badge tone="blue" withDot size="sm">Explainable rules</Badge>
        )}
      />

      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-surface-elevated to-accent/5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <span className="rounded-lg bg-primary/10 p-2.5 text-primary"><Brain className="h-5 w-5" /></span>
            <div>
              <p className="text-sm font-semibold text-text-primary">Learning from live IAMS data</p>
              <p className="mt-1 max-w-3xl text-sm text-text-secondary">{data.dataReadiness.message}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs text-text-secondary md:text-right">
            <span>Snapshots: <strong className="text-text-primary">{formatNumber(data.dataReadiness.snapshotCount)}</strong></span>
            <span>Last scored: <strong className="text-text-primary">{data.dataReadiness.lastScoredAt ? formatDateTime(data.dataReadiness.lastScoredAt) : 'Awaiting first refresh'}</strong></span>
          </div>
        </div>
      </Card>

      <section className="grid gap-6 xl:grid-cols-[1.45fr_0.75fr]">
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader
              title={<span className="flex items-center gap-2"><Activity className="h-4 w-4 text-rose-500" />Early warnings</span>}
              subtitle="Signals that may require attention. Review the reasons; they are not automatic audit decisions."
            />
          </div>
          {data.insights.length === 0 ? (
            <div className="px-5 pb-5"><EmptyState compact icon={<CheckCircle2 className="h-5 w-5" />} title="No current early warnings" description="There are no workflow signals above the alert threshold in records you can access." /></div>
          ) : (
            <div className="divide-y divide-border">
              {data.insights.map((insight) => (
                <InsightRow key={insight.id} insight={insight} isSaving={feedback.isPending} onFeedback={(value) => feedback.mutate({ insightId: insight.id, value })} />
              ))}
            </div>
          )}
        </Card>

        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader
              title={<span className="flex items-center gap-2"><Lightbulb className="h-4 w-4 text-amber-500" />Next best actions</span>}
              subtitle="Current tasks inferred directly from your audit workflow."
            />
          </div>
          {data.nextActions.length === 0 ? (
            <div className="px-5 pb-5"><EmptyState compact icon={<CheckCircle2 className="h-5 w-5" />} title="No urgent next actions" description="Your visible workflow items are up to date." /></div>
          ) : (
            <div className="divide-y divide-border">
              {data.nextActions.map((action) => (
                <Link key={`${action.entityType}:${action.entityId}:${action.type}`} href={action.actionUrl} className="block px-5 py-4 transition-colors hover:bg-surface-alt">
                  <div className="flex items-start gap-3">
                    <Badge tone={action.priority === 'high' ? 'red' : action.priority === 'medium' ? 'amber' : 'gray'}>{action.priority}</Badge>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text-primary">{action.title}</p>
                      <p className="mt-1 text-xs text-text-secondary">{action.description}</p>
                      {action.dueAt && <p className="mt-2 flex items-center gap-1 text-xs text-text-muted"><Clock3 className="h-3.5 w-3.5" />Due {formatDateTime(action.dueAt)}</p>}
                    </div>
                    <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}

const InsightRow = ({ insight, isSaving, onFeedback }: { insight: PredictiveInsight; isSaving: boolean; onFeedback: (feedback: PredictiveFeedback) => void }): JSX.Element => (
  <div className="px-5 py-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={severityTone[insight.severity]}>{insight.severity}</Badge>
          <span className="text-xs font-semibold text-text-secondary">Attention score {insight.score}/100</span>
        </div>
        <Link href={insight.actionUrl} className="mt-2 block text-sm font-semibold text-text-primary hover:text-primary">{insight.title}</Link>
        <p className="mt-1 text-xs leading-5 text-text-secondary">{insight.summary}</p>
        {insight.rationale.length > 0 && (
          <ul className="mt-3 space-y-1.5 rounded-md bg-surface-alt px-3 py-2 text-xs text-text-secondary">
            {insight.rationale.slice(0, 3).map((factor) => <li key={factor.code}><strong className="font-medium text-text-primary">{factor.label}:</strong> {factor.value}</li>)}
          </ul>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button size="sm" variant={insight.feedback === 'useful' ? 'primary' : 'ghost'} onClick={() => onFeedback('useful')} disabled={isSaving} title="This insight was useful"><ThumbsUp className="h-3.5 w-3.5" /></Button>
        <Button size="sm" variant={insight.feedback === 'not_useful' ? 'secondary' : 'ghost'} onClick={() => onFeedback('not_useful')} disabled={isSaving} title="This insight was not useful"><ThumbsDown className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  </div>
);

const PredictiveLoadingState = (): JSX.Element => (
  <div className="space-y-6">
    <PageHeader title="Audit intelligence" subtitle="Explainable live-data early warnings and next best actions." />
    <Skeleton className="h-24 rounded-xl" />
    <div className="grid gap-6 xl:grid-cols-[1.45fr_0.75fr]">
      <Skeleton className="h-[28rem] rounded-xl" />
      <Skeleton className="h-[28rem] rounded-xl" />
    </div>
  </div>
);
