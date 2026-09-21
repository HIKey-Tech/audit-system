'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Brain, ChevronRight, Sparkles } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { predictiveApi, type PredictiveSeverity } from '@/lib/api/predictive';

const severityTone: Record<PredictiveSeverity, 'gray' | 'yellow' | 'orange' | 'red'> = {
  low: 'gray',
  medium: 'yellow',
  high: 'orange',
  critical: 'red',
};

/** Compact entry point for the live, explainable early-warning workspace. */
export const AuditIntelligenceCard = (): JSX.Element => {
  const query = useQuery({
    queryKey: ['predictive', 'overview'],
    queryFn: predictiveApi.getOverview,
    staleTime: 55_000,
  });

  return (
    <Card padded={false}>
      <div className="px-5 pt-5">
        <CardHeader
          title={<span className="flex items-center gap-2"><Brain className="h-4 w-4 text-primary" />Audit intelligence</span>}
          subtitle="Live workflow signals that may need attention."
          action={<Link href="/predictive" className="text-xs font-medium text-primary hover:underline">Open</Link>}
        />
      </div>
      {query.isLoading ? (
        <div className="space-y-3 px-5 pb-5"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-5/6" /></div>
      ) : query.isError || !query.data ? (
        <div className="px-5 pb-5"><ErrorState compact onRetry={() => query.refetch()} /></div>
      ) : query.data.insights.length === 0 ? (
        <div className="px-5 pb-5"><EmptyState compact icon={<Sparkles className="h-4 w-4" />} title="No current early warnings" description="Open Audit intelligence to review next actions." /></div>
      ) : (
        <div className="divide-y divide-border">
          {query.data.insights.slice(0, 3).map((insight) => (
            <Link key={insight.id} href={insight.actionUrl} className="flex items-start gap-2 px-5 py-3 transition-colors hover:bg-surface-alt">
              <Badge tone={severityTone[insight.severity]}>{insight.severity}</Badge>
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-text-primary">{insight.title}</span>
              <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-muted" />
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
};
