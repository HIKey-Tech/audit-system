'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileUp, Lock, Pencil, Plus, ShieldCheck, Trash2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ReasonDialog } from '@/components/ui/ReasonDialog';
import { SecurityTestFormSlideOver } from '@/components/system-audit/SecurityTestFormSlideOver';
import { NewAnalysisSlideOver } from '@/components/system-audit/NewAnalysisSlideOver';
import { SeverityPills, StatTile } from '@/components/system-audit/shared';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue';
import { assetsApi } from '@/lib/api/assets';
import { systemAuditApi, type SecurityTestStatus } from '@/lib/api/system-audit';
import { SECURITY_TEST_STATUS_LABELS, SECURITY_TEST_TYPE_LABELS } from '@/lib/system-audit';
import { formatDate, formatDateTime, formatFileSize } from '@/lib/utils/format';

const TRANSITION_LABELS: Partial<Record<SecurityTestStatus, string>> = {
  in_progress: 'Start testing',
  reporting: 'Testing complete',
  remediation: 'Move to remediation',
  closed: 'Close test',
  cancelled: 'Cancel test',
};

const STEPS: SecurityTestStatus[] = ['planned', 'authorised', 'in_progress', 'reporting', 'remediation', 'closed'];

export default function SecurityTestPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const router = useRouter();
  const qc = useQueryClient();
  const { hasPermission, user } = usePermissions();
  const canRead = hasPermission('sectest:read');
  const canManage = hasPermission('sectest:manage');
  const canAuthorise = hasPermission('sectest:authorise');
  const reportRef = useRef<HTMLInputElement>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [authoriseOpen, setAuthoriseOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [assetSearch, setAssetSearch] = useState('');
  const debouncedAsset = useDebouncedValue(assetSearch, 300);

  const test = useQuery({ queryKey: ['system-audit', 'security-test', id], queryFn: () => systemAuditApi.getSecurityTest(id), enabled: Boolean(id) && canRead });
  const assets = useQuery({
    queryKey: ['assets', 'picker', debouncedAsset],
    queryFn: () => assetsApi.list({ search: debouncedAsset, pageSize: 8 }),
    enabled: canManage && debouncedAsset.length >= 2,
  });

  const refresh = (): void => void qc.invalidateQueries({ queryKey: ['system-audit'] });
  const onError = (fallback: string) => (err: unknown) => toast.error(err instanceof Error ? err.message : fallback);

  const authorise = useMutation({
    mutationFn: (note: string) => systemAuditApi.authoriseSecurityTest(id, note),
    onSuccess: () => { toast.success('Test authorised'); setAuthoriseOpen(false); refresh(); },
    onError: onError('Could not authorise the test'),
  });
  const transition = useMutation({
    mutationFn: (status: SecurityTestStatus) => systemAuditApi.changeSecurityTestStatus(id, status),
    onSuccess: (t) => { toast.success(`Status: ${SECURITY_TEST_STATUS_LABELS[t.status]}`); refresh(); },
    onError: onError('Could not change the status'),
  });
  const addAsset = useMutation({
    mutationFn: (assetId: string) => systemAuditApi.addSecurityTestAssets(id, [assetId]),
    onSuccess: () => { toast.success('Asset added to scope'); setAssetSearch(''); refresh(); },
    onError: onError('Could not add the asset'),
  });
  const removeAsset = useMutation({
    mutationFn: (assetId: string) => systemAuditApi.removeSecurityTestAsset(id, assetId),
    onSuccess: () => { toast.success('Asset removed from scope'); refresh(); },
    onError: onError('Could not remove the asset'),
  });
  const uploadReport = useMutation({
    mutationFn: (file: File) => systemAuditApi.uploadSecurityTestReport(id, file),
    onSuccess: () => { toast.success('Report attached'); refresh(); },
    onError: onError('Could not upload the report'),
  });
  const remove = useMutation({
    mutationFn: () => systemAuditApi.deleteSecurityTest(id),
    onSuccess: () => { toast.success('Security test deleted'); refresh(); router.push('/system-audit/security-tests'); },
    onError: onError('Could not delete the test'),
  });

  const crumbs = [{ label: 'System audit', href: '/system-audit' }, { label: 'Security testing', href: '/system-audit/security-tests' }];
  if (!canRead) return <div><PageHeader title="Security test" breadcrumbs={crumbs} /><Card><EmptyState icon={<Lock className="h-4 w-4" />} title="You do not have access to security testing" /></Card></div>;
  if (test.isError) return <div><PageHeader title="Security test" breadcrumbs={crumbs} /><Card><ErrorState onRetry={() => test.refetch()} /></Card></div>;
  if (!test.data) return <div><PageHeader title="Loading…" breadcrumbs={crumbs} /><Card><Skeleton className="h-24 w-full" /></Card></div>;

  const t = test.data;
  const finished = t.status === 'closed' || t.status === 'cancelled';
  const isOwnTest = t.coordinator?.id === user.id || t.createdBy?.id === user.id;
  const canUploadReport = canManage && ['in_progress', 'reporting', 'remediation', 'closed'].includes(t.status);
  const stepIndex = STEPS.indexOf(t.status);

  return (
    <div>
      <PageHeader
        title={t.title}
        subtitle={`${t.reference} · ${SECURITY_TEST_TYPE_LABELS[t.testType]}`}
        breadcrumbs={[...crumbs, { label: t.reference }]}
        actions={
          <div className="flex flex-wrap gap-2">
            {canManage && !finished && <Button variant="secondary" size="sm" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditOpen(true)}>Edit</Button>}
            {canManage && (t.status === 'planned' || t.status === 'cancelled') && <Button variant="ghost" size="sm" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setDeleteOpen(true)}>Delete</Button>}
            {t.status === 'planned' && canAuthorise && (
              <Button size="sm" leftIcon={<ShieldCheck className="h-3.5 w-3.5" />} disabled={isOwnTest} title={isOwnTest ? 'The coordinator or creator cannot authorise their own test' : undefined} onClick={() => setAuthoriseOpen(true)}>
                Authorise test
              </Button>
            )}
            {canManage && t.allowedTransitions.map((s) => (
              <Button key={s} size="sm" variant={s === 'cancelled' ? 'ghost' : 'primary'} isLoading={transition.isPending && transition.variables === s} onClick={() => transition.mutate(s)}>
                {TRANSITION_LABELS[s] ?? SECURITY_TEST_STATUS_LABELS[s]}
              </Button>
            ))}
          </div>
        }
      />

      {t.status !== 'cancelled' && (
        <Card padded className="mb-4">
          <ol className="flex flex-wrap items-center gap-2 text-xs">
            {STEPS.map((s, i) => (
              <li key={s} className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 font-medium ${i < stepIndex ? 'bg-emerald-50 text-emerald-700' : i === stepIndex ? 'bg-primary text-white' : 'bg-surface-alt text-text-muted'}`}>
                  {SECURITY_TEST_STATUS_LABELS[s]}
                </span>
                {i < STEPS.length - 1 && <span className="text-text-muted">→</span>}
              </li>
            ))}
          </ol>
          {t.status === 'planned' && <p className="mt-2 text-xs text-text-secondary">Testing cannot start until someone other than the coordinator authorises it.</p>}
          {t.status === 'reporting' && !t.report && <p className="mt-2 text-xs text-amber-700">Attach the tester&apos;s report to move on.</p>}
        </Card>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Scan imports" value={t.results.scanRuns} />
        <StatTile label="Latest results" value={t.results.latestScan ? t.results.latestScan.critical + t.results.latestScan.high : '—'} hint={t.results.latestScan ? <SeverityPills counts={t.results.latestScan} /> : 'Import scan results'} tone={t.results.latestScan && t.results.latestScan.critical > 0 ? 'bad' : 'neutral'} />
        <StatTile label="Open exceptions" value={t.results.openExceptions} tone={t.results.openExceptions > 0 ? 'warn' : 'neutral'} />
        <StatTile label="Findings raised" value={t.results.findingsRaised} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card padded>
            <CardHeader title="Scope & rules of engagement" />
            <p className="whitespace-pre-wrap text-sm text-text-primary">{t.scope}</p>
            {t.rulesOfEngagement && (
              <>
                <p className="mb-1 mt-4 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Rules of engagement</p>
                <p className="whitespace-pre-wrap text-sm text-text-primary">{t.rulesOfEngagement}</p>
              </>
            )}
          </Card>

          <Card padded>
            <CardHeader
              title="Results"
              subtitle="Scanner or tester output, analysed for severity and overdue remediation"
              action={canManage && !finished ? <Button size="sm" variant="secondary" leftIcon={<FileUp className="h-3.5 w-3.5" />} onClick={() => setImportOpen(true)}>Import results</Button> : undefined}
            />
            {t.scanRuns.length === 0 ? (
              <p className="text-sm text-text-muted">No results imported yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {t.scanRuns.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                    <Link href={`/system-audit/analytics/${r.id}`} className="text-sm font-medium text-primary hover:underline">{r.reference} — {r.title}</Link>
                    <span className="text-xs text-text-secondary">{r.exceptionCount} exception(s) · {formatDateTime(r.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card padded>
            <CardHeader title="Assets in scope" subtitle="From the asset registry" />
            {canManage && !finished && (
              <div className="relative mb-3">
                <Input placeholder="Search assets to add (name or tag)" leftIcon={<Plus className="h-4 w-4" />} value={assetSearch} onChange={(e) => setAssetSearch(e.target.value)} />
                {assets.data && debouncedAsset.length >= 2 && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-white shadow-lg">
                    {assets.data.items.length === 0 && <p className="px-3 py-2 text-xs text-text-muted">No matching assets</p>}
                    {assets.data.items.filter((a) => !t.assets.some((x) => x.id === a.id)).map((a) => (
                      <button key={a.id} type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-alt" onClick={() => addAsset.mutate(a.id)}>
                        <span className="font-mono text-xs text-text-muted">{a.assetTag}</span> {a.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {t.assets.length === 0 ? (
              <p className="text-sm text-text-muted">No registry assets linked.</p>
            ) : (
              <ul className="divide-y divide-border">
                {t.assets.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 py-2">
                    <Link href={`/assets/${a.id}`} className="text-sm text-text-primary hover:text-primary">
                      <span className="font-mono text-xs text-text-muted">{a.assetTag}</span> {a.name}
                    </Link>
                    <span className="flex items-center gap-2">
                      <Badge status={a.criticality} size="xs">{a.criticality}</Badge>
                      {canManage && !finished && (
                        <button type="button" aria-label={`Remove ${a.name}`} className="text-text-muted hover:text-danger" onClick={() => removeAsset.mutate(a.id)}><X className="h-4 w-4" /></button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card padded>
            <CardHeader title="Details" />
            <dl className="space-y-2 text-sm">
              <Row label="Status" value={<Badge status={t.status} size="xs" withDot>{SECURITY_TEST_STATUS_LABELS[t.status]}</Badge>} />
              <Row label="Provider" value={`${t.provider} (${t.providerType})`} />
              <Row label="Planned" value={`${formatDate(t.plannedStart)} – ${formatDate(t.plannedEnd)}`} />
              {t.actualStart && <Row label="Actual" value={`${formatDate(t.actualStart)} – ${t.actualEnd ? formatDate(t.actualEnd) : 'ongoing'}`} />}
              <Row label="Coordinator" value={t.coordinator?.name ?? '—'} />
              <Row label="Authorised" value={t.authorisedBy ? `${t.authorisedBy.name}, ${formatDateTime(t.authorisedAt)}` : 'Not yet'} />
              {t.engagement && <Row label="Engagement" value={<Link href={`/audit/engagements/${t.engagement.id}`} className="text-primary hover:underline">{t.engagement.referenceNumber}</Link>} />}
              {t.notes && <Row label="Notes" value={t.notes} />}
            </dl>
          </Card>
          <Card padded>
            <CardHeader title="Test report" />
            {t.report ? (
              <div className="space-y-2">
                <p className="text-sm text-text-primary">{t.report.fileName}</p>
                <p className="text-xs text-text-secondary">{formatFileSize(t.report.fileSize)} · {formatDateTime(t.report.uploadedAt)}</p>
                <Button size="sm" variant="secondary" leftIcon={<Download className="h-3.5 w-3.5" />} onClick={() => systemAuditApi.downloadSecurityTestReport(t.id).catch((e: Error) => toast.error(e.message))}>Download</Button>
              </div>
            ) : (
              <p className="text-sm text-text-muted">No report attached.</p>
            )}
            {canUploadReport && (
              <div className="mt-3">
                <input ref={reportRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadReport.mutate(f); e.target.value = ''; }} />
                <Button size="sm" variant="ghost" leftIcon={<Upload className="h-3.5 w-3.5" />} isLoading={uploadReport.isPending} onClick={() => reportRef.current?.click()}>
                  {t.report ? 'Upload new version' : 'Attach report'}
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>

      <SecurityTestFormSlideOver open={editOpen} onClose={() => setEditOpen(false)} test={t} />
      <NewAnalysisSlideOver open={importOpen} onClose={() => setImportOpen(false)} initialType="vulnerability_scan" lockType securityTestId={t.id} engagementId={t.engagement?.id} />
      <ReasonDialog
        open={authoriseOpen}
        onClose={() => setAuthoriseOpen(false)}
        onConfirm={(note) => authorise.mutate(note)}
        title="Authorise this security test"
        description={`You confirm ${t.provider} may test the agreed scope between ${formatDate(t.plannedStart)} and ${formatDate(t.plannedEnd)} under the rules of engagement.`}
        reasonLabel="Authorisation note"
        confirmLabel="Authorise"
        minLength={1}
        isLoading={authorise.isPending}
      />
      <ConfirmDialog open={deleteOpen} title="Delete this security test?" description="It will be removed from the register." confirmLabel="Delete" variant="danger" isLoading={remove.isPending} onConfirm={() => remove.mutate()} onCancel={() => setDeleteOpen(false)} />
    </div>
  );
}

const Row = ({ label, value }: { label: string; value: React.ReactNode }): JSX.Element => (
  <div className="grid grid-cols-3 gap-2">
    <dt className="text-xs text-text-secondary">{label}</dt>
    <dd className="col-span-2 text-text-primary">{value}</dd>
  </div>
);
