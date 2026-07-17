'use client';

import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FileText, Send, Check, X, Download, Sparkles, ChevronDown, Loader2, Eye, LayoutGrid } from 'lucide-react';
import { toast } from 'sonner';
import { toastOnInvalid } from '@/lib/utils/form';

import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormField } from '@/components/ui/FormField';
import { ReasonDialog } from '@/components/ui/ReasonDialog';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Input';
import { InfoHint } from '@/components/ui/InfoHint';
import { reportTemplatesApi } from '@/lib/api/settings';
import { reportsApi } from '@/lib/api/audit';
import { workflowApi } from '@/lib/api/workflow';
import { ApproveSignPanel } from '@/components/workflow/ApproveSignPanel';
import { SignedApprovalDocuments } from '@/components/workflow/SignedApprovalDocuments';
import { ApprovalChain } from '@/components/audit/engagements/ApprovalChain';
import { formatRelative, formatDate } from '@/lib/utils/format';
import { usePermission } from '@/hooks/usePermission';
import { useSession } from '@/components/providers/AuthProvider';
import type { AuditEngagementDetail } from '@/lib/types/domain';

const GenSchema = z.object({
  title: z.string().min(2).max(300),
  templateId: z.string().optional().or(z.literal('')),
  executiveSummary: z.string().optional().or(z.literal('')),
  scope: z.string().optional().or(z.literal('')),
  methodology: z.string().optional().or(z.literal('')),
});
type GenValues = z.infer<typeof GenSchema>;

export const ReportTab = ({ engagement }: { engagement: AuditEngagementDetail }): JSX.Element => {
  const qc = useQueryClient();
  const session = useSession();
  const canGenerateReport = usePermission('report:create');
  const canSubmitReport = usePermission('report:submit');
  const canApproveApproval = usePermission('approval:approve');
  const canRejectApproval = usePermission('approval:reject');
  const canIssueReport = usePermission('report:issue');
  const canExportReport = usePermission('report:export');

  const report = useQuery({
    queryKey: ['engagements', engagement.id, 'report'],
    queryFn: () => reportsApi.getByEngagement(engagement.id).catch(() => null),
    retry: false,
  });

  const reportTemplates = useQuery({
    queryKey: ['settings', 'report-templates', 'list'],
    queryFn: () => reportTemplatesApi.list(),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['engagements', engagement.id] });
    qc.invalidateQueries({ queryKey: ['engagements', engagement.id, 'report'] });
    qc.invalidateQueries({ queryKey: ['workflow'] });
  };

  const approval = useQuery({
    queryKey: ['workflow', 'approval', 'audit_report', report.data?.id],
    queryFn: () => workflowApi.getApprovalByEntity('audit_report', report.data!.id).catch(() => null),
    enabled: Boolean(report.data?.id),
    retry: false,
  });

  const generate = useMutation({
    mutationFn: (v: GenValues) =>
      reportsApi.generate(engagement.id, {
        title: v.title,
        templateId: v.templateId || undefined,
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
  const rejectMut = useMutation({
    mutationFn: (reason: string) => workflowApi.reject(approval.data!.id, reason),
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
  const [activeView, setActiveView] = useState<'cards' | 'preview'>('cards');
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);

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
    setValue,
    formState: { errors },
  } = useForm<GenValues>({
    resolver: zodResolver(GenSchema),
    defaultValues: {
      title: `${engagement.title} — Audit Report`,
      templateId: '',
      executiveSummary: '',
      scope: '',
      methodology: '',
    },
  });

  useEffect(() => {
    const list = reportTemplates.data;
    if (!list || list.length === 0) return;
    const def = list.find((t) => t.isDefault) ?? list[0];
    setValue('templateId', def.id);
  }, [reportTemplates.data, setValue]);

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
          <form onSubmit={handleSubmit((v) => generate.mutate(v), toastOnInvalid)} className="space-y-4" noValidate>
            <FormField
              label={
                <span className="inline-flex items-center gap-1">
                  Report template
                  <InfoHint content="Controls the report's branding, classification, and section layout for the on-screen preview and the exported PDF/DOCX." />
                </span>
              }
            >
              <Select {...register('templateId')}>
                {(reportTemplates.data ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.isDefault ? ' (default)' : ''}
                  </option>
                ))}
              </Select>
            </FormField>
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

  const appliedTemplate =
    (reportTemplates.data ?? []).find((t) => t.id === r.templateId) ??
    (reportTemplates.data ?? []).find((t) => t.isDefault) ??
    null;

  const readStr = (cfg: unknown, key: string, fallback: string): string => {
    if (cfg && typeof cfg === 'object' && !Array.isArray(cfg)) {
      const v = (cfg as Record<string, unknown>)[key];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return fallback;
  };
  const normalizeHex = (value: string, fallback: string): string => {
    const v = value.replace(/^#/, '').trim();
    return /^[0-9a-fA-F]{6}$/.test(v) ? `#${v}` : fallback;
  };

  const tplHeader = appliedTemplate?.headerConfig ?? null;
  const tplFooter = appliedTemplate?.footerConfig ?? null;
  const previewOrgName = readStr(tplHeader, 'orgName', 'Galaxy Backbone Limited');
  const previewOrgAddress = readStr(tplHeader, 'address', 'Corporate Headquarters, Abuja');
  const previewClassification = readStr(tplHeader, 'classification', 'Confidential');
  const previewPrimary = normalizeHex(readStr(tplHeader, 'primaryColor', '#003087'), '#003087');
  const previewFooter = readStr(tplFooter, 'confidentialityNotice', '');

  const sectionTitle = (index: number, fallback: string): string => {
    const s = appliedTemplate?.sections?.[index];
    return s ? `${index + 1}. ${s.title}` : fallback;
  };

  const currentStep = approval.data?.steps?.find((step) => step.level === approval.data?.currentLevel);
  const canActOnCurrentApproval =
    approval.data?.status === 'pending' &&
    currentStep?.approverId === session.id;

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-text-primary">{r.title}</h3>
              <StatusBadge status={r.status} explain="report" />
              <Badge tone="gray">v{r.version}</Badge>
            </div>
            <p className="mt-1 text-xs text-text-secondary">
              {r.issuedAt ? `Issued ${formatRelative(r.issuedAt)} by ${r.issuedByName ?? '—'}` : 'Not yet issued'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-md border border-border bg-slate-100/80 p-0.5 mr-2">
              <button
                type="button"
                onClick={() => setActiveView('cards')}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-all ${
                  activeView === 'cards'
                    ? 'bg-white text-text-primary shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Cards
              </button>
              <button
                type="button"
                onClick={() => setActiveView('preview')}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-all ${
                  activeView === 'preview'
                    ? 'bg-white text-text-primary shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                Preview
              </button>
            </div>

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
            {r.status === 'submitted' && canActOnCurrentApproval && (
              <>
                {canApproveApproval && (
                <Button variant="success" size="sm" leftIcon={<Check className="h-4 w-4" />} onClick={() => setApproveOpen((v) => !v)}>
                  Approve &amp; Sign
                </Button>
                )}
                {canRejectApproval && (
                  <Button variant="danger" size="sm" leftIcon={<X className="h-4 w-4" />} onClick={() => setIsRejectModalOpen(true)}>
                    Reject
                  </Button>
                )}
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

        {approveOpen && approval.data && canActOnCurrentApproval && (
          <ApproveSignPanel
            approvalId={approval.data.id}
            entityType="audit_report"
            reportFields={{
              executiveSummary: r.executiveSummary ?? '',
              scope: r.scope ?? '',
              methodology: r.methodology ?? '',
            }}
            onDone={() => {
              setApproveOpen(false);
              refresh();
            }}
          />
        )}
      </Card>

      {approval.data && approval.data.status === 'approved' && (
        <SignedApprovalDocuments approvalId={approval.data.id} />
      )}

      {activeView === 'cards' ? (
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
      ) : (
        <div className="w-full max-w-[816px] mx-auto bg-white border border-border shadow-[0_4px_24px_rgba(0,0,0,0.06)] rounded-lg p-10 md:p-14 text-slate-800 space-y-6 select-none font-sans transition-all duration-300">
          {/* A4 simulated print header */}
          <div className="text-center pb-5 border-b-2 border-slate-200 space-y-2">
            <div className="text-xs font-semibold tracking-wider text-slate-500 uppercase">{previewOrgName}</div>
            <h1 className="text-xl font-bold tracking-tight text-text-primary uppercase" style={{ color: previewPrimary }}>{r.title}</h1>
            <div className="text-[10px] text-text-secondary">{previewOrgAddress}</div>
          </div>

          {/* Metadata Block */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 border border-slate-100 rounded-md p-4 text-xs">
            <div className="space-y-2">
              <div className="flex justify-between border-b border-slate-200 pb-1.5">
                <span className="font-medium text-slate-500">Report Reference:</span>
                <span className="text-text-primary font-semibold">{engagement.referenceNumber}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-1.5">
                <span className="font-medium text-slate-500">Audit Type:</span>
                <span className="text-text-primary uppercase font-semibold">{engagement.auditType} Audit</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-1.5 md:border-none md:pb-0">
                <span className="font-medium text-slate-500">Audited Entity:</span>
                <span className="text-text-primary font-semibold">{engagement.universeName || '—'}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between border-b border-slate-200 pb-1.5">
                <span className="font-medium text-slate-500">Audit Period:</span>
                <span className="text-text-primary font-semibold">
                  {engagement.plannedStartDate ? new Date(engagement.plannedStartDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—'} to {engagement.plannedEndDate ? new Date(engagement.plannedEndDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-1.5">
                <span className="font-medium text-slate-500">Report Date:</span>
                <span className="text-text-primary font-semibold">{r.issuedAt ? new Date(r.issuedAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : 'Draft'}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-slate-500">Classification:</span>
                <span className="text-text-primary font-bold tracking-wider uppercase text-danger">{previewClassification}</span>
              </div>
            </div>
          </div>

          {/* Section 1: Executive Summary */}
          <div className="space-y-2">
            <h2 className="text-sm font-bold text-text-primary border-b border-slate-100 pb-1">{sectionTitle(0, '1. Executive Summary')}</h2>
            <p className="text-xs leading-relaxed text-slate-700 whitespace-pre-wrap pl-1">
              {r.executiveSummary || 'No executive summary provided.'}
            </p>
          </div>

          {/* Section 2: Scope */}
          <div className="space-y-2">
            <h2 className="text-sm font-bold text-text-primary border-b border-slate-100 pb-1">{sectionTitle(1, '2. Audit Scope')}</h2>
            <p className="text-xs leading-relaxed text-slate-700 whitespace-pre-wrap pl-1">
              {r.scope || 'No scope details specified.'}
            </p>
          </div>

          {/* Section 3: Methodology */}
          <div className="space-y-2">
            <h2 className="text-sm font-bold text-text-primary border-b border-slate-100 pb-1">{sectionTitle(2, '3. Methodology')}</h2>
            <p className="text-xs leading-relaxed text-slate-700 whitespace-pre-wrap pl-1">
              {r.methodology || 'No methodology notes entered.'}
            </p>
          </div>

          {/* Section 4: Findings Summary */}
          <div className="space-y-2">
            <h2 className="text-sm font-bold text-text-primary border-b border-slate-100 pb-1">{sectionTitle(3, '4. Findings Summary Table')}</h2>
            {(engagement.findings ?? []).length === 0 ? (
              <p className="text-xs text-slate-500 italic pl-1">No findings were identified during the course of this engagement.</p>
            ) : (
              <div className="overflow-hidden border border-slate-200 rounded-md">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-50 text-text-secondary border-b border-slate-200">
                    <tr>
                      <th scope="col" className="px-4 py-2 text-left font-semibold">Ref</th>
                      <th scope="col" className="px-4 py-2 text-left font-semibold">Finding Title</th>
                      <th scope="col" className="px-4 py-2 text-center font-semibold">Severity</th>
                      <th scope="col" className="px-4 py-2 text-center font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {(engagement.findings ?? []).map((f, idx) => (
                      <tr key={f.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2 font-medium text-slate-500">{idx + 1}</td>
                        <td className="px-4 py-2 text-slate-900 font-medium">{f.title}</td>
                        <td className="px-4 py-2 text-center">
                          <StatusBadge status={f.severity} size="xs" />
                        </td>
                        <td className="px-4 py-2 text-center capitalize text-slate-500">{f.status?.replace('_', ' ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 5: Signature Blocks */}
          <div className="pt-6 border-t border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-700">
              <div className="space-y-1 bg-slate-50/50 border border-slate-100 rounded-md p-3">
                <div className="font-bold text-slate-500">Prepared by:</div>
                <div className="font-medium text-slate-900">{engagement.leadAuditorName || 'Lead Auditor'}</div>
                <div className="text-[10px] text-slate-400">Date: {engagement.actualStartDate ? formatDate(engagement.actualStartDate) : '—'}</div>
              </div>
              <div className="space-y-1 bg-slate-50/50 border border-slate-100 rounded-md p-3">
                <div className="font-bold text-slate-500">Reviewed by:</div>
                <div className="font-medium text-slate-900">{engagement.auditManagerName ?? '—'}</div>
              </div>
              <div className="space-y-1 bg-slate-50/50 border border-slate-100 rounded-md p-3">
                <div className="font-bold text-slate-500">Approved by:</div>
                <div className="font-medium text-slate-900">
                  {(() => {
                    if (approval.data?.steps) {
                      const approvedSteps = approval.data.steps.filter((s) => s.status === 'approved');
                      const highest = approvedSteps.length > 0
                        ? approvedSteps.reduce((max, s) => (s.level > max.level ? s : max))
                        : undefined;
                      return highest?.approver?.displayName || '—';
                    }
                    return '—';
                  })()}
                </div>
              </div>
            </div>
          </div>

          {previewFooter && (
            <div className="pt-4 mt-6 border-t border-slate-200 text-center text-[11px] text-slate-400">
              {previewFooter}
            </div>
          )}
        </div>
      )}

      <Card>
        <CardHeader title="Approval chain" />
        <ApprovalChain entityType="audit_report" entityId={r.id} />
      </Card>

      <ReasonDialog
        open={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        onConfirm={async (reason) => {
          await rejectMut.mutateAsync(reason);
          setIsRejectModalOpen(false);
        }}
        title="Reject audit report"
        description="Provide a detailed reason for rejecting this report. This feedback is visible in the approval chain logs."
        placeholder="Enter reason for rejection…"
        confirmLabel="Confirm rejection"
        tone="danger"
        isLoading={rejectMut.isPending}
      />
    </div>
  );
};
