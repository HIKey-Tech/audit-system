'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Briefcase,
  Calendar,
  CheckCircle2,
  CheckSquare,
  ClipboardList,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  XCircle,
} from 'lucide-react';

import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Input, Select } from '@/components/ui/Input';
import { Table, type Column } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDate, formatDateTime, formatNumber } from '@/lib/utils/format';
import { auditTypeLabel } from '@/lib/audit-domains';
import {
  periodicReportsApi,
  type PeriodType,
  type PeriodicReportApproval,
  type PeriodicReportEngagement,
  type PeriodicReportFinding,
  type PeriodicReportItem,
  type PeriodicReportProgramme,
  type PeriodicReportQuery,
} from '@/lib/api/periodic-reports';

type SectionTab =
  | 'all'
  | 'programmes'
  | 'engagements'
  | 'reports'
  | 'approvals'
  | 'findings';

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const QUARTERS = [
  { value: 1, label: 'Q1 (Jan – Mar)' },
  { value: 2, label: 'Q2 (Apr – Jun)' },
  { value: 3, label: 'Q3 (Jul – Sep)' },
  { value: 4, label: 'Q4 (Oct – Dec)' },
];

const AUDIT_TYPE_OPTIONS = [
  { value: 'all', label: 'All Audit Types' },
  { value: 'it', label: 'System/IT Audit' },
  { value: 'systems', label: 'Systems Audit' },
  { value: 'financial', label: 'Financial Audit' },
  { value: 'compliance', label: 'Compliance Audit' },
  { value: 'operational', label: 'Operational Audit' },
  { value: 'pension', label: 'Pension Audit' },
  { value: 'procurement', label: 'Procurement Audit' },
  { value: 'hr_payroll', label: 'HR & Payroll Audit' },
  { value: 'project', label: 'Project Audit' },
  { value: 'special', label: 'Special Audit' },
];

const CANONICAL_AUDIT_TYPES = [
  'it',
  'systems',
  'financial',
  'compliance',
  'operational',
  'pension',
  'procurement',
  'hr_payroll',
  'project',
  'special',
] as const;

const ENTITY_TYPE_LABELS: Record<string, string> = {
  audit_plan: 'Audit Programme',
  audit_working_paper: 'Working Paper',
  audit_report: 'Audit Review',
  audit_finding_closure: 'Finding Closure',
  audit_finding: 'Audit Finding',
  audit_engagement: 'Audit Engagement',
};

const formatEntityType = (t: string): string =>
  ENTITY_TYPE_LABELS[t] ??
  t.replace(/^audit_/, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function PeriodicReportsPage(): JSX.Element {
  const router = useRouter();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentQuarter = Math.floor(now.getMonth() / 3) + 1;

  const [periodType, setPeriodType] = useState<PeriodType>('quarterly');
  const [year, setYear] = useState<number>(currentYear);
  const [month, setMonth] = useState<number>(currentMonth);
  const [quarter, setQuarter] = useState<number>(currentQuarter);
  const [startDate, setStartDate] = useState<string>(`${currentYear}-01-01`);
  const [endDate, setEndDate] = useState<string>(now.toISOString().slice(0, 10));
  const [auditType, setAuditType] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<SectionTab>('all');
  const [approvalStatusFilter, setApprovalStatusFilter] = useState<string>('all');

  const yearsList = useMemo(() => {
    const list: number[] = [];
    for (let y = currentYear + 1; y >= currentYear - 5; y -= 1) {
      list.push(y);
    }
    return list;
  }, [currentYear]);

  const queryParams = useMemo<PeriodicReportQuery>(() => {
    const base: PeriodicReportQuery = {
      periodType,
      year,
      auditType: auditType !== 'all' ? auditType : undefined,
    };
    if (periodType === 'monthly') base.month = month;
    if (periodType === 'quarterly') base.quarter = quarter;
    if (periodType === 'custom') {
      base.startDate = startDate;
      base.endDate = endDate;
    }
    return base;
  }, [periodType, year, month, quarter, startDate, endDate, auditType]);

  const reportQuery = useQuery({
    queryKey: ['audit', 'periodic-reports', queryParams],
    queryFn: () => periodicReportsApi.get(queryParams),
  });

  const exportDocxMut = useMutation({
    mutationFn: () => periodicReportsApi.exportFile(queryParams, 'docx'),
    onSuccess: ({ blob, fileName }) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported Word report: ${fileName}`);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Word export failed');
    },
  });

  const exportPdfMut = useMutation({
    mutationFn: () => periodicReportsApi.exportFile(queryParams, 'pdf'),
    onSuccess: ({ blob, fileName }) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported PDF report: ${fileName}`);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'PDF export failed');
    },
  });

  const data = reportQuery.data;

  const filteredApprovals = useMemo(() => {
    if (!data) return [];
    if (approvalStatusFilter === 'all') return data.approvals;
    if (approvalStatusFilter === 'escalated') {
      return data.approvals.filter((a) => a.status === 'escalated' || Boolean(a.isEscalated));
    }
    return data.approvals.filter((a) => a.status === approvalStatusFilter);
  }, [data, approvalStatusFilter]);

  const programmeColumns: Column<PeriodicReportProgramme>[] = [
    {
      key: 'title',
      header: 'Programme Title',
      render: (p) => (
        <Link
          href={`/audit/plans/${p.id}`}
          onClick={(e) => e.stopPropagation()}
          className="font-medium text-primary hover:underline"
        >
          {p.title}
        </Link>
      ),
    },
    {
      key: 'year',
      header: 'Year',
      width: '80px',
      render: (p) => <span className="font-mono text-xs text-text-secondary">FY {p.year}</span>,
    },
    {
      key: 'auditType',
      header: 'Audit Type',
      width: '150px',
      render: (p) => <Badge tone="blue">{auditTypeLabel(p.auditType)}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      width: '130px',
      render: (p) => <StatusBadge status={p.status} />,
    },
    {
      key: 'items',
      header: 'Planned Entities',
      width: '130px',
      render: (p) => (
        <span className="text-xs text-text-secondary">
          <strong className="text-text-primary">{p.engagementsCreatedCount}</strong> / {p.itemsCount} launched
        </span>
      ),
    },
    {
      key: 'approval',
      header: 'Approval / Rejection Details',
      render: (p) =>
        p.status === 'rejected' && p.rejectionReason ? (
          <span className="text-xs text-danger">Rejected: {p.rejectionReason}</span>
        ) : p.approvedByName ? (
          <span className="text-xs text-text-secondary">
            Approved by <strong className="text-text-primary">{p.approvedByName}</strong>
            {p.approvedAt ? ` (${formatDate(p.approvedAt)})` : ''}
          </span>
        ) : (
          <span className="text-xs text-text-muted">—</span>
        ),
    },
  ];

  const engagementColumns: Column<PeriodicReportEngagement>[] = [
    {
      key: 'ref',
      header: 'Reference',
      width: '130px',
      render: (e) => (
        <Link
          href={`/audit/engagements/${e.id}`}
          onClick={(ev) => ev.stopPropagation()}
          className="font-mono text-xs font-semibold text-primary hover:underline"
        >
          {e.referenceNumber}
        </Link>
      ),
    },
    {
      key: 'title',
      header: 'Engagement & Entity',
      render: (e) => (
        <div>
          <Link
            href={`/audit/engagements/${e.id}`}
            onClick={(ev) => ev.stopPropagation()}
            className="font-medium text-text-primary hover:text-primary hover:underline"
          >
            {e.title}
          </Link>
          <p className="text-xs text-text-muted">{e.universeName}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      width: '130px',
      render: (e) => <Badge tone="blue">{auditTypeLabel(e.auditType, 'short')}</Badge>,
    },
    {
      key: 'status',
      header: 'Stage',
      width: '140px',
      render: (e) => <StatusBadge status={e.status} />,
    },
    {
      key: 'team',
      header: 'Lead / Manager / Auditee',
      render: (e) => (
        <div className="text-xs leading-relaxed text-text-secondary">
          <div>
            <span className="text-text-muted">Lead:</span>{' '}
            <span className="font-medium text-text-primary">{e.leadAuditorName}</span>
          </div>
          <div>
            <span className="text-text-muted">Mgr:</span> {e.auditManagerName} ·{' '}
            <span className="text-text-muted">Auditee:</span> {e.auditeeName}
          </div>
        </div>
      ),
    },
    {
      key: 'progress',
      header: 'Fieldwork',
      width: '120px',
      render: (e) => (
        <div className="text-xs">
          <div className="font-medium text-text-primary">{e.checklistCompletionPct}% controls</div>
          <div className="text-text-muted">{e.findingsCount} findings</div>
        </div>
      ),
    },
    {
      key: 'ola',
      header: 'OLA Deadline',
      width: '140px',
      render: (e) => (
        <div className="space-y-0.5">
          <div className="text-xs text-text-secondary">{formatDate(e.olaDeadline)}</div>
          {e.isOverdue && <Badge status="overdue">Overdue OLA</Badge>}
        </div>
      ),
    },
  ];

  const reportColumns: Column<PeriodicReportItem>[] = [
    {
      key: 'title',
      header: 'Review Title',
      render: (r) => (
        <div>
          <Link
            href={`/audit/engagements/${r.engagementId}`}
            onClick={(e) => e.stopPropagation()}
            className="font-medium text-text-primary hover:text-primary hover:underline"
          >
            {r.title}
          </Link>
          <p className="text-xs text-text-muted">{r.engagementTitle}</p>
        </div>
      ),
    },
    {
      key: 'engagement',
      header: 'Engagement',
      width: '130px',
      render: (r) => (
        <Link
          href={`/audit/engagements/${r.engagementId}`}
          onClick={(e) => e.stopPropagation()}
          className="font-mono text-xs text-primary hover:underline"
        >
          {r.engagementReference}
        </Link>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      width: '130px',
      render: (r) => <Badge tone="blue">{auditTypeLabel(r.auditType, 'short')}</Badge>,
    },
    {
      key: 'version',
      header: 'Version',
      width: '85px',
      render: (r) => <Badge tone="gray">v{r.versionNumber}.0</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      width: '130px',
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'author',
      header: 'Author',
      width: '150px',
      render: (r) => <span className="text-xs text-text-secondary">{r.createdByName}</span>,
    },
    {
      key: 'issued',
      header: 'Issued / Notes',
      render: (r) =>
        r.rejectionReason ? (
          <span className="text-xs text-danger">Rejected: {r.rejectionReason}</span>
        ) : r.issuedAt ? (
          <span className="text-xs text-text-secondary">Issued {formatDate(r.issuedAt)}</span>
        ) : (
          <span className="text-xs text-text-muted">In workflow</span>
        ),
    },
  ];

  const approvalColumns: Column<PeriodicReportApproval>[] = [
    {
      key: 'type',
      header: 'Record Type',
      width: '140px',
      render: (a) => <Badge tone="purple">{formatEntityType(a.entityType)}</Badge>,
    },
    {
      key: 'subject',
      header: 'Subject / Reference',
      render: (a) => (
        <Link
          href="/workflow/approvals"
          onClick={(e) => e.stopPropagation()}
          className="font-medium text-text-primary hover:text-primary hover:underline"
        >
          {a.entityReference}
        </Link>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '150px',
      render: (a) => (
        <div className="flex flex-wrap items-center gap-1">
          <StatusBadge status={a.status} />
          {a.isEscalated && a.status !== 'escalated' && (
            <Badge tone="purple">Escalated</Badge>
          )}
        </div>
      ),
    },
    {
      key: 'level',
      header: 'Stage',
      width: '110px',
      render: (a) => (
        <span className="font-mono text-xs text-text-secondary">
          Level {a.currentLevel}/{a.totalLevels}
        </span>
      ),
    },
    {
      key: 'submittedBy',
      header: 'Submitted By',
      width: '150px',
      render: (a) => <span className="text-xs text-text-secondary">{a.submittedByName}</span>,
    },
    {
      key: 'reviewer',
      header: 'Last Reviewer & Comment',
      render: (a) => (
        <div className="text-xs">
          <div className="font-medium text-text-primary">{a.lastActedByName ?? 'Awaiting reviewer'}</div>
          {a.lastComment && <div className="mt-0.5 text-text-secondary line-clamp-2">{a.lastComment}</div>}
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Completed / Submitted',
      width: '140px',
      render: (a) => (
        <span className="text-xs text-text-secondary">
          {formatDate(a.completedAt ?? a.createdAt)}
        </span>
      ),
    },
  ];

  const findingColumns: Column<PeriodicReportFinding>[] = [
    {
      key: 'title',
      header: 'Finding Title',
      render: (f) => (
        <div>
          <Link
            href={`/audit/findings/${f.id}`}
            onClick={(e) => e.stopPropagation()}
            className="font-medium text-text-primary hover:text-primary hover:underline"
          >
            {f.title}
          </Link>
          <p className="text-xs text-text-muted">{f.engagementTitle}</p>
        </div>
      ),
    },
    {
      key: 'engagement',
      header: 'Engagement',
      width: '130px',
      render: (f) => (
        <Link
          href={`/audit/engagements/${f.engagementId}`}
          onClick={(e) => e.stopPropagation()}
          className="font-mono text-xs text-primary hover:underline"
        >
          {f.engagementReference}
        </Link>
      ),
    },
    {
      key: 'severity',
      header: 'Severity',
      width: '110px',
      render: (f) => <StatusBadge status={f.severity} />,
    },
    {
      key: 'status',
      header: 'Status',
      width: '150px',
      render: (f) => <StatusBadge status={f.status} />,
    },
    {
      key: 'auditee',
      header: 'Auditee Owner',
      width: '150px',
      render: (f) => <span className="text-xs text-text-secondary">{f.auditeeName}</span>,
    },
    {
      key: 'response',
      header: 'Mgmt Response',
      width: '130px',
      render: (f) =>
        f.hasManagementResponse ? (
          <Badge tone="green">Received</Badge>
        ) : (
          <Badge tone="amber">Awaiting</Badge>
        ),
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      width: '120px',
      render: (f) => <span className="text-xs text-text-secondary">{formatDate(f.dueDate)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Periodic Audit Activity Reports"
        subtitle="Generate Monthly, Quarterly, Annual, or Custom period audit activity reports across programmes, engagements, reviews, approvals, and findings — and export to Word (.docx) or PDF."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => exportDocxMut.mutate()}
              disabled={exportDocxMut.isPending || reportQuery.isLoading}
            >
              <FileSpreadsheet className="mr-1.5 h-4 w-4 text-primary" />
              {exportDocxMut.isPending ? 'Generating Word…' : 'Export Word (.docx)'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => exportPdfMut.mutate()}
              disabled={exportPdfMut.isPending || reportQuery.isLoading}
            >
              <Download className="mr-1.5 h-4 w-4" />
              {exportPdfMut.isPending ? 'Generating PDF…' : 'Export PDF (.pdf)'}
            </Button>
          </div>
        }
      />

      {/* Period Filter Bar */}
      <Card className="border-border bg-surface-elevated p-4 shadow-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              Reporting Period Type
            </label>
            <div className="inline-flex flex-wrap rounded-lg border border-border bg-surface p-1">
              {(
                [
                  { key: 'monthly', label: 'Monthly' },
                  { key: 'quarterly', label: 'Quarterly' },
                  { key: 'yearly', label: 'Yearly' },
                  { key: 'custom', label: 'Custom Range' },
                ] as const
              ).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setPeriodType(item.key)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    periodType === item.key
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            {periodType !== 'custom' && (
              <div className="w-32">
                <label className="mb-1 block text-xs font-medium text-text-secondary">Year</label>
                <Select
                  value={String(year)}
                  onChange={(e) => setYear(Number(e.target.value))}
                >
                  {yearsList.map((y) => (
                    <option key={y} value={String(y)}>
                      {y}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {periodType === 'monthly' && (
              <div className="w-40">
                <label className="mb-1 block text-xs font-medium text-text-secondary">Month</label>
                <Select
                  value={String(month)}
                  onChange={(e) => setMonth(Number(e.target.value))}
                >
                  {MONTHS.map((m) => (
                    <option key={m.value} value={String(m.value)}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {periodType === 'quarterly' && (
              <div className="w-44">
                <label className="mb-1 block text-xs font-medium text-text-secondary">Quarter</label>
                <Select
                  value={String(quarter)}
                  onChange={(e) => setQuarter(Number(e.target.value))}
                >
                  {QUARTERS.map((q) => (
                    <option key={q.value} value={String(q.value)}>
                      {q.label}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {periodType === 'custom' && (
              <>
                <div className="w-40">
                  <label className="mb-1 block text-xs font-medium text-text-secondary">Start Date</label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="w-40">
                  <label className="mb-1 block text-xs font-medium text-text-secondary">End Date</label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="w-48">
              <label className="mb-1 flex items-center gap-1 text-xs font-medium text-text-secondary">
                <Filter className="h-3 w-3" />
                Audit Domain
              </label>
              <Select value={auditType} onChange={(e) => setAuditType(e.target.value)}>
                {AUDIT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        {data && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-text-secondary">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="blue">{data.periodLabel}</Badge>
              {data.auditTypeFilter && (
                <Badge tone="purple">Domain: {auditTypeLabel(data.auditTypeFilter)}</Badge>
              )}
            </div>
            <div>
              Prepared for <strong className="text-text-primary">{data.generatedBy}</strong> · Snapshot{' '}
              {formatDateTime(data.generatedAt)}
            </div>
          </div>
        )}
      </Card>

      {reportQuery.isLoading && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-96 rounded-xl" />
        </div>
      )}

      {reportQuery.isError && (
        <ErrorState error={reportQuery.error} onRetry={() => reportQuery.refetch()} />
      )}

      {data && (
        <>
          {/* Executive Summary KPI Grid */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {/* Programmes KPI */}
            <Card className="border-border bg-surface-elevated p-4 shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Audit Programmes
                </span>
                <ClipboardList className="h-4 w-4 text-primary" />
              </div>
              <div className="mt-2 text-2xl font-bold text-text-primary">
                {formatNumber(data.summary.totalProgrammes)}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                <Badge tone="green">{data.summary.approvedProgrammes} Approved</Badge>
                <Badge tone="amber">{data.summary.pendingProgrammes} Pending</Badge>
                {data.summary.rejectedProgrammes > 0 && (
                  <Badge tone="red">{data.summary.rejectedProgrammes} Rejected</Badge>
                )}
              </div>
            </Card>

            {/* Engagements KPI */}
            <Card className="border-border bg-surface-elevated p-4 shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Audit Engagements
                </span>
                <Briefcase className="h-4 w-4 text-blue-600" />
              </div>
              <div className="mt-2 text-2xl font-bold text-text-primary">
                {formatNumber(data.summary.totalEngagements)}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                <Badge tone="blue">{data.summary.engagementsStartedInPeriod} Started</Badge>
                <Badge tone="green">{data.summary.engagementsClosedInPeriod} Closed</Badge>
                {data.summary.engagementsOverdue > 0 && (
                  <Badge tone="red">{data.summary.engagementsOverdue} Overdue</Badge>
                )}
              </div>
            </Card>

            {/* Audit Reports KPI */}
            <Card className="border-border bg-surface-elevated p-4 shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Audit Reviews
                </span>
                <FileText className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="mt-2 text-2xl font-bold text-text-primary">
                {formatNumber(data.reports.length)}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                <Badge tone="gray">{data.summary.reportsDraft} Draft</Badge>
                <Badge tone="amber">{data.summary.reportsSubmitted} In Review</Badge>
                <Badge tone="green">{data.summary.reportsApproved} Approved</Badge>
                <Badge tone="blue">
                  {data.summary.reportsPublished ?? data.summary.reportsIssuedInPeriod} Published / Issued
                </Badge>
                <Badge tone="red">{data.summary.reportsRejected} Rejected</Badge>
              </div>
            </Card>

            {/* Approvals KPI */}
            <Card className="border-border bg-surface-elevated p-4 shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Workflow Approvals
                </span>
                <CheckSquare className="h-4 w-4 text-purple-600" />
              </div>
              <div className="mt-2 text-2xl font-bold text-text-primary">
                {formatNumber(data.summary.approvalsTotalInPeriod)}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                <Badge tone="green">{data.summary.approvalsApproved} Approved</Badge>
                <Badge tone="amber">{data.summary.approvalsPending} Pending</Badge>
                <Badge tone="red">{data.summary.approvalsRejected} Rejected</Badge>
                <Badge tone="purple">{data.summary.approvalsEscalated ?? 0} Escalated</Badge>
              </div>
            </Card>

            {/* Findings KPI */}
            <Card className="border-border bg-surface-elevated p-4 shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Audit Findings
                </span>
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              </div>
              <div className="mt-2 text-2xl font-bold text-text-primary">
                {formatNumber(data.findings.length)}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                <Badge tone="amber">{data.summary.findingsRaisedInPeriod} Raised</Badge>
                <Badge tone="green">{data.summary.findingsClosedInPeriod} Closed</Badge>
                <Badge tone="red">
                  {data.summary.findingsBySeverity.critical + data.summary.findingsBySeverity.high} Crit/High
                </Badge>
              </div>
            </Card>
          </div>

          {/* Section Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-border pb-2">
            {(
              [
                { key: 'all', label: 'All Sections (Full Report View)', count: null },
                { key: 'programmes', label: 'Audit Programmes', count: data.programmes.length },
                { key: 'engagements', label: 'Audit Engagements', count: data.engagements.length },
                { key: 'reports', label: 'Reviews Issued & Status', count: data.reports.length },
                { key: 'approvals', label: 'Approvals Breakdown', count: data.approvals.length },
                { key: 'findings', label: 'Findings & Follow-Up', count: data.findings.length },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                  activeTab === tab.key
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-surface text-text-secondary hover:bg-slate-100 hover:text-text-primary'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                {tab.label}
                {tab.count !== null && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                      activeTab === tab.key
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-200 text-text-secondary'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* 1. Audit Programmes Section */}
          {(activeTab === 'all' || activeTab === 'programmes') && (
            <Card className="border-border bg-surface-elevated shadow-card">
              <CardHeader
                title="1. Audit Programmes"
                subtitle="Annual risk-based audit programmes active or updated during the selected period."
              />
              <div className="mt-2">
                <Table<PeriodicReportProgramme>
                  columns={programmeColumns}
                  data={data.programmes}
                  rowKey={(p) => p.id}
                  onRowClick={(p) => router.push(`/audit/plans/${p.id}`)}
                  emptyState={
                    <EmptyState
                      icon={<ClipboardList className="h-4 w-4" />}
                      title="No audit programmes in this period"
                      description="No audit programmes matched the selected period and filter."
                    />
                  }
                />
              </div>
            </Card>
          )}

          {/* 2. Audit Engagements Section */}
          {(activeTab === 'all' || activeTab === 'engagements') && (
            <Card className="border-border bg-surface-elevated shadow-card">
              <CardHeader
                title="2. Audit Engagements Executed & Active"
                subtitle="Engagements planned, started, under quality assurance, or closed during the period."
              />

              {/* Engagements By-Status and By-Audit-Type Breakdown Tables */}
              <div className="grid gap-4 px-5 pt-4 md:grid-cols-2">
                {/* By Stage / Status Breakdown Table */}
                <div className="rounded-lg border border-border bg-surface p-3.5">
                  <div className="mb-2.5 flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                      Engagements by Stage / Status
                    </h4>
                    <span className="text-xs text-text-muted">
                      Total: <strong className="text-text-primary">{data.summary.totalEngagements}</strong>
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-border text-[11px] font-semibold uppercase text-text-muted">
                          <th className="pb-2">Stage / Status</th>
                          <th className="pb-2 text-right">Count</th>
                          <th className="pb-2 text-right">% of Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {(
                          [
                            {
                              key: 'planned',
                              label: 'Planned',
                              count: data.summary.engagementsByStatus.planned,
                            },
                            {
                              key: 'in_progress',
                              label: 'In Progress',
                              count: data.summary.engagementsByStatus.in_progress,
                            },
                            {
                              key: 'under_review',
                              label: 'Quality Assurance / Under Review',
                              count: data.summary.engagementsByStatus.under_review,
                            },
                            {
                              key: 'reported',
                              label: 'Review Issued / Reported',
                              count: data.summary.engagementsByStatus.reported,
                            },
                            {
                              key: 'closed',
                              label: 'Closed',
                              count: data.summary.engagementsByStatus.closed,
                            },
                          ] as const
                        ).map((row) => {
                          const pct =
                            data.summary.totalEngagements > 0
                              ? Math.round((row.count / data.summary.totalEngagements) * 100)
                              : 0;
                          return (
                            <tr key={row.key}>
                              <td className="py-1.5 font-medium text-text-primary">
                                <div className="flex items-center gap-2">
                                  <StatusBadge status={row.key} />
                                  <span className="text-text-secondary">{row.label}</span>
                                </div>
                              </td>
                              <td className="py-1.5 text-right font-mono font-semibold text-text-primary">
                                {row.count}
                              </td>
                              <td className="py-1.5 text-right font-mono text-text-secondary">
                                {pct}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* By Audit Type Breakdown Table */}
                <div className="rounded-lg border border-border bg-surface p-3.5">
                  <div className="mb-2.5 flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                      Engagements by Audit Type
                    </h4>
                    <span className="text-xs text-text-muted">
                      Total: <strong className="text-text-primary">{data.summary.totalEngagements}</strong>
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-border text-[11px] font-semibold uppercase text-text-muted">
                          <th className="pb-2">Audit Type</th>
                          <th className="pb-2 text-right">Count</th>
                          <th className="pb-2 text-right">% of Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {Array.from(
                          new Set([
                            ...CANONICAL_AUDIT_TYPES,
                            ...Object.keys(data.summary.engagementsByType ?? {}),
                          ]),
                        ).map((typeKey) => {
                          const count = data.summary.engagementsByType?.[typeKey] ?? 0;
                          const pct =
                            data.summary.totalEngagements > 0
                              ? Math.round((count / data.summary.totalEngagements) * 100)
                              : 0;
                          return (
                            <tr key={typeKey}>
                              <td className="py-1.5 font-medium text-text-primary">
                                <Badge tone="blue">{auditTypeLabel(typeKey)}</Badge>
                              </td>
                              <td className="py-1.5 text-right font-mono font-semibold text-text-primary">
                                {count}
                              </td>
                              <td className="py-1.5 text-right font-mono text-text-secondary">
                                {pct}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <Table<PeriodicReportEngagement>
                  columns={engagementColumns}
                  data={data.engagements}
                  rowKey={(e) => e.id}
                  onRowClick={(e) => router.push(`/audit/engagements/${e.id}`)}
                  emptyState={
                    <EmptyState
                      icon={<Briefcase className="h-4 w-4" />}
                      title="No audit engagements in this period"
                      description="No engagements overlapped or were updated during the selected period."
                    />
                  }
                />
              </div>
            </Card>
          )}

          {/* 3. Audit Reports Section */}
          {(activeTab === 'all' || activeTab === 'reports') && (
            <Card className="border-border bg-surface-elevated shadow-card">
              <CardHeader
                title="3. Audit Reviews Issued & Status"
                subtitle="Audit reviews drafted, submitted for approval, approved, rejected, or formally issued in the period."
              />

              {/* Report Status Breakdown Table / Strip */}
              <div className="px-5 pt-4">
                <div className="rounded-lg border border-border bg-surface p-3.5">
                  <div className="mb-2.5 flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                      Report Status Breakdown (Draft / In Review / Approved / Published / Rejected)
                    </h4>
                    <span className="text-xs text-text-muted">
                      Total Reviews: <strong className="text-text-primary">{data.reports.length}</strong>
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-border text-[11px] font-semibold uppercase text-text-muted">
                          <th className="pb-2">Draft</th>
                          <th className="pb-2">In Review (Submitted)</th>
                          <th className="pb-2">Approved</th>
                          <th className="pb-2">Published / Issued</th>
                          <th className="pb-2">Rejected</th>
                          <th className="pb-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="pt-2 font-mono font-semibold text-text-primary">
                            <Badge tone="gray">{data.summary.reportsDraft} Draft</Badge>
                          </td>
                          <td className="pt-2 font-mono font-semibold text-text-primary">
                            <Badge tone="amber">{data.summary.reportsSubmitted} In Review</Badge>
                          </td>
                          <td className="pt-2 font-mono font-semibold text-text-primary">
                            <Badge tone="green">{data.summary.reportsApproved} Approved</Badge>
                          </td>
                          <td className="pt-2 font-mono font-semibold text-text-primary">
                            <Badge tone="blue">
                              {data.summary.reportsPublished ?? data.summary.reportsIssuedInPeriod}{' '}
                              Published / Issued
                            </Badge>
                          </td>
                          <td className="pt-2 font-mono font-semibold text-text-primary">
                            <Badge tone="red">{data.summary.reportsRejected} Rejected</Badge>
                          </td>
                          <td className="pt-2 text-right font-mono font-bold text-text-primary">
                            {data.reports.length}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <Table<PeriodicReportItem>
                  columns={reportColumns}
                  data={data.reports}
                  rowKey={(r) => r.id}
                  onRowClick={(r) => router.push(`/audit/engagements/${r.engagementId}`)}
                  emptyState={
                    <EmptyState
                      icon={<FileText className="h-4 w-4" />}
                      title="No audit reviews in this period"
                      description="No audit reviews were created or issued during the selected period."
                    />
                  }
                />
              </div>
            </Card>
          )}

          {/* 4. Approvals Breakdown Section */}
          {(activeTab === 'all' || activeTab === 'approvals') && (
            <Card className="border-border bg-surface-elevated shadow-card">
              <CardHeader
                title="4. Workflow Approvals (Pending, Approved, Rejected, Escalated)"
                subtitle="Sign-off decisions and escalations across audit programmes, working papers, audit reviews, and finding closures."
                action={
                  <div className="inline-flex flex-wrap rounded-lg border border-border bg-surface p-0.5">
                    {(
                      [
                        { key: 'all', label: `All (${data.approvals.length})` },
                        { key: 'pending', label: `Pending (${data.summary.approvalsPending})`, icon: Clock },
                        {
                          key: 'approved',
                          label: `Approved (${data.summary.approvalsApproved})`,
                          icon: CheckCircle2,
                        },
                        {
                          key: 'rejected',
                          label: `Rejected (${data.summary.approvalsRejected})`,
                          icon: XCircle,
                        },
                        {
                          key: 'escalated',
                          label: `Escalated (${data.summary.approvalsEscalated ?? 0})`,
                          icon: AlertTriangle,
                        },
                      ] as const
                    ).map((pill) => (
                      <button
                        key={pill.key}
                        type="button"
                        onClick={() => setApprovalStatusFilter(pill.key)}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                          approvalStatusFilter === pill.key
                            ? 'bg-primary text-white'
                            : 'text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        {pill.label}
                      </button>
                    ))}
                  </div>
                }
              />
              <div className="mt-2">
                <Table<PeriodicReportApproval>
                  columns={approvalColumns}
                  data={filteredApprovals}
                  rowKey={(a) => a.id}
                  onRowClick={() => router.push('/workflow/approvals')}
                  emptyState={
                    <EmptyState
                      icon={<CheckSquare className="h-4 w-4" />}
                      title="No approvals matching filter"
                      description="No workflow approvals matched the selected period and status filter."
                    />
                  }
                />
              </div>
            </Card>
          )}

          {/* 5. Findings & Remediation Section */}
          {(activeTab === 'all' || activeTab === 'findings') && (
            <Card className="border-border bg-surface-elevated shadow-card">
              <CardHeader
                title="5. Audit Findings & Remediation Follow-Up"
                subtitle="Issues raised, management responses received, and findings verified/closed during the period."
              />
              <div className="mt-2">
                <Table<PeriodicReportFinding>
                  columns={findingColumns}
                  data={data.findings}
                  rowKey={(f) => f.id}
                  onRowClick={(f) => router.push(`/audit/findings/${f.id}`)}
                  emptyState={
                    <EmptyState
                      icon={<AlertTriangle className="h-4 w-4" />}
                      title="No findings in this period"
                      description="No audit findings were raised or closed during the selected period."
                    />
                  }
                />
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
