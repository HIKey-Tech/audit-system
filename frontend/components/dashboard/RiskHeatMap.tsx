'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Grid3x3 } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { dashboardApi } from '@/lib/api/dashboard';
import { formatNumber } from '@/lib/utils/format';
import type { RiskMatrixCell } from '@/lib/types/domain';

// Zone colour by inherent score band (likelihood × impact), matching the
// riskScoreLabel bands used elsewhere. Populated cells use the full zone
// colour; empty cells are faded so the live exposure stands out.
interface Zone {
  label: string;
  filled: string;
  empty: string;
}

const zoneForScore = (score: number): Zone => {
  if (score >= 20) return { label: 'Critical', filled: 'bg-red-500 text-white ring-red-600', empty: 'bg-red-50 text-red-300 ring-red-100' };
  if (score >= 13) return { label: 'High', filled: 'bg-orange-400 text-white ring-orange-500', empty: 'bg-orange-50 text-orange-300 ring-orange-100' };
  if (score >= 6) return { label: 'Medium', filled: 'bg-yellow-300 text-yellow-900 ring-yellow-400', empty: 'bg-yellow-50 text-yellow-400 ring-yellow-100' };
  return { label: 'Low', filled: 'bg-emerald-300 text-emerald-900 ring-emerald-400', empty: 'bg-emerald-50 text-emerald-400 ring-emerald-100' };
};

const LEGEND: { label: string; swatch: string }[] = [
  { label: 'Low', swatch: 'bg-emerald-300' },
  { label: 'Medium', swatch: 'bg-yellow-300' },
  { label: 'High', swatch: 'bg-orange-400' },
  { label: 'Critical', swatch: 'bg-red-500' },
];

export const RiskHeatMap = (): JSX.Element => {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard', 'risk-matrix'],
    queryFn: () => dashboardApi.getRiskMatrix(),
  });

  // Index cells by "likelihood:impact" for O(1) lookup while laying out the grid.
  const byCell = new Map<string, RiskMatrixCell>();
  for (const cell of data?.cells ?? []) {
    byCell.set(`${cell.likelihood}:${cell.impact}`, cell);
  }

  // Impact descends down the page (5 at top), likelihood ascends to the right.
  const impacts = [5, 4, 3, 2, 1];
  const likelihoods = [1, 2, 3, 4, 5];

  return (
    <Card padded={false}>
      <div className="flex items-start justify-between px-5 pt-5 pb-3">
        <CardHeader
          title="Risk Heat Map"
          subtitle="Open & mitigated risks · likelihood × impact"
          className="mb-0"
        />
        <Link href="/risk" className="shrink-0 text-xs font-medium text-primary hover:underline">
          View all
        </Link>
      </div>

      <div className="px-5 pb-5">
        {isLoading ? (
          <Skeleton className="h-56 w-full" />
        ) : isError ? (
          <ErrorState compact onRetry={() => refetch()} />
        ) : (data?.totalPlotted ?? 0) === 0 ? (
          <EmptyState
            compact
            icon={<Grid3x3 className="h-4 w-4" />}
            title="No active risks to plot"
            description="Risks appear here once registered and assessed."
          />
        ) : (
          <>
            {/* Screen-reader alternative — the visual grid below is aria-hidden. */}
            <table className="sr-only">
              <caption>
                Risk heat map: active risk counts by likelihood (columns) and impact (rows).
                {' '}
                {formatNumber(data?.totalPlotted ?? 0)} risks plotted.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Impact \ Likelihood</th>
                  {likelihoods.map((likelihood) => (
                    <th key={likelihood} scope="col">{likelihood}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {impacts.map((impact) => (
                  <tr key={impact}>
                    <th scope="row">{impact}</th>
                    {likelihoods.map((likelihood) => (
                      <td key={likelihood}>{byCell.get(`${likelihood}:${impact}`)?.count ?? 0}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Matrix: impact label column + 5 likelihood columns */}
            <div className="flex gap-2" aria-hidden="true">
              {/* Vertical Impact axis caption */}
              <div className="flex items-center">
                <span className="-rotate-180 text-[10px] font-semibold uppercase tracking-widest text-text-muted [writing-mode:vertical-rl]">
                  Impact →
                </span>
              </div>

              <div className="flex-1">
                {impacts.map((impact) => (
                  <div key={impact} className="flex items-stretch gap-1.5">
                    <div className="flex w-4 items-center justify-center text-[10px] font-medium text-text-muted">
                      {impact}
                    </div>
                    <div className="mb-1.5 grid flex-1 grid-cols-5 gap-1.5">
                      {likelihoods.map((likelihood) => {
                        const cell = byCell.get(`${likelihood}:${impact}`);
                        const count = cell?.count ?? 0;
                        const score = likelihood * impact;
                        const zone = zoneForScore(score);
                        return (
                          <div
                            key={likelihood}
                            title={`${count} risk${count === 1 ? '' : 's'} · L${likelihood} × I${impact} · score ${score} (${zone.label})`}
                            className={`flex aspect-square items-center justify-center rounded-md text-sm font-semibold tabular-nums ring-1 ${
                              count > 0 ? zone.filled : zone.empty
                            }`}
                          >
                            {count > 0 ? count : ''}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Likelihood axis numbers */}
                <div className="flex gap-1.5 pl-[1.375rem]">
                  <div className="grid flex-1 grid-cols-5 gap-1.5">
                    {likelihoods.map((likelihood) => (
                      <div key={likelihood} className="text-center text-[10px] font-medium text-text-muted">
                        {likelihood}
                      </div>
                    ))}
                  </div>
                </div>
                <p className="mt-1 pl-[1.375rem] text-center text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                  Likelihood →
                </p>
              </div>
            </div>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
              <div className="flex flex-wrap items-center gap-3">
                {LEGEND.map((item) => (
                  <span key={item.label} className="inline-flex items-center gap-1.5 text-[11px] text-text-secondary">
                    <span className={`h-2.5 w-2.5 rounded-sm ${item.swatch}`} />
                    {item.label}
                  </span>
                ))}
              </div>
              <span className="text-[11px] text-text-muted">
                {formatNumber(data?.totalPlotted ?? 0)} plotted
              </span>
            </div>
          </>
        )}
      </div>
    </Card>
  );
};
