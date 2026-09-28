'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, Lock, ShieldCheck } from 'lucide-react';

import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatTile } from '@/components/system-audit/shared';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { systemAuditApi } from '@/lib/api/system-audit';
import { SYSTEM_AUDIT_ACTIVITIES } from '@/lib/system-audit';
import { formatNumber } from '@/lib/utils/format';

export default function SystemAuditToolkitPage(): JSX.Element {
  const { hasPermission, nav } = usePermissions();
  const canAnalytics = hasPermission('sysaudit:read');

  const runs = useQuery({
    queryKey: ['system-audit', 'runs', 'count'],
    queryFn: () => systemAuditApi.listRuns({ pageSize: 1 }),
    enabled: canAnalytics,
  });
  const accessReviews = useQuery({
    queryKey: ['system-audit', 'runs', 'access-count'],
    queryFn: () => systemAuditApi.listRuns({ pageSize: 1, analysisType: 'access_listing' }),
    enabled: canAnalytics,
  });
  const tests = useQuery({
    queryKey: ['system-audit', 'security-tests', 'count'],
    queryFn: () => systemAuditApi.listSecurityTests({ pageSize: 1 }),
    enabled: hasPermission('sectest:read'),
  });
  const docs = useQuery({
    queryKey: ['system-audit', 'documentation', 'summary'],
    queryFn: () => systemAuditApi.documentSummary(),
    enabled: hasPermission('sysdoc:read'),
  });

  if (!nav.systemAudit) {
    return (
      <div>
        <PageHeader title="System audit toolkit" />
        <Card>
          <EmptyState icon={<Lock className="h-4 w-4" />} title="You do not have access to the system audit toolkit" />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="System audit toolkit"
        subtitle="The seven system-audit activities and where IAMS covers each one."
        breadcrumbs={[{ label: 'System/IT Audit', href: '/audit/domains/it' }, { label: 'Toolkit' }]}
      />

      <Card padded className="mb-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0 text-sm text-text-secondary">
            <p className="font-medium text-text-primary">Read-only by design</p>
            <p className="mt-0.5">
              IAMS never changes the systems it audits. Data arrives as exports that auditors upload, or through the
              read-only IAMS, Entra ID, and IMOC connectors. Every uploaded extract is fingerprinted (SHA-256) and kept
              as evidence, and every review decision is recorded in the tamper-evident audit trail.
            </p>
          </div>
        </div>
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Analyses run" value={canAnalytics ? formatNumber(runs.data?.meta.total ?? 0) : '—'} />
        <StatTile label="Access reviews" value={canAnalytics ? formatNumber(accessReviews.data?.meta.total ?? 0) : '—'} />
        <StatTile label="Security tests" value={tests.data ? formatNumber(tests.data.meta.total) : '—'} />
        <StatTile
          label="Documents"
          value={docs.data ? formatNumber(docs.data.total) : '—'}
          hint={docs.data && docs.data.reviewOverdue > 0 ? `${docs.data.reviewOverdue} past review date` : undefined}
          tone={docs.data && docs.data.reviewOverdue > 0 ? 'warn' : 'neutral'}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {SYSTEM_AUDIT_ACTIVITIES.map((activity) => {
          const links = activity.links.filter((l) => !l.permission || hasPermission(l.permission));
          return (
            <Card key={activity.number} padded>
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
                  {activity.number}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold text-text-primary">{activity.title}</h2>
                  <ul className="mt-2 space-y-1">
                    {activity.requirements.map((r) => (
                      <li key={r} className="flex items-start gap-2 text-sm text-text-secondary">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    Privilege provided: <span className="normal-case tracking-normal text-text-secondary">{activity.privilege}</span>
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {links.length === 0 && (
                      <span className="text-xs italic text-text-muted">Your role does not include these tools.</span>
                    )}
                    {links.map((link) => {
                      const Icon = link.icon;
                      return (
                        <Link
                          key={link.href + link.label}
                          href={link.href}
                          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-2.5 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-primary hover:text-primary"
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {link.label}
                          <ArrowRight className="h-3 w-3 text-text-muted" />
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
