import * as fs from 'fs';
import * as path from 'path';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableCell,
  TableRow,
  AlignmentType,
  BorderStyle,
  WidthType,
  VerticalAlign,
  Footer,
  PageNumber,
  convertInchesToTwip,
  ShadingType,
  ImageRun,
} from 'docx';
import type { Content, TableCell as PdfTableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import { format as formatDate } from 'date-fns';
import { borderedTableLayout, hexColor, mm, renderPdf, severityBadge } from '../../../../../shared/utils/pdf.util';
import { htmlFragmentToMarkdownAndImages } from '../../../working-papers/utility/working-paper.utility';
import { markdownToPdfContent } from '../../../working-papers/utility/markdown.utility';
import { prisma } from '../../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../../shared/errors/app.error';
import { logger } from '../../../../../shared/utils/logger.util';
import { IReportTemplateService } from '../../../../settings/service/interface/report-template.service.interface';
import { ISystemConfigService } from '../../../../settings/service/interface/system-config.service.interface';
import { IApprovalService } from '../../../../workflow/approval/service/interface/approval.service.interface';
import { WorkflowEntityType } from '../../../../workflow/domain/enum/workflow.enum';
import { ApprovalResponseDto } from '../../../../workflow/approval/dto/response/approval.response.dto';
import { ReportTemplateResponseDto } from '../../../../settings/dto/response/settings.response.dto';
import { DocumentService } from '../../../../document';
import { IDocumentService } from '../../../../document/service/interface/document.service.interface';
import { IReportGenerationService } from '../interface/report-generation.service.interface';

const GBB_LOGO_PATH = path.resolve(__dirname, '../../../../../assets/gbb-logo.png');
let cachedLogoBuffer: Buffer | null = null;
const getGbbLogoBuffer = (): Buffer | null => {
  if (cachedLogoBuffer) return cachedLogoBuffer;
  try {
    if (fs.existsSync(GBB_LOGO_PATH)) {
      cachedLogoBuffer = fs.readFileSync(GBB_LOGO_PATH);
      return cachedLogoBuffer;
    }
  } catch (err) {
    logger.warn('Could not read GBB logo file', { err });
  }
  return null;
};

/** Resolved approver signature images, keyed by approval step id. */
type StepSignatureMap = Map<string, { buffer: Buffer; dataUrl: string; type: 'png' | 'jpg' }>;

// ────────────────────────────────────────────────────────────
// Local types
// ────────────────────────────────────────────────────────────

interface ReportUserBrief {
  displayName: string | null;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
}

interface ReportFinding {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  rootCause: string;
  riskImplication: string;
  recommendation: string;
  status: string;
  dueDate: Date;
  controlReference?: string | null;
  auditee: { displayName: string | null; firstName: string; lastName: string };
  followUp: {
    managementResponse: string | null;
    managementResponseBy: { displayName: string | null; firstName: string; lastName: string } | null;
    managementResponseAt: Date | null;
    verificationStatus: string;
    verifiedBy: { displayName: string | null; firstName: string; lastName: string } | null;
    verifiedAt: Date | null;
    verificationNotes: string | null;
  } | null;
}

interface ReportData {
  report: {
    id: string;
    title: string;
    executiveSummary: string;
    scope: string;
    methodology: string;
    status: string;
    versionNumber: number;
    issuedAt: Date | null;
    createdById: string;
    templateId: string | null;
    signOffMode?: 'cae_only' | 'cae_and_dg';
  };
  engagement: {
    id: string;
    referenceNumber: string;
    title: string;
    auditType: string;
    plannedStartDate: Date;
    plannedEndDate: Date;
    actualStartDate: Date | null;
    universe: { name: string };
    leadAuditor: ReportUserBrief;
    auditManager: ReportUserBrief;
    auditee: ReportUserBrief;
  };
  findings: ReportFinding[];
  assetsInScope: ReportAsset[];
}

interface ReportAsset {
  assetTag: string;
  name: string;
  assetType: string;
  criticality: string;
  scopeRole: string;
}

interface TemplateConfig {
  template: ReportTemplateResponseDto;
  orgName: string;
  orgAddress: string;
  footerNotice: string;
}

interface RenderHeaderConfig {
  orgName: string;
  orgAddress: string;
  reportTitle: string;
  classification: string;
  primaryColor: string;
  accentColor: string;
}

// ────────────────────────────────────────────────────────────
// Severity ordering & colours
// ────────────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<string, number> = {
  critical: 1,
  high: 2,
  medium: 3,
  low: 4,
  informational: 5,
};

/** "excluded_reference" → "Excluded Reference"; leaves already-readable text alone. */
const titleCase = (value: string): string =>
  value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const SEVERITY_COLOURS: Record<string, { bg: string; text: string }> = {
  critical: { bg: 'DC2626', text: 'FFFFFF' },
  high: { bg: 'EA580C', text: 'FFFFFF' },
  medium: { bg: 'CA8A04', text: '000000' },
  low: { bg: '16A34A', text: 'FFFFFF' },
  informational: { bg: '64748B', text: 'FFFFFF' },
};

const AUDIT_TYPE_LABEL: Record<string, string> = {
  it: 'IT Audit',
  financial: 'Financial Audit',
  compliance: 'Compliance Audit',
  systems: 'Systems Audit',
};

const FINDING_CATEGORY_LABEL: Record<string, string> = {
  it: 'IT',
  financial: 'Financial',
  compliance: 'Compliance',
  systems: 'Systems',
  operational: 'Operational',
};

const FINDING_STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  management_response_received: 'Management Response Received',
  in_remediation: 'In Remediation',
  verified: 'Verified',
  pending_closure: 'Pending Closure',
  closed: 'Closed',
};

// ────────────────────────────────────────────────────────────
// Service
// ────────────────────────────────────────────────────────────

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readString = (
  record: Record<string, unknown>,
  key: string,
  fallback: string,
): string => {
  const value = record[key];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
};

const readColor = (
  record: Record<string, unknown>,
  key: string,
  fallback: string,
): string => {
  const value = readString(record, key, fallback).replace(/^#/, '').trim();
  return /^[0-9a-fA-F]{6}$/.test(value) ? value.toUpperCase() : fallback;
};

const readNestedLabel = (
  record: Record<string, unknown>,
  key: string,
  fallback: string,
): string => {
  const nested = record[key];
  if (!isPlainRecord(nested)) return fallback;
  return readString(nested, 'label', fallback);
};

export class ReportGenerationService implements IReportGenerationService {
  constructor(
    private readonly reportTemplateService: IReportTemplateService,
    private readonly systemConfigService: ISystemConfigService,
    private readonly approvalService: IApprovalService,
    private readonly documentService: IDocumentService = new DocumentService(),
  ) {}

  /** Load each approved step's recorded signature image, keyed by step id. Never throws. */
  private async _stepSignatures(approval: ApprovalResponseDto | null): Promise<StepSignatureMap> {
    const map: StepSignatureMap = new Map();
    for (const step of approval?.steps ?? []) {
      if (step.status !== 'approved' || !step.signatureId) continue;
      try {
        const sig = await prisma.user_Signature.findUnique({ where: { id: step.signatureId } });
        if (!sig) continue;
        const file = await this.documentService.getFileById(sig.document_id);
        map.set(step.id, {
          buffer: file.buffer,
          dataUrl: `data:${file.mimeType};base64,${file.buffer.toString('base64')}`,
          type: file.mimeType === 'image/jpeg' ? 'jpg' : 'png',
        });
      } catch {
        // Skip this approver's image; the text block still renders.
      }
    }
    return map;
  }

  /** The first reviewer (lowest approved level) and final approver (highest approved level). */
  private _signOffSteps(
    approval: ApprovalResponseDto | null,
  ): { reviewedStepId?: string; approvedStepId?: string } {
    const approved = (approval?.steps ?? [])
      .filter((s) => s.status === 'approved')
      .sort((a, b) => a.level - b.level);
    if (approved.length === 0) return {};
    const approvedStepId = approved[approved.length - 1].id;
    const reviewedStepId = approved.length > 1 ? approved[0].id : undefined;
    return { reviewedStepId, approvedStepId };
  }

  // ─────────── Data fetching ───────────

  async fetchReportData(reportId: string): Promise<ReportData> {
    const report = await prisma.audit_Report.findFirst({
      where: { id: reportId, deleted_at: null },
      include: {
        engagement: {
          include: {
            universe: { select: { name: true } },
            lead_auditor: {
              select: { display_name: true, first_name: true, last_name: true, job_title: true },
            },
            audit_manager: {
              select: { display_name: true, first_name: true, last_name: true, job_title: true },
            },
            auditee: {
              select: { display_name: true, first_name: true, last_name: true, job_title: true },
            },
            findings: {
              where: { deleted_at: null },
              include: {
                auditee: { select: { display_name: true, first_name: true, last_name: true } },
                checklist: { select: { control_reference: true } },
                follow_up: {
                  include: {
                    management_response_by: {
                      select: { display_name: true, first_name: true, last_name: true },
                    },
                    verified_by: {
                      select: { display_name: true, first_name: true, last_name: true },
                    },
                  },
                },
              },
            },
            asset_links: {
              where: { asset: { deleted_at: null } },
              include: {
                asset: { select: { asset_tag: true, name: true, asset_type: true, criticality: true } },
              },
              orderBy: { scope_role: 'asc' },
            },
          },
        },
      },
    });

    if (!report) throw AppError.notFound('Audit report');

    let signOffMode: 'cae_only' | 'cae_and_dg' = 'cae_and_dg';
    try {
      const modeRow = await prisma.system_Config.findUnique({
        where: { key: `report.sign_off_mode.${reportId}` },
        select: { value: true },
      });
      if (modeRow?.value === 'cae_only' || modeRow?.value === 'cae_and_dg') {
        signOffMode = modeRow.value;
      }
    } catch {
      // Fallback to default
    }

    const sortedFindings = [...report.engagement.findings].sort(
      (a, b) => (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99),
    );

    return {
      report: {
        id: report.id,
        title: report.title,
        executiveSummary: report.executive_summary,
        scope: report.scope,
        methodology: report.methodology,
        status: report.status,
        versionNumber: report.version_number,
        issuedAt: report.issued_at,
        createdById: report.created_by_id,
        templateId: report.template_id ?? null,
        signOffMode,
      },
      engagement: {
        id: report.engagement.id,
        referenceNumber: report.engagement.reference_number,
        title: report.engagement.title,
        auditType: report.engagement.audit_type,
        plannedStartDate: report.engagement.planned_start_date,
        plannedEndDate: report.engagement.planned_end_date,
        actualStartDate: report.engagement.actual_start_date,
        universe: { name: report.engagement.universe.name },
        leadAuditor: {
          displayName: report.engagement.lead_auditor.display_name,
          firstName: report.engagement.lead_auditor.first_name,
          lastName: report.engagement.lead_auditor.last_name,
          jobTitle: report.engagement.lead_auditor.job_title,
        },
        auditManager: {
          displayName: report.engagement.audit_manager.display_name,
          firstName: report.engagement.audit_manager.first_name,
          lastName: report.engagement.audit_manager.last_name,
          jobTitle: report.engagement.audit_manager.job_title,
        },
        auditee: {
          displayName: report.engagement.auditee.display_name,
          firstName: report.engagement.auditee.first_name,
          lastName: report.engagement.auditee.last_name,
          jobTitle: report.engagement.auditee.job_title,
        },
      },
      findings: sortedFindings.map((f) => ({
        id: f.id,
        title: f.title,
        description: f.description,
        category: f.category,
        severity: f.severity,
        rootCause: f.root_cause,
        riskImplication: f.risk_implication,
        recommendation: f.recommendation,
        status: f.status,
        dueDate: f.due_date,
        controlReference: (f as { checklist?: { control_reference?: string } | null }).checklist?.control_reference ?? null,
        auditee: {
          displayName: f.auditee.display_name,
          firstName: f.auditee.first_name,
          lastName: f.auditee.last_name,
        },
        followUp: f.follow_up
          ? {
              managementResponse: f.follow_up.management_response,
              managementResponseBy: f.follow_up.management_response_by
                ? {
                    displayName: f.follow_up.management_response_by.display_name,
                    firstName: f.follow_up.management_response_by.first_name,
                    lastName: f.follow_up.management_response_by.last_name,
                  }
                : null,
              managementResponseAt: f.follow_up.management_response_at,
              verificationStatus: f.follow_up.verification_status,
              verifiedBy: f.follow_up.verified_by
                ? {
                    displayName: f.follow_up.verified_by.display_name,
                    firstName: f.follow_up.verified_by.first_name,
                    lastName: f.follow_up.verified_by.last_name,
                  }
                : null,
              verifiedAt: f.follow_up.verified_at,
              verificationNotes: f.follow_up.verification_notes,
            }
          : null,
      })),
      assetsInScope: report.engagement.asset_links.map((link) => ({
        assetTag: link.asset.asset_tag,
        name: link.asset.name,
        assetType: link.asset.asset_type,
        criticality: link.asset.criticality,
        scopeRole: link.scope_role,
      })),
    };
  }

  async fetchTemplateAndConfig(templateId?: string | null): Promise<TemplateConfig> {
    let template;
    if (templateId) {
      try {
        template = await this.reportTemplateService.getTemplateById(templateId);
      } catch {
        template = await this.reportTemplateService.getDefaultTemplate();
      }
    } else {
      template = await this.reportTemplateService.getDefaultTemplate();
    }
    const configs = await this.systemConfigService.getAllConfig(false);
    const configMap = new Map(configs.map((c) => [c.key, c.value]));
    return {
      template,
      orgName: configMap.get('org_name') ?? 'Galaxy Backbone Limited',
      orgAddress: configMap.get('org_address') ?? '',
      footerNotice: configMap.get('report_footer_notice') ?? '',
    };
  }

  // ─────────── DOCX generation ───────────

  async generateDocx(reportId: string): Promise<Buffer> {
    const data = await this.fetchReportData(reportId);
    const config = await this.fetchTemplateAndConfig(data.report.templateId);
    let approval: ApprovalResponseDto | null = null;
    try {
      approval = await this.approvalService.getApprovalByEntity(WorkflowEntityType.AuditReport, reportId);
    } catch {
      approval = null;
    }
    const sigMap = await this._stepSignatures(approval);
    const doc = this._buildDocxDocument(data, config, approval, sigMap);
    const uint8Array = await Packer.toBuffer(doc);
    return Buffer.from(uint8Array);
  }

  private _buildDocxDocument(
    data: ReportData,
    config: TemplateConfig,
    approval: ApprovalResponseDto | null,
    sigMap: StepSignatureMap,
  ): Document {
    const children: (Paragraph | Table)[] = [];
    const header = this._getHeaderConfig(config);
    const footerNotice = this._getFooterNotice(config);

    // Cover Page Header (GBB Logo + Company name + Title Box + Confidentiality Callout)
    children.push(...this._buildDocxCoverHeader(data, header));

    // Table 1: Document Information Table
    children.push(...this._buildDocxDocumentInfoTable(data, header.classification, approval));

    // Table 2: Change History Table
    children.push(...this._buildDocxChangeHistoryTable(data));

    // Table 3: Distribution List Table
    children.push(...this._buildDocxDistributionTable(data));

    // Table 4: Approval List Table
    children.push(...this._buildDocxApprovalListTable(approval, sigMap, data));

    // Change Control & Table of Contents
    children.push(...this._buildDocxChangeControlAndToc());

    // Page Break before main report body
    children.push(
      new Paragraph({
        pageBreakBefore: true,
        children: [],
      }),
    );

    // Sections
    config.template.sections.forEach((section, idx) => {
      children.push(
        new Paragraph({
          spacing: { before: 240, after: 120 },
          children: [
            new TextRun({
              text: `${idx + 1}. ${section.title}`,
              bold: true,
              size: 24,
              color: header.primaryColor,
            }),
          ],
        }),
      );
      children.push(...this._buildDocxSectionContent(section.key, data));
    });

    // Assets in scope — appended when the engagement has linked assets
    if (data.assetsInScope.length > 0) {
      children.push(
        new Paragraph({
          spacing: { before: 240, after: 120 },
          children: [
            new TextRun({
              text: `${config.template.sections.length + 1}. Assets in Scope`,
              bold: true,
              size: 24,
              color: header.primaryColor,
            }),
          ],
        }),
      );
      children.push(this._buildDocxAssetsInScopeTable(data.assetsInScope));
    }

    // Validity and Document Management section
    const validitySecNum = data.assetsInScope.length > 0 ? config.template.sections.length + 2 : config.template.sections.length + 1;
    children.push(
      new Paragraph({
        spacing: { before: 240, after: 120 },
        children: [
          new TextRun({
            text: `${validitySecNum}. Validity and Document Management`,
            bold: true,
            size: 24,
            color: header.primaryColor,
          }),
        ],
      }),
      new Paragraph({
        spacing: { after: 240 },
        children: [
          new TextRun({
            text: `This document was last reviewed on ${formatDate(data.report.issuedAt || new Date(), 'dd MMMM yyyy')}. This document remains valid and binding until superseded by a subsequent version approved through the Galaxy Backbone Limited internal approval matrix.`,
            size: 20,
            color: '334155',
          }),
        ],
      }),
    );

    // Footer notice
    children.push(
      new Paragraph({
        spacing: { before: 240 },
        children: [
          new TextRun({
            text: footerNotice,
            size: 18,
            color: '64748B',
            italics: true,
          }),
        ],
      }),
    );

    return new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: convertInchesToTwip(0.8),
                bottom: convertInchesToTwip(0.8),
                left: convertInchesToTwip(0.8),
                right: convertInchesToTwip(0.8),
              },
            },
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: `${footerNotice} - Page `,
                      size: 18,
                      color: '64748B',
                    }),
                    new TextRun({
                      children: [PageNumber.CURRENT],
                      size: 18,
                      color: '64748B',
                    }),
                    new TextRun({
                      text: ' of ',
                      size: 18,
                      color: '64748B',
                    }),
                    new TextRun({
                      children: [PageNumber.TOTAL_PAGES],
                      size: 18,
                      color: '64748B',
                    }),
                  ],
                }),
              ],
            }),
          },
          children,
        },
      ],
    });
  }

  private _buildDocxCoverHeader(data: ReportData, header: RenderHeaderConfig): (Paragraph | Table)[] {
    const items: (Paragraph | Table)[] = [];
    const logoBuf = getGbbLogoBuffer();
    if (logoBuf) {
      items.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 100, after: 120 },
          children: [
            new ImageRun({
              type: 'png',
              data: logoBuf,
              transformation: { width: 140, height: 98 },
            }),
          ],
        }),
      );
    }
    items.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 80, after: 180 },
        children: [
          new TextRun({
            text: 'Galaxy Backbone Limited',
            bold: true,
            size: 26,
            color: '334155',
          }),
        ],
      }),
    );

    // Title box (Table 1 in docx template) with 4F6228 border
    items.push(
      new Table({
        rows: [
          new TableRow({
            children: [
              new TableCell({
                shading: { fill: 'F8FAF8', type: ShadingType.SOLID },
                margins: { top: 240, bottom: 240, left: 240, right: 240 },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 100, after: 100 },
                    children: [
                      new TextRun({
                        text: data.report.title.toUpperCase(),
                        bold: true,
                        size: 32,
                        color: header.primaryColor,
                      }),
                    ],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 60, after: 100 },
                    children: [
                      new TextRun({
                        text: `Version ${data.report.versionNumber}.0`,
                        bold: true,
                        size: 22,
                        color: '475569',
                      }),
                    ],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 80, after: 40 },
                    children: [
                      new TextRun({
                        text: 'DOCUMENT REFERENCE NUMBER:',
                        bold: true,
                        size: 18,
                        color: '64748B',
                      }),
                    ],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 40, after: 100 },
                    children: [
                      new TextRun({
                        text: data.engagement.referenceNumber,
                        bold: true,
                        size: 22,
                        color: '0F172A',
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 24, color: '4F6228' },
          bottom: { style: BorderStyle.SINGLE, size: 24, color: '4F6228' },
          left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
          right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
          insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' },
          insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        },
      }),
    );

    // Confidentiality Notice
    items.push(
      new Paragraph({
        spacing: { before: 200, after: 180 },
        children: [
          new TextRun({ text: 'Confidentiality: ', bold: true, size: 19 }),
          new TextRun({
            text:
              'No part of this document may be disclosed verbally or in writing, including by reproduction, to any third party without the prior written consent of Galaxy Backbone Limited. This document, its associated appendices and any attachments remain the property of Galaxy Backbone Limited and shall be returned upon request.',
            size: 19,
            color: '334155',
          }),
        ],
      }),
    );

    return items;
  }

  private _buildDocxDocumentInfoTable(
    data: ReportData,
    classification: string,
    approval: ApprovalResponseDto | null,
  ): (Paragraph | Table)[] {
    let finalApproverName =
      data.report.signOffMode === 'cae_only'
        ? 'Head of Internal Audit (CAE)'
        : 'Managing Director / CEO';
    if (approval?.steps) {
      const approvedSteps = approval.steps.filter((s) => s.status === 'approved');
      if (approvedSteps.length > 0) {
        const highest = approvedSteps.reduce((max, s) => (s.level > max.level ? s : max));
        if (highest?.approver?.displayName) finalApproverName = highest.approver.displayName;
      }
    }

    const leadAuditorName =
      data.engagement.leadAuditor.displayName ??
      `${data.engagement.leadAuditor.firstName} ${data.engagement.leadAuditor.lastName}`.trim() ??
      'Internal Audit Team';

    const rows = [
      this._docxMetadataRow('Document ID:', data.engagement.referenceNumber),
      this._docxMetadataRow('Document Version:', `Version ${data.report.versionNumber}.0`),
      this._docxMetadataRow('Date of Version:', formatDate(data.report.issuedAt || new Date(), 'dd/MM/yyyy')),
      this._docxMetadataRow('Document Division:', data.engagement.universe.name || 'Internal Audit & Assurance'),
      this._docxMetadataRow('Document Owner:', leadAuditorName),
      this._docxMetadataRow('Document Author:', leadAuditorName),
      this._docxMetadataRow('Approved by:', finalApproverName),
      this._docxMetadataRow('Document Classification:', classification),
      this._docxMetadataRow('Document Status:', data.report.status.toUpperCase()),
    ];

    return [
      new Paragraph({
        spacing: { before: 200, after: 100 },
        children: [new TextRun({ text: 'Document Information', bold: true, size: 22, color: '003087' })],
      }),
      new Table({
        rows,
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: '808080' },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: '808080' },
          left: { style: BorderStyle.SINGLE, size: 4, color: '808080' },
          right: { style: BorderStyle.SINGLE, size: 4, color: '808080' },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: '808080' },
          insideVertical: { style: BorderStyle.SINGLE, size: 4, color: '808080' },
        },
      }),
    ];
  }

  private _buildDocxChangeHistoryTable(data: ReportData): (Paragraph | Table)[] {
    const leadAuditorName =
      data.engagement.leadAuditor.displayName ??
      `${data.engagement.leadAuditor.firstName} ${data.engagement.leadAuditor.lastName}`.trim() ??
      'Internal Audit Team';

    const headerRow = new TableRow({
      children: [
        this._docxHeaderCell('Version'),
        this._docxHeaderCell('Date'),
        this._docxHeaderCell('Created by'),
        this._docxHeaderCell('Change from Previous Version'),
      ],
    });

    const rows = [
      headerRow,
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Version 1.0' })] })] }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: data.engagement.actualStartDate
                      ? formatDate(data.engagement.actualStartDate, 'dd/MM/yyyy')
                      : formatDate(new Date(), 'dd/MM/yyyy'),
                  }),
                ],
              }),
            ],
          }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: leadAuditorName })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Initial audit review formulation' })] })] }),
        ],
      }),
    ];

    if (data.report.versionNumber > 1) {
      rows.push(
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `Version ${data.report.versionNumber}.0` })] })] }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: formatDate(data.report.issuedAt || new Date(), 'dd/MM/yyyy') })],
                }),
              ],
            }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: leadAuditorName })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Audit review revision and approval' })] })] }),
          ],
        }),
      );
    }

    return [
      new Paragraph({
        spacing: { before: 200, after: 100 },
        children: [new TextRun({ text: 'Change history', bold: true, size: 22, color: '003087' })],
      }),
      new Table({
        rows,
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: '808080' },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: '808080' },
          left: { style: BorderStyle.SINGLE, size: 4, color: '808080' },
          right: { style: BorderStyle.SINGLE, size: 4, color: '808080' },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: '808080' },
          insideVertical: { style: BorderStyle.SINGLE, size: 4, color: '808080' },
        },
      }),
    ];
  }

  private _buildDocxDistributionTable(data: ReportData): (Paragraph | Table)[] {
    const dateStr = formatDate(data.report.issuedAt || new Date(), 'dd/MM/yyyy');
    const verStr = `Version ${data.report.versionNumber}.0`;

    const headerRow = new TableRow({
      children: [
        this._docxHeaderCell('Name'),
        this._docxHeaderCell('Version'),
        this._docxHeaderCell('Date'),
      ],
    });

    const rows = [
      headerRow,
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Board Audit Committee & Executive Management' })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: verStr })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: dateStr })] })] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `Audited Entity (${data.engagement.universe.name})` })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: verStr })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: dateStr })] })] }),
        ],
      }),
    ];

    return [
      new Paragraph({
        spacing: { before: 200, after: 100 },
        children: [new TextRun({ text: 'Distribution List', bold: true, size: 22, color: '003087' })],
      }),
      new Table({
        rows,
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: '808080' },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: '808080' },
          left: { style: BorderStyle.SINGLE, size: 4, color: '808080' },
          right: { style: BorderStyle.SINGLE, size: 4, color: '808080' },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: '808080' },
          insideVertical: { style: BorderStyle.SINGLE, size: 4, color: '808080' },
        },
      }),
    ];
  }

  private _buildDocxApprovalListTable(
    approval: ApprovalResponseDto | null,
    sigMap: StepSignatureMap,
    data: ReportData,
  ): (Paragraph | Table)[] {
    const headerRow = new TableRow({
      children: [
        this._docxHeaderCell('Name'),
        this._docxHeaderCell('Position'),
        this._docxHeaderCell('Signature'),
        this._docxHeaderCell('Date'),
      ],
    });

    const dataRows: TableRow[] = [];
    const steps = approval?.steps ?? [];

    if (steps.length > 0) {
      const sortedSteps = [...steps].sort((a, b) => a.level - b.level);
      sortedSteps.forEach((step) => {
        const name = step.approver?.displayName || `Designated Approver (Level ${step.level})`;
        const position =
          step.approver?.jobTitle ||
          (step.level === 1 ? 'Head of Unit / Reviewer' : step.level === 2 ? 'Executive Director' : 'Managing Director / CEO');
        const sigEntry = sigMap.get(step.id);
        const sigChildren: Paragraph[] = [];

        if (step.status === 'approved') {
          if (sigEntry) {
            sigChildren.push(
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new ImageRun({
                    type: sigEntry.type,
                    data: sigEntry.buffer,
                    transformation: { width: 110, height: 38 },
                  }),
                ],
              }),
            );
          } else {
            sigChildren.push(
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: '[Digitally Signed]', italics: true, bold: true, color: '166534' })],
              }),
            );
          }
        } else if (step.status === 'rejected') {
          sigChildren.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: 'Rejected', color: 'DC2626' })],
            }),
          );
        } else {
          sigChildren.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: 'Pending Approval', italics: true, color: '64748B' })],
            }),
          );
        }

        const dateStr = step.actedAt ? formatDate(new Date(step.actedAt), 'dd/MM/yyyy') : '—';

        dataRows.push(
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: name, bold: true })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: position })] })] }),
              new TableCell({ children: sigChildren }),
              new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: dateStr })] })] }),
            ],
          }),
        );
      });
    } else {
      const defaultApprovers =
        data.report.signOffMode === 'cae_only'
          ? [
              { name: data.engagement.auditManager.displayName || 'Head of Unit (HOU)', pos: 'Head of Unit / Audit Manager' },
              { name: 'Head of Internal Audit (CAE)', pos: 'Head of Internal Audit' },
            ]
          : [
              { name: data.engagement.auditManager.displayName || 'Head of Unit (HOU)', pos: 'Head of Unit / Audit Manager' },
              { name: 'Head of Internal Audit (CAE)', pos: 'Head of Internal Audit / ED' },
              { name: 'Managing Director / CEO', pos: 'MD / CEO' },
            ];
      defaultApprovers.forEach((def) => {
        dataRows.push(
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: def.name, bold: true })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: def.pos })] })] }),
              new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Pending Submission', italics: true, color: '64748B' })] })] }),
              new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '—' })] })] }),
            ],
          }),
        );
      });
    }

    return [
      new Paragraph({
        spacing: { before: 200, after: 100 },
        children: [new TextRun({ text: 'Approval List', bold: true, size: 22, color: '003087' })],
      }),
      new Table({
        rows: [headerRow, ...dataRows],
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: '808080' },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: '808080' },
          left: { style: BorderStyle.SINGLE, size: 4, color: '808080' },
          right: { style: BorderStyle.SINGLE, size: 4, color: '808080' },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: '808080' },
          insideVertical: { style: BorderStyle.SINGLE, size: 4, color: '808080' },
        },
      }),
    ];
  }

  private _buildDocxChangeControlAndToc(): (Paragraph | Table)[] {
    return [
      new Paragraph({
        spacing: { before: 180, after: 140 },
        children: [
          new TextRun({ text: 'Change Control: ', bold: true, size: 18 }),
          new TextRun({
            text:
              'The contents of this document are subject to change control. Any proposed amendments should be submitted to the Document Owner for review and approval prior to implementation.',
            italics: true,
            size: 18,
            color: '475569',
          }),
        ],
      }),
      new Paragraph({
        spacing: { before: 180, after: 80 },
        children: [new TextRun({ text: 'Table of Contents', bold: true, size: 22, color: '003087' })],
      }),
      new Paragraph({ children: [new TextRun({ text: '1. Executive Summary', size: 20 })] }),
      new Paragraph({ children: [new TextRun({ text: '2. Audit Scope', size: 20 })] }),
      new Paragraph({ children: [new TextRun({ text: '3. Methodology', size: 20 })] }),
      new Paragraph({ children: [new TextRun({ text: '4. Findings Summary Table', size: 20 })] }),
      new Paragraph({ children: [new TextRun({ text: '5. Detailed Findings', size: 20 })] }),
      new Paragraph({ children: [new TextRun({ text: '6. Assets in Scope', size: 20 })] }),
      new Paragraph({
        spacing: { after: 240 },
        children: [new TextRun({ text: '7. Validity and Document Management', size: 20 })],
      }),
    ];
  }

  private _buildDocxHeader(header: RenderHeaderConfig): Paragraph[] {
    return [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: header.orgName, size: 20, color: header.primaryColor })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 120 },
        children: [
          new TextRun({
            text: header.reportTitle,
            bold: true,
            size: 28,
            color: header.primaryColor,
            allCaps: true,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: header.orgAddress, size: 18, color: '64748B' })],
      }),
      new Paragraph({
        spacing: { before: 120, after: 240 },
        border: {
          bottom: { color: header.accentColor, space: 1, style: BorderStyle.SINGLE, size: 12 },
        },
        children: [],
      }),
    ];
  }

  private _buildDocxMetadataTable(data: ReportData, classification: string): Table {
    const rows = [
      this._docxMetadataRow('Report Reference', data.engagement.referenceNumber),
      this._docxMetadataRow('Audit Type', AUDIT_TYPE_LABEL[data.engagement.auditType] ?? data.engagement.auditType),
      this._docxMetadataRow('Audited Entity', data.engagement.universe.name),
      this._docxMetadataRow(
        'Audit Period',
        `${formatDate(data.engagement.plannedStartDate, 'dd MMM yyyy')} to ${formatDate(data.engagement.plannedEndDate, 'dd MMM yyyy')}`,
      ),
      this._docxMetadataRow(
        'Report Date',
        data.report.issuedAt ? formatDate(data.report.issuedAt, 'dd MMMM yyyy') : 'Not yet issued',
      ),
      this._docxMetadataRow('Classification', classification),
    ];

    return new Table({
      rows,
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      },
    });
  }

  private _docxMetadataRow(label: string, value: string): TableRow {
    const isConfidential = label === 'Classification';
    return new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: label, bold: true })] })],
          width: { size: 30, type: WidthType.PERCENTAGE },
          shading: { fill: 'F3F4F6', type: ShadingType.SOLID },
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ text: value, bold: isConfidential })],
            }),
          ],
          width: { size: 70, type: WidthType.PERCENTAGE },
        }),
      ],
    });
  }

  private _htmlOrTextToDocxBlocks(rawText: string): (Paragraph | Table)[] {
    if (!rawText || !rawText.trim()) {
      return [new Paragraph({ children: [new TextRun({ text: 'N/A' })] })];
    }
    const { markdown, images } = htmlFragmentToMarkdownAndImages(rawText);
    const blocks: (Paragraph | Table)[] = [];
    const lines = markdown.split(/\r?\n/);
    let idx = 0;

    while (idx < lines.length) {
      const line = lines[idx].trim();
      if (!line) {
        idx++;
        continue;
      }

      // Markdown table block
      if (line.startsWith('|') && line.endsWith('|')) {
        const tableLines: string[] = [];
        while (idx < lines.length && lines[idx].trim().startsWith('|')) {
          const tLine = lines[idx].trim();
          // Skip separator rows like | --- | --- |
          if (!/^\|[\s\-:|]+\|$/.test(tLine)) {
            tableLines.push(tLine);
          }
          idx++;
        }
        if (tableLines.length > 0) {
          const rows = tableLines.map((rowStr, rIdx) => {
            const cells = rowStr
              .replace(/^\|/, '')
              .replace(/\|$/, '')
              .split('|')
              .map((c) => c.trim());
            return new TableRow({
              children: cells.map(
                (cellText) =>
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: cellText.replace(/\*\*/g, ''),
                            bold: rIdx === 0,
                            color: rIdx === 0 ? 'FFFFFF' : '1E293B',
                          }),
                        ],
                      }),
                    ],
                    shading: rIdx === 0 ? { fill: '003087', type: ShadingType.SOLID } : undefined,
                    verticalAlign: VerticalAlign.CENTER,
                  }),
              ),
            });
          });
          blocks.push(
            new Table({
              rows,
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
              },
            }),
          );
        }
        continue;
      }

      // Headings
      const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const text = headingMatch[2].replace(/\*\*/g, '');
        blocks.push(
          new Paragraph({
            spacing: { before: 160, after: 80 },
            children: [
              new TextRun({
                text,
                bold: true,
                size: level === 1 ? 26 : level === 2 ? 24 : 22,
                color: '003087',
              }),
            ],
          }),
        );
        idx++;
        continue;
      }

      // Bullet / numbered lists
      const bulletMatch = line.match(/^[-*•]\s+(.+)$/);
      if (bulletMatch) {
        blocks.push(
          new Paragraph({
            spacing: { before: 40, after: 40 },
            children: this._parseInlineBoldRuns(`• ${bulletMatch[1]}`),
          }),
        );
        idx++;
        continue;
      }

      blocks.push(
        new Paragraph({
          spacing: { before: 60, after: 60 },
          children: this._parseInlineBoldRuns(line),
        }),
      );
      idx++;
    }

    // Append inline base64 images
    for (const dataUrl of images) {
      const m = dataUrl.match(/^data:image\/(png|jpe?g);base64,(.+)$/i);
      if (m) {
        try {
          const imgType = m[1].toLowerCase() === 'png' ? 'png' : 'jpg';
          const imgBuffer = Buffer.from(m[2], 'base64');
          blocks.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 120, after: 120 },
              children: [
                new ImageRun({
                  type: imgType,
                  data: imgBuffer,
                  transformation: { width: 420, height: 260 },
                }),
              ],
            }),
          );
        } catch {
          // Ignore malformed inline image
        }
      }
    }

    return blocks.length > 0 ? blocks : [new Paragraph({ children: [new TextRun({ text: rawText })] })];
  }

  private _parseInlineBoldRuns(text: string): TextRun[] {
    const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
    return parts.map((part) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return new TextRun({ text: part.slice(2, -2), bold: true });
      }
      return new TextRun({ text: part });
    });
  }

  private _htmlOrTextToPdfBlocks(rawText: string): Content[] {
    if (!rawText || !rawText.trim()) {
      return [{ text: 'N/A' }];
    }
    const { markdown, images } = htmlFragmentToMarkdownAndImages(rawText);
    const content: Content[] = [...markdownToPdfContent(markdown)];
    for (const dataUrl of images) {
      if (/^data:image\/(png|jpe?g);base64,/i.test(dataUrl)) {
        content.push({
          image: dataUrl,
          fit: [440, 280],
          alignment: 'center',
          margin: [0, 6, 0, 8],
        });
      }
    }
    return content.length > 0 ? content : [{ text: rawText }];
  }

  private _buildDocxSectionContent(key: string, data: ReportData): (Paragraph | Table)[] {
    switch (key) {
      case 'executive_summary':
        return this._htmlOrTextToDocxBlocks(data.report.executiveSummary);
      case 'background':
        return [new Paragraph({ children: [new TextRun({ text: 'Refer to engagement details above.' })] })];
      case 'objectives':
        return this._htmlOrTextToDocxBlocks(data.report.scope);
      case 'methodology':
        return this._htmlOrTextToDocxBlocks(data.report.methodology);
      case 'findings_summary':
        return [this._buildDocxFindingsSummaryTable(data.findings)];
      case 'detailed_findings':
        return this._buildDocxDetailedFindings(data.findings);
      case 'conclusion':
        return [new Paragraph({ children: [new TextRun({ text: 'See findings and recommendations above.' })] })];
      default:
        return [new Paragraph({ children: [new TextRun({ text: '' })] })];
    }
  }

  private _buildDocxFindingsSummaryTable(findings: ReportFinding[]): Table {
    const headerRow = new TableRow({
      children: [
        this._docxHeaderCell('No.'),
        this._docxHeaderCell('Finding Title'),
        this._docxHeaderCell('Category'),
        this._docxHeaderCell('Severity'),
        this._docxHeaderCell('Status'),
        this._docxHeaderCell('Due Date'),
      ],
    });

    const dataRows = findings.map((f, idx) =>
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: String(idx + 1) })] })],
            verticalAlign: VerticalAlign.CENTER,
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: f.title })] })],
            verticalAlign: VerticalAlign.CENTER,
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: FINDING_CATEGORY_LABEL[f.category] ?? f.category })] })],
            verticalAlign: VerticalAlign.CENTER,
          }),
          this._severityDocxCell(f.severity),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: FINDING_STATUS_LABEL[f.status] ?? f.status })] })],
            verticalAlign: VerticalAlign.CENTER,
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: formatDate(f.dueDate, 'dd MMM yyyy') })],
              }),
            ],
            verticalAlign: VerticalAlign.CENTER,
          }),
        ],
      }),
    );

    return new Table({
      rows: [headerRow, ...dataRows],
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      },
    });
  }

  private _buildDocxAssetsInScopeTable(assets: ReportAsset[]): Table {
    const headerRow = new TableRow({
      children: [
        this._docxHeaderCell('Tag'),
        this._docxHeaderCell('Asset'),
        this._docxHeaderCell('Type'),
        this._docxHeaderCell('Criticality'),
        this._docxHeaderCell('Scope Role'),
      ],
    });
    const dataRows = assets.map((a) =>
      new TableRow({
        children: [a.assetTag, a.name, a.assetType, a.criticality, a.scopeRole].map((v) =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: titleCase(v) })] })],
            verticalAlign: VerticalAlign.CENTER,
          }),
        ),
      }),
    );
    return new Table({
      rows: [headerRow, ...dataRows],
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      },
    });
  }

  private _docxHeaderCell(text: string): TableCell {
    return new TableCell({
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text, bold: true, color: 'FFFFFF' })],
        }),
      ],
      shading: { fill: '003087', type: ShadingType.SOLID },
      verticalAlign: VerticalAlign.CENTER,
    });
  }

  private _severityDocxCell(severity: string): TableCell {
    const colour = SEVERITY_COLOURS[severity.toLowerCase()] ?? { bg: '64748B', text: 'FFFFFF' };
    return new TableCell({
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: severity.toUpperCase(),
              bold: true,
              color: colour.text,
            }),
          ],
        }),
      ],
      shading: { fill: colour.bg, type: ShadingType.SOLID },
      verticalAlign: VerticalAlign.CENTER,
    });
  }

  private _buildDocxDetailedFindings(findings: ReportFinding[]): (Paragraph | Table)[] {
    const result: (Paragraph | Table)[] = [];
    findings.forEach((f, idx) => {
      // Heading
      result.push(
        new Paragraph({
          spacing: { before: 240, after: 120 },
          children: [
            new TextRun({
              text: `Finding ${idx + 1}: ${f.title}`,
              bold: true,
              size: 22,
            }),
          ],
        }),
      );

      // Details table
      result.push(this._buildDocxFindingDetailsTable(f));

      // Description
      result.push(
        new Paragraph({
          spacing: { before: 120 },
          children: [
            new TextRun({ text: 'Description: ', bold: true }),
            new TextRun({ text: f.description }),
          ],
        }),
      );

      // Root Cause
      result.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Root Cause: ', bold: true }),
            new TextRun({ text: f.rootCause }),
          ],
        }),
      );

      // Risk Implication
      result.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Risk Implication: ', bold: true }),
            new TextRun({ text: f.riskImplication }),
          ],
        }),
      );

      // Recommendation
      result.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Recommendation: ', bold: true }),
            new TextRun({ text: f.recommendation }),
          ],
        }),
      );

      // Management Response (always shown so the report captures auditee response status)
      if (f.followUp?.managementResponse) {
        const responder = f.followUp.managementResponseBy;
        const responderName =
          responder?.displayName ??
          `${responder?.firstName ?? ''} ${responder?.lastName ?? ''}`.trim() ??
          'N/A';
        const responseDate = f.followUp.managementResponseAt
          ? formatDate(f.followUp.managementResponseAt, 'dd MMM yyyy')
          : '';
        result.push(
          new Paragraph({
            spacing: { before: 120 },
            children: [
              new TextRun({ text: 'Management Response: ', bold: true }),
              new TextRun({ text: f.followUp.managementResponse }),
            ],
          }),
        );
        result.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Submitted by: ${responderName}${responseDate ? ` on ${responseDate}` : ''}`,
                italics: true,
                size: 20,
              }),
            ],
          }),
        );
      } else {
        result.push(
          new Paragraph({
            spacing: { before: 120 },
            children: [
              new TextRun({ text: 'Management Response: ', bold: true }),
              new TextRun({ text: 'Awaiting management response from auditee.', italics: true }),
            ],
          }),
        );
      }

      // Verification
      if (f.followUp?.verifiedAt) {
        const verifier = f.followUp.verifiedBy;
        const verifierName =
          verifier?.displayName ??
          `${verifier?.firstName ?? ''} ${verifier?.lastName ?? ''}`.trim() ??
          'N/A';
        const verifyDate = f.followUp.verifiedAt
          ? formatDate(f.followUp.verifiedAt, 'dd MMM yyyy')
          : '';
        result.push(
          new Paragraph({
            spacing: { before: 120 },
            children: [
              new TextRun({ text: 'Verification Status: ', bold: true }),
              new TextRun({ text: f.followUp.verificationStatus }),
            ],
          }),
        );
        result.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Verified by: ${verifierName} on ${verifyDate}`,
                italics: true,
                size: 20,
              }),
            ],
          }),
        );
        result.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Verification Notes: ', bold: true }),
              new TextRun({ text: f.followUp.verificationNotes ?? 'N/A' }),
            ],
          }),
        );
      }

      // Separator
      if (idx < findings.length - 1) {
        result.push(
          new Paragraph({
            spacing: { before: 120, after: 120 },
            border: {
              bottom: { color: 'CCCCCC', space: 1, style: BorderStyle.SINGLE, size: 6 },
            },
            children: [],
          }),
        );
      }
    });
    return result;
  }

  private _buildDocxFindingDetailsTable(finding: ReportFinding): Table {
    const auditeeName =
      finding.auditee.displayName ??
      `${finding.auditee.firstName} ${finding.auditee.lastName}`.trim() ??
      'N/A';

    const rows: TableRow[] = [
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: 'Severity', bold: true })] })],
            width: { size: 20, type: WidthType.PERCENTAGE },
            shading: { fill: 'F8F9FA', type: ShadingType.SOLID },
          }),
          this._severityDocxCell(finding.severity),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: 'Category', bold: true })] })],
            width: { size: 20, type: WidthType.PERCENTAGE },
            shading: { fill: 'F8F9FA', type: ShadingType.SOLID },
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: FINDING_CATEGORY_LABEL[finding.category] ?? finding.category })] })],
          }),
        ],
      }),
    ];

    if (finding.controlReference) {
      rows.push(
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: 'Control Reference', bold: true })] })],
              width: { size: 20, type: WidthType.PERCENTAGE },
              shading: { fill: 'F8F9FA', type: ShadingType.SOLID },
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: finding.controlReference })] })],
            }),
          ],
        }),
      );
    }

    rows.push(
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: 'Status', bold: true })] })],
            width: { size: 20, type: WidthType.PERCENTAGE },
            shading: { fill: 'F8F9FA', type: ShadingType.SOLID },
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: FINDING_STATUS_LABEL[finding.status] ?? finding.status })] })],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: 'Due Date', bold: true })] })],
            width: { size: 20, type: WidthType.PERCENTAGE },
            shading: { fill: 'F8F9FA', type: ShadingType.SOLID },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: formatDate(finding.dueDate, 'dd MMM yyyy') })],
              }),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: 'Auditee', bold: true })] })],
            width: { size: 20, type: WidthType.PERCENTAGE },
            shading: { fill: 'F8F9FA', type: ShadingType.SOLID },
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: auditeeName })] })],
          }),
        ],
      }),
    );

    return new Table({
      rows,
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      },
    });
  }

  private _buildDocxSignatureBlock(
    data: ReportData,
    approval: ApprovalResponseDto | null,
    config: TemplateConfig,
    sigMap: StepSignatureMap,
  ): Table {
    const labels = this._getSignatureLabels(config);
    const { reviewedStepId, approvedStepId } = this._signOffSteps(approval);
    const sigParagraphs = (stepId?: string): Paragraph[] => {
      const entry = stepId ? sigMap.get(stepId) : undefined;
      return entry
        ? [
            new Paragraph({
              children: [
                new ImageRun({ type: entry.type, data: entry.buffer, transformation: { width: 120, height: 42 } }),
              ],
            }),
          ]
        : [];
    };
    const leadAuditorName =
      data.engagement.leadAuditor.displayName ??
      `${data.engagement.leadAuditor.firstName} ${data.engagement.leadAuditor.lastName}`.trim() ??
      'N/A';
    const leadAuditorTitle = data.engagement.leadAuditor.jobTitle ?? '';
    const preparedDate = data.engagement.actualStartDate
      ? formatDate(data.engagement.actualStartDate, 'dd MMM yyyy')
      : '';

    const auditManagerName =
      data.engagement.auditManager.displayName ??
      `${data.engagement.auditManager.firstName} ${data.engagement.auditManager.lastName}`.trim() ??
      'N/A';
    const auditManagerTitle = data.engagement.auditManager.jobTitle ?? '';

    let caeApproverName =
      data.report.signOffMode === 'cae_only'
        ? 'Head of Internal Audit (Pending)'
        : 'Head of Internal Audit / DG (Pending)';
    if (approval?.steps) {
      const approvedSteps = approval.steps.filter((s) => s.status === 'approved');
      const highest =
        approvedSteps.length > 0
          ? approvedSteps.reduce((max, s) => (s.level > max.level ? s : max))
          : undefined;
      if (highest?.approver?.displayName) {
        caeApproverName = highest.approver.displayName;
      }
    }

    return new Table({
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: `${labels.preparedBy}:`, bold: true, color: '003087' }),
                  ],
                }),
                new Paragraph({ children: [new TextRun({ text: leadAuditorName })] }),
                new Paragraph({ children: [new TextRun({ text: leadAuditorTitle })] }),
                new Paragraph({ children: [new TextRun({ text: preparedDate })] }),
              ],
              width: { size: 33, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: `${labels.reviewedBy}:`, bold: true, color: '003087' }),
                  ],
                }),
                ...sigParagraphs(reviewedStepId),
                new Paragraph({ children: [new TextRun({ text: auditManagerName })] }),
                new Paragraph({ children: [new TextRun({ text: auditManagerTitle })] }),
              ],
              width: { size: 33, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: `${labels.approvedBy}:`, bold: true, color: '003087' }),
                  ],
                }),
                ...sigParagraphs(approvedStepId),
                new Paragraph({ children: [new TextRun({ text: caeApproverName })] }),
              ],
              width: { size: 34, type: WidthType.PERCENTAGE },
            }),
          ],
        }),
      ],
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.NONE },
        insideVertical: { style: BorderStyle.NONE },
      },
    });
  }

  // ─────────── PDF generation ───────────

  async generatePdf(reportId: string): Promise<Buffer> {
    const data = await this.fetchReportData(reportId);
    const config = await this.fetchTemplateAndConfig(data.report.templateId);
    let approval: ApprovalResponseDto | null = null;
    try {
      approval = await this.approvalService.getApprovalByEntity(WorkflowEntityType.AuditReport, reportId);
    } catch {
      approval = null;
    }
    const sigMap = await this._stepSignatures(approval);
    return renderPdf(this._buildPdfDocDefinition(data, config, approval, sigMap));
  }

  private _buildPdfDocDefinition(
    data: ReportData,
    config: TemplateConfig,
    approval: ApprovalResponseDto | null,
    sigMap: StepSignatureMap,
  ): TDocumentDefinitions {
    const header = this._getHeaderConfig(config);
    const footerNotice = this._getFooterNotice(config);
    const labels = this._getSignatureLabels(config);
    const { reviewedStepId, approvedStepId } = this._signOffSteps(approval);
    const primary = hexColor(header.primaryColor);
    const accent = hexColor(header.accentColor);

    const sigImg = (stepId?: string): Content | null => {
      const entry = stepId ? sigMap.get(stepId) : undefined;
      return entry ? { image: entry.dataUrl, fit: [120, 42], margin: [0, 4, 0, 4] } : null;
    };

    /** "Label: value" line with the label bolded in the brand colour. */
    const labeled = (label: string, value: string): Content => ({
      text: [{ text: `${label}: `, bold: true, color: primary }, value],
      margin: [0, 3, 0, 3],
    });

    /** A label cell for the metadata / details tables. */
    const labelCell = (text: string): PdfTableCell => ({ text, bold: true, color: primary, fillColor: '#F8F9FA' });

    const leadAuditorName =
      data.engagement.leadAuditor.displayName ??
      `${data.engagement.leadAuditor.firstName} ${data.engagement.leadAuditor.lastName}`.trim() ??
      'N/A';
    const leadAuditorTitle = data.engagement.leadAuditor.jobTitle ?? '';
    const preparedDate = data.engagement.actualStartDate
      ? formatDate(data.engagement.actualStartDate, 'dd MMM yyyy')
      : '';

    const auditManagerName =
      data.engagement.auditManager.displayName ??
      `${data.engagement.auditManager.firstName} ${data.engagement.auditManager.lastName}`.trim() ??
      'N/A';
    const auditManagerTitle = data.engagement.auditManager.jobTitle ?? '';

    let caeApproverName =
      data.report.signOffMode === 'cae_only'
        ? 'Head of Internal Audit (Pending)'
        : 'Head of Internal Audit / DG (Pending)';
    if (approval?.steps) {
      const approvedSteps = approval.steps.filter((s) => s.status === 'approved');
      const highest =
        approvedSteps.length > 0
          ? approvedSteps.reduce((max, s) => (s.level > max.level ? s : max))
          : undefined;
      if (highest?.approver?.displayName) {
        caeApproverName = highest.approver.displayName;
      }
    }

    const findingsSummaryTable: Content = {
      table: {
        headerRows: 1,
        widths: [22, '*', 80, 64, 70, 64],
        body: [
          ['No.', 'Finding Title', 'Category', 'Severity', 'Status', 'Due Date'].map(
            (h): PdfTableCell => ({ text: h, bold: true, color: '#FFFFFF', fillColor: primary }),
          ),
          ...data.findings.map((f, idx): PdfTableCell[] => [
            { text: String(idx + 1) },
            { text: f.title },
            { text: FINDING_CATEGORY_LABEL[f.category] ?? f.category },
            severityBadge(f.severity),
            { text: FINDING_STATUS_LABEL[f.status] ?? f.status },
            { text: formatDate(f.dueDate, 'dd MMM yyyy') },
          ]),
        ],
      },
      layout: borderedTableLayout,
      margin: [0, 4, 0, 0],
    };

    const detailedFindingsContent: Content[] = [];
    data.findings.forEach((f, idx) => {
      const auditeeName =
        f.auditee.displayName ?? `${f.auditee.firstName} ${f.auditee.lastName}`.trim() ?? 'N/A';

      const detailsBody: PdfTableCell[][] = [
        [labelCell('Severity'), severityBadge(f.severity)],
        [labelCell('Category'), { text: FINDING_CATEGORY_LABEL[f.category] ?? f.category }],
      ];
      if (f.controlReference) {
        detailsBody.push([labelCell('Control Reference'), { text: f.controlReference }]);
      }
      detailsBody.push(
        [labelCell('Status'), { text: FINDING_STATUS_LABEL[f.status] ?? f.status }],
        [labelCell('Due Date'), { text: formatDate(f.dueDate, 'dd MMM yyyy') }],
        [labelCell('Auditee'), { text: auditeeName }],
      );

      detailedFindingsContent.push(
        { text: `Finding ${idx + 1}: ${f.title}`, bold: true, fontSize: 12, margin: [0, 14, 0, 6] },
        {
          table: {
            widths: [110, '*'],
            body: detailsBody,
          },
          layout: borderedTableLayout,
          margin: [0, 0, 0, 6],
        },
        labeled('Description', f.description),
        labeled('Root Cause', f.rootCause),
        labeled('Risk Implication', f.riskImplication),
        labeled('Recommendation', f.recommendation),
      );

      if (f.followUp?.managementResponse) {
        const responder = f.followUp.managementResponseBy;
        const responderName =
          responder?.displayName ??
          `${responder?.firstName ?? ''} ${responder?.lastName ?? ''}`.trim() ??
          'N/A';
        const responseDate = f.followUp.managementResponseAt
          ? formatDate(f.followUp.managementResponseAt, 'dd MMM yyyy')
          : '';
        detailedFindingsContent.push(
          labeled('Management Response', f.followUp.managementResponse),
          { text: `Submitted by: ${responderName}${responseDate ? ` on ${responseDate}` : ''}`, italics: true, fontSize: 10, color: '#64748B', margin: [0, 0, 0, 3] },
        );
      } else {
        detailedFindingsContent.push(
          labeled('Management Response', 'Awaiting management response from auditee.'),
        );
      }

      if (f.followUp?.verifiedAt) {
        const verifier = f.followUp.verifiedBy;
        const verifierName =
          verifier?.displayName ??
          `${verifier?.firstName ?? ''} ${verifier?.lastName ?? ''}`.trim() ??
          'N/A';
        const verifyDate = formatDate(f.followUp.verifiedAt, 'dd MMM yyyy');
        detailedFindingsContent.push(
          labeled('Verification Status', f.followUp.verificationStatus),
          { text: `Verified by: ${verifierName} on ${verifyDate}`, italics: true, fontSize: 10, color: '#64748B', margin: [0, 0, 0, 3] },
          labeled('Verification Notes', f.followUp.verificationNotes ?? 'N/A'),
        );
      }

      if (idx < data.findings.length - 1) {
        detailedFindingsContent.push({
          canvas: [{ type: 'line', x1: 0, y1: 0, x2: 482, y2: 0, lineWidth: 1, lineColor: '#cccccc' }],
          margin: [0, 10, 0, 10],
        });
      }
    });

    const sectionsContent: Content[] = [];
    config.template.sections.forEach((section, idx) => {
      sectionsContent.push({ text: `${idx + 1}. ${section.title}`, style: 'sectionTitle', margin: [0, 18, 0, 8] });
      switch (section.key) {
        case 'executive_summary':
          sectionsContent.push(...this._htmlOrTextToPdfBlocks(data.report.executiveSummary));
          break;
        case 'background':
          sectionsContent.push({ text: 'Refer to engagement details above.' });
          break;
        case 'objectives':
          sectionsContent.push(...this._htmlOrTextToPdfBlocks(data.report.scope));
          break;
        case 'methodology':
          sectionsContent.push(...this._htmlOrTextToPdfBlocks(data.report.methodology));
          break;
        case 'findings_summary':
          sectionsContent.push(findingsSummaryTable);
          break;
        case 'detailed_findings':
          sectionsContent.push(...detailedFindingsContent);
          break;
        case 'conclusion':
          sectionsContent.push({ text: 'See findings and recommendations above.' });
          break;
        default:
          break;
      }
    });

    // Assets in scope — always appended when the engagement has linked assets,
    // so scope reaches the report even if the template omits an assets section.
    if (data.assetsInScope.length > 0) {
      sectionsContent.push({
        text: `${config.template.sections.length + 1}. Assets in Scope`,
        style: 'sectionTitle',
        margin: [0, 18, 0, 8],
      });
      sectionsContent.push({
        table: {
          headerRows: 1,
          widths: ['auto', '*', 'auto', 'auto', 'auto'],
          body: [
            ['Tag', 'Asset', 'Type', 'Criticality', 'Scope Role'].map((h) => ({ text: h, bold: true, fillColor: '#f1f5f9' })),
            ...data.assetsInScope.map((a) => [
              titleCase(a.assetTag),
              titleCase(a.name),
              titleCase(a.assetType),
              titleCase(a.criticality),
              titleCase(a.scopeRole),
            ]),
          ],
        },
        layout: borderedTableLayout,
        margin: [0, 0, 0, 8],
      });
    }

    const logoBuf = getGbbLogoBuffer();
    const logoDataUrl = logoBuf ? `data:image/png;base64,${logoBuf.toString('base64')}` : null;

    const approvalListPdfRows: PdfTableCell[][] = [];
    if (approval?.steps && approval.steps.length > 0) {
      const sortedSteps = [...approval.steps].sort((a, b) => a.level - b.level);
      sortedSteps.forEach((step) => {
        const name = step.approver?.displayName || `Approver (Level ${step.level})`;
        const position =
          step.approver?.jobTitle ||
          (step.level === 1
            ? 'Head of Unit / Reviewer'
            : step.level === 2
              ? 'Head of Internal Audit (CAE)'
              : 'Director General / CEO');
        const sig = sigImg(step.id);
        let sigCell: PdfTableCell;
        if (step.status === 'approved') {
          sigCell = sig ? sig : { text: '[Digitally Signed]', italics: true, color: '#166534', bold: true };
        } else if (step.status === 'rejected') {
          sigCell = { text: 'Rejected', color: '#DC2626' };
        } else {
          sigCell = { text: 'Pending Approval', italics: true, color: '#64748B' };
        }
        const dateStr = step.actedAt ? formatDate(new Date(step.actedAt), 'dd/MM/yyyy') : '—';
        approvalListPdfRows.push([{ text: name, bold: true }, { text: position }, sigCell, { text: dateStr, alignment: 'center' }]);
      });
    } else if (data.report.signOffMode === 'cae_only') {
      approvalListPdfRows.push(
        [{ text: auditManagerName, bold: true }, { text: auditManagerTitle || 'Head of Unit / Audit Manager' }, { text: 'Pending Submission', italics: true, color: '#64748B' }, { text: '—', alignment: 'center' }],
        [{ text: 'Head of Internal Audit (CAE)', bold: true }, { text: 'Head of Internal Audit' }, { text: 'Pending Submission', italics: true, color: '#64748B' }, { text: '—', alignment: 'center' }],
      );
    } else {
      approvalListPdfRows.push(
        [{ text: auditManagerName, bold: true }, { text: auditManagerTitle || 'Head of Unit / Audit Manager' }, { text: 'Pending Submission', italics: true, color: '#64748B' }, { text: '—', alignment: 'center' }],
        [{ text: 'Head of Internal Audit (CAE)', bold: true }, { text: 'Head of Internal Audit' }, { text: 'Pending Submission', italics: true, color: '#64748B' }, { text: '—', alignment: 'center' }],
        [{ text: 'Director General / CEO', bold: true }, { text: 'Director General / MD' }, { text: 'Pending Submission', italics: true, color: '#64748B' }, { text: '—', alignment: 'center' }],
      );
    }

    const pad = (l: number, t: number, r: number, b: number): [number, number, number, number] => [l, t, r, b];

    return {
      pageSize: 'A4',
      pageMargins: [mm(20), mm(20), mm(20), mm(25)],
      footer: (currentPage, pageCount) => ({
        text: `${footerNotice} - Page ${currentPage} of ${pageCount}`,
        alignment: 'center',
        fontSize: 9,
        color: '#64748B',
        margin: pad(mm(20), 8, mm(20), 0),
      }),
      content: [
        ...(logoDataUrl
          ? [{ image: logoDataUrl, width: 120, alignment: 'center' as const, margin: pad(0, 0, 0, 8) }]
          : []),
        { text: 'Galaxy Backbone Limited', style: 'orgName', alignment: 'center', margin: pad(0, 0, 0, 6) },
        {
          table: {
            widths: ['*'],
            body: [
              [
                {
                  stack: [
                    { text: data.report.title.toUpperCase(), bold: true, fontSize: 14, color: primary, alignment: 'center', margin: pad(0, 4, 0, 3) },
                    { text: `Version ${data.report.versionNumber}.0`, bold: true, fontSize: 10, color: '#475569', alignment: 'center', margin: pad(0, 0, 0, 4) },
                    { text: 'DOCUMENT REFERENCE NUMBER:', bold: true, fontSize: 8, color: '#64748B', alignment: 'center', margin: pad(0, 3, 0, 1) },
                    { text: data.engagement.referenceNumber, bold: true, fontSize: 10, color: '#0F172A', alignment: 'center', margin: pad(0, 0, 0, 4) },
                  ],
                  fillColor: '#F8FAF8',
                  margin: pad(8, 4, 8, 4),
                },
              ],
            ],
          },
          layout: {
            hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length ? 3 : 0),
            vLineWidth: () => 0,
            hLineColor: () => '#4F6228',
          },
          margin: pad(0, 4, 0, 8),
        },
        {
          table: {
            widths: ['*'],
            body: [
              [
                {
                  text: [
                    { text: 'Confidentiality: ', bold: true, color: '#0F172A' },
                    'No part of this document may be disclosed verbally or in writing, including by reproduction, to any third party without the prior written consent of Galaxy Backbone Limited. This document, its associated appendices and any attachments remain the property of Galaxy Backbone Limited and shall be returned upon request.',
                  ],
                  fontSize: 7.5,
                  fillColor: '#F8F9FA',
                  color: '#334155',
                  margin: pad(6, 4, 6, 4),
                },
              ],
            ],
          },
          layout: borderedTableLayout,
          margin: pad(0, 0, 0, 8),
        },
        { text: 'Document Information', bold: true, fontSize: 9.5, color: primary, margin: pad(0, 2, 0, 2) },
        {
          table: {
            widths: [130, '*'],
            body: [
              [labelCell('Document ID:'), { text: data.engagement.referenceNumber, fontSize: 8.5 }],
              [labelCell('Document Version:'), { text: `Version ${data.report.versionNumber}.0`, fontSize: 8.5 }],
              [labelCell('Date of Version:'), { text: formatDate(data.report.issuedAt || new Date(), 'dd/MM/yyyy'), fontSize: 8.5 }],
              [labelCell('Document Division:'), { text: data.engagement.universe.name || 'Internal Audit & Assurance', fontSize: 8.5 }],
              [labelCell('Document Owner:'), { text: leadAuditorName, fontSize: 8.5 }],
              [labelCell('Document Author:'), { text: leadAuditorName, fontSize: 8.5 }],
              [labelCell('Approved by:'), { text: caeApproverName, bold: true, fontSize: 8.5 }],
              [labelCell('Document Classification:'), { text: header.classification, bold: true, color: '#DC2626', fontSize: 8.5 }],
              [labelCell('Document Status:'), { text: data.report.status.toUpperCase(), bold: true, fontSize: 8.5 }],
            ],
          },
          layout: borderedTableLayout,
          margin: pad(0, 0, 0, 8),
        },
        { text: 'Change history', bold: true, fontSize: 9.5, color: primary, margin: pad(0, 2, 0, 2) },
        {
          table: {
            headerRows: 1,
            widths: [65, 70, 100, '*'],
            body: [
              ['Version', 'Date', 'Created by', 'Change from Previous Version'].map(
                (h): PdfTableCell => ({ text: h, bold: true, fillColor: '#F1F5F9', color: primary, fontSize: 8.5 }),
              ),
              [
                { text: 'Version 1.0', fontSize: 8.5 },
                { text: data.engagement.actualStartDate ? formatDate(data.engagement.actualStartDate, 'dd/MM/yyyy') : formatDate(new Date(), 'dd/MM/yyyy'), fontSize: 8.5 },
                { text: leadAuditorName, fontSize: 8.5 },
                { text: 'Initial audit review draft formulation', fontSize: 8.5 },
              ],
              ...(data.report.versionNumber > 1
                ? [
                    [
                      { text: `Version ${data.report.versionNumber}.0`, fontSize: 8.5 },
                      { text: formatDate(data.report.issuedAt || new Date(), 'dd/MM/yyyy'), fontSize: 8.5 },
                      { text: leadAuditorName, fontSize: 8.5 },
                      { text: 'Audit review updates and formal approval', fontSize: 8.5 },
                    ],
                  ]
                : []),
            ],
          },
          layout: borderedTableLayout,
          margin: pad(0, 0, 0, 8),
        },
        { text: 'Distribution List', bold: true, fontSize: 9.5, color: primary, margin: pad(0, 2, 0, 2) },
        {
          table: {
            headerRows: 1,
            widths: ['*', 85, 75],
            body: [
              ['Name', 'Version', 'Date'].map(
                (h): PdfTableCell => ({ text: h, bold: true, fillColor: '#F1F5F9', color: primary, fontSize: 8.5 }),
              ),
              [
                { text: 'Board Audit Committee & Executive Management', fontSize: 8.5 },
                { text: `Version ${data.report.versionNumber}.0`, fontSize: 8.5 },
                { text: formatDate(data.report.issuedAt || new Date(), 'dd/MM/yyyy'), fontSize: 8.5 },
              ],
              [
                { text: `Audited Entity (${data.engagement.universe.name})`, fontSize: 8.5 },
                { text: `Version ${data.report.versionNumber}.0`, fontSize: 8.5 },
                { text: formatDate(data.report.issuedAt || new Date(), 'dd/MM/yyyy'), fontSize: 8.5 },
              ],
            ],
          },
          layout: borderedTableLayout,
          margin: pad(0, 0, 0, 8),
        },
        { text: 'Approval List', bold: true, fontSize: 9.5, color: primary, margin: pad(0, 2, 0, 2) },
        {
          table: {
            headerRows: 1,
            widths: [110, 110, 130, '*'],
            body: [
              ['Name', 'Position', 'Signature', 'Date'].map(
                (h): PdfTableCell => ({ text: h, bold: true, fillColor: '#F1F5F9', color: primary, fontSize: 8.5 }),
              ),
              ...approvalListPdfRows,
            ],
          },
          layout: borderedTableLayout,
          margin: pad(0, 0, 0, 8),
        },
        {
          text: [
            { text: 'Change Control: ', bold: true },
            { text: 'The contents of this document are subject to change control. Any proposed amendments should be submitted to the Document Owner for review and approval prior to implementation.', italics: true },
          ],
          fontSize: 8,
          color: '#475569',
          margin: pad(0, 0, 0, 8),
        },
        {
          stack: [
            { text: 'Table of Contents', bold: true, fontSize: 9.5, color: primary, margin: pad(0, 2, 0, 2) },
            { text: '1. Executive Summary', fontSize: 8.5, margin: pad(4, 1, 0, 1) },
            { text: '2. Audit Scope', fontSize: 8.5, margin: pad(4, 1, 0, 1) },
            { text: '3. Methodology', fontSize: 8.5, margin: pad(4, 1, 0, 1) },
            { text: '4. Findings Summary Table', fontSize: 8.5, margin: pad(4, 1, 0, 1) },
            { text: '5. Detailed Findings', fontSize: 8.5, margin: pad(4, 1, 0, 1) },
            ...(data.assetsInScope.length > 0 ? [{ text: '6. Assets in Scope', fontSize: 8.5, margin: pad(4, 1, 0, 1) }] : []),
            { text: `${data.assetsInScope.length > 0 ? 7 : 6}. Validity and Document Management`, fontSize: 8.5, margin: pad(4, 1, 0, 1) },
          ],
          margin: pad(0, 0, 0, 10),
          pageBreak: 'after' as const,
        },
        ...sectionsContent,
        {
          text: `${data.assetsInScope.length > 0 ? config.template.sections.length + 2 : config.template.sections.length + 1}. Validity and Document Management`,
          style: 'sectionTitle',
          margin: pad(0, 18, 0, 8),
        },
        {
          text: `This document was last reviewed on ${formatDate(data.report.issuedAt || new Date(), 'dd MMMM yyyy')}. This document remains valid and binding until superseded by a subsequent version approved through the Galaxy Backbone Limited internal approval matrix.`,
          fontSize: 10,
          lineHeight: 1.3,
        },
      ],
      styles: {
        orgName: { fontSize: 14, bold: true, color: primary },
        reportTitle: { fontSize: 18, bold: true, color: primary },
        sectionTitle: { fontSize: 14, bold: true, color: primary },
      },
    };
  }

  private _getHeaderConfig(config: TemplateConfig): RenderHeaderConfig {
    const header = isPlainRecord(config.template.headerConfig) ? config.template.headerConfig : {};
    return {
      orgName: readString(header, 'orgName', config.orgName),
      orgAddress: readString(header, 'address', config.orgAddress),
      reportTitle: readString(header, 'reportTitle', 'INTERNAL AUDIT REPORT'),
      classification: readString(header, 'classification', 'CONFIDENTIAL'),
      primaryColor: readColor(header, 'primaryColor', '003087'),
      accentColor: readColor(header, 'accentColor', '003087'),
    };
  }

  private _getFooterNotice(config: TemplateConfig): string {
    const footer = isPlainRecord(config.template.footerConfig) ? config.template.footerConfig : {};
    return readString(footer, 'confidentialityNotice', config.footerNotice);
  }

  private _getSignatureLabels(config: TemplateConfig): { preparedBy: string; reviewedBy: string; approvedBy: string } {
    const signature = isPlainRecord(config.template.signatureConfig) ? config.template.signatureConfig : {};
    return {
      preparedBy: readNestedLabel(signature, 'preparedBy', 'Prepared by'),
      reviewedBy: readNestedLabel(signature, 'reviewedBy', 'Reviewed by'),
      approvedBy: readNestedLabel(signature, 'approvedBy', 'Approved by'),
    };
  }

  private _escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ─────────── Export ───────────

  async exportReport(reportId: string, format: 'docx' | 'pdf'): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    const data = await this.fetchReportData(reportId);
    const today = formatDate(new Date(), 'yyyy-MM-dd');
    const filename = `GBB-IAR-${data.engagement.referenceNumber}-${today}.${format}`;
    const mimeType =
      format === 'docx'
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/pdf';

    const buffer = format === 'docx' ? await this.generateDocx(reportId) : await this.generatePdf(reportId);

    return { buffer, filename, mimeType };
  }
}
