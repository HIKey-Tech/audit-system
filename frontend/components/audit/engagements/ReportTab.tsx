'use client';

import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FileText, Send, Check, X, Download, Sparkles, ChevronDown, Loader2, Eye, LayoutGrid, Clock } from 'lucide-react';
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
import { reportsApi, findingsApi } from '@/lib/api/audit';
import { assetsApi } from '@/lib/api/assets';
import { workflowApi } from '@/lib/api/workflow';
import { ApproveSignPanel } from '@/components/workflow/ApproveSignPanel';
import { SignedApprovalDocuments } from '@/components/workflow/SignedApprovalDocuments';
import { DocumentSignerModal } from '@/components/workflow/DocumentSignerModal';
import { ApprovalChain } from '@/components/audit/engagements/ApprovalChain';
import { formatRelative, formatDate } from '@/lib/utils/format';
import { auditTypeLabel } from '@/lib/audit-domains';
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

  // The review preview auto-assembles findings + assets in scope. The engagement
  // detail only carries finding aggregates and no asset list, so fetch both here
  // (live, viewer-scoped) — the same data the exported PDF/DOCX pulls.
  const findings = useQuery({
    queryKey: ['engagements', engagement.id, 'findings'],
    queryFn: () => findingsApi.listByEngagement(engagement.id),
  });
  const assets = useQuery({
    queryKey: ['engagements', engagement.id, 'assets'],
    queryFn: () => assetsApi.listForEngagement(engagement.id),
  });
  const reportFindings = findings.data ?? [];
  const scopeAssets = assets.data ?? [];

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['engagements', engagement.id] });
    qc.invalidateQueries({ queryKey: ['engagements', engagement.id, 'report'] });
    qc.invalidateQueries({ queryKey: ['workflow'] });
    qc.invalidateQueries({ queryKey: ['approval-chain'] });
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
      toast.success('Review generated');
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
    onSuccess: () => { toast.success('Review issued'); refresh(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const [exportingFormat, setExportingFormat] = useState<'pdf' | 'docx' | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [activeView, setActiveView] = useState<'cards' | 'preview'>('cards');
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [pdfPreview, setPdfPreview] = useState<{ url: string; name: string } | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);

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

  const handleViewPdf = async () => {
    if (!report.data) return;
    setLoadingPdf(true);
    try {
      const { blob, fileName } = await reportsApi.exportFile(
        report.data.id,
        'pdf',
        engagement.referenceNumber,
      );
      const url = URL.createObjectURL(blob);
      setPdfPreview({ url, name: fileName });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to generate PDF preview');
    } finally {
      setLoadingPdf(false);
    }
  };

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
      title: `${engagement.title} — Audit Review`,
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

  // Must stay above the early returns below: a hook declared after them changes
  // the hook count once the report loads and crashes the tab (Rules of Hooks).
  const reportId = report.data?.id;
  const approvalChain = useQuery({
    queryKey: ['approval-chain', 'audit_report', reportId],
    queryFn: () => workflowApi.getApprovalChain('audit_report', reportId as string),
    enabled: Boolean(reportId),
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
        <CardHeader title="Audit review" subtitle="Generate the formal audit review once fieldwork is complete." />
        {!canGenerateReport ? (
          <EmptyState
            icon={<FileText className="h-4 w-4" />}
            title="No review yet"
            description="A review can be generated by the lead auditor or audit administrator."
          />
        ) : (
          <form onSubmit={handleSubmit((v) => generate.mutate(v), toastOnInvalid)} className="space-y-4" noValidate>
            <FormField
              label={
                <span className="inline-flex items-center gap-1">
                  Review template
                  <InfoHint content="Controls the review's branding, classification, and section layout for the on-screen preview and the exported PDF/DOCX." />
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
              Generate review
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

  const finalApproverName = (() => {
    if (approval.data?.steps && approval.data.steps.length > 0) {
      const highestStep = [...approval.data.steps].sort((a, b) => b.level - a.level)[0];
      if (highestStep?.approver?.displayName) return highestStep.approver.displayName;
    }
    if (approvalChain.data?.levels && approvalChain.data.levels.length > 0) {
      const highestLevel = [...approvalChain.data.levels].sort((a, b) => b.level - a.level)[0];
      if (highestLevel.resolvedApprover?.displayName) return highestLevel.resolvedApprover.displayName;
      if (highestLevel.candidates.length > 0) return highestLevel.candidates[0].displayName;
    }
    return 'Managing Director / CEO';
  })();

  const approvalRows = (() => {
    if (approval.data?.steps && approval.data.steps.length > 0) {
      return [...approval.data.steps]
        .sort((a, b) => a.level - b.level)
        .map((step) => {
          const chainLvl = approvalChain.data?.levels?.find((l) => l.level === step.level);
          const name =
            step.approver?.displayName ||
            chainLvl?.resolvedApprover?.displayName ||
            chainLvl?.candidates?.[0]?.displayName ||
            `Approver (Level ${step.level})`;
          const position =
            step.approver?.jobTitle ||
            chainLvl?.resolvedApprover?.jobTitle ||
            (step.level === 1 ? 'Head of Unit / Manager' : step.level === 2 ? 'Executive Director' : 'Managing Director / CEO');
          const isPendingCurrent = approval.data?.status === 'pending' && step.level === approval.data.currentLevel;
          return {
            level: step.level,
            id: step.id,
            name,
            position,
            status: step.status,
            signatureId: step.signatureId,
            actedAt: step.actedAt,
            isPendingCurrent,
          };
        });
    }

    if (approvalChain.data?.levels && approvalChain.data.levels.length > 0) {
      return [...approvalChain.data.levels]
        .sort((a, b) => a.level - b.level)
        .map((lvl) => {
          const name =
            lvl.resolvedApprover?.displayName ||
            lvl.candidates[0]?.displayName ||
            (lvl.candidates.length > 1 ? lvl.candidates.map((c) => c.displayName).join(', ') : 'Eligible Approver');
          const position =
            lvl.resolvedApprover?.jobTitle ||
            (lvl.level === 1 ? 'Head of Unit / Manager' : lvl.level === 2 ? 'Executive Director' : 'Managing Director / CEO');
          return {
            level: lvl.level,
            id: `chain-${lvl.level}`,
            name,
            position,
            status: lvl.status,
            signatureId: null,
            actedAt: null,
            isPendingCurrent: false,
          };
        });
    }

    return [
      {
        level: 1,
        id: 'fallback-1',
        name: engagement.auditManagerName || 'Head of Unit (HOU)',
        position: 'Head of Unit / Audit Manager',
        status: 'upcoming',
        signatureId: null,
        actedAt: null,
        isPendingCurrent: false,
      },
      {
        level: 2,
        id: 'fallback-2',
        name: 'Head of Department (HOD)',
        position: 'Executive Director / HOD',
        status: 'upcoming',
        signatureId: null,
        actedAt: null,
        isPendingCurrent: false,
      },
      {
        level: 3,
        id: 'fallback-3',
        name: 'Managing Director / CEO',
        position: 'MD / CEO',
        status: 'upcoming',
        signatureId: null,
        actedAt: null,
        isPendingCurrent: false,
      },
    ];
  })();

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

            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Eye className="h-4 w-4" />}
              isLoading={loadingPdf}
              onClick={handleViewPdf}
            >
              View PDF
            </Button>

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
                Issue review
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
            {(reportFindings).length === 0 ? (
              <p className="text-xs text-text-muted">No findings.</p>
            ) : (
              <ul className="space-y-2">
                {(reportFindings).map((f) => (
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
        <div className="w-full max-w-[850px] mx-auto bg-white border border-border shadow-xl rounded-lg p-8 sm:p-12 md:p-16 text-slate-800 space-y-8 select-text font-sans transition-all duration-300">
          {/* Running top bar */}
          <div className="flex items-center justify-between text-[11px] font-semibold tracking-wider text-slate-400 border-b border-slate-200 pb-2 mb-2 uppercase">
            <span>Galaxy Backbone Limited</span>
            <span className="text-danger font-bold">Internal Use Only</span>
          </div>

          {/* Centered GBB Logo & Organization Title */}
          <div className="text-center space-y-3 pt-2">
            <img
              src="/gbb-logo.png"
              alt="Galaxy Backbone Limited"
              className="h-20 sm:h-24 object-contain mx-auto drop-shadow-sm"
            />
            <h2 className="text-base font-bold tracking-wider text-slate-700 uppercase">
              Galaxy Backbone Limited
            </h2>
          </div>

          {/* Formal Title Box (matching GBB Template Table 1) */}
          <div className="border-y-4 border-[#4F6228] bg-slate-50/80 py-8 px-6 text-center space-y-3 rounded-sm my-6 shadow-xs">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight uppercase" style={{ color: previewPrimary }}>
              {r.title}
            </h1>
            <div className="text-sm font-semibold text-slate-600">
              Version {r.version}.0
            </div>
            <div className="pt-2 text-xs font-bold tracking-widest text-slate-500 uppercase">
              DOCUMENT REFERENCE NUMBER:
            </div>
            <div className="text-sm font-mono font-bold text-slate-900 bg-white inline-block px-3 py-1 rounded border border-slate-200 shadow-xs">
              {engagement.referenceNumber}
            </div>
          </div>

          {/* Confidentiality Callout Box */}
          <div className="p-4 border border-slate-300 bg-slate-50/70 rounded text-xs leading-relaxed text-slate-700">
            <p>
              <strong className="font-bold text-slate-900">Confidentiality: </strong>
              No part of this document may be disclosed verbally or in writing, including by reproduction, to any third party without the prior written consent of Galaxy Backbone Limited. This document, its associated appendices and any attachments remain the property of Galaxy Backbone Limited and shall be returned upon request.
            </p>
          </div>

          {/* Table 1: Document Information */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold tracking-wide text-slate-900 uppercase">Document Information</h3>
            <div className="overflow-hidden border border-slate-300 rounded-sm">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <tbody className="divide-y divide-slate-200 bg-white">
                  <tr>
                    <td className="px-4 py-2 font-bold bg-slate-100 text-slate-700 w-2/5 border-r border-slate-200">Document ID:</td>
                    <td className="px-4 py-2 font-mono text-slate-900">{engagement.referenceNumber}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-bold bg-slate-100 text-slate-700 border-r border-slate-200">Document Version:</td>
                    <td className="px-4 py-2 text-slate-900 font-medium">Version {r.version}.0</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-bold bg-slate-100 text-slate-700 border-r border-slate-200">Date of Version:</td>
                    <td className="px-4 py-2 text-slate-900">{r.issuedAt ? formatDate(r.issuedAt) : formatDate(r.updatedAt || new Date())}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-bold bg-slate-100 text-slate-700 border-r border-slate-200">Document Division:</td>
                    <td className="px-4 py-2 text-slate-900">{engagement.universeName || 'Internal Audit & Assurance'}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-bold bg-slate-100 text-slate-700 border-r border-slate-200">Document Owner:</td>
                    <td className="px-4 py-2 text-slate-900">{engagement.leadAuditorName || 'Lead Auditor'}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-bold bg-slate-100 text-slate-700 border-r border-slate-200">Document Author:</td>
                    <td className="px-4 py-2 text-slate-900">{engagement.leadAuditorName || 'Internal Audit Team'}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-bold bg-slate-100 text-slate-700 border-r border-slate-200">Approved by:</td>
                    <td className="px-4 py-2 font-semibold text-slate-900">{finalApproverName}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-bold bg-slate-100 text-slate-700 border-r border-slate-200">Document Classification:</td>
                    <td className="px-4 py-2 font-bold text-danger uppercase tracking-wider">{previewClassification}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-bold bg-slate-100 text-slate-700 border-r border-slate-200">Document Status:</td>
                    <td className="px-4 py-2 font-semibold uppercase text-slate-900">{r.status}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 2: Change History */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold tracking-wide text-slate-900 uppercase">Change history</h3>
            <div className="overflow-hidden border border-slate-300 rounded-sm">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2 text-left border-r border-slate-200">Version</th>
                    <th className="px-4 py-2 text-left border-r border-slate-200">Date</th>
                    <th className="px-4 py-2 text-left border-r border-slate-200">Created by</th>
                    <th className="px-4 py-2 text-left">Change from Previous Version</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  <tr>
                    <td className="px-4 py-2 font-medium border-r border-slate-200">Version 1.0</td>
                    <td className="px-4 py-2 border-r border-slate-200">{engagement.actualStartDate ? formatDate(engagement.actualStartDate) : formatDate(r.createdAt)}</td>
                    <td className="px-4 py-2 border-r border-slate-200">{engagement.leadAuditorName || 'Lead Auditor'}</td>
                    <td className="px-4 py-2">Initial audit review draft formulation</td>
                  </tr>
                  {r.version > 1 && (
                    <tr>
                      <td className="px-4 py-2 font-medium border-r border-slate-200">Version {r.version}.0</td>
                      <td className="px-4 py-2 border-r border-slate-200">{r.issuedAt ? formatDate(r.issuedAt) : formatDate(r.updatedAt)}</td>
                      <td className="px-4 py-2 border-r border-slate-200">{engagement.leadAuditorName || 'Audit Team'}</td>
                      <td className="px-4 py-2">Review revisions and formal approval cycle</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 3: Distribution List */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold tracking-wide text-slate-900 uppercase">Distribution List</h3>
            <div className="overflow-hidden border border-slate-300 rounded-sm">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2 text-left border-r border-slate-200">Name</th>
                    <th className="px-4 py-2 text-left border-r border-slate-200">Version</th>
                    <th className="px-4 py-2 text-left">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  <tr>
                    <td className="px-4 py-2 font-medium border-r border-slate-200">Board Audit Committee &amp; Executive Management</td>
                    <td className="px-4 py-2 border-r border-slate-200">Version {r.version}.0</td>
                    <td className="px-4 py-2">{r.issuedAt ? formatDate(r.issuedAt) : formatDate(r.updatedAt || new Date())}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-medium border-r border-slate-200">Audited Entity ({engagement.universeName || 'Business Unit'})</td>
                    <td className="px-4 py-2 border-r border-slate-200">Version {r.version}.0</td>
                    <td className="px-4 py-2">{r.issuedAt ? formatDate(r.issuedAt) : formatDate(r.updatedAt || new Date())}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 4: Approval List with Interactive Append Signature */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold tracking-wide text-slate-900 uppercase">Approval List</h3>
              {canActOnCurrentApproval && (
                <span className="text-xs text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 font-semibold inline-flex items-center gap-1.5 animate-pulse">
                  <span>✍️</span> Action required: click Append Signature below
                </span>
              )}
            </div>
            <div className="overflow-hidden border border-slate-300 rounded-sm shadow-xs">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2 text-left border-r border-slate-200 w-1/4">Name</th>
                    <th className="px-4 py-2 text-left border-r border-slate-200 w-1/4">Position</th>
                    <th className="px-4 py-2 text-center border-r border-slate-200 w-1/3">Signature</th>
                    <th className="px-4 py-2 text-center">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {approvalRows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-900 border-r border-slate-200">
                        {row.name}
                      </td>
                      <td className="px-4 py-3 text-slate-600 border-r border-slate-200">
                        {row.position}
                      </td>
                      <td className="px-4 py-3 text-center border-r border-slate-200">
                        {row.status === 'approved' ? (
                          <div className="flex flex-col items-center justify-center space-y-1">
                            {row.signatureId ? (
                              <img
                                src={`/api/proxy/documents/${row.signatureId}/file`}
                                alt="Signature"
                                className="h-10 max-h-12 object-contain mx-auto border-b border-slate-300 pb-1"
                              />
                            ) : (
                              <span className="font-serif italic text-base text-slate-800">{row.name}</span>
                            )}
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              <Check className="h-2.5 w-2.5" /> Digitally Signed
                            </span>
                          </div>
                        ) : row.isPendingCurrent && canActOnCurrentApproval ? (
                          <div className="flex flex-col items-center justify-center gap-1.5 py-1">
                            <Button
                              size="sm"
                              variant="success"
                              leftIcon={<Check className="h-3.5 w-3.5" />}
                              onClick={() => {
                                setApproveOpen(true);
                                toast.info('Approve & Sign panel opened below');
                              }}
                              className="shadow-sm font-semibold text-xs"
                            >
                              Append Signature
                            </Button>
                            <span className="text-[10px] text-emerald-700 font-medium">Ready for your sign-off</span>
                          </div>
                        ) : row.isPendingCurrent ? (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded border border-amber-200 font-medium">
                            <Clock className="h-3 w-3" /> Awaiting signature
                          </span>
                        ) : row.status === 'rejected' ? (
                          <span className="inline-flex items-center gap-1 text-xs text-danger bg-red-50 px-2 py-0.5 rounded border border-red-200 font-medium">
                            <X className="h-3 w-3" /> Rejected
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Pending prior level</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-700">
                        {row.actedAt ? formatDate(row.actedAt) : row.status === 'approved' ? formatDate(r.updatedAt) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Change Control Notice */}
          <div className="p-3 border-l-4 border-slate-400 bg-slate-50 text-xs italic text-slate-600 rounded-r">
            <strong className="font-semibold text-slate-800 not-italic">Change Control: </strong>
            The contents of this document are subject to change control. Any proposed amendments should be submitted to the Document Owner for review and approval prior to implementation.
          </div>

          {/* Table of contents */}
          <div className="p-5 border border-slate-200 bg-slate-50/50 rounded-sm space-y-3 text-xs">
            <div className="font-bold text-slate-900 tracking-wider uppercase border-b border-slate-200 pb-1.5">
              Table of Contents
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-slate-700 font-medium">
              <li>{sectionTitle(0, 'Executive Summary')}</li>
              <li>{sectionTitle(1, 'Audit Scope')}</li>
              <li>{sectionTitle(2, 'Methodology')}</li>
              <li>{sectionTitle(3, 'Findings Summary Table')}</li>
              {scopeAssets.length > 0 && <li>Assets in Scope</li>}
              <li>Validity and Document Management</li>
            </ol>
          </div>

          {/* Document Sections with Section Separators */}
          <div className="space-y-6 pt-4 border-t-2 border-slate-200">
            {/* Section 1: Executive Summary */}
            <div className="space-y-2">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-1.5 uppercase tracking-wide">
                {sectionTitle(0, '1. Executive Summary')}
              </h2>
              <p className="text-xs leading-relaxed text-slate-700 whitespace-pre-wrap pl-1">
                {r.executiveSummary || 'No executive summary provided.'}
              </p>
            </div>

            {/* Section 2: Scope */}
            <div className="space-y-2">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-1.5 uppercase tracking-wide">
                {sectionTitle(1, '2. Audit Scope')}
              </h2>
              <p className="text-xs leading-relaxed text-slate-700 whitespace-pre-wrap pl-1">
                {r.scope || 'No scope details specified.'}
              </p>
            </div>

            {/* Section 3: Methodology */}
            <div className="space-y-2">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-1.5 uppercase tracking-wide">
                {sectionTitle(2, '3. Methodology')}
              </h2>
              <p className="text-xs leading-relaxed text-slate-700 whitespace-pre-wrap pl-1">
                {r.methodology || 'No methodology notes entered.'}
              </p>
            </div>

            {/* Section 4: Findings Summary */}
            <div className="space-y-2">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-1.5 uppercase tracking-wide">
                {sectionTitle(3, '4. Findings Summary Table')}
              </h2>
              {reportFindings.length === 0 ? (
                <p className="text-xs text-slate-500 italic pl-1">
                  No findings were identified during the course of this engagement.
                </p>
              ) : (
                <div className="overflow-hidden border border-slate-300 rounded-sm">
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th scope="col" className="px-4 py-2 text-left border-r border-slate-200">Ref</th>
                        <th scope="col" className="px-4 py-2 text-left border-r border-slate-200">Finding Title</th>
                        <th scope="col" className="px-4 py-2 text-center border-r border-slate-200">Severity</th>
                        <th scope="col" className="px-4 py-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {reportFindings.map((f, idx) => (
                        <tr key={f.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-2 font-medium text-slate-500 border-r border-slate-200">{idx + 1}</td>
                          <td className="px-4 py-2 text-slate-900 font-medium border-r border-slate-200">{f.title}</td>
                          <td className="px-4 py-2 text-center border-r border-slate-200">
                            <StatusBadge status={f.severity} size="xs" />
                          </td>
                          <td className="px-4 py-2 text-center capitalize text-slate-600">{f.status?.replace('_', ' ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Section 5: Assets in Scope */}
            {scopeAssets.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-1.5 uppercase tracking-wide">
                  5. Assets in Scope
                </h2>
                <div className="overflow-hidden border border-slate-300 rounded-sm">
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th scope="col" className="px-4 py-2 text-left border-r border-slate-200">Tag</th>
                        <th scope="col" className="px-4 py-2 text-left border-r border-slate-200">Name</th>
                        <th scope="col" className="px-4 py-2 text-left border-r border-slate-200">Type</th>
                        <th scope="col" className="px-4 py-2 text-center">Criticality</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {scopeAssets.map((a) => (
                        <tr key={a.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-2 font-medium text-slate-900 border-r border-slate-200">{a.assetTag}</td>
                          <td className="px-4 py-2 text-slate-700 border-r border-slate-200">{a.name}</td>
                          <td className="px-4 py-2 capitalize text-slate-600 border-r border-slate-200">{a.assetType?.replace(/_/g, ' ')}</td>
                          <td className="px-4 py-2 text-center">
                            <StatusBadge status={a.criticality ?? 'low'} size="xs" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Section 6: Validity and Document Management */}
            <div className="space-y-2 pt-2">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-1.5 uppercase tracking-wide">
                {scopeAssets.length > 0 ? '6. Validity and Document Management' : '5. Validity and Document Management'}
              </h2>
              <p className="text-xs leading-relaxed text-slate-700 pl-1">
                This document was last reviewed on {r.issuedAt ? formatDate(r.issuedAt) : formatDate(r.updatedAt || new Date())}. This document remains valid and binding until superseded by a subsequent version approved through the Galaxy Backbone Limited internal approval matrix.
              </p>
            </div>
          </div>

          {/* Running Footer */}
          <div className="pt-6 mt-8 border-t border-slate-200 flex flex-wrap items-center justify-between text-[11px] text-slate-400">
            <span>{r.title} | Version {r.version}.0</span>
            <span>Galaxy Backbone Limited | {previewClassification}</span>
          </div>
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
        title="Reject audit review"
        description="Provide a detailed reason for rejecting this review. This feedback is visible in the approval chain logs."
        placeholder="Enter reason for rejection…"
        confirmLabel="Confirm rejection"
        tone="danger"
        isLoading={rejectMut.isPending}
      />

      {pdfPreview && (
        <DocumentSignerModal
          open={!!pdfPreview}
          onClose={() => {
            URL.revokeObjectURL(pdfPreview.url);
            setPdfPreview(null);
          }}
          fileUrl={pdfPreview.url}
          documentName={pdfPreview.name}
          isSignable={false}
        />
      )}
    </div>
  );
};
