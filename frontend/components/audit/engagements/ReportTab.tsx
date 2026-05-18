'use client';

import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FileText, Send, Check, X, Download, Sparkles, ChevronDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormField } from '@/components/ui/FormField';
import { Input, Textarea } from '@/components/ui/Input';
import { reportsApi } from '@/lib/api/audit';
import { formatRelative } from '@/lib/utils/format';
import { usePermission } from '@/hooks/usePermission';
import type { AuditEngagementDetail } from '@/lib/types/domain';

const GenSchema = z.object({
  title: z.string().min(2).max(300),
  executiveSummary: z.string().optional().or(z.literal('')),
  scope: z.string().optional().or(z.literal('')),
  methodology: z.string().optional().or(z.literal('')),
});
type GenValues = z.infer<typeof GenSchema>;

export const ReportTab = ({ engagement }: { engagement: AuditEngagementDetail }): JSX.Element => {
  const qc = useQueryClient();
  const canGenerateReport = usePermission('report:create');
  const canSubmitReport = usePermission('report:submit');
  const canApproveReport = usePermission('report:approve');
  const canIssueReport = usePermission('report:issue');
  const canExportReport = usePermission('report:export');

  const report = useQuery({
    queryKey: ['engagements', engagement.id, 'report'],
    queryFn: () => reportsApi.getByEngagement(engagement.id).catch(() => null),
    retry: false,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['engagements', engagement.id] });
    qc.invalidateQueries({ queryKey: ['engagements', engagement.id, 'report'] });
  };

  const generate = useMutation({
    mutationFn: (v: GenValues) =>
      reportsApi.generate(engagement.id, {
        title: v.title,
        executiveSummary: v.executiveSummary || undefined,
        scope: v.scope || undefined,
        methodology: v.methodology || undefined,
      }),
    onSuccess: () => {
      toast.success('Report generated');
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to generate'),
  });

  const submitMut = useMutation({
    mutationFn: () => reportsApi.submit(report.data!.id),
    onSuccess: () => { toast.success('Submitted for approval'); refresh(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });
  const approveMut = useMutation({
    mutationFn: () => reportsApi.approve(report.data!.id),
    onSuccess: () => { toast.success('Approved'); refresh(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });
  const rejectMut = useMutation({
    mutationFn: (reason: string) => reportsApi.reject(report.data!.id, reason),
    onSuccess: () => { toast.success('Rejected'); refresh(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });
  const issueMut = useMutation({
    mutationFn: () => reportsApi.issue(report.data!.id),
    onSuccess: () => { toast.success('Report issued'); refresh(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const [exportingFormat, setExportingFormat] = useState<'pdf' | 'docx' | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showExportMenu) return;
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showExportMenu]);

  const handleExport = async (format: 'pdf' | 'docx') => {
    setExportingFormat(format);
    setShowExportMenu(false);
    try {
      const { blob, fileName } = await reportsApi.exportFile(
        report.data!.id,
        format,
        engagement.referenceNumber,
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExportingFormat(null);
    }
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<GenValues>({
    resolver: zodResolver(GenSchema),
    defaultValues: {
      title: `${engagement.title} — Audit Report`,
      executiveSummary: '',
      scope: '',
      methodology: '',
    },
  });

  if (report.isLoading) {
    return (
      <Card>
        <Skeleton className="h-4 w-1/3 mb-3" />
        <Skeleton className="h-3 w-2/3" />
      </Card>
    );
  }

  if (!report.data) {
    return (
      <Card>
        <CardHeader title="Audit report" subtitle="Generate the formal audit report once fieldwork is complete." />
        {!canGenerateReport ? (
          <EmptyState
            icon={<FileText className="h-4 w-4" />}
            title="No report yet"
            description="A report can be generated by the lead auditor or audit administrator."
          />
        ) : (
          <form onSubmit={handleSubmit((v) => generate.mutate(v))} className="space-y-4" noValidate>
            <FormField label="Title" required error={errors.title?.message}>
              <Input error={errors.title?.message} {...register('title')} />
            </FormField>
            <FormField label="Executive summary">
              <Textarea rows={5} {...register('executiveSummary')} />
            </FormField>
            <FormField label="Scope">
              <Textarea rows={4} {...register('scope')} />
            </FormField>
            <FormField label="Methodology">
              <Textarea rows={4} {...register('methodology')} />
            </FormField>
            <Button type="submit" leftIcon={<Sparkles className="h-4 w-4" />} isLoading={generate.isPending}>
              Generate report
            </Button>
          </form>
        )}
      </Card>
    );
  }

  const r = report.data;

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-text-primary">{r.title}</h3>
              <StatusBadge status={r.status} />
              <Badge tone="gray">v{r.version}</Badge>
            </div>
            <p className="mt-1 text-xs text-text-secondary">
              {r.issuedAt ? `Issued ${formatRelative(r.issuedAt)} by ${r.issuedByName ?? '—'}` : 'Not yet issued'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canExportReport && (
              <div ref={exportMenuRef} className="relative flex">
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Download className="h-4 w-4" />}
                  isLoading={exportingFormat === 'pdf'}
                  disabled={exportingFormat === 'docx'}
                  onClick={() => handleExport('pdf')}
                  className="rounded-r-none border-r-0"
                >
                  Export PDF
                </Button>
                <button
                  type="button"
                  onClick={() => setShowExportMenu((v) => !v)}
                  disabled={exportingFormat !== null}
                  aria-label="More export options"
                  className="inline-flex h-8 items-center rounded-r-md border border-border bg-white px-1.5 text-text-secondary hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 top-full z-10 mt-1 w-36 rounded-md border border-border bg-white py-1 shadow-lg">
                    <button
                      type="button"
                      onClick={() => handleExport('docx')}
                      disabled={exportingFormat !== null}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {exportingFormat === 'docx' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <FileText className="h-3.5 w-3.5" />
                      )}
                      Export DOCX
                    </button>
                  </div>
                )}
              </div>
            )}
            {canSubmitReport && (r.status === 'draft' || r.status === 'rejected') && (
              <Button leftIcon={<Send className="h-4 w-4" />} size="sm" onClick={() => submitMut.mutate()} isLoading={submitMut.isPending}>
                Submit for approval
              </Button>
            )}
            {canApproveReport && r.status === 'submitted' && (
              <>
                <Button variant="success" size="sm" leftIcon={<Check className="h-4 w-4" />} onClick={() => approveMut.mutate()} isLoading={approveMut.isPending}>
                  Approve
                </Button>
                <Button variant="danger" size="sm" leftIcon={<X className="h-4 w-4" />} onClick={() => {
                  const reason = window.prompt('Rejection reason') ?? '';
                  if (reason.trim()) rejectMut.mutate(reason.trim());
                }}>
                  Reject
                </Button>
              </>
            )}
            {canIssueReport && r.status === 'approved' && (
              <Button size="sm" onClick={() => issueMut.mutate()} isLoading={issueMut.isPending}>
                Issue report
              </Button>
            )}
          </div>
        </div>

        {r.rejectionReason && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-danger">
            <p className="font-medium">Rejection reason</p>
            <p className="mt-0.5 whitespace-pre-wrap">{r.rejectionReason}</p>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Executive summary" />
          <p className="text-sm text-text-primary whitespace-pre-wrap">
            {r.executiveSummary || '—'}
          </p>
        </Card>
        <Card>
          <CardHeader title="Scope" />
          <p className="text-sm text-text-primary whitespace-pre-wrap">{r.scope || '—'}</p>
        </Card>
        <Card>
          <CardHeader title="Methodology" />
          <p className="text-sm text-text-primary whitespace-pre-wrap">{r.methodology || '—'}</p>
        </Card>
        <Card>
          <CardHeader title="Findings summary" />
          {(engagement.findings ?? []).length === 0 ? (
            <p className="text-xs text-text-muted">No findings.</p>
          ) : (
            <ul className="space-y-2">
              {(engagement.findings ?? []).map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-text-primary">{f.title}</span>
                  <StatusBadge status={f.severity} size="xs" />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {r.approvalChain && r.approvalChain.length > 0 && (
        <Card>
          <CardHeader title="Approval chain" />
          <ol className="space-y-2 text-xs">
            {r.approvalChain.map((step) => (
              <li key={step.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <div>
                  <p className="font-medium text-text-primary">
                    Level {step.level} · {step.approverName}
                  </p>
                  {(step.comment || step.rejectionReason) && (
                    <p className="text-text-secondary mt-0.5">{step.rejectionReason || step.comment}</p>
                  )}
                </div>
                <StatusBadge status={step.status} />
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
};
