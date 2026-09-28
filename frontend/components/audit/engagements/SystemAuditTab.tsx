'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Bug, Download, FileSearch, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { NewAnalysisSlideOver } from '@/components/system-audit/NewAnalysisSlideOver';
import { SeverityPills } from '@/components/system-audit/shared';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { systemAuditApi } from '@/lib/api/system-audit';
import { ANALYSIS_META, DOC_TYPE_LABELS, SECURITY_TEST_STATUS_LABELS, SECURITY_TEST_TYPE_LABELS } from '@/lib/system-audit';
import { formatDate, formatDateTime } from '@/lib/utils/format';
import type { AuditEngagementDetail } from '@/lib/types/domain';

/**
 * The engagement's view of the system audit toolkit: analyses run for it, the
 * documentation relevant to its scope (its universe entity and linked assets),
 * and the security tests coordinated under it.
 */
export const SystemAuditTab = ({ engagement }: { engagement: AuditEngagementDetail }): JSX.Element => {
  const { hasPermission } = usePermissions();
  const canAnalytics = hasPermission('sysaudit:read');
  const canRun = hasPermission('sysaudit:run') && engagement.status === 'in_progress';
  const canDocs = hasPermission('sysdoc:read');
  const canTests = hasPermission('sectest:read');
  const [open, setOpen] = useState(false);

  const runs = useQuery({
    queryKey: ['system-audit', 'runs', 'engagement', engagement.id],
    queryFn: () => systemAuditApi.listRuns({ engagementId: engagement.id, pageSize: 50 }),
    enabled: canAnalytics,
  });
  const docs = useQuery({
    queryKey: ['system-audit', 'documentation', 'engagement', engagement.id],
    queryFn: () => systemAuditApi.listDocuments({ engagementId: engagement.id, pageSize: 50 }),
    enabled: canDocs,
  });
  const tests = useQuery({
    queryKey: ['system-audit', 'security-tests', 'engagement', engagement.id],
    queryFn: () => systemAuditApi.listSecurityTests({ engagementId: engagement.id, pageSize: 50 }),
    enabled: canTests,
  });

  return (
    <div className="space-y-4">
      {canAnalytics && (
        <Card padded>
          <CardHeader
            title="Data analytics"
            subtitle="Analyses of system exports and live data for this engagement — extracts are stored as engagement evidence"
            action={canRun ? <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setOpen(true)}>New analysis</Button> : undefined}
          />
          {runs.data?.items.length ? (
            <ul className="divide-y divide-border">
              {runs.data.items.map((r) => {
                const Icon = ANALYSIS_META[r.analysisType].icon;
                return (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <Link href={`/system-audit/analytics/${r.id}`} className="flex min-w-0 items-center gap-2 text-sm font-medium text-text-primary hover:text-primary">
                      <Icon className="h-4 w-4 shrink-0 text-text-muted" />
                      <span className="font-mono text-xs text-primary">{r.reference}</span>
                      <span className="truncate">{r.title}</span>
                    </Link>
                    <span className="flex items-center gap-2">
                      <SeverityPills counts={r.severityCounts} />
                      {r.reviewStatus === 'completed' ? <Badge tone="green" size="xs">Signed off</Badge> : <Badge tone="amber" size="xs">{r.openExceptions} open</Badge>}
                      <span className="text-xs text-text-muted">{formatDateTime(r.createdAt)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="flex items-center gap-2 text-sm text-text-muted"><FileSearch className="h-4 w-4" />No analyses linked to this engagement yet.</p>
          )}
        </Card>
      )}

      {canDocs && (
        <Card padded>
          <CardHeader
            title="Documentation in scope"
            subtitle="Policies, diagrams, manuals, plans, and contracts linked to this engagement's universe entity or assets"
            action={<Link href="/system-audit/documentation" className="text-xs font-medium text-primary hover:underline">Library</Link>}
          />
          {docs.data?.items.length ? (
            <ul className="divide-y divide-border">
              {docs.data.items.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="flex min-w-0 items-center gap-2 text-sm text-text-primary">
                    <BookOpen className="h-4 w-4 shrink-0 text-text-muted" />
                    <span className="truncate">{d.title}</span>
                    <Badge tone="gray" size="xs">{DOC_TYPE_LABELS[d.docType]}</Badge>
                    {d.reviewState === 'overdue' && <Badge status="overdue" size="xs">Review overdue</Badge>}
                    {d.contractState === 'expired' && <Badge status="expired" size="xs">Expired</Badge>}
                  </span>
                  <Button size="sm" variant="ghost" leftIcon={<Download className="h-3.5 w-3.5" />} onClick={() => systemAuditApi.downloadDocument(d.id).catch((e: Error) => toast.error(e.message))}>
                    Download
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">No documentation is linked to this engagement&apos;s scope.</p>
          )}
        </Card>
      )}

      {canTests && (
        <Card padded>
          <CardHeader title="Security tests" subtitle="Vulnerability assessments and penetration tests under this engagement" />
          {tests.data?.items.length ? (
            <ul className="divide-y divide-border">
              {tests.data.items.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <Link href={`/system-audit/security-tests/${t.id}`} className="flex min-w-0 items-center gap-2 text-sm font-medium text-text-primary hover:text-primary">
                    <Bug className="h-4 w-4 shrink-0 text-text-muted" />
                    <span className="font-mono text-xs text-primary">{t.reference}</span>
                    <span className="truncate">{t.title}</span>
                  </Link>
                  <span className="flex items-center gap-2 text-xs text-text-secondary">
                    {SECURITY_TEST_TYPE_LABELS[t.testType]} · {formatDate(t.plannedStart)}
                    <Badge status={t.status} size="xs">{SECURITY_TEST_STATUS_LABELS[t.status]}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">No security tests linked to this engagement.</p>
          )}
        </Card>
      )}

      <NewAnalysisSlideOver open={open} onClose={() => setOpen(false)} engagementId={engagement.id} />
    </div>
  );
};
