'use client';

import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils/cn';
import { formatNumber } from '@/lib/utils/format';
import { ANALYSIS_META, SOURCE_LABELS } from '@/lib/system-audit';
import type { AnalysisRun, AnalysisType, Severity, SeverityCounts } from '@/lib/api/system-audit';

const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low'];

const SEVERITY_TONE: Record<Severity, 'red' | 'orange' | 'yellow' | 'green'> = {
  critical: 'red',
  high: 'orange',
  medium: 'yellow',
  low: 'green',
};

/** Compact "2 critical · 3 high …" pills; zero counts are omitted. */
export const SeverityPills = ({ counts, className }: { counts: SeverityCounts; className?: string }): JSX.Element => {
  const present = SEVERITY_ORDER.filter((s) => counts[s] > 0);
  if (present.length === 0) {
    return <span className={cn('text-xs text-text-muted', className)}>No exceptions</span>;
  }
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1', className)}>
      {present.map((s) => (
        <Badge key={s} tone={SEVERITY_TONE[s]} size="xs">
          {counts[s]} {s}
        </Badge>
      ))}
    </span>
  );
};

export const SeverityBadge = ({ severity }: { severity: Severity }): JSX.Element => (
  <Badge tone={SEVERITY_TONE[severity]} size="xs" withDot>
    {severity.charAt(0).toUpperCase() + severity.slice(1)}
  </Badge>
);

export const SourceBadge = ({ source }: { source: AnalysisRun['source'] }): JSX.Element => (
  <Badge tone={source === 'upload' ? 'gray' : 'blue'} size="xs">
    {SOURCE_LABELS[source]}
  </Badge>
);

export const StatTile = ({
  label,
  value,
  hint,
  tone = 'neutral',
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'neutral' | 'good' | 'bad' | 'warn';
  icon?: ReactNode;
}): JSX.Element => (
  <Card padded className="!p-4">
    <div className="flex items-start justify-between gap-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">{label}</p>
      {icon && <span className="text-text-muted">{icon}</span>}
    </div>
    <p
      className={cn(
        'mt-1 text-2xl font-semibold tabular-nums',
        tone === 'good' && 'text-emerald-700',
        tone === 'bad' && 'text-red-700',
        tone === 'warn' && 'text-amber-700',
        tone === 'neutral' && 'text-text-primary',
      )}
    >
      {value}
    </p>
    {hint && <p className="mt-0.5 text-xs text-text-secondary">{hint}</p>}
  </Card>
);

const displayValue = (value: unknown, suffix?: string): string => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') return `${formatNumber(value)}${suffix ?? ''}`;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
};

/** The headline metrics of a run's summary for its analysis type. */
export const HeadlineMetrics = ({
  type,
  summary,
  compact,
}: {
  type: AnalysisType;
  summary: Record<string, unknown>;
  compact?: boolean;
}): JSX.Element => {
  const metrics = ANALYSIS_META[type].headline;
  return (
    <div className={cn('grid gap-2', compact ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5')}>
      {metrics.map((m) => {
        const value = summary[m.key];
        const flagged = m.bad && typeof value === 'number' && value !== 0;
        return (
          <div key={m.key} className={cn('rounded-md border border-border px-3 py-2', flagged && 'border-red-200 bg-red-50/50')}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{m.label}</p>
            <p className={cn('text-lg font-semibold tabular-nums', flagged ? 'text-red-700' : 'text-text-primary')}>
              {displayValue(value, m.suffix)}
            </p>
          </div>
        );
      })}
    </div>
  );
};

/** Human label for a raw summary key, e.g. "sodConflicts" → "Sod conflicts". */
export const summaryLabel = (key: string): string =>
  key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/\bSod\b/, 'SoD')
    .replace(/\bMfa\b/, 'MFA')
    .replace(/\bSla\b/, 'SLA');

export const SummaryTable = ({ summary }: { summary: Record<string, unknown> }): JSX.Element => (
  <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
    {Object.entries(summary).map(([key, value]) => (
      <div key={key} className="flex items-baseline justify-between gap-3 border-b border-border/60 py-1.5">
        <dt className="text-xs text-text-secondary">{summaryLabel(key)}</dt>
        <dd className="text-sm font-medium tabular-nums text-text-primary">
          {typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)
            ? new Date(value).toLocaleString()
            : displayValue(value)}
        </dd>
      </div>
    ))}
  </dl>
);
