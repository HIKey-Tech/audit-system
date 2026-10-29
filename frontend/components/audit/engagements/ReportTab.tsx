'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Send,
  Check,
  X,
  Download,
  Sparkles,
  ChevronDown,
  Loader2,
  Eye,
  LayoutGrid,
  Clock,
  FileEdit,
  Save,
  RefreshCw,
  MessageSquare,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormField } from '@/components/ui/FormField';
import { ReasonDialog } from '@/components/ui/ReasonDialog';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { InfoHint } from '@/components/ui/InfoHint';
import { DocumentWorkspaceModal } from '@/components/ui/DocumentWorkspaceModal';
import {
  WordDocumentEditor,
  sectionsToWordHtml,
  wordHtmlToSections,
  plainOrMarkdownToHtml,
  isRichHtml,
} from '@/components/ui/WordDocumentEditor';
import { reportTemplatesApi } from '@/lib/api/settings';
import { reportsApi, findingsApi, followUpApi } from '@/lib/api/audit';
import { assetsApi } from '@/lib/api/assets';
import { workflowApi } from '@/lib/api/workflow';
import { api } from '@/lib/api-client';
import { ApproveSignPanel } from '@/components/workflow/ApproveSignPanel';
import { SignedApprovalDocuments } from '@/components/workflow/SignedApprovalDocuments';
import { DocumentSignerModal } from '@/components/workflow/DocumentSignerModal';
import { ApprovalChain } from '@/components/audit/engagements/ApprovalChain';
import { formatRelative, formatDate } from '@/lib/utils/format';
import { auditTypeLabel } from '@/lib/audit-domains';
import { usePermission } from '@/hooks/usePermission';
import { useSession } from '@/components/providers/AuthProvider';
import type { AuditEngagementDetail, AuditFinding, AuditReport, ReportTemplateDto as ReportTemplate } from '@/lib/types/domain';

export type ReportSignOffMode = 'cae_only' | 'cae_and_dg';

interface ReportCommentItem {
  id: string;
  reportId: string;
  authorId: string;
  authorName: string;
  authorRole?: string | null;
  body: string;
  createdAt: string;
}

interface EnrichedFinding extends AuditFinding {
  managementResponse?: string | null;
  managementResponseAt?: string | null;
  verificationStatus?: string | null;
}

type ExtendedAuditReport = AuditReport & {
  signOffMode?: ReportSignOffMode;
  comments?: ReportCommentItem[];
  findings?: Array<{
    id: string;
    title: string;
    description?: string;
    severity: string;
    category?: string;
    status: string;
    rootCause?: string;
    riskImplication?: string;
    recommendation?: string;
    auditeeName?: string;
    controlReference?: string | null;
    managementResponse?: string | null;
    managementResponseAt?: string | null;
    verificationStatus?: string | null;
    dueDate?: string;
  }>;
};

const escapeHtml = (str: string): string =>
  (str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

/**
 * Collapses accidentally duplicated HTML blocks (e.g., when two template sections with identical
 * default scope HTML were previously concatenated with a newline).
 */
function deduplicateRepeatedHtml(raw: string): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return '';
  // Check if the string is two identical halves separated by whitespace/newline
  const lines = trimmed.split('\n');
  if (lines.length >= 2 && lines.length % 2 === 0) {
    const half = lines.length / 2;
    const firstHalf = lines.slice(0, half).join('\n').trim();
    const secondHalf = lines.slice(half).join('\n').trim();
    if (firstHalf && firstHalf === secondHalf) {
      return firstHalf;
    }
  }
  // Also check if `<p>The audit covered` appears twice identically
  const marker = '<p>The audit covered';
  const firstIdx = trimmed.indexOf(marker);
  if (firstIdx === 0) {
    const secondIdx = trimmed.indexOf(marker, marker.length);
    if (secondIdx > 0) {
      const firstPart = trimmed.slice(0, secondIdx).trim();
      const secondPart = trimmed.slice(secondIdx).trim();
      if (firstPart === secondPart) {
        return firstPart;
      }
    }
  }
  return trimmed;
}

/**
 * Builds rich HTML sections from a report template + engagement + findings + auditee responses + scope assets
 * so the Microsoft Word-style editor displays all template headers and engagement findings immediately.
 */
function buildReportWordDocumentHtml(params: {
  engagement: AuditEngagementDetail;
  template: ReportTemplate | null;
  findings: EnrichedFinding[];
  scopeAssets: Array<{
    id: string;
    assetTag?: string;
    name: string;
    assetType?: string;
    criticality?: string;
  }>;
  existingReport?: ExtendedAuditReport | null;
}): string {
  const { engagement, template, findings, scopeAssets, existingReport } = params;

  const highCount = findings.filter(
    (f) => f.severity === 'critical' || f.severity === 'high',
  ).length;
  const mediumCount = findings.filter((f) => f.severity === 'medium').length;
  const lowCount = findings.filter((f) => f.severity === 'low').length;

  // Build default Executive Summary HTML with findings & auditee responses overview
  const defaultExecSummaryHtml = (() => {
    if (existingReport?.executiveSummary?.trim()) {
      return isRichHtml(existingReport.executiveSummary)
        ? existingReport.executiveSummary
        : plainOrMarkdownToHtml(existingReport.executiveSummary);
    }
    const rowsHtml =
      findings.length > 0
        ? `<table style="width:100%; border-collapse:collapse; margin:10px 0; font-size:12px;">
            <thead>
              <tr style="background:#003087; color:#ffffff;">
                <th style="border:1px solid #cbd5e1; padding:6px 8px; text-align:left;">#</th>
                <th style="border:1px solid #cbd5e1; padding:6px 8px; text-align:left;">Finding Title</th>
                <th style="border:1px solid #cbd5e1; padding:6px 8px; text-align:center;">Severity</th>
                <th style="border:1px solid #cbd5e1; padding:6px 8px; text-align:left;">Auditee Owner</th>
                <th style="border:1px solid #cbd5e1; padding:6px 8px; text-align:left;">Auditee Management Response</th>
              </tr>
            </thead>
            <tbody>
              ${findings
                .map(
                  (f, i) => `
                <tr>
                  <td style="border:1px solid #cbd5e1; padding:6px 8px;">${i + 1}</td>
                  <td style="border:1px solid #cbd5e1; padding:6px 8px;"><strong>${escapeHtml(f.title)}</strong></td>
                  <td style="border:1px solid #cbd5e1; padding:6px 8px; text-align:center; font-weight:bold;">${escapeHtml((f.severity || '').toUpperCase())}</td>
                  <td style="border:1px solid #cbd5e1; padding:6px 8px;">${escapeHtml(f.auditeeName || engagement.auditeeName || 'Auditee')}</td>
                  <td style="border:1px solid #cbd5e1; padding:6px 8px;">${
                    f.managementResponse
                      ? escapeHtml(f.managementResponse)
                      : '<em>Awaiting management response from auditee</em>'
                  }</td>
                </tr>`,
                )
                .join('')}
            </tbody>
          </table>`
        : `<p><em>No audit exceptions or findings were raised during fieldwork.</em></p>`;

    return `
      <p>Internal Audit conducted a <strong>${escapeHtml(auditTypeLabel(engagement.auditType))}</strong> audit of <strong>${escapeHtml(engagement.universeName || engagement.title)}</strong> (Engagement Reference: <strong>${escapeHtml(engagement.referenceNumber)}</strong>) covering the planned period ${formatDate(engagement.plannedStartDate)} to ${formatDate(engagement.plannedEndDate)}.</p>
      <p>A total of <strong>${findings.length}</strong> audit finding(s) were identified during the engagement: <strong>${highCount}</strong> Critical/High, <strong>${mediumCount}</strong> Medium, and <strong>${lowCount}</strong> Low severity.</p>
      ${rowsHtml}
    `.trim();
  })();

  // Build default Background & Context HTML (distinct from Scope & Objectives so templates with both sections don't duplicate content)
  const defaultBackgroundHtml = `<p>This audit engagement (<strong>${escapeHtml(engagement.referenceNumber)}</strong>) was conducted for <strong>${escapeHtml(engagement.universeName || engagement.title)}</strong> under the <strong>${escapeHtml(auditTypeLabel(engagement.auditType))}</strong> programme. The engagement was led by <strong>${escapeHtml(engagement.leadAuditorName || 'the Lead Auditor')}</strong> under the supervision of <strong>${escapeHtml(engagement.auditManagerName || 'the Audit Manager')}</strong>, with <strong>${escapeHtml(engagement.auditeeName || 'the Auditee')}</strong> serving as the primary auditee contact.</p>`;

  // Build default Scope & Objectives HTML
  const defaultScopeHtml = (() => {
    if (existingReport?.scope?.trim()) {
      const cleanedScope = deduplicateRepeatedHtml(existingReport.scope);
      return isRichHtml(cleanedScope)
        ? cleanedScope
        : plainOrMarkdownToHtml(cleanedScope);
    }
    const assetsTableHtml =
      scopeAssets.length > 0
        ? `<p><strong>Assets in Scope:</strong></p>
           <table style="width:100%; border-collapse:collapse; margin:8px 0; font-size:12px;">
             <thead>
               <tr style="background:#f1f5f9; color:#0f172a;">
                 <th style="border:1px solid #cbd5e1; padding:6px 8px; text-align:left;">Asset Tag</th>
                 <th style="border:1px solid #cbd5e1; padding:6px 8px; text-align:left;">Asset Name</th>
                 <th style="border:1px solid #cbd5e1; padding:6px 8px; text-align:left;">Type</th>
                 <th style="border:1px solid #cbd5e1; padding:6px 8px; text-align:center;">Criticality</th>
               </tr>
             </thead>
             <tbody>
               ${scopeAssets
                 .map(
                   (a) => `
                 <tr>
                   <td style="border:1px solid #cbd5e1; padding:6px 8px;">${escapeHtml(a.assetTag || '—')}</td>
                   <td style="border:1px solid #cbd5e1; padding:6px 8px;">${escapeHtml(a.name)}</td>
                   <td style="border:1px solid #cbd5e1; padding:6px 8px;">${escapeHtml((a.assetType || '').replace(/_/g, ' '))}</td>
                   <td style="border:1px solid #cbd5e1; padding:6px 8px; text-align:center;">${escapeHtml((a.criticality || 'medium').toUpperCase())}</td>
                 </tr>`,
                 )
                 .join('')}
             </tbody>
           </table>`
        : '';

    return `
      <p>The audit covered the processes, controls, systems, and governance arrangements of <strong>${escapeHtml(engagement.universeName || engagement.title)}</strong> under the <strong>${escapeHtml(auditTypeLabel(engagement.auditType))}</strong> domain for the period <strong>${formatDate(engagement.plannedStartDate)}</strong> to <strong>${formatDate(engagement.plannedEndDate)}</strong>.</p>
      <ul>
        <li><strong>Audited Entity:</strong> ${escapeHtml(engagement.universeName || 'N/A')}</li>
        <li><strong>Lead Auditor:</strong> ${escapeHtml(engagement.leadAuditorName || 'N/A')}</li>
        <li><strong>Audit Manager / Reviewer:</strong> ${escapeHtml(engagement.auditManagerName || 'N/A')}</li>
        <li><strong>Primary Auditee Contact:</strong> ${escapeHtml(engagement.auditeeName || 'N/A')}</li>
      </ul>
      ${assetsTableHtml}
    `.trim();
  })();

  // Build default Methodology HTML
  const defaultMethodologyHtml = (() => {
    if (existingReport?.methodology?.trim()) {
      return isRichHtml(existingReport.methodology)
        ? existingReport.methodology
        : plainOrMarkdownToHtml(existingReport.methodology);
    }
    return `
      <p>Our audit was conducted in accordance with the International Standards for the Professional Practice of Internal Auditing (IIA Standards) and the Galaxy Backbone Internal Audit Charter. Our methodology included:</p>
      <ol>
        <li><strong>Walkthroughs &amp; Inquiry:</strong> Interviews with process owners and walkthroughs of key operational and technology controls.</li>
        <li><strong>Control Design &amp; Operating Effectiveness Testing:</strong> Inspection of policies, configurations, logs, and transaction samples.</li>
        <li><strong>Substantive &amp; Analytical Procedures:</strong> Evaluation of audit evidence, exceptions, root causes, and management remediation plans.</li>
      </ol>
    `.trim();
  })();

  // Build Detailed Findings + Auditee Management Responses HTML
  const detailedFindingsHtml = (() => {
    if (findings.length === 0) {
      return `<p><em>No findings were raised during this engagement.</em></p>`;
    }
    return findings
      .map(
        (f, idx) => `
        <div style="margin-bottom:14px; padding:10px 12px; border:1px solid #cbd5e1; border-radius:4px; background:#ffffff;">
          <p style="margin:0 0 6px 0;"><strong>Finding ${idx + 1}: ${escapeHtml(f.title)}</strong> — <span style="color:#003087; font-weight:bold;">[${escapeHtml((f.severity || '').toUpperCase())}]</span></p>
          <p style="margin:4px 0;"><strong>Category:</strong> ${escapeHtml((f.category || '').replace(/_/g, ' '))} | <strong>Status:</strong> ${escapeHtml((f.status || '').replace(/_/g, ' '))} | <strong>Due Date:</strong> ${f.dueDate ? formatDate(f.dueDate) : '—'} | <strong>Auditee:</strong> ${escapeHtml(f.auditeeName || engagement.auditeeName || 'N/A')}</p>
          <p style="margin:4px 0;"><strong>Observation / Condition:</strong> ${escapeHtml(f.description || '—')}</p>
          <p style="margin:4px 0;"><strong>Root Cause:</strong> ${escapeHtml(f.rootCause || '—')}</p>
          <p style="margin:4px 0;"><strong>Risk / Implication:</strong> ${escapeHtml(f.riskImplication || '—')}</p>
          <p style="margin:4px 0;"><strong>Audit Recommendation:</strong> ${escapeHtml(f.recommendation || '—')}</p>
          <p style="margin:6px 0 0 0; padding:6px 8px; background:#f8fafc; border-left:3px solid #003087;"><strong>Auditee Management Response:</strong> ${
            f.managementResponse
              ? `${escapeHtml(f.managementResponse)}${f.managementResponseAt ? ` <em>(Responded ${formatDate(f.managementResponseAt)})</em>` : ''}`
              : '<em>Awaiting formal management response from auditee.</em>'
          }</p>
        </div>`,
      )
      .join('');
  })();

  const templateSections: Array<{ key?: string; title: string; required?: boolean }> = template?.sections?.length
    ? [...template.sections]
    : [
        { key: 'executive_summary', title: 'Executive Summary', required: true },
        { key: 'objectives', title: 'Audit Scope & Objectives', required: true },
        { key: 'methodology', title: 'Audit Methodology', required: true },
        {
          key: 'detailed_findings',
          title: 'Findings & Auditee Management Responses',
          required: true,
        },
        { key: 'conclusion', title: 'Conclusion & Overall Audit Opinion', required: true },
      ];

  const mappedSections = templateSections.map((sec, idx) => {
    const keyLower = (sec.key || sec.title || '').toLowerCase();
    let content = '';
    if (keyLower.includes('executive') || (keyLower.includes('summary') && idx === 0)) {
      content = defaultExecSummaryHtml;
    } else if (keyLower.includes('background') && !keyLower.includes('scope') && !keyLower.includes('objective')) {
      content = defaultBackgroundHtml;
    } else if (keyLower.includes('scope') || keyLower.includes('objective')) {
      content = defaultScopeHtml;
    } else if (keyLower.includes('method') || keyLower.includes('approach')) {
      content = defaultMethodologyHtml;
    } else if (keyLower.includes('finding') || keyLower.includes('observation') || keyLower.includes('exception')) {
      content = detailedFindingsHtml;
    } else if (keyLower.includes('conclu') || keyLower.includes('opinion')) {
      content = `<p>Based on the audit procedures performed and the "${findings.length}" finding(s) documented above, management should implement the agreed corrective action plans by the committed target dates. Internal Audit will track and verify remediation through the Follow-Up module.</p>`;
    } else {
      content = `<p>Enter details for ${escapeHtml(sec.title)}...</p>`;
    }

    return {
      title: `${idx + 1}. ${sec.title.replace(/^\d+\.\s*/, '')}`,
      content,
    };
  });

  return sectionsToWordHtml(mappedSections);
}

/**
 * Extracts `executiveSummary`, `scope`, and `methodology` from the unified Word HTML document
 * while preserving rich HTML (tables, inline base64 images, lists, formatting) inside each section.
 */
function extractReportFieldsFromWordHtml(
  wordHtml: string,
  fallbackExec: string,
  fallbackScope: string,
  fallbackMethod: string,
): { executiveSummary: string; scope: string; methodology: string } {
  const sections = wordHtmlToSections(wordHtml);
  if (sections.length === 0) {
    return {
      executiveSummary: wordHtml || fallbackExec,
      scope: fallbackScope,
      methodology: fallbackMethod,
    };
  }

  const execParts: string[] = [];
  const scopeParts: string[] = [];
  const backgroundParts: string[] = [];
  const methodParts: string[] = [];
  const extraParts: string[] = [];

  for (const sec of sections) {
    const t = sec.title.toLowerCase();
    const blockHtml = sec.content?.trim() || '';
    if (!blockHtml) continue;

    if (t.includes('executive') || (t.includes('summary') && !t.includes('finding'))) {
      execParts.push(blockHtml);
    } else if (t.includes('scope') || t.includes('objective')) {
      if (!scopeParts.includes(blockHtml)) {
        scopeParts.push(blockHtml);
      }
    } else if (t.includes('background')) {
      if (!backgroundParts.includes(blockHtml)) {
        backgroundParts.push(blockHtml);
      }
    } else if (t.includes('method') || t.includes('approach') || t.includes('procedure')) {
      if (!methodParts.includes(blockHtml)) {
        methodParts.push(blockHtml);
      }
    } else if (t.includes('conclu') || t.includes('opinion')) {
      extraParts.push(`<h3>${escapeHtml(sec.title)}</h3>${blockHtml}`);
    } else if (!t.includes('finding')) {
      extraParts.push(`<h3>${escapeHtml(sec.title)}</h3>${blockHtml}`);
    }
  }

  const uniqueScopeParts =
    scopeParts.length > 0
      ? scopeParts
      : backgroundParts;

  const executiveSummary =
    [...execParts, ...extraParts].join('\n').trim() || wordHtml || fallbackExec;
  const scope = Array.from(new Set(uniqueScopeParts)).join('\n').trim() || fallbackScope;
  const methodology = Array.from(new Set(methodParts)).join('\n').trim() || fallbackMethod;

  return { executiveSummary, scope, methodology };
}

/**
 * Renders either rich HTML (with tables, images, lists) or plain text cleanly in read-only mode.
 */
const RichSectionViewer = ({
  content,
  emptyText = '—',
  className = '',
}: {
  content: string | null | undefined;
  emptyText?: string;
  className?: string;
}): JSX.Element => {
  if (!content || !content.trim()) {
    return <p className="text-xs text-text-muted italic">{emptyText}</p>;
  }
  const deduped = deduplicateRepeatedHtml(content);
  const html = isRichHtml(deduped) ? deduped : plainOrMarkdownToHtml(deduped);
  return (
    <div
      className={`prose prose-sm max-w-none text-slate-800 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-slate-300 [&_th]:bg-slate-100 [&_th]:px-2.5 [&_th]:py-1.5 [&_th]:text-left [&_td]:border [&_td]:border-slate-300 [&_td]:px-2.5 [&_td]:py-1.5 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded [&_img]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export const ReportTab = ({ engagement }: { engagement: AuditEngagementDetail }): JSX.Element => {
  const qc = useQueryClient();
  const session = useSession();
  const canGenerateReport = usePermission('report:create');
  const canUpdateReport = usePermission('report:update') || canGenerateReport;
  const canSubmitReport = usePermission('report:submit');
  const canApproveApproval = usePermission('approval:approve');
  const canRejectApproval = usePermission('approval:reject');
  const canIssueReport = usePermission('report:issue');
  const canExportReport = usePermission('report:export');

  const report = useQuery({
    queryKey: ['engagements', engagement.id, 'report'],
    queryFn: () =>
      reportsApi.getByEngagement(engagement.id).catch(() => null) as Promise<ExtendedAuditReport | null>,
    retry: false,
  });

  const reportTemplates = useQuery({
    queryKey: ['settings', 'report-templates', 'list'],
    queryFn: () => reportTemplatesApi.list(),
  });

  const findings = useQuery({
    queryKey: ['engagements', engagement.id, 'findings'],
    queryFn: () => findingsApi.listByEngagement(engagement.id),
  });

  const assets = useQuery({
    queryKey: ['engagements', engagement.id, 'assets'],
    queryFn: () => assetsApi.listForEngagement(engagement.id),
  });

  const rawFindings = useMemo(() => findings.data ?? [], [findings.data]);
  const scopeAssets = useMemo(() => assets.data ?? [], [assets.data]);

  // Also fetch follow-up management responses for findings when not already embedded on the report
  const findingFollowUps = useQuery({
    queryKey: [
      'engagements',
      engagement.id,
      'findings-followups',
      rawFindings.map((f) => f.id).join(','),
    ],
    queryFn: async () => {
      const results = await Promise.all(
        rawFindings.map(async (f) => {
          const fu = await followUpApi.getByFinding(f.id).catch(() => null);
          return [f.id, fu] as const;
        }),
      );
      return Object.fromEntries(results);
    },
    enabled: rawFindings.length > 0,
  });

  const enrichedFindings: EnrichedFinding[] = useMemo(() => {
    const rFindings = report.data?.findings ?? [];
    const rFindingMap = new Map(rFindings.map((rf) => [rf.id, rf]));
    const fuMap = findingFollowUps.data ?? {};

    return rawFindings.map((f) => {
      const rf = rFindingMap.get(f.id);
      const fu = fuMap[f.id];
      return {
        ...f,
        managementResponse: rf?.managementResponse ?? fu?.managementResponse ?? null,
        managementResponseAt: rf?.managementResponseAt ?? fu?.responseDate ?? null,
        verificationStatus: rf?.verificationStatus ?? fu?.verificationStatus ?? null,
      };
    });
  }, [rawFindings, report.data?.findings, findingFollowUps.data]);

  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['engagements', engagement.id] });
    qc.invalidateQueries({ queryKey: ['engagements', engagement.id, 'report'] });
    qc.invalidateQueries({ queryKey: ['workflow'] });
    qc.invalidateQueries({ queryKey: ['approval-chain'] });
  }, [qc, engagement.id]);

  const reportId = report.data?.id;

  const approval = useQuery({
    queryKey: ['workflow', 'approval', 'audit_report', reportId],
    queryFn: () => workflowApi.getApprovalByEntity('audit_report', reportId!).catch(() => null),
    enabled: Boolean(reportId),
    retry: false,
  });

  const approvalChain = useQuery({
    queryKey: ['approval-chain', 'audit_report', reportId],
    queryFn: () => workflowApi.getApprovalChain('audit_report', reportId as string),
    enabled: Boolean(reportId),
  });

  // Report comments query
  const commentsQuery = useQuery({
    queryKey: ['audit-report-comments', reportId],
    queryFn: () =>
      api.get<ReportCommentItem[]>(`/audit/reports/${reportId}/comments`).catch(() => []),
    enabled: Boolean(reportId),
  });

  // Authoring state (used for both pre-generation and editing existing draft/rejected reports)
  const [title, setTitle] = useState<string>(`${engagement.title} — Audit Report`);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [signOffMode, setSignOffMode] = useState<ReportSignOffMode>('cae_and_dg');
  const [editorHtml, setEditorHtml] = useState<string>('');
  const [editorInitializedFor, setEditorInitializedFor] = useState<string>('');
  const [activeView, setActiveView] = useState<'editor' | 'preview' | 'cards'>('preview');
  const [isStudioOpen, setIsStudioOpen] = useState<boolean>(false);
  const [commentText, setCommentText] = useState<string>('');

  const selectedTemplate = useMemo(() => {
    const list = reportTemplates.data ?? [];
    return (
      list.find((t) => t.id === selectedTemplateId) ??
      list.find((t) => t.isDefault) ??
      list[0] ??
      null
    );
  }, [reportTemplates.data, selectedTemplateId]);

  // Set default template ID once templates load
  useEffect(() => {
    const list = reportTemplates.data;
    if (!list || list.length === 0) return;
    if (!selectedTemplateId) {
      const def = list.find((t) => t.isDefault) ?? list[0];
      setSelectedTemplateId(def.id);
    }
  }, [reportTemplates.data, selectedTemplateId]);

  // Synchronize state when existing report loads or before generation
  useEffect(() => {
    const r = report.data;
    if (r) {
      const initKey = `existing-${r.id}-v${r.version}-${enrichedFindings.length}`;
      if (editorInitializedFor !== initKey) {
        setTitle(r.title);
        if (r.templateId) setSelectedTemplateId(r.templateId);
        if (r.signOffMode) setSignOffMode(r.signOffMode);
        const tpl =
          (reportTemplates.data ?? []).find((t) => t.id === r.templateId) ??
          selectedTemplate;
        setEditorHtml(
          buildReportWordDocumentHtml({
            engagement,
            template: tpl,
            findings: enrichedFindings,
            scopeAssets,
            existingReport: r,
          }),
        );
        setEditorInitializedFor(initKey);
        if (r.status === 'draft' || r.status === 'rejected') {
          setActiveView('editor');
        }
      }
    } else if (selectedTemplate) {
      const initKey = `new-${selectedTemplate.id}-${enrichedFindings.length}-${scopeAssets.length}`;
      if (editorInitializedFor !== initKey) {
        setEditorHtml(
          buildReportWordDocumentHtml({
            engagement,
            template: selectedTemplate,
            findings: enrichedFindings,
            scopeAssets,
            existingReport: null,
          }),
        );
        setEditorInitializedFor(initKey);
      }
    }
  }, [
    report.data,
    selectedTemplate,
    enrichedFindings,
    scopeAssets,
    engagement,
    reportTemplates.data,
    editorInitializedFor,
  ]);

  // When user switches template in dropdown, re-populate template headers
  const handleTemplateChange = (newTemplateId: string) => {
    setSelectedTemplateId(newTemplateId);
    const tpl = (reportTemplates.data ?? []).find((t) => t.id === newTemplateId) ?? null;
    setEditorHtml(
      buildReportWordDocumentHtml({
        engagement,
        template: tpl,
        findings: enrichedFindings,
        scopeAssets,
        existingReport: report.data,
      }),
    );
    toast.success(`Loaded "${tpl?.name ?? 'Selected'}" template headers & engagement findings into editor`);
  };

  const handleResyncFindingsAndTemplate = () => {
    setEditorHtml(
      buildReportWordDocumentHtml({
        engagement,
        template: selectedTemplate,
        findings: enrichedFindings,
        scopeAssets,
        existingReport: null,
      }),
    );
    toast.success('Refreshed template headers, findings, and auditee responses in editor');
  };

  const generate = useMutation({
    mutationFn: (mode: 'draft' | 'generate') => {
      const extracted = extractReportFieldsFromWordHtml(
        editorHtml,
        '',
        `Audit of ${engagement.universeName || engagement.title}`,
        'Walkthroughs, control testing, and substantive procedures per IIA Standards.',
      );
      return api.post<ExtendedAuditReport>(
        `/audit/engagements/${engagement.id}/report/generate`,
        {
          title: title.trim() || `${engagement.title} — Audit Report`,
          templateId: selectedTemplateId || undefined,
          signOffMode,
          executiveSummary: extracted.executiveSummary,
          scope: extracted.scope,
          methodology: extracted.methodology,
        },
      );
    },
    onSuccess: () => {
      toast.success('Audit report saved as draft');
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to generate report'),
  });

  const updateReportMut = useMutation({
    mutationFn: () => {
      const r = report.data!;
      const extracted = extractReportFieldsFromWordHtml(
        editorHtml,
        r.executiveSummary ?? '',
        r.scope ?? '',
        r.methodology ?? '',
      );
      return api.put<ExtendedAuditReport>(`/audit/reports/${r.id}`, {
        title: title.trim() || r.title,
        templateId: selectedTemplateId || r.templateId || undefined,
        signOffMode,
        executiveSummary: extracted.executiveSummary,
        scope: extracted.scope,
        methodology: extracted.methodology,
      });
    },
    onSuccess: () => {
      toast.success('Report draft saved');
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to save report draft'),
  });

  const submitMut = useMutation({
    mutationFn: async () => {
      const r = report.data!;
      if (canUpdateReport && (r.status === 'draft' || r.status === 'rejected')) {
        const extracted = extractReportFieldsFromWordHtml(
          editorHtml,
          r.executiveSummary ?? '',
          r.scope ?? '',
          r.methodology ?? '',
        );
        await api.put<ExtendedAuditReport>(`/audit/reports/${r.id}`, {
          title: title.trim() || r.title,
          templateId: selectedTemplateId || r.templateId || undefined,
          signOffMode,
          executiveSummary: extracted.executiveSummary,
          scope: extracted.scope,
          methodology: extracted.methodology,
        });
      }
      return reportsApi.submit(r.id);
    },
    onSuccess: () => {
      toast.success('Submitted for approval');
      setActiveView('preview');
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to submit report'),
  });

  const rejectMut = useMutation({
    mutationFn: (reason: string) => workflowApi.reject(approval.data!.id, reason),
    onSuccess: () => {
      toast.success('Report rejected');
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to reject'),
  });

  const issueMut = useMutation({
    mutationFn: () => reportsApi.issue(report.data!.id),
    onSuccess: () => {
      toast.success('Audit report formally issued');
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to issue report'),
  });

  const addCommentMut = useMutation({
    mutationFn: (body: string) =>
      api.post<ReportCommentItem>(`/audit/reports/${report.data!.id}/comments`, { body }),
    onSuccess: () => {
      setCommentText('');
      toast.success('Comment posted & team notified');
      qc.invalidateQueries({ queryKey: ['audit-report-comments', reportId] });
      qc.invalidateQueries({ queryKey: ['engagements', engagement.id, 'report'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to post comment'),
  });

  const [exportingFormat, setExportingFormat] = useState<'pdf' | 'docx' | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
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

  if (report.isLoading) {
    return (
      <Card>
        <Skeleton className="h-4 w-1/3 mb-3" />
        <Skeleton className="h-3 w-2/3" />
      </Card>
    );
  }

  // Sign-off selector UI helper
  const renderSignOffSelector = (disabled = false) => (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-text-primary">
        Report Sign-Off Requirement (Permission-Based Executive Approval Chain)
      </label>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setSignOffMode('cae_only')}
          className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-all ${
            signOffMode === 'cae_only'
              ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
              : 'border-border bg-white hover:bg-slate-50'
          } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          <ShieldCheck
            className={`mt-0.5 h-4 w-4 shrink-0 ${
              signOffMode === 'cae_only' ? 'text-primary' : 'text-slate-400'
            }`}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-text-primary">
                Oversight Sign-Off Only (1 Executive Level)
              </span>
              {signOffMode === 'cae_only' && <Badge tone="blue">Selected</Badge>}
            </div>
            <p className="mt-0.5 text-[11px] text-text-secondary">
              Standard Audit: Reviewed by the Engagement Audit Manager, with final sign-off routed to the user holding <code className="rounded bg-slate-100 px-1 py-0.5 text-[10px]">report:approve:oversight</code> (e.g. Head of Internal Audit / CAE).
            </p>
          </div>
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => setSignOffMode('cae_and_dg')}
          className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-all ${
            signOffMode === 'cae_and_dg'
              ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
              : 'border-border bg-white hover:bg-slate-50'
          } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          <Users
            className={`mt-0.5 h-4 w-4 shrink-0 ${
              signOffMode === 'cae_and_dg' ? 'text-primary' : 'text-slate-400'
            }`}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-text-primary">
                Oversight + Executive Final Sign-Off (2 Executive Levels)
              </span>
              {signOffMode === 'cae_and_dg' && <Badge tone="blue">Selected</Badge>}
            </div>
            <p className="mt-0.5 text-[11px] text-text-secondary">
              Executive / Major Audit: Reviewed by the Engagement Audit Manager, endorsed by <code className="rounded bg-slate-100 px-1 py-0.5 text-[10px]">report:approve:oversight</code>, and final sign-off routed to <code className="rounded bg-slate-100 px-1 py-0.5 text-[10px]">report:approve:final</code> (e.g. Director General / MD).
            </p>
          </div>
        </button>
      </div>
    </div>
  );

  const renderStudioModal = (currentReport: ExtendedAuditReport | null) => (
    <DocumentWorkspaceModal
      open={isStudioOpen}
      onClose={() => setIsStudioOpen(false)}
      dirty={Boolean(title.trim().length > 0 || editorHtml.trim().length > 0)}
      title={
        <div className="flex items-center gap-2 max-w-md w-full">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Formal Audit Report Title..."
            className="h-8 text-xs font-semibold"
          />
        </div>
      }
      subtitle={`${engagement.referenceNumber} · ${engagement.title} · Review & Audit Report`}
      badge={
        <Badge status={currentReport?.status ?? 'draft'}>
          {(currentReport?.status ?? 'draft').toUpperCase()}
        </Badge>
      }
      headerCenter={
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-medium whitespace-nowrap">Template:</span>
            <select
              value={selectedTemplateId || currentReport?.templateId || ''}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 focus:border-[#1E3A8A] focus:outline-none"
            >
              {(reportTemplates.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.isDefault ? ' (default)' : ''}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            onClick={handleResyncFindingsAndTemplate}
            title="Re-sync findings & auditee responses into document"
          >
            Re-sync ({enrichedFindings.length})
          </Button>
        </div>
      }
      headerRight={
        <div className="flex items-center gap-2">
          {canExportReport && currentReport && (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Download className="h-3.5 w-3.5" />}
              onClick={() => handleExport('docx')}
              disabled={exportingFormat !== null}
            >
              Export DOCX
            </Button>
          )}
          {!currentReport ? (
            <>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                leftIcon={<Save className="h-3.5 w-3.5" />}
                isLoading={generate.isPending}
                onClick={() => generate.mutate('draft')}
              >
                Save as Draft
              </Button>
              <Button
                type="button"
                size="sm"
                leftIcon={<Sparkles className="h-3.5 w-3.5" />}
                isLoading={generate.isPending}
                onClick={() => generate.mutate('generate')}
              >
                Generate Report
              </Button>
            </>
          ) : (
            <>
              {canEditInWord && (
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Save className="h-3.5 w-3.5" />}
                  isLoading={updateReportMut.isPending}
                  onClick={() => updateReportMut.mutate()}
                >
                  Save Draft
                </Button>
              )}
              {canSubmitReport && (currentReport.status === 'draft' || currentReport.status === 'rejected') && (
                <Button
                  size="sm"
                  leftIcon={<Send className="h-3.5 w-3.5" />}
                  isLoading={submitMut.isPending}
                  onClick={() => submitMut.mutate()}
                >
                  Submit for Approval
                </Button>
              )}
              {currentReport.status === 'submitted' && canActOnCurrentApproval && (
                <Button
                  variant="success"
                  size="sm"
                  leftIcon={<Check className="h-3.5 w-3.5" />}
                  onClick={() => setApproveOpen(true)}
                >
                  Approve &amp; Sign
                </Button>
              )}
            </>
          )}
        </div>
      }
    >
      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="p-3 bg-white border-b border-slate-200">
          {renderSignOffSelector(
            currentReport
              ? currentReport.status !== 'draft' && currentReport.status !== 'rejected'
              : false,
          )}
        </div>

        <div className="flex-1 min-h-[700px] flex flex-col">
          <WordDocumentEditor
            value={editorHtml}
            onChange={setEditorHtml}
            documentTitle={title || `${engagement.title} — Audit Report`}
            engagementReference={engagement.referenceNumber}
            engagementTitle={
              selectedTemplate?.name ?? appliedTemplate?.name ?? 'Standard Audit Report Template'
            }
            classification="INTERNAL AUDIT CONFIDENTIAL"
            onSaveDraft={
              currentReport ? () => updateReportMut.mutate() : () => generate.mutate('draft')
            }
            savingDraft={currentReport ? updateReportMut.isPending : generate.isPending}
            minHeight="640px"
          />
        </div>

        {approveOpen && approval.data && canActOnCurrentApproval && (
          <div className="border-t border-slate-200 bg-white p-4 shadow-lg">
            <ApproveSignPanel
              approvalId={approval.data.id}
              entityType="audit_report"
              reportFields={{
                executiveSummary: currentReport?.executiveSummary ?? '',
                scope: currentReport?.scope ?? '',
                methodology: currentReport?.methodology ?? '',
              }}
              onDone={() => {
                setApproveOpen(false);
                refresh();
              }}
            />
          </div>
        )}
      </div>
    </DocumentWorkspaceModal>
  );

  // ─────────── Pre-Generation View (Word-like Report Authoring) ───────────
  if (!report.data) {
    return (
      <>
        <Card>
          <CardHeader
            title="Audit Report — Word Document Editor"
            subtitle="Select a report template to load its section headers, review auto-appended findings & auditee responses, insert images or tables, and save as draft."
            action={
              canGenerateReport ? (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  leftIcon={<FileEdit className="h-4 w-4" />}
                  onClick={() => setIsStudioOpen(true)}
                >
                  Open Word Document Studio
                </Button>
              ) : undefined
            }
          />
          {!canGenerateReport ? (
            <EmptyState
              icon={<FileText className="h-4 w-4" />}
              title="No audit report yet"
              description="An audit report can be generated by the lead auditor or audit administrator."
            />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  label={
                    <span className="inline-flex items-center gap-1">
                      Report template
                      <InfoHint content="Selecting a template automatically writes its section headers into the Word editor below, along with engagement findings and auditee responses." />
                    </span>
                  }
                >
                  <Select
                    value={selectedTemplateId}
                    onChange={(e) => handleTemplateChange(e.target.value)}
                  >
                    {(reportTemplates.data ?? []).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                        {t.isDefault ? ' (default)' : ''}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <FormField label="Report title" required>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter formal report title..."
                  />
                </FormField>
              </div>

              {renderSignOffSelector(false)}

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                <span>
                  <strong>{enrichedFindings.length}</strong> finding(s) and{' '}
                  <strong>
                    {enrichedFindings.filter((f) => Boolean(f.managementResponse)).length}
                  </strong>{' '}
                  auditee management response(s) are automatically included in this report draft.
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
                    onClick={handleResyncFindingsAndTemplate}
                  >
                    Re-sync Findings
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    leftIcon={<FileEdit className="h-3.5 w-3.5" />}
                    onClick={() => setIsStudioOpen(true)}
                  >
                    Open Full Studio
                  </Button>
                </div>
              </div>

              <WordDocumentEditor
                value={editorHtml}
                onChange={setEditorHtml}
                documentTitle={title || `${engagement.title} — Audit Report`}
                engagementReference={engagement.referenceNumber}
                engagementTitle={selectedTemplate?.name ?? 'Standard Audit Report Template'}
                classification="INTERNAL AUDIT CONFIDENTIAL"
                onSaveDraft={() => generate.mutate('draft')}
                savingDraft={generate.isPending}
                minHeight="540px"
              />

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  leftIcon={<Save className="h-4 w-4" />}
                  isLoading={generate.isPending}
                  onClick={() => generate.mutate('draft')}
                >
                  Save as Draft
                </Button>
                <Button
                  type="button"
                  leftIcon={<Sparkles className="h-4 w-4" />}
                  isLoading={generate.isPending}
                  onClick={() => generate.mutate('generate')}
                >
                  Generate Audit Report
                </Button>
              </div>
            </div>
          )}
        </Card>

        {renderStudioModal(null)}
      </>
    );
  }

  const r = report.data;
  const effectiveSignOffMode: ReportSignOffMode = r.signOffMode ?? signOffMode ?? 'cae_and_dg';

  const appliedTemplate =
    (reportTemplates.data ?? []).find((t) => t.id === (selectedTemplateId || r.templateId)) ??
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
  const previewClassification = readStr(tplHeader, 'classification', 'Confidential');
  const previewPrimary = normalizeHex(readStr(tplHeader, 'primaryColor', '#003087'), '#003087');

  const sectionTitle = (index: number, fallback: string): string => {
    const s = appliedTemplate?.sections?.[index];
    return s ? `${index + 1}. ${s.title}` : fallback;
  };

  const currentStep = approval.data?.steps?.find(
    (step) => step.level === approval.data?.currentLevel,
  );
  const canActOnCurrentApproval =
    approval.data?.status === 'pending' && currentStep?.approverId === session.id;

  const canEditInWord =
    (canUpdateReport && (r.status === 'draft' || r.status === 'rejected')) ||
    Boolean(canActOnCurrentApproval);

  const finalApproverName = (() => {
    if (approval.data?.steps && approval.data.steps.length > 0) {
      const highestStep = [...approval.data.steps].sort((a, b) => b.level - a.level)[0];
      if (highestStep?.approver?.displayName) return highestStep.approver.displayName;
    }
    if (approvalChain.data?.levels && approvalChain.data.levels.length > 0) {
      const highestLevel = [...approvalChain.data.levels].sort((a, b) => b.level - a.level)[0];
      if (highestLevel.resolvedApprover?.displayName)
        return highestLevel.resolvedApprover.displayName;
      if (highestLevel.candidates.length > 0) return highestLevel.candidates[0].displayName;
    }
    return effectiveSignOffMode === 'cae_only'
      ? 'Head of Internal Audit (CAE)'
      : 'Director General / MD';
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
            (step.level === 1
              ? 'Head of Unit / Audit Manager'
              : step.level === 2
                ? 'Head of Internal Audit (CAE)'
                : 'Director General / CEO');
          const isPendingCurrent =
            approval.data?.status === 'pending' && step.level === approval.data.currentLevel;
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
            (lvl.candidates.length > 1
              ? lvl.candidates.map((c) => c.displayName).join(', ')
              : 'Eligible Approver');
          const position =
            lvl.resolvedApprover?.jobTitle ||
            (lvl.level === 1
              ? 'Head of Unit / Audit Manager'
              : lvl.level === 2
                ? 'Head of Internal Audit (CAE)'
                : 'Director General / CEO');
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

    const baseRows = [
      {
        level: 1,
        id: 'fallback-1',
        name: engagement.auditManagerName || 'Head of Unit (Audit Manager)',
        position: 'Head of Unit / Audit Manager',
        status: 'upcoming',
        signatureId: null,
        actedAt: null,
        isPendingCurrent: false,
      },
      {
        level: 2,
        id: 'fallback-2',
        name: 'Head of Internal Audit (CAE)',
        position: 'Head of Internal Audit',
        status: 'upcoming',
        signatureId: null,
        actedAt: null,
        isPendingCurrent: false,
      },
    ];

    if (effectiveSignOffMode !== 'cae_only') {
      baseRows.push({
        level: 3,
        id: 'fallback-3',
        name: 'Director General / CEO',
        position: 'Director General / MD',
        status: 'upcoming',
        signatureId: null,
        actedAt: null,
        isPendingCurrent: false,
      });
    }

    return baseRows;
  })();

  const commentsList = commentsQuery.data ?? r.comments ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-text-primary">{r.title}</h3>
              <StatusBadge status={r.status} explain="report" />
              <Badge tone="gray">v{r.version}</Badge>
              <Badge tone={effectiveSignOffMode === 'cae_only' ? 'blue' : 'purple'}>
                {effectiveSignOffMode === 'cae_only'
                  ? 'Sign-Off: Head of Internal Audit'
                  : 'Sign-Off: Head of Audit + DG'}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-text-secondary">
              {r.issuedAt
                ? `Issued ${formatRelative(r.issuedAt)} by ${r.issuedByName ?? '—'}`
                : 'Not yet issued'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-md border border-border bg-slate-100/80 p-0.5 mr-2">
              {canEditInWord && (
                <button
                  type="button"
                  onClick={() => setActiveView('editor')}
                  className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-all ${
                    activeView === 'editor'
                      ? 'bg-white text-text-primary shadow-sm'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <FileEdit className="h-3.5 w-3.5" />
                  Word Editor
                </button>
              )}
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
            </div>

            {canEditInWord && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<FileEdit className="h-4 w-4" />}
                onClick={() => setIsStudioOpen(true)}
              >
                Open Word Studio
              </Button>
            )}

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

            {canEditInWord && (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Save className="h-4 w-4" />}
                onClick={() => updateReportMut.mutate()}
                isLoading={updateReportMut.isPending}
              >
                Save Draft
              </Button>
            )}

            {canSubmitReport && (r.status === 'draft' || r.status === 'rejected') && (
              <Button
                leftIcon={<Send className="h-4 w-4" />}
                size="sm"
                onClick={() => submitMut.mutate()}
                isLoading={submitMut.isPending}
              >
                Submit for approval
              </Button>
            )}
            {r.status === 'submitted' && canActOnCurrentApproval && (
              <>
                {canApproveApproval && (
                  <Button
                    variant="success"
                    size="sm"
                    leftIcon={<Check className="h-4 w-4" />}
                    onClick={() => setApproveOpen((v) => !v)}
                  >
                    Approve &amp; Sign
                  </Button>
                )}
                {canRejectApproval && (
                  <Button
                    variant="danger"
                    size="sm"
                    leftIcon={<X className="h-4 w-4" />}
                    onClick={() => setIsRejectModalOpen(true)}
                  >
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

      {/* ─────────── Word Editor View ─────────── */}
      {activeView === 'editor' && canEditInWord ? (
        <Card>
          <CardHeader
            title="Microsoft Word-Style Report Editor"
            subtitle="Edit the audit report with full formatting, tables, inline images, margins, and template headers. Click Save as Draft at any time."
            action={
              <Button
                variant="primary"
                size="sm"
                leftIcon={<FileEdit className="h-4 w-4" />}
                onClick={() => setIsStudioOpen(true)}
              >
                Open Word Document Studio
              </Button>
            }
          />
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField label="Report template">
                <Select
                  value={selectedTemplateId || r.templateId || ''}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                >
                  {(reportTemplates.data ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.isDefault ? ' (default)' : ''}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Report title">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </FormField>
            </div>

            {renderSignOffSelector(r.status !== 'draft' && r.status !== 'rejected')}

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              <span>
                <strong>{enrichedFindings.length}</strong> finding(s) &amp;{' '}
                <strong>
                  {enrichedFindings.filter((f) => Boolean(f.managementResponse)).length}
                </strong>{' '}
                auditee response(s) linked to this engagement.
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
                onClick={handleResyncFindingsAndTemplate}
              >
                Re-sync Findings &amp; Auditee Responses into Document
              </Button>
            </div>

            <WordDocumentEditor
              value={editorHtml}
              onChange={setEditorHtml}
              documentTitle={title || r.title}
              engagementReference={engagement.referenceNumber}
              engagementTitle={appliedTemplate?.name ?? 'Standard Audit Report Template'}
              classification={previewClassification.toUpperCase()}
              onSaveDraft={() => updateReportMut.mutate()}
              savingDraft={updateReportMut.isPending}
              minHeight="560px"
            />
          </div>
        </Card>
      ) : activeView === 'cards' ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Executive summary" />
            <RichSectionViewer content={r.executiveSummary} />
          </Card>
          <Card>
            <CardHeader title="Scope" />
            <RichSectionViewer content={r.scope} />
          </Card>
          <Card>
            <CardHeader title="Methodology" />
            <RichSectionViewer content={r.methodology} />
          </Card>
          <Card>
            <CardHeader title="Findings &amp; Auditee Responses" />
            {enrichedFindings.length === 0 ? (
              <p className="text-xs text-text-muted">No findings.</p>
            ) : (
              <ul className="space-y-3">
                {enrichedFindings.map((f) => (
                  <li
                    key={f.id}
                    className="rounded-md border border-border bg-slate-50/60 p-2.5 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-text-primary">{f.title}</span>
                      <StatusBadge status={f.severity} size="xs" />
                    </div>
                    <p className="text-text-secondary line-clamp-2">{f.description}</p>
                    <div className="pt-1 text-[11px] text-slate-700 border-t border-slate-200/80">
                      <span className="font-semibold">Auditee Response: </span>
                      {f.managementResponse ? (
                        <span>{f.managementResponse}</span>
                      ) : (
                        <span className="italic text-text-muted">
                          Awaiting response from {f.auditeeName || engagement.auditeeName || 'auditee'}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      ) : (
        /* ─────────── Formal GBB A4 Document Preview ─────────── */
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

          {/* Formal Title Box */}
          <div className="border-y-4 border-[#4F6228] bg-slate-50/80 py-8 px-6 text-center space-y-3 rounded-sm my-6 shadow-xs">
            <h1
              className="text-2xl sm:text-3xl font-extrabold tracking-tight uppercase"
              style={{ color: previewPrimary }}
            >
              {r.title}
            </h1>
            <div className="text-sm font-semibold text-slate-600">Version {r.version}.0</div>
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
              No part of this document may be disclosed verbally or in writing, including by
              reproduction, to any third party without the prior written consent of Galaxy Backbone
              Limited. This document, its associated appendices and any attachments remain the
              property of Galaxy Backbone Limited and shall be returned upon request.
            </p>
          </div>

          {/* Table 1: Document Information */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold tracking-wide text-slate-900 uppercase">
              Document Information
            </h3>
            <div className="overflow-hidden border border-slate-300 rounded-sm">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <tbody className="divide-y divide-slate-200 bg-white">
                  <tr>
                    <td className="px-4 py-2 font-bold bg-slate-100 text-slate-700 w-2/5 border-r border-slate-200">
                      Document ID:
                    </td>
                    <td className="px-4 py-2 font-mono text-slate-900">
                      {engagement.referenceNumber}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-bold bg-slate-100 text-slate-700 border-r border-slate-200">
                      Document Version:
                    </td>
                    <td className="px-4 py-2 text-slate-900 font-medium">Version {r.version}.0</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-bold bg-slate-100 text-slate-700 border-r border-slate-200">
                      Date of Version:
                    </td>
                    <td className="px-4 py-2 text-slate-900">
                      {r.issuedAt ? formatDate(r.issuedAt) : formatDate(r.updatedAt || new Date())}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-bold bg-slate-100 text-slate-700 border-r border-slate-200">
                      Document Division:
                    </td>
                    <td className="px-4 py-2 text-slate-900">
                      {engagement.universeName || 'Internal Audit & Assurance'}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-bold bg-slate-100 text-slate-700 border-r border-slate-200">
                      Document Owner:
                    </td>
                    <td className="px-4 py-2 text-slate-900">
                      {engagement.leadAuditorName || 'Lead Auditor'}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-bold bg-slate-100 text-slate-700 border-r border-slate-200">
                      Document Author:
                    </td>
                    <td className="px-4 py-2 text-slate-900">
                      {engagement.leadAuditorName || 'Internal Audit Team'}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-bold bg-slate-100 text-slate-700 border-r border-slate-200">
                      Approved by:
                    </td>
                    <td className="px-4 py-2 font-semibold text-slate-900">{finalApproverName}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-bold bg-slate-100 text-slate-700 border-r border-slate-200">
                      Sign-Off Mode:
                    </td>
                    <td className="px-4 py-2 font-medium text-slate-900">
                      {effectiveSignOffMode === 'cae_only'
                        ? 'Head of Internal Audit (1 Executive Sign-Off)'
                        : 'Head of Internal Audit + Director General (2 Executive Sign-Offs)'}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-bold bg-slate-100 text-slate-700 border-r border-slate-200">
                      Document Classification:
                    </td>
                    <td className="px-4 py-2 font-bold text-danger uppercase tracking-wider">
                      {previewClassification}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-bold bg-slate-100 text-slate-700 border-r border-slate-200">
                      Document Status:
                    </td>
                    <td className="px-4 py-2 font-semibold uppercase text-slate-900">{r.status}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 2: Change History */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold tracking-wide text-slate-900 uppercase">
              Change history
            </h3>
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
                    <td className="px-4 py-2 border-r border-slate-200">
                      {engagement.actualStartDate
                        ? formatDate(engagement.actualStartDate)
                        : formatDate(r.createdAt)}
                    </td>
                    <td className="px-4 py-2 border-r border-slate-200">
                      {engagement.leadAuditorName || 'Lead Auditor'}
                    </td>
                    <td className="px-4 py-2">Initial audit report draft formulation</td>
                  </tr>
                  {r.version > 1 && (
                    <tr>
                      <td className="px-4 py-2 font-medium border-r border-slate-200">
                        Version {r.version}.0
                      </td>
                      <td className="px-4 py-2 border-r border-slate-200">
                        {r.issuedAt ? formatDate(r.issuedAt) : formatDate(r.updatedAt)}
                      </td>
                      <td className="px-4 py-2 border-r border-slate-200">
                        {engagement.leadAuditorName || 'Audit Team'}
                      </td>
                      <td className="px-4 py-2">Report revisions and formal approval cycle</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 3: Distribution List */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold tracking-wide text-slate-900 uppercase">
              Distribution List
            </h3>
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
                    <td className="px-4 py-2 font-medium border-r border-slate-200">
                      Board Audit Committee &amp; Executive Management
                    </td>
                    <td className="px-4 py-2 border-r border-slate-200">Version {r.version}.0</td>
                    <td className="px-4 py-2">
                      {r.issuedAt ? formatDate(r.issuedAt) : formatDate(r.updatedAt || new Date())}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-medium border-r border-slate-200">
                      Audited Entity ({engagement.universeName || 'Business Unit'}) —{' '}
                      {engagement.auditeeName || 'Auditee'}
                    </td>
                    <td className="px-4 py-2 border-r border-slate-200">Version {r.version}.0</td>
                    <td className="px-4 py-2">
                      {r.issuedAt ? formatDate(r.issuedAt) : formatDate(r.updatedAt || new Date())}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 4: Approval List with Interactive Append Signature */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold tracking-wide text-slate-900 uppercase">
                Approval List
              </h3>
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
                    <th className="px-4 py-2 text-center border-r border-slate-200 w-1/3">
                      Signature
                    </th>
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
                              <span className="font-serif italic text-base text-slate-800">
                                {row.name}
                              </span>
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
                                toast.info('Approve & Sign panel opened above');
                              }}
                              className="shadow-sm font-semibold text-xs"
                            >
                              Append Signature
                            </Button>
                            <span className="text-[10px] text-emerald-700 font-medium">
                              Ready for your sign-off
                            </span>
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
                        {row.actedAt
                          ? formatDate(row.actedAt)
                          : row.status === 'approved'
                            ? formatDate(r.updatedAt)
                            : '—'}
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
            The contents of this document are subject to change control. Any proposed amendments
            should be submitted to the Document Owner for review and approval prior to
            implementation.
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
              <li>{sectionTitle(3, 'Findings Summary & Detailed Findings (with Auditee Responses)')}</li>
              {scopeAssets.length > 0 && <li>Assets in Scope</li>}
              <li>Validity and Document Management</li>
            </ol>
          </div>

          {/* Document Sections */}
          <div className="space-y-6 pt-4 border-t-2 border-slate-200">
            {/* Section 1: Executive Summary */}
            <div className="space-y-2">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-1.5 uppercase tracking-wide">
                {sectionTitle(0, '1. Executive Summary')}
              </h2>
              <RichSectionViewer
                content={r.executiveSummary}
                emptyText="No executive summary provided."
              />
            </div>

            {/* Section 2: Scope */}
            <div className="space-y-2">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-1.5 uppercase tracking-wide">
                {sectionTitle(1, '2. Audit Scope')}
              </h2>
              <RichSectionViewer content={r.scope} emptyText="No scope details specified." />
            </div>

            {/* Section 3: Methodology */}
            <div className="space-y-2">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-1.5 uppercase tracking-wide">
                {sectionTitle(2, '3. Methodology')}
              </h2>
              <RichSectionViewer
                content={r.methodology}
                emptyText="No methodology notes entered."
              />
            </div>

            {/* Section 4: Findings Summary & Detailed Findings with Auditee Responses */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-1.5 uppercase tracking-wide">
                {sectionTitle(
                  3,
                  '4. Findings Summary & Detailed Findings (with Auditee Management Responses)',
                )}
              </h2>
              {enrichedFindings.length === 0 ? (
                <p className="text-xs text-slate-500 italic pl-1">
                  No findings were identified during the course of this engagement.
                </p>
              ) : (
                <>
                  <div className="overflow-hidden border border-slate-300 rounded-sm">
                    <table className="min-w-full divide-y divide-slate-200 text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th
                            scope="col"
                            className="px-3 py-2 text-left border-r border-slate-200"
                          >
                            Ref
                          </th>
                          <th
                            scope="col"
                            className="px-3 py-2 text-left border-r border-slate-200"
                          >
                            Finding Title
                          </th>
                          <th
                            scope="col"
                            className="px-3 py-2 text-center border-r border-slate-200"
                          >
                            Severity
                          </th>
                          <th
                            scope="col"
                            className="px-3 py-2 text-left border-r border-slate-200"
                          >
                            Auditee Owner
                          </th>
                          <th scope="col" className="px-3 py-2 text-center">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {enrichedFindings.map((f, idx) => (
                          <tr key={f.id} className="hover:bg-slate-50/50">
                            <td className="px-3 py-2 font-medium text-slate-500 border-r border-slate-200">
                              {idx + 1}
                            </td>
                            <td className="px-3 py-2 text-slate-900 font-medium border-r border-slate-200">
                              {f.title}
                            </td>
                            <td className="px-3 py-2 text-center border-r border-slate-200">
                              <StatusBadge status={f.severity} size="xs" />
                            </td>
                            <td className="px-3 py-2 text-slate-700 border-r border-slate-200">
                              {f.auditeeName || engagement.auditeeName || '—'}
                            </td>
                            <td className="px-3 py-2 text-center capitalize text-slate-600">
                              {f.status?.replace('_', ' ')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Detailed Finding Cards with Auditee Management Responses */}
                  <div className="space-y-4 pt-2">
                    {enrichedFindings.map((f, idx) => (
                      <div
                        key={f.id}
                        className="rounded-md border border-slate-300 bg-white p-4 space-y-2 text-xs shadow-2xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                          <span className="font-bold text-slate-900 text-sm">
                            Finding {idx + 1}: {f.title}
                          </span>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={f.severity} size="xs" />
                            <Badge tone="gray">{f.status?.replace(/_/g, ' ')}</Badge>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-600 bg-slate-50 p-2 rounded">
                          <div>
                            <span className="font-semibold text-slate-800">Category: </span>
                            <span className="capitalize">{f.category?.replace(/_/g, ' ')}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-800">Auditee Owner: </span>
                            <span>{f.auditeeName || engagement.auditeeName || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-800">Target Due Date: </span>
                            <span>{f.dueDate ? formatDate(f.dueDate) : '—'}</span>
                          </div>
                        </div>

                        <p>
                          <strong className="text-slate-900">Observation / Description: </strong>
                          {f.description || '—'}
                        </p>
                        {f.rootCause && (
                          <p>
                            <strong className="text-slate-900">Root Cause: </strong>
                            {f.rootCause}
                          </p>
                        )}
                        {f.riskImplication && (
                          <p>
                            <strong className="text-slate-900">Risk Implication: </strong>
                            {f.riskImplication}
                          </p>
                        )}
                        {f.recommendation && (
                          <p>
                            <strong className="text-slate-900">Recommendation: </strong>
                            {f.recommendation}
                          </p>
                        )}

                        <div className="mt-2 rounded border-l-4 border-[#003087] bg-blue-50/50 p-2.5">
                          <div className="font-bold text-[#003087]">
                            Auditee Management Response:
                          </div>
                          <p className="mt-0.5 text-slate-800 whitespace-pre-wrap">
                            {f.managementResponse ||
                              'Awaiting formal management response from auditee.'}
                          </p>
                          {f.managementResponseAt && (
                            <p className="mt-1 text-[10px] italic text-slate-500">
                              Submitted on {formatDate(f.managementResponseAt)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
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
                        <th scope="col" className="px-4 py-2 text-left border-r border-slate-200">
                          Tag
                        </th>
                        <th scope="col" className="px-4 py-2 text-left border-r border-slate-200">
                          Name
                        </th>
                        <th scope="col" className="px-4 py-2 text-left border-r border-slate-200">
                          Type
                        </th>
                        <th scope="col" className="px-4 py-2 text-center">
                          Criticality
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {scopeAssets.map((a) => (
                        <tr key={a.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-2 font-medium text-slate-900 border-r border-slate-200">
                            {a.assetTag}
                          </td>
                          <td className="px-4 py-2 text-slate-700 border-r border-slate-200">
                            {a.name}
                          </td>
                          <td className="px-4 py-2 capitalize text-slate-600 border-r border-slate-200">
                            {a.assetType?.replace(/_/g, ' ')}
                          </td>
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
                {scopeAssets.length > 0
                  ? '6. Validity and Document Management'
                  : '5. Validity and Document Management'}
              </h2>
              <p className="text-xs leading-relaxed text-slate-700 pl-1">
                This document was last reviewed on{' '}
                {r.issuedAt ? formatDate(r.issuedAt) : formatDate(r.updatedAt || new Date())}. This
                document remains valid and binding until superseded by a subsequent version approved
                through the Galaxy Backbone Limited internal approval matrix.
              </p>
            </div>
          </div>

          {/* Running Footer */}
          <div className="pt-6 mt-8 border-t border-slate-200 flex flex-wrap items-center justify-between text-[11px] text-slate-400">
            <span>
              {r.title} | Version {r.version}.0
            </span>
            <span>Galaxy Backbone Limited | {previewClassification}</span>
          </div>
        </div>
      )}

      {/* ─────────── Review Comments & Discussion Trail ─────────── */}
      <Card>
        <CardHeader
          title="Review Comments &amp; Discussion Trail"
          subtitle="Reviewers, approvers, and auditors can leave feedback or revision notes on this report. Posting a comment notifies the report author and engagement team."
        />
        <div className="space-y-4">
          {commentsList.length === 0 ? (
            <p className="text-xs text-text-muted italic">
              No review comments yet. Use the box below to add review notes or feedback.
            </p>
          ) : (
            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {commentsList.map((c) => (
                <div
                  key={c.id}
                  className="rounded-lg border border-border bg-slate-50/70 px-3.5 py-2.5 text-xs space-y-1"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-text-primary">{c.authorName}</span>
                      {c.authorRole && <Badge tone="gray">{c.authorRole}</Badge>}
                    </div>
                    <span className="text-[11px] text-text-muted">
                      {formatRelative(c.createdAt)}
                    </span>
                  </div>
                  <p className="text-text-secondary whitespace-pre-wrap">{c.body}</p>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2 pt-2 border-t border-border">
            <div className="flex-1">
              <Textarea
                rows={2}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write a review comment, question, or requested edit on this report..."
              />
            </div>
            <Button
              type="button"
              size="sm"
              leftIcon={<MessageSquare className="h-4 w-4" />}
              disabled={!commentText.trim()}
              isLoading={addCommentMut.isPending}
              onClick={() => {
                if (commentText.trim()) {
                  addCommentMut.mutate(commentText.trim());
                }
              }}
            >
              Post Comment
            </Button>
          </div>
        </div>
      </Card>

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

      {renderStudioModal(r)}
    </div>
  );
};
