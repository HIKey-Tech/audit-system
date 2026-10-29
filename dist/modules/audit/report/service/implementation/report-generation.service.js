"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportGenerationService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const docx_1 = require("docx");
const date_fns_1 = require("date-fns");
const pdf_util_1 = require("../../../../../shared/utils/pdf.util");
const working_paper_utility_1 = require("../../../working-papers/utility/working-paper.utility");
const markdown_utility_1 = require("../../../working-papers/utility/markdown.utility");
const prisma_client_1 = require("../../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../../shared/errors/app.error");
const logger_util_1 = require("../../../../../shared/utils/logger.util");
const workflow_enum_1 = require("../../../../workflow/domain/enum/workflow.enum");
const document_1 = require("../../../../document");
const GBB_LOGO_PATH = path.resolve(__dirname, '../../../../../assets/gbb-logo.png');
let cachedLogoBuffer = null;
const getGbbLogoBuffer = () => {
    if (cachedLogoBuffer)
        return cachedLogoBuffer;
    try {
        if (fs.existsSync(GBB_LOGO_PATH)) {
            cachedLogoBuffer = fs.readFileSync(GBB_LOGO_PATH);
            return cachedLogoBuffer;
        }
    }
    catch (err) {
        logger_util_1.logger.warn('Could not read GBB logo file', { err });
    }
    return null;
};
// ────────────────────────────────────────────────────────────
// Severity ordering & colours
// ────────────────────────────────────────────────────────────
const SEVERITY_ORDER = {
    critical: 1,
    high: 2,
    medium: 3,
    low: 4,
    informational: 5,
};
/** "excluded_reference" → "Excluded Reference"; leaves already-readable text alone. */
const titleCase = (value) => value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const SEVERITY_COLOURS = {
    critical: { bg: 'DC2626', text: 'FFFFFF' },
    high: { bg: 'EA580C', text: 'FFFFFF' },
    medium: { bg: 'CA8A04', text: '000000' },
    low: { bg: '16A34A', text: 'FFFFFF' },
    informational: { bg: '64748B', text: 'FFFFFF' },
};
const AUDIT_TYPE_LABEL = {
    it: 'IT Audit',
    financial: 'Financial Audit',
    compliance: 'Compliance Audit',
    systems: 'Systems Audit',
};
const FINDING_CATEGORY_LABEL = {
    it: 'IT',
    financial: 'Financial',
    compliance: 'Compliance',
    systems: 'Systems',
    operational: 'Operational',
};
const FINDING_STATUS_LABEL = {
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
const isPlainRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const readString = (record, key, fallback) => {
    const value = record[key];
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
};
const readColor = (record, key, fallback) => {
    const value = readString(record, key, fallback).replace(/^#/, '').trim();
    return /^[0-9a-fA-F]{6}$/.test(value) ? value.toUpperCase() : fallback;
};
const readNestedLabel = (record, key, fallback) => {
    const nested = record[key];
    if (!isPlainRecord(nested))
        return fallback;
    return readString(nested, 'label', fallback);
};
class ReportGenerationService {
    reportTemplateService;
    systemConfigService;
    approvalService;
    documentService;
    constructor(reportTemplateService, systemConfigService, approvalService, documentService = new document_1.DocumentService()) {
        this.reportTemplateService = reportTemplateService;
        this.systemConfigService = systemConfigService;
        this.approvalService = approvalService;
        this.documentService = documentService;
    }
    /** Load each approved step's recorded signature image, keyed by step id. Never throws. */
    async _stepSignatures(approval) {
        const map = new Map();
        for (const step of approval?.steps ?? []) {
            if (step.status !== 'approved' || !step.signatureId)
                continue;
            try {
                const sig = await prisma_client_1.prisma.user_Signature.findUnique({ where: { id: step.signatureId } });
                if (!sig)
                    continue;
                const file = await this.documentService.getFileById(sig.document_id);
                map.set(step.id, {
                    buffer: file.buffer,
                    dataUrl: `data:${file.mimeType};base64,${file.buffer.toString('base64')}`,
                    type: file.mimeType === 'image/jpeg' ? 'jpg' : 'png',
                });
            }
            catch {
                // Skip this approver's image; the text block still renders.
            }
        }
        return map;
    }
    /** The first reviewer (lowest approved level) and final approver (highest approved level). */
    _signOffSteps(approval) {
        const approved = (approval?.steps ?? [])
            .filter((s) => s.status === 'approved')
            .sort((a, b) => a.level - b.level);
        if (approved.length === 0)
            return {};
        const approvedStepId = approved[approved.length - 1].id;
        const reviewedStepId = approved.length > 1 ? approved[0].id : undefined;
        return { reviewedStepId, approvedStepId };
    }
    // ─────────── Data fetching ───────────
    async fetchReportData(reportId) {
        const report = await prisma_client_1.prisma.audit_Report.findFirst({
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
        if (!report)
            throw app_error_1.AppError.notFound('Audit report');
        let signOffMode = 'cae_and_dg';
        try {
            const modeRow = await prisma_client_1.prisma.system_Config.findUnique({
                where: { key: `report.sign_off_mode.${reportId}` },
                select: { value: true },
            });
            if (modeRow?.value === 'cae_only' || modeRow?.value === 'cae_and_dg') {
                signOffMode = modeRow.value;
            }
        }
        catch {
            // Fallback to default
        }
        const sortedFindings = [...report.engagement.findings].sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99));
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
                controlReference: f.checklist?.control_reference ?? null,
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
    async fetchTemplateAndConfig(templateId) {
        let template;
        if (templateId) {
            try {
                template = await this.reportTemplateService.getTemplateById(templateId);
            }
            catch {
                template = await this.reportTemplateService.getDefaultTemplate();
            }
        }
        else {
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
    async generateDocx(reportId) {
        const data = await this.fetchReportData(reportId);
        const config = await this.fetchTemplateAndConfig(data.report.templateId);
        let approval = null;
        try {
            approval = await this.approvalService.getApprovalByEntity(workflow_enum_1.WorkflowEntityType.AuditReport, reportId);
        }
        catch {
            approval = null;
        }
        const sigMap = await this._stepSignatures(approval);
        const doc = this._buildDocxDocument(data, config, approval, sigMap);
        const uint8Array = await docx_1.Packer.toBuffer(doc);
        return Buffer.from(uint8Array);
    }
    _buildDocxDocument(data, config, approval, sigMap) {
        const children = [];
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
        children.push(new docx_1.Paragraph({
            pageBreakBefore: true,
            children: [],
        }));
        // Sections
        config.template.sections.forEach((section, idx) => {
            children.push(new docx_1.Paragraph({
                spacing: { before: 240, after: 120 },
                children: [
                    new docx_1.TextRun({
                        text: `${idx + 1}. ${section.title}`,
                        bold: true,
                        size: 24,
                        color: header.primaryColor,
                    }),
                ],
            }));
            children.push(...this._buildDocxSectionContent(section.key, data));
        });
        // Assets in scope — appended when the engagement has linked assets
        if (data.assetsInScope.length > 0) {
            children.push(new docx_1.Paragraph({
                spacing: { before: 240, after: 120 },
                children: [
                    new docx_1.TextRun({
                        text: `${config.template.sections.length + 1}. Assets in Scope`,
                        bold: true,
                        size: 24,
                        color: header.primaryColor,
                    }),
                ],
            }));
            children.push(this._buildDocxAssetsInScopeTable(data.assetsInScope));
        }
        // Validity and Document Management section
        const validitySecNum = data.assetsInScope.length > 0 ? config.template.sections.length + 2 : config.template.sections.length + 1;
        children.push(new docx_1.Paragraph({
            spacing: { before: 240, after: 120 },
            children: [
                new docx_1.TextRun({
                    text: `${validitySecNum}. Validity and Document Management`,
                    bold: true,
                    size: 24,
                    color: header.primaryColor,
                }),
            ],
        }), new docx_1.Paragraph({
            spacing: { after: 240 },
            children: [
                new docx_1.TextRun({
                    text: `This document was last reviewed on ${(0, date_fns_1.format)(data.report.issuedAt || new Date(), 'dd MMMM yyyy')}. This document remains valid and binding until superseded by a subsequent version approved through the Galaxy Backbone Limited internal approval matrix.`,
                    size: 20,
                    color: '334155',
                }),
            ],
        }));
        // Footer notice
        children.push(new docx_1.Paragraph({
            spacing: { before: 240 },
            children: [
                new docx_1.TextRun({
                    text: footerNotice,
                    size: 18,
                    color: '64748B',
                    italics: true,
                }),
            ],
        }));
        return new docx_1.Document({
            sections: [
                {
                    properties: {
                        page: {
                            margin: {
                                top: (0, docx_1.convertInchesToTwip)(0.8),
                                bottom: (0, docx_1.convertInchesToTwip)(0.8),
                                left: (0, docx_1.convertInchesToTwip)(0.8),
                                right: (0, docx_1.convertInchesToTwip)(0.8),
                            },
                        },
                    },
                    footers: {
                        default: new docx_1.Footer({
                            children: [
                                new docx_1.Paragraph({
                                    alignment: docx_1.AlignmentType.CENTER,
                                    children: [
                                        new docx_1.TextRun({
                                            text: `${footerNotice} - Page `,
                                            size: 18,
                                            color: '64748B',
                                        }),
                                        new docx_1.TextRun({
                                            children: [docx_1.PageNumber.CURRENT],
                                            size: 18,
                                            color: '64748B',
                                        }),
                                        new docx_1.TextRun({
                                            text: ' of ',
                                            size: 18,
                                            color: '64748B',
                                        }),
                                        new docx_1.TextRun({
                                            children: [docx_1.PageNumber.TOTAL_PAGES],
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
    _buildDocxCoverHeader(data, header) {
        const items = [];
        const logoBuf = getGbbLogoBuffer();
        if (logoBuf) {
            items.push(new docx_1.Paragraph({
                alignment: docx_1.AlignmentType.CENTER,
                spacing: { before: 100, after: 120 },
                children: [
                    new docx_1.ImageRun({
                        type: 'png',
                        data: logoBuf,
                        transformation: { width: 140, height: 98 },
                    }),
                ],
            }));
        }
        items.push(new docx_1.Paragraph({
            alignment: docx_1.AlignmentType.CENTER,
            spacing: { before: 80, after: 180 },
            children: [
                new docx_1.TextRun({
                    text: 'Galaxy Backbone Limited',
                    bold: true,
                    size: 26,
                    color: '334155',
                }),
            ],
        }));
        // Title box (Table 1 in docx template) with 4F6228 border
        items.push(new docx_1.Table({
            rows: [
                new docx_1.TableRow({
                    children: [
                        new docx_1.TableCell({
                            shading: { fill: 'F8FAF8', type: docx_1.ShadingType.SOLID },
                            margins: { top: 240, bottom: 240, left: 240, right: 240 },
                            children: [
                                new docx_1.Paragraph({
                                    alignment: docx_1.AlignmentType.CENTER,
                                    spacing: { before: 100, after: 100 },
                                    children: [
                                        new docx_1.TextRun({
                                            text: data.report.title.toUpperCase(),
                                            bold: true,
                                            size: 32,
                                            color: header.primaryColor,
                                        }),
                                    ],
                                }),
                                new docx_1.Paragraph({
                                    alignment: docx_1.AlignmentType.CENTER,
                                    spacing: { before: 60, after: 100 },
                                    children: [
                                        new docx_1.TextRun({
                                            text: `Version ${data.report.versionNumber}.0`,
                                            bold: true,
                                            size: 22,
                                            color: '475569',
                                        }),
                                    ],
                                }),
                                new docx_1.Paragraph({
                                    alignment: docx_1.AlignmentType.CENTER,
                                    spacing: { before: 80, after: 40 },
                                    children: [
                                        new docx_1.TextRun({
                                            text: 'DOCUMENT REFERENCE NUMBER:',
                                            bold: true,
                                            size: 18,
                                            color: '64748B',
                                        }),
                                    ],
                                }),
                                new docx_1.Paragraph({
                                    alignment: docx_1.AlignmentType.CENTER,
                                    spacing: { before: 40, after: 100 },
                                    children: [
                                        new docx_1.TextRun({
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
            width: { size: 100, type: docx_1.WidthType.PERCENTAGE },
            borders: {
                top: { style: docx_1.BorderStyle.SINGLE, size: 24, color: '4F6228' },
                bottom: { style: docx_1.BorderStyle.SINGLE, size: 24, color: '4F6228' },
                left: { style: docx_1.BorderStyle.NONE, size: 0, color: 'auto' },
                right: { style: docx_1.BorderStyle.NONE, size: 0, color: 'auto' },
                insideHorizontal: { style: docx_1.BorderStyle.NONE, size: 0, color: 'auto' },
                insideVertical: { style: docx_1.BorderStyle.NONE, size: 0, color: 'auto' },
            },
        }));
        // Confidentiality Notice
        items.push(new docx_1.Paragraph({
            spacing: { before: 200, after: 180 },
            children: [
                new docx_1.TextRun({ text: 'Confidentiality: ', bold: true, size: 19 }),
                new docx_1.TextRun({
                    text: 'No part of this document may be disclosed verbally or in writing, including by reproduction, to any third party without the prior written consent of Galaxy Backbone Limited. This document, its associated appendices and any attachments remain the property of Galaxy Backbone Limited and shall be returned upon request.',
                    size: 19,
                    color: '334155',
                }),
            ],
        }));
        return items;
    }
    _buildDocxDocumentInfoTable(data, classification, approval) {
        let finalApproverName = data.report.signOffMode === 'cae_only'
            ? 'Head of Internal Audit (CAE)'
            : 'Managing Director / CEO';
        if (approval?.steps) {
            const approvedSteps = approval.steps.filter((s) => s.status === 'approved');
            if (approvedSteps.length > 0) {
                const highest = approvedSteps.reduce((max, s) => (s.level > max.level ? s : max));
                if (highest?.approver?.displayName)
                    finalApproverName = highest.approver.displayName;
            }
        }
        const leadAuditorName = data.engagement.leadAuditor.displayName ??
            `${data.engagement.leadAuditor.firstName} ${data.engagement.leadAuditor.lastName}`.trim() ??
            'Internal Audit Team';
        const rows = [
            this._docxMetadataRow('Document ID:', data.engagement.referenceNumber),
            this._docxMetadataRow('Document Version:', `Version ${data.report.versionNumber}.0`),
            this._docxMetadataRow('Date of Version:', (0, date_fns_1.format)(data.report.issuedAt || new Date(), 'dd/MM/yyyy')),
            this._docxMetadataRow('Document Division:', data.engagement.universe.name || 'Internal Audit & Assurance'),
            this._docxMetadataRow('Document Owner:', leadAuditorName),
            this._docxMetadataRow('Document Author:', leadAuditorName),
            this._docxMetadataRow('Approved by:', finalApproverName),
            this._docxMetadataRow('Document Classification:', classification),
            this._docxMetadataRow('Document Status:', data.report.status.toUpperCase()),
        ];
        return [
            new docx_1.Paragraph({
                spacing: { before: 200, after: 100 },
                children: [new docx_1.TextRun({ text: 'Document Information', bold: true, size: 22, color: '003087' })],
            }),
            new docx_1.Table({
                rows,
                width: { size: 100, type: docx_1.WidthType.PERCENTAGE },
                borders: {
                    top: { style: docx_1.BorderStyle.SINGLE, size: 4, color: '808080' },
                    bottom: { style: docx_1.BorderStyle.SINGLE, size: 4, color: '808080' },
                    left: { style: docx_1.BorderStyle.SINGLE, size: 4, color: '808080' },
                    right: { style: docx_1.BorderStyle.SINGLE, size: 4, color: '808080' },
                    insideHorizontal: { style: docx_1.BorderStyle.SINGLE, size: 4, color: '808080' },
                    insideVertical: { style: docx_1.BorderStyle.SINGLE, size: 4, color: '808080' },
                },
            }),
        ];
    }
    _buildDocxChangeHistoryTable(data) {
        const leadAuditorName = data.engagement.leadAuditor.displayName ??
            `${data.engagement.leadAuditor.firstName} ${data.engagement.leadAuditor.lastName}`.trim() ??
            'Internal Audit Team';
        const headerRow = new docx_1.TableRow({
            children: [
                this._docxHeaderCell('Version'),
                this._docxHeaderCell('Date'),
                this._docxHeaderCell('Created by'),
                this._docxHeaderCell('Change from Previous Version'),
            ],
        });
        const rows = [
            headerRow,
            new docx_1.TableRow({
                children: [
                    new docx_1.TableCell({ children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: 'Version 1.0' })] })] }),
                    new docx_1.TableCell({
                        children: [
                            new docx_1.Paragraph({
                                children: [
                                    new docx_1.TextRun({
                                        text: data.engagement.actualStartDate
                                            ? (0, date_fns_1.format)(data.engagement.actualStartDate, 'dd/MM/yyyy')
                                            : (0, date_fns_1.format)(new Date(), 'dd/MM/yyyy'),
                                    }),
                                ],
                            }),
                        ],
                    }),
                    new docx_1.TableCell({ children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: leadAuditorName })] })] }),
                    new docx_1.TableCell({ children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: 'Initial audit review formulation' })] })] }),
                ],
            }),
        ];
        if (data.report.versionNumber > 1) {
            rows.push(new docx_1.TableRow({
                children: [
                    new docx_1.TableCell({ children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: `Version ${data.report.versionNumber}.0` })] })] }),
                    new docx_1.TableCell({
                        children: [
                            new docx_1.Paragraph({
                                children: [new docx_1.TextRun({ text: (0, date_fns_1.format)(data.report.issuedAt || new Date(), 'dd/MM/yyyy') })],
                            }),
                        ],
                    }),
                    new docx_1.TableCell({ children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: leadAuditorName })] })] }),
                    new docx_1.TableCell({ children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: 'Audit review revision and approval' })] })] }),
                ],
            }));
        }
        return [
            new docx_1.Paragraph({
                spacing: { before: 200, after: 100 },
                children: [new docx_1.TextRun({ text: 'Change history', bold: true, size: 22, color: '003087' })],
            }),
            new docx_1.Table({
                rows,
                width: { size: 100, type: docx_1.WidthType.PERCENTAGE },
                borders: {
                    top: { style: docx_1.BorderStyle.SINGLE, size: 4, color: '808080' },
                    bottom: { style: docx_1.BorderStyle.SINGLE, size: 4, color: '808080' },
                    left: { style: docx_1.BorderStyle.SINGLE, size: 4, color: '808080' },
                    right: { style: docx_1.BorderStyle.SINGLE, size: 4, color: '808080' },
                    insideHorizontal: { style: docx_1.BorderStyle.SINGLE, size: 4, color: '808080' },
                    insideVertical: { style: docx_1.BorderStyle.SINGLE, size: 4, color: '808080' },
                },
            }),
        ];
    }
    _buildDocxDistributionTable(data) {
        const dateStr = (0, date_fns_1.format)(data.report.issuedAt || new Date(), 'dd/MM/yyyy');
        const verStr = `Version ${data.report.versionNumber}.0`;
        const headerRow = new docx_1.TableRow({
            children: [
                this._docxHeaderCell('Name'),
                this._docxHeaderCell('Version'),
                this._docxHeaderCell('Date'),
            ],
        });
        const rows = [
            headerRow,
            new docx_1.TableRow({
                children: [
                    new docx_1.TableCell({ children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: 'Board Audit Committee & Executive Management' })] })] }),
                    new docx_1.TableCell({ children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: verStr })] })] }),
                    new docx_1.TableCell({ children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: dateStr })] })] }),
                ],
            }),
            new docx_1.TableRow({
                children: [
                    new docx_1.TableCell({ children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: `Audited Entity (${data.engagement.universe.name})` })] })] }),
                    new docx_1.TableCell({ children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: verStr })] })] }),
                    new docx_1.TableCell({ children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: dateStr })] })] }),
                ],
            }),
        ];
        return [
            new docx_1.Paragraph({
                spacing: { before: 200, after: 100 },
                children: [new docx_1.TextRun({ text: 'Distribution List', bold: true, size: 22, color: '003087' })],
            }),
            new docx_1.Table({
                rows,
                width: { size: 100, type: docx_1.WidthType.PERCENTAGE },
                borders: {
                    top: { style: docx_1.BorderStyle.SINGLE, size: 4, color: '808080' },
                    bottom: { style: docx_1.BorderStyle.SINGLE, size: 4, color: '808080' },
                    left: { style: docx_1.BorderStyle.SINGLE, size: 4, color: '808080' },
                    right: { style: docx_1.BorderStyle.SINGLE, size: 4, color: '808080' },
                    insideHorizontal: { style: docx_1.BorderStyle.SINGLE, size: 4, color: '808080' },
                    insideVertical: { style: docx_1.BorderStyle.SINGLE, size: 4, color: '808080' },
                },
            }),
        ];
    }
    _buildDocxApprovalListTable(approval, sigMap, data) {
        const headerRow = new docx_1.TableRow({
            children: [
                this._docxHeaderCell('Name'),
                this._docxHeaderCell('Position'),
                this._docxHeaderCell('Signature'),
                this._docxHeaderCell('Date'),
            ],
        });
        const dataRows = [];
        const steps = approval?.steps ?? [];
        if (steps.length > 0) {
            const sortedSteps = [...steps].sort((a, b) => a.level - b.level);
            sortedSteps.forEach((step) => {
                const name = step.approver?.displayName || `Designated Approver (Level ${step.level})`;
                const position = step.approver?.jobTitle ||
                    (step.level === 1 ? 'Head of Unit / Reviewer' : step.level === 2 ? 'Executive Director' : 'Managing Director / CEO');
                const sigEntry = sigMap.get(step.id);
                const sigChildren = [];
                if (step.status === 'approved') {
                    if (sigEntry) {
                        sigChildren.push(new docx_1.Paragraph({
                            alignment: docx_1.AlignmentType.CENTER,
                            children: [
                                new docx_1.ImageRun({
                                    type: sigEntry.type,
                                    data: sigEntry.buffer,
                                    transformation: { width: 110, height: 38 },
                                }),
                            ],
                        }));
                    }
                    else {
                        sigChildren.push(new docx_1.Paragraph({
                            alignment: docx_1.AlignmentType.CENTER,
                            children: [new docx_1.TextRun({ text: '[Digitally Signed]', italics: true, bold: true, color: '166534' })],
                        }));
                    }
                }
                else if (step.status === 'rejected') {
                    sigChildren.push(new docx_1.Paragraph({
                        alignment: docx_1.AlignmentType.CENTER,
                        children: [new docx_1.TextRun({ text: 'Rejected', color: 'DC2626' })],
                    }));
                }
                else {
                    sigChildren.push(new docx_1.Paragraph({
                        alignment: docx_1.AlignmentType.CENTER,
                        children: [new docx_1.TextRun({ text: 'Pending Approval', italics: true, color: '64748B' })],
                    }));
                }
                const dateStr = step.actedAt ? (0, date_fns_1.format)(new Date(step.actedAt), 'dd/MM/yyyy') : '—';
                dataRows.push(new docx_1.TableRow({
                    children: [
                        new docx_1.TableCell({ children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: name, bold: true })] })] }),
                        new docx_1.TableCell({ children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: position })] })] }),
                        new docx_1.TableCell({ children: sigChildren }),
                        new docx_1.TableCell({ children: [new docx_1.Paragraph({ alignment: docx_1.AlignmentType.CENTER, children: [new docx_1.TextRun({ text: dateStr })] })] }),
                    ],
                }));
            });
        }
        else {
            const defaultApprovers = data.report.signOffMode === 'cae_only'
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
                dataRows.push(new docx_1.TableRow({
                    children: [
                        new docx_1.TableCell({ children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: def.name, bold: true })] })] }),
                        new docx_1.TableCell({ children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: def.pos })] })] }),
                        new docx_1.TableCell({ children: [new docx_1.Paragraph({ alignment: docx_1.AlignmentType.CENTER, children: [new docx_1.TextRun({ text: 'Pending Submission', italics: true, color: '64748B' })] })] }),
                        new docx_1.TableCell({ children: [new docx_1.Paragraph({ alignment: docx_1.AlignmentType.CENTER, children: [new docx_1.TextRun({ text: '—' })] })] }),
                    ],
                }));
            });
        }
        return [
            new docx_1.Paragraph({
                spacing: { before: 200, after: 100 },
                children: [new docx_1.TextRun({ text: 'Approval List', bold: true, size: 22, color: '003087' })],
            }),
            new docx_1.Table({
                rows: [headerRow, ...dataRows],
                width: { size: 100, type: docx_1.WidthType.PERCENTAGE },
                borders: {
                    top: { style: docx_1.BorderStyle.SINGLE, size: 4, color: '808080' },
                    bottom: { style: docx_1.BorderStyle.SINGLE, size: 4, color: '808080' },
                    left: { style: docx_1.BorderStyle.SINGLE, size: 4, color: '808080' },
                    right: { style: docx_1.BorderStyle.SINGLE, size: 4, color: '808080' },
                    insideHorizontal: { style: docx_1.BorderStyle.SINGLE, size: 4, color: '808080' },
                    insideVertical: { style: docx_1.BorderStyle.SINGLE, size: 4, color: '808080' },
                },
            }),
        ];
    }
    _buildDocxChangeControlAndToc() {
        return [
            new docx_1.Paragraph({
                spacing: { before: 180, after: 140 },
                children: [
                    new docx_1.TextRun({ text: 'Change Control: ', bold: true, size: 18 }),
                    new docx_1.TextRun({
                        text: 'The contents of this document are subject to change control. Any proposed amendments should be submitted to the Document Owner for review and approval prior to implementation.',
                        italics: true,
                        size: 18,
                        color: '475569',
                    }),
                ],
            }),
            new docx_1.Paragraph({
                spacing: { before: 180, after: 80 },
                children: [new docx_1.TextRun({ text: 'Table of Contents', bold: true, size: 22, color: '003087' })],
            }),
            new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: '1. Executive Summary', size: 20 })] }),
            new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: '2. Audit Scope', size: 20 })] }),
            new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: '3. Methodology', size: 20 })] }),
            new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: '4. Findings Summary Table', size: 20 })] }),
            new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: '5. Detailed Findings', size: 20 })] }),
            new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: '6. Assets in Scope', size: 20 })] }),
            new docx_1.Paragraph({
                spacing: { after: 240 },
                children: [new docx_1.TextRun({ text: '7. Validity and Document Management', size: 20 })],
            }),
        ];
    }
    _buildDocxHeader(header) {
        return [
            new docx_1.Paragraph({
                alignment: docx_1.AlignmentType.CENTER,
                children: [new docx_1.TextRun({ text: header.orgName, size: 20, color: header.primaryColor })],
            }),
            new docx_1.Paragraph({
                alignment: docx_1.AlignmentType.CENTER,
                spacing: { before: 120, after: 120 },
                children: [
                    new docx_1.TextRun({
                        text: header.reportTitle,
                        bold: true,
                        size: 28,
                        color: header.primaryColor,
                        allCaps: true,
                    }),
                ],
            }),
            new docx_1.Paragraph({
                alignment: docx_1.AlignmentType.CENTER,
                children: [new docx_1.TextRun({ text: header.orgAddress, size: 18, color: '64748B' })],
            }),
            new docx_1.Paragraph({
                spacing: { before: 120, after: 240 },
                border: {
                    bottom: { color: header.accentColor, space: 1, style: docx_1.BorderStyle.SINGLE, size: 12 },
                },
                children: [],
            }),
        ];
    }
    _buildDocxMetadataTable(data, classification) {
        const rows = [
            this._docxMetadataRow('Report Reference', data.engagement.referenceNumber),
            this._docxMetadataRow('Audit Type', AUDIT_TYPE_LABEL[data.engagement.auditType] ?? data.engagement.auditType),
            this._docxMetadataRow('Audited Entity', data.engagement.universe.name),
            this._docxMetadataRow('Audit Period', `${(0, date_fns_1.format)(data.engagement.plannedStartDate, 'dd MMM yyyy')} to ${(0, date_fns_1.format)(data.engagement.plannedEndDate, 'dd MMM yyyy')}`),
            this._docxMetadataRow('Report Date', data.report.issuedAt ? (0, date_fns_1.format)(data.report.issuedAt, 'dd MMMM yyyy') : 'Not yet issued'),
            this._docxMetadataRow('Classification', classification),
        ];
        return new docx_1.Table({
            rows,
            width: { size: 100, type: docx_1.WidthType.PERCENTAGE },
            borders: {
                top: { style: docx_1.BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                bottom: { style: docx_1.BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                left: { style: docx_1.BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                right: { style: docx_1.BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                insideHorizontal: { style: docx_1.BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                insideVertical: { style: docx_1.BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
            },
        });
    }
    _docxMetadataRow(label, value) {
        const isConfidential = label === 'Classification';
        return new docx_1.TableRow({
            children: [
                new docx_1.TableCell({
                    children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: label, bold: true })] })],
                    width: { size: 30, type: docx_1.WidthType.PERCENTAGE },
                    shading: { fill: 'F3F4F6', type: docx_1.ShadingType.SOLID },
                }),
                new docx_1.TableCell({
                    children: [
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: value, bold: isConfidential })],
                        }),
                    ],
                    width: { size: 70, type: docx_1.WidthType.PERCENTAGE },
                }),
            ],
        });
    }
    _htmlOrTextToDocxBlocks(rawText) {
        if (!rawText || !rawText.trim()) {
            return [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: 'N/A' })] })];
        }
        const { markdown, images } = (0, working_paper_utility_1.htmlFragmentToMarkdownAndImages)(rawText);
        const blocks = [];
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
                const tableLines = [];
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
                        return new docx_1.TableRow({
                            children: cells.map((cellText) => new docx_1.TableCell({
                                children: [
                                    new docx_1.Paragraph({
                                        children: [
                                            new docx_1.TextRun({
                                                text: cellText.replace(/\*\*/g, ''),
                                                bold: rIdx === 0,
                                                color: rIdx === 0 ? 'FFFFFF' : '1E293B',
                                            }),
                                        ],
                                    }),
                                ],
                                shading: rIdx === 0 ? { fill: '003087', type: docx_1.ShadingType.SOLID } : undefined,
                                verticalAlign: docx_1.VerticalAlign.CENTER,
                            })),
                        });
                    });
                    blocks.push(new docx_1.Table({
                        rows,
                        width: { size: 100, type: docx_1.WidthType.PERCENTAGE },
                        borders: {
                            top: { style: docx_1.BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                            bottom: { style: docx_1.BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                            left: { style: docx_1.BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                            right: { style: docx_1.BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                            insideHorizontal: { style: docx_1.BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                            insideVertical: { style: docx_1.BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                        },
                    }));
                }
                continue;
            }
            // Headings
            const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
            if (headingMatch) {
                const level = headingMatch[1].length;
                const text = headingMatch[2].replace(/\*\*/g, '');
                blocks.push(new docx_1.Paragraph({
                    spacing: { before: 160, after: 80 },
                    children: [
                        new docx_1.TextRun({
                            text,
                            bold: true,
                            size: level === 1 ? 26 : level === 2 ? 24 : 22,
                            color: '003087',
                        }),
                    ],
                }));
                idx++;
                continue;
            }
            // Bullet / numbered lists
            const bulletMatch = line.match(/^[-*•]\s+(.+)$/);
            if (bulletMatch) {
                blocks.push(new docx_1.Paragraph({
                    spacing: { before: 40, after: 40 },
                    children: this._parseInlineBoldRuns(`• ${bulletMatch[1]}`),
                }));
                idx++;
                continue;
            }
            blocks.push(new docx_1.Paragraph({
                spacing: { before: 60, after: 60 },
                children: this._parseInlineBoldRuns(line),
            }));
            idx++;
        }
        // Append inline base64 images
        for (const dataUrl of images) {
            const m = dataUrl.match(/^data:image\/(png|jpe?g);base64,(.+)$/i);
            if (m) {
                try {
                    const imgType = m[1].toLowerCase() === 'png' ? 'png' : 'jpg';
                    const imgBuffer = Buffer.from(m[2], 'base64');
                    blocks.push(new docx_1.Paragraph({
                        alignment: docx_1.AlignmentType.CENTER,
                        spacing: { before: 120, after: 120 },
                        children: [
                            new docx_1.ImageRun({
                                type: imgType,
                                data: imgBuffer,
                                transformation: { width: 420, height: 260 },
                            }),
                        ],
                    }));
                }
                catch {
                    // Ignore malformed inline image
                }
            }
        }
        return blocks.length > 0 ? blocks : [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: rawText })] })];
    }
    _parseInlineBoldRuns(text) {
        const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
        return parts.map((part) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return new docx_1.TextRun({ text: part.slice(2, -2), bold: true });
            }
            return new docx_1.TextRun({ text: part });
        });
    }
    _htmlOrTextToPdfBlocks(rawText) {
        if (!rawText || !rawText.trim()) {
            return [{ text: 'N/A' }];
        }
        const { markdown, images } = (0, working_paper_utility_1.htmlFragmentToMarkdownAndImages)(rawText);
        const content = [...(0, markdown_utility_1.markdownToPdfContent)(markdown)];
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
    _buildDocxSectionContent(key, data) {
        switch (key) {
            case 'executive_summary':
                return this._htmlOrTextToDocxBlocks(data.report.executiveSummary);
            case 'background':
                return [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: 'Refer to engagement details above.' })] })];
            case 'objectives':
                return this._htmlOrTextToDocxBlocks(data.report.scope);
            case 'methodology':
                return this._htmlOrTextToDocxBlocks(data.report.methodology);
            case 'findings_summary':
                return [this._buildDocxFindingsSummaryTable(data.findings)];
            case 'detailed_findings':
                return this._buildDocxDetailedFindings(data.findings);
            case 'conclusion':
                return [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: 'See findings and recommendations above.' })] })];
            default:
                return [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: '' })] })];
        }
    }
    _buildDocxFindingsSummaryTable(findings) {
        const headerRow = new docx_1.TableRow({
            children: [
                this._docxHeaderCell('No.'),
                this._docxHeaderCell('Finding Title'),
                this._docxHeaderCell('Category'),
                this._docxHeaderCell('Severity'),
                this._docxHeaderCell('Status'),
                this._docxHeaderCell('Due Date'),
            ],
        });
        const dataRows = findings.map((f, idx) => new docx_1.TableRow({
            children: [
                new docx_1.TableCell({
                    children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: String(idx + 1) })] })],
                    verticalAlign: docx_1.VerticalAlign.CENTER,
                }),
                new docx_1.TableCell({
                    children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: f.title })] })],
                    verticalAlign: docx_1.VerticalAlign.CENTER,
                }),
                new docx_1.TableCell({
                    children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: FINDING_CATEGORY_LABEL[f.category] ?? f.category })] })],
                    verticalAlign: docx_1.VerticalAlign.CENTER,
                }),
                this._severityDocxCell(f.severity),
                new docx_1.TableCell({
                    children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: FINDING_STATUS_LABEL[f.status] ?? f.status })] })],
                    verticalAlign: docx_1.VerticalAlign.CENTER,
                }),
                new docx_1.TableCell({
                    children: [
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: (0, date_fns_1.format)(f.dueDate, 'dd MMM yyyy') })],
                        }),
                    ],
                    verticalAlign: docx_1.VerticalAlign.CENTER,
                }),
            ],
        }));
        return new docx_1.Table({
            rows: [headerRow, ...dataRows],
            width: { size: 100, type: docx_1.WidthType.PERCENTAGE },
            borders: {
                top: { style: docx_1.BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                bottom: { style: docx_1.BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                left: { style: docx_1.BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                right: { style: docx_1.BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                insideHorizontal: { style: docx_1.BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                insideVertical: { style: docx_1.BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
            },
        });
    }
    _buildDocxAssetsInScopeTable(assets) {
        const headerRow = new docx_1.TableRow({
            children: [
                this._docxHeaderCell('Tag'),
                this._docxHeaderCell('Asset'),
                this._docxHeaderCell('Type'),
                this._docxHeaderCell('Criticality'),
                this._docxHeaderCell('Scope Role'),
            ],
        });
        const dataRows = assets.map((a) => new docx_1.TableRow({
            children: [a.assetTag, a.name, a.assetType, a.criticality, a.scopeRole].map((v) => new docx_1.TableCell({
                children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: titleCase(v) })] })],
                verticalAlign: docx_1.VerticalAlign.CENTER,
            })),
        }));
        return new docx_1.Table({
            rows: [headerRow, ...dataRows],
            width: { size: 100, type: docx_1.WidthType.PERCENTAGE },
            borders: {
                top: { style: docx_1.BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                bottom: { style: docx_1.BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                left: { style: docx_1.BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                right: { style: docx_1.BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                insideHorizontal: { style: docx_1.BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                insideVertical: { style: docx_1.BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
            },
        });
    }
    _docxHeaderCell(text) {
        return new docx_1.TableCell({
            children: [
                new docx_1.Paragraph({
                    alignment: docx_1.AlignmentType.CENTER,
                    children: [new docx_1.TextRun({ text, bold: true, color: 'FFFFFF' })],
                }),
            ],
            shading: { fill: '003087', type: docx_1.ShadingType.SOLID },
            verticalAlign: docx_1.VerticalAlign.CENTER,
        });
    }
    _severityDocxCell(severity) {
        const colour = SEVERITY_COLOURS[severity.toLowerCase()] ?? { bg: '64748B', text: 'FFFFFF' };
        return new docx_1.TableCell({
            children: [
                new docx_1.Paragraph({
                    alignment: docx_1.AlignmentType.CENTER,
                    children: [
                        new docx_1.TextRun({
                            text: severity.toUpperCase(),
                            bold: true,
                            color: colour.text,
                        }),
                    ],
                }),
            ],
            shading: { fill: colour.bg, type: docx_1.ShadingType.SOLID },
            verticalAlign: docx_1.VerticalAlign.CENTER,
        });
    }
    _buildDocxDetailedFindings(findings) {
        const result = [];
        findings.forEach((f, idx) => {
            // Heading
            result.push(new docx_1.Paragraph({
                spacing: { before: 240, after: 120 },
                children: [
                    new docx_1.TextRun({
                        text: `Finding ${idx + 1}: ${f.title}`,
                        bold: true,
                        size: 22,
                    }),
                ],
            }));
            // Details table
            result.push(this._buildDocxFindingDetailsTable(f));
            // Description
            result.push(new docx_1.Paragraph({
                spacing: { before: 120 },
                children: [
                    new docx_1.TextRun({ text: 'Description: ', bold: true }),
                    new docx_1.TextRun({ text: f.description }),
                ],
            }));
            // Root Cause
            result.push(new docx_1.Paragraph({
                children: [
                    new docx_1.TextRun({ text: 'Root Cause: ', bold: true }),
                    new docx_1.TextRun({ text: f.rootCause }),
                ],
            }));
            // Risk Implication
            result.push(new docx_1.Paragraph({
                children: [
                    new docx_1.TextRun({ text: 'Risk Implication: ', bold: true }),
                    new docx_1.TextRun({ text: f.riskImplication }),
                ],
            }));
            // Recommendation
            result.push(new docx_1.Paragraph({
                children: [
                    new docx_1.TextRun({ text: 'Recommendation: ', bold: true }),
                    new docx_1.TextRun({ text: f.recommendation }),
                ],
            }));
            // Management Response (always shown so the report captures auditee response status)
            if (f.followUp?.managementResponse) {
                const responder = f.followUp.managementResponseBy;
                const responderName = responder?.displayName ??
                    `${responder?.firstName ?? ''} ${responder?.lastName ?? ''}`.trim() ??
                    'N/A';
                const responseDate = f.followUp.managementResponseAt
                    ? (0, date_fns_1.format)(f.followUp.managementResponseAt, 'dd MMM yyyy')
                    : '';
                result.push(new docx_1.Paragraph({
                    spacing: { before: 120 },
                    children: [
                        new docx_1.TextRun({ text: 'Management Response: ', bold: true }),
                        new docx_1.TextRun({ text: f.followUp.managementResponse }),
                    ],
                }));
                result.push(new docx_1.Paragraph({
                    children: [
                        new docx_1.TextRun({
                            text: `Submitted by: ${responderName}${responseDate ? ` on ${responseDate}` : ''}`,
                            italics: true,
                            size: 20,
                        }),
                    ],
                }));
            }
            else {
                result.push(new docx_1.Paragraph({
                    spacing: { before: 120 },
                    children: [
                        new docx_1.TextRun({ text: 'Management Response: ', bold: true }),
                        new docx_1.TextRun({ text: 'Awaiting management response from auditee.', italics: true }),
                    ],
                }));
            }
            // Verification
            if (f.followUp?.verifiedAt) {
                const verifier = f.followUp.verifiedBy;
                const verifierName = verifier?.displayName ??
                    `${verifier?.firstName ?? ''} ${verifier?.lastName ?? ''}`.trim() ??
                    'N/A';
                const verifyDate = f.followUp.verifiedAt
                    ? (0, date_fns_1.format)(f.followUp.verifiedAt, 'dd MMM yyyy')
                    : '';
                result.push(new docx_1.Paragraph({
                    spacing: { before: 120 },
                    children: [
                        new docx_1.TextRun({ text: 'Verification Status: ', bold: true }),
                        new docx_1.TextRun({ text: f.followUp.verificationStatus }),
                    ],
                }));
                result.push(new docx_1.Paragraph({
                    children: [
                        new docx_1.TextRun({
                            text: `Verified by: ${verifierName} on ${verifyDate}`,
                            italics: true,
                            size: 20,
                        }),
                    ],
                }));
                result.push(new docx_1.Paragraph({
                    children: [
                        new docx_1.TextRun({ text: 'Verification Notes: ', bold: true }),
                        new docx_1.TextRun({ text: f.followUp.verificationNotes ?? 'N/A' }),
                    ],
                }));
            }
            // Separator
            if (idx < findings.length - 1) {
                result.push(new docx_1.Paragraph({
                    spacing: { before: 120, after: 120 },
                    border: {
                        bottom: { color: 'CCCCCC', space: 1, style: docx_1.BorderStyle.SINGLE, size: 6 },
                    },
                    children: [],
                }));
            }
        });
        return result;
    }
    _buildDocxFindingDetailsTable(finding) {
        const auditeeName = finding.auditee.displayName ??
            `${finding.auditee.firstName} ${finding.auditee.lastName}`.trim() ??
            'N/A';
        const rows = [
            new docx_1.TableRow({
                children: [
                    new docx_1.TableCell({
                        children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: 'Severity', bold: true })] })],
                        width: { size: 20, type: docx_1.WidthType.PERCENTAGE },
                        shading: { fill: 'F8F9FA', type: docx_1.ShadingType.SOLID },
                    }),
                    this._severityDocxCell(finding.severity),
                ],
            }),
            new docx_1.TableRow({
                children: [
                    new docx_1.TableCell({
                        children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: 'Category', bold: true })] })],
                        width: { size: 20, type: docx_1.WidthType.PERCENTAGE },
                        shading: { fill: 'F8F9FA', type: docx_1.ShadingType.SOLID },
                    }),
                    new docx_1.TableCell({
                        children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: FINDING_CATEGORY_LABEL[finding.category] ?? finding.category })] })],
                    }),
                ],
            }),
        ];
        if (finding.controlReference) {
            rows.push(new docx_1.TableRow({
                children: [
                    new docx_1.TableCell({
                        children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: 'Control Reference', bold: true })] })],
                        width: { size: 20, type: docx_1.WidthType.PERCENTAGE },
                        shading: { fill: 'F8F9FA', type: docx_1.ShadingType.SOLID },
                    }),
                    new docx_1.TableCell({
                        children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: finding.controlReference })] })],
                    }),
                ],
            }));
        }
        rows.push(new docx_1.TableRow({
            children: [
                new docx_1.TableCell({
                    children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: 'Status', bold: true })] })],
                    width: { size: 20, type: docx_1.WidthType.PERCENTAGE },
                    shading: { fill: 'F8F9FA', type: docx_1.ShadingType.SOLID },
                }),
                new docx_1.TableCell({
                    children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: FINDING_STATUS_LABEL[finding.status] ?? finding.status })] })],
                }),
            ],
        }), new docx_1.TableRow({
            children: [
                new docx_1.TableCell({
                    children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: 'Due Date', bold: true })] })],
                    width: { size: 20, type: docx_1.WidthType.PERCENTAGE },
                    shading: { fill: 'F8F9FA', type: docx_1.ShadingType.SOLID },
                }),
                new docx_1.TableCell({
                    children: [
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: (0, date_fns_1.format)(finding.dueDate, 'dd MMM yyyy') })],
                        }),
                    ],
                }),
            ],
        }), new docx_1.TableRow({
            children: [
                new docx_1.TableCell({
                    children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: 'Auditee', bold: true })] })],
                    width: { size: 20, type: docx_1.WidthType.PERCENTAGE },
                    shading: { fill: 'F8F9FA', type: docx_1.ShadingType.SOLID },
                }),
                new docx_1.TableCell({
                    children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: auditeeName })] })],
                }),
            ],
        }));
        return new docx_1.Table({
            rows,
            width: { size: 100, type: docx_1.WidthType.PERCENTAGE },
            borders: {
                top: { style: docx_1.BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                bottom: { style: docx_1.BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                left: { style: docx_1.BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                right: { style: docx_1.BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                insideHorizontal: { style: docx_1.BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                insideVertical: { style: docx_1.BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
            },
        });
    }
    _buildDocxSignatureBlock(data, approval, config, sigMap) {
        const labels = this._getSignatureLabels(config);
        const { reviewedStepId, approvedStepId } = this._signOffSteps(approval);
        const sigParagraphs = (stepId) => {
            const entry = stepId ? sigMap.get(stepId) : undefined;
            return entry
                ? [
                    new docx_1.Paragraph({
                        children: [
                            new docx_1.ImageRun({ type: entry.type, data: entry.buffer, transformation: { width: 120, height: 42 } }),
                        ],
                    }),
                ]
                : [];
        };
        const leadAuditorName = data.engagement.leadAuditor.displayName ??
            `${data.engagement.leadAuditor.firstName} ${data.engagement.leadAuditor.lastName}`.trim() ??
            'N/A';
        const leadAuditorTitle = data.engagement.leadAuditor.jobTitle ?? '';
        const preparedDate = data.engagement.actualStartDate
            ? (0, date_fns_1.format)(data.engagement.actualStartDate, 'dd MMM yyyy')
            : '';
        const auditManagerName = data.engagement.auditManager.displayName ??
            `${data.engagement.auditManager.firstName} ${data.engagement.auditManager.lastName}`.trim() ??
            'N/A';
        const auditManagerTitle = data.engagement.auditManager.jobTitle ?? '';
        let caeApproverName = data.report.signOffMode === 'cae_only'
            ? 'Head of Internal Audit (Pending)'
            : 'Head of Internal Audit / DG (Pending)';
        if (approval?.steps) {
            const approvedSteps = approval.steps.filter((s) => s.status === 'approved');
            const highest = approvedSteps.length > 0
                ? approvedSteps.reduce((max, s) => (s.level > max.level ? s : max))
                : undefined;
            if (highest?.approver?.displayName) {
                caeApproverName = highest.approver.displayName;
            }
        }
        return new docx_1.Table({
            rows: [
                new docx_1.TableRow({
                    children: [
                        new docx_1.TableCell({
                            children: [
                                new docx_1.Paragraph({
                                    children: [
                                        new docx_1.TextRun({ text: `${labels.preparedBy}:`, bold: true, color: '003087' }),
                                    ],
                                }),
                                new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: leadAuditorName })] }),
                                new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: leadAuditorTitle })] }),
                                new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: preparedDate })] }),
                            ],
                            width: { size: 33, type: docx_1.WidthType.PERCENTAGE },
                        }),
                        new docx_1.TableCell({
                            children: [
                                new docx_1.Paragraph({
                                    children: [
                                        new docx_1.TextRun({ text: `${labels.reviewedBy}:`, bold: true, color: '003087' }),
                                    ],
                                }),
                                ...sigParagraphs(reviewedStepId),
                                new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: auditManagerName })] }),
                                new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: auditManagerTitle })] }),
                            ],
                            width: { size: 33, type: docx_1.WidthType.PERCENTAGE },
                        }),
                        new docx_1.TableCell({
                            children: [
                                new docx_1.Paragraph({
                                    children: [
                                        new docx_1.TextRun({ text: `${labels.approvedBy}:`, bold: true, color: '003087' }),
                                    ],
                                }),
                                ...sigParagraphs(approvedStepId),
                                new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: caeApproverName })] }),
                            ],
                            width: { size: 34, type: docx_1.WidthType.PERCENTAGE },
                        }),
                    ],
                }),
            ],
            width: { size: 100, type: docx_1.WidthType.PERCENTAGE },
            borders: {
                top: { style: docx_1.BorderStyle.NONE },
                bottom: { style: docx_1.BorderStyle.NONE },
                left: { style: docx_1.BorderStyle.NONE },
                right: { style: docx_1.BorderStyle.NONE },
                insideHorizontal: { style: docx_1.BorderStyle.NONE },
                insideVertical: { style: docx_1.BorderStyle.NONE },
            },
        });
    }
    // ─────────── PDF generation ───────────
    async generatePdf(reportId) {
        const data = await this.fetchReportData(reportId);
        const config = await this.fetchTemplateAndConfig(data.report.templateId);
        let approval = null;
        try {
            approval = await this.approvalService.getApprovalByEntity(workflow_enum_1.WorkflowEntityType.AuditReport, reportId);
        }
        catch {
            approval = null;
        }
        const sigMap = await this._stepSignatures(approval);
        return (0, pdf_util_1.renderPdf)(this._buildPdfDocDefinition(data, config, approval, sigMap));
    }
    _buildPdfDocDefinition(data, config, approval, sigMap) {
        const header = this._getHeaderConfig(config);
        const footerNotice = this._getFooterNotice(config);
        const labels = this._getSignatureLabels(config);
        const { reviewedStepId, approvedStepId } = this._signOffSteps(approval);
        const primary = (0, pdf_util_1.hexColor)(header.primaryColor);
        const accent = (0, pdf_util_1.hexColor)(header.accentColor);
        const sigImg = (stepId) => {
            const entry = stepId ? sigMap.get(stepId) : undefined;
            return entry ? { image: entry.dataUrl, fit: [120, 42], margin: [0, 4, 0, 4] } : null;
        };
        /** "Label: value" line with the label bolded in the brand colour. */
        const labeled = (label, value) => ({
            text: [{ text: `${label}: `, bold: true, color: primary }, value],
            margin: [0, 3, 0, 3],
        });
        /** A label cell for the metadata / details tables. */
        const labelCell = (text) => ({ text, bold: true, color: primary, fillColor: '#F8F9FA' });
        const leadAuditorName = data.engagement.leadAuditor.displayName ??
            `${data.engagement.leadAuditor.firstName} ${data.engagement.leadAuditor.lastName}`.trim() ??
            'N/A';
        const leadAuditorTitle = data.engagement.leadAuditor.jobTitle ?? '';
        const preparedDate = data.engagement.actualStartDate
            ? (0, date_fns_1.format)(data.engagement.actualStartDate, 'dd MMM yyyy')
            : '';
        const auditManagerName = data.engagement.auditManager.displayName ??
            `${data.engagement.auditManager.firstName} ${data.engagement.auditManager.lastName}`.trim() ??
            'N/A';
        const auditManagerTitle = data.engagement.auditManager.jobTitle ?? '';
        let caeApproverName = data.report.signOffMode === 'cae_only'
            ? 'Head of Internal Audit (Pending)'
            : 'Head of Internal Audit / DG (Pending)';
        if (approval?.steps) {
            const approvedSteps = approval.steps.filter((s) => s.status === 'approved');
            const highest = approvedSteps.length > 0
                ? approvedSteps.reduce((max, s) => (s.level > max.level ? s : max))
                : undefined;
            if (highest?.approver?.displayName) {
                caeApproverName = highest.approver.displayName;
            }
        }
        const findingsSummaryTable = {
            table: {
                headerRows: 1,
                widths: [22, '*', 80, 64, 70, 64],
                body: [
                    ['No.', 'Finding Title', 'Category', 'Severity', 'Status', 'Due Date'].map((h) => ({ text: h, bold: true, color: '#FFFFFF', fillColor: primary })),
                    ...data.findings.map((f, idx) => [
                        { text: String(idx + 1) },
                        { text: f.title },
                        { text: FINDING_CATEGORY_LABEL[f.category] ?? f.category },
                        (0, pdf_util_1.severityBadge)(f.severity),
                        { text: FINDING_STATUS_LABEL[f.status] ?? f.status },
                        { text: (0, date_fns_1.format)(f.dueDate, 'dd MMM yyyy') },
                    ]),
                ],
            },
            layout: pdf_util_1.borderedTableLayout,
            margin: [0, 4, 0, 0],
        };
        const detailedFindingsContent = [];
        data.findings.forEach((f, idx) => {
            const auditeeName = f.auditee.displayName ?? `${f.auditee.firstName} ${f.auditee.lastName}`.trim() ?? 'N/A';
            const detailsBody = [
                [labelCell('Severity'), (0, pdf_util_1.severityBadge)(f.severity)],
                [labelCell('Category'), { text: FINDING_CATEGORY_LABEL[f.category] ?? f.category }],
            ];
            if (f.controlReference) {
                detailsBody.push([labelCell('Control Reference'), { text: f.controlReference }]);
            }
            detailsBody.push([labelCell('Status'), { text: FINDING_STATUS_LABEL[f.status] ?? f.status }], [labelCell('Due Date'), { text: (0, date_fns_1.format)(f.dueDate, 'dd MMM yyyy') }], [labelCell('Auditee'), { text: auditeeName }]);
            detailedFindingsContent.push({ text: `Finding ${idx + 1}: ${f.title}`, bold: true, fontSize: 12, margin: [0, 14, 0, 6] }, {
                table: {
                    widths: [110, '*'],
                    body: detailsBody,
                },
                layout: pdf_util_1.borderedTableLayout,
                margin: [0, 0, 0, 6],
            }, labeled('Description', f.description), labeled('Root Cause', f.rootCause), labeled('Risk Implication', f.riskImplication), labeled('Recommendation', f.recommendation));
            if (f.followUp?.managementResponse) {
                const responder = f.followUp.managementResponseBy;
                const responderName = responder?.displayName ??
                    `${responder?.firstName ?? ''} ${responder?.lastName ?? ''}`.trim() ??
                    'N/A';
                const responseDate = f.followUp.managementResponseAt
                    ? (0, date_fns_1.format)(f.followUp.managementResponseAt, 'dd MMM yyyy')
                    : '';
                detailedFindingsContent.push(labeled('Management Response', f.followUp.managementResponse), { text: `Submitted by: ${responderName}${responseDate ? ` on ${responseDate}` : ''}`, italics: true, fontSize: 10, color: '#64748B', margin: [0, 0, 0, 3] });
            }
            else {
                detailedFindingsContent.push(labeled('Management Response', 'Awaiting management response from auditee.'));
            }
            if (f.followUp?.verifiedAt) {
                const verifier = f.followUp.verifiedBy;
                const verifierName = verifier?.displayName ??
                    `${verifier?.firstName ?? ''} ${verifier?.lastName ?? ''}`.trim() ??
                    'N/A';
                const verifyDate = (0, date_fns_1.format)(f.followUp.verifiedAt, 'dd MMM yyyy');
                detailedFindingsContent.push(labeled('Verification Status', f.followUp.verificationStatus), { text: `Verified by: ${verifierName} on ${verifyDate}`, italics: true, fontSize: 10, color: '#64748B', margin: [0, 0, 0, 3] }, labeled('Verification Notes', f.followUp.verificationNotes ?? 'N/A'));
            }
            if (idx < data.findings.length - 1) {
                detailedFindingsContent.push({
                    canvas: [{ type: 'line', x1: 0, y1: 0, x2: 482, y2: 0, lineWidth: 1, lineColor: '#cccccc' }],
                    margin: [0, 10, 0, 10],
                });
            }
        });
        const sectionsContent = [];
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
                layout: pdf_util_1.borderedTableLayout,
                margin: [0, 0, 0, 8],
            });
        }
        const logoBuf = getGbbLogoBuffer();
        const logoDataUrl = logoBuf ? `data:image/png;base64,${logoBuf.toString('base64')}` : null;
        const approvalListPdfRows = [];
        if (approval?.steps && approval.steps.length > 0) {
            const sortedSteps = [...approval.steps].sort((a, b) => a.level - b.level);
            sortedSteps.forEach((step) => {
                const name = step.approver?.displayName || `Approver (Level ${step.level})`;
                const position = step.approver?.jobTitle ||
                    (step.level === 1
                        ? 'Head of Unit / Reviewer'
                        : step.level === 2
                            ? 'Head of Internal Audit (CAE)'
                            : 'Director General / CEO');
                const sig = sigImg(step.id);
                let sigCell;
                if (step.status === 'approved') {
                    sigCell = sig ? sig : { text: '[Digitally Signed]', italics: true, color: '#166534', bold: true };
                }
                else if (step.status === 'rejected') {
                    sigCell = { text: 'Rejected', color: '#DC2626' };
                }
                else {
                    sigCell = { text: 'Pending Approval', italics: true, color: '#64748B' };
                }
                const dateStr = step.actedAt ? (0, date_fns_1.format)(new Date(step.actedAt), 'dd/MM/yyyy') : '—';
                approvalListPdfRows.push([{ text: name, bold: true }, { text: position }, sigCell, { text: dateStr, alignment: 'center' }]);
            });
        }
        else if (data.report.signOffMode === 'cae_only') {
            approvalListPdfRows.push([{ text: auditManagerName, bold: true }, { text: auditManagerTitle || 'Head of Unit / Audit Manager' }, { text: 'Pending Submission', italics: true, color: '#64748B' }, { text: '—', alignment: 'center' }], [{ text: 'Head of Internal Audit (CAE)', bold: true }, { text: 'Head of Internal Audit' }, { text: 'Pending Submission', italics: true, color: '#64748B' }, { text: '—', alignment: 'center' }]);
        }
        else {
            approvalListPdfRows.push([{ text: auditManagerName, bold: true }, { text: auditManagerTitle || 'Head of Unit / Audit Manager' }, { text: 'Pending Submission', italics: true, color: '#64748B' }, { text: '—', alignment: 'center' }], [{ text: 'Head of Internal Audit (CAE)', bold: true }, { text: 'Head of Internal Audit' }, { text: 'Pending Submission', italics: true, color: '#64748B' }, { text: '—', alignment: 'center' }], [{ text: 'Director General / CEO', bold: true }, { text: 'Director General / MD' }, { text: 'Pending Submission', italics: true, color: '#64748B' }, { text: '—', alignment: 'center' }]);
        }
        const pad = (l, t, r, b) => [l, t, r, b];
        return {
            pageSize: 'A4',
            pageMargins: [(0, pdf_util_1.mm)(20), (0, pdf_util_1.mm)(20), (0, pdf_util_1.mm)(20), (0, pdf_util_1.mm)(25)],
            footer: (currentPage, pageCount) => ({
                text: `${footerNotice} - Page ${currentPage} of ${pageCount}`,
                alignment: 'center',
                fontSize: 9,
                color: '#64748B',
                margin: pad((0, pdf_util_1.mm)(20), 8, (0, pdf_util_1.mm)(20), 0),
            }),
            content: [
                ...(logoDataUrl
                    ? [{ image: logoDataUrl, width: 120, alignment: 'center', margin: pad(0, 0, 0, 8) }]
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
                        hLineWidth: (i, node) => (i === 0 || i === node.table.body.length ? 3 : 0),
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
                    layout: pdf_util_1.borderedTableLayout,
                    margin: pad(0, 0, 0, 8),
                },
                { text: 'Document Information', bold: true, fontSize: 9.5, color: primary, margin: pad(0, 2, 0, 2) },
                {
                    table: {
                        widths: [130, '*'],
                        body: [
                            [labelCell('Document ID:'), { text: data.engagement.referenceNumber, fontSize: 8.5 }],
                            [labelCell('Document Version:'), { text: `Version ${data.report.versionNumber}.0`, fontSize: 8.5 }],
                            [labelCell('Date of Version:'), { text: (0, date_fns_1.format)(data.report.issuedAt || new Date(), 'dd/MM/yyyy'), fontSize: 8.5 }],
                            [labelCell('Document Division:'), { text: data.engagement.universe.name || 'Internal Audit & Assurance', fontSize: 8.5 }],
                            [labelCell('Document Owner:'), { text: leadAuditorName, fontSize: 8.5 }],
                            [labelCell('Document Author:'), { text: leadAuditorName, fontSize: 8.5 }],
                            [labelCell('Approved by:'), { text: caeApproverName, bold: true, fontSize: 8.5 }],
                            [labelCell('Document Classification:'), { text: header.classification, bold: true, color: '#DC2626', fontSize: 8.5 }],
                            [labelCell('Document Status:'), { text: data.report.status.toUpperCase(), bold: true, fontSize: 8.5 }],
                        ],
                    },
                    layout: pdf_util_1.borderedTableLayout,
                    margin: pad(0, 0, 0, 8),
                },
                { text: 'Change history', bold: true, fontSize: 9.5, color: primary, margin: pad(0, 2, 0, 2) },
                {
                    table: {
                        headerRows: 1,
                        widths: [65, 70, 100, '*'],
                        body: [
                            ['Version', 'Date', 'Created by', 'Change from Previous Version'].map((h) => ({ text: h, bold: true, fillColor: '#F1F5F9', color: primary, fontSize: 8.5 })),
                            [
                                { text: 'Version 1.0', fontSize: 8.5 },
                                { text: data.engagement.actualStartDate ? (0, date_fns_1.format)(data.engagement.actualStartDate, 'dd/MM/yyyy') : (0, date_fns_1.format)(new Date(), 'dd/MM/yyyy'), fontSize: 8.5 },
                                { text: leadAuditorName, fontSize: 8.5 },
                                { text: 'Initial audit review draft formulation', fontSize: 8.5 },
                            ],
                            ...(data.report.versionNumber > 1
                                ? [
                                    [
                                        { text: `Version ${data.report.versionNumber}.0`, fontSize: 8.5 },
                                        { text: (0, date_fns_1.format)(data.report.issuedAt || new Date(), 'dd/MM/yyyy'), fontSize: 8.5 },
                                        { text: leadAuditorName, fontSize: 8.5 },
                                        { text: 'Audit review updates and formal approval', fontSize: 8.5 },
                                    ],
                                ]
                                : []),
                        ],
                    },
                    layout: pdf_util_1.borderedTableLayout,
                    margin: pad(0, 0, 0, 8),
                },
                { text: 'Distribution List', bold: true, fontSize: 9.5, color: primary, margin: pad(0, 2, 0, 2) },
                {
                    table: {
                        headerRows: 1,
                        widths: ['*', 85, 75],
                        body: [
                            ['Name', 'Version', 'Date'].map((h) => ({ text: h, bold: true, fillColor: '#F1F5F9', color: primary, fontSize: 8.5 })),
                            [
                                { text: 'Board Audit Committee & Executive Management', fontSize: 8.5 },
                                { text: `Version ${data.report.versionNumber}.0`, fontSize: 8.5 },
                                { text: (0, date_fns_1.format)(data.report.issuedAt || new Date(), 'dd/MM/yyyy'), fontSize: 8.5 },
                            ],
                            [
                                { text: `Audited Entity (${data.engagement.universe.name})`, fontSize: 8.5 },
                                { text: `Version ${data.report.versionNumber}.0`, fontSize: 8.5 },
                                { text: (0, date_fns_1.format)(data.report.issuedAt || new Date(), 'dd/MM/yyyy'), fontSize: 8.5 },
                            ],
                        ],
                    },
                    layout: pdf_util_1.borderedTableLayout,
                    margin: pad(0, 0, 0, 8),
                },
                { text: 'Approval List', bold: true, fontSize: 9.5, color: primary, margin: pad(0, 2, 0, 2) },
                {
                    table: {
                        headerRows: 1,
                        widths: [110, 110, 130, '*'],
                        body: [
                            ['Name', 'Position', 'Signature', 'Date'].map((h) => ({ text: h, bold: true, fillColor: '#F1F5F9', color: primary, fontSize: 8.5 })),
                            ...approvalListPdfRows,
                        ],
                    },
                    layout: pdf_util_1.borderedTableLayout,
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
                    pageBreak: 'after',
                },
                ...sectionsContent,
                {
                    text: `${data.assetsInScope.length > 0 ? config.template.sections.length + 2 : config.template.sections.length + 1}. Validity and Document Management`,
                    style: 'sectionTitle',
                    margin: pad(0, 18, 0, 8),
                },
                {
                    text: `This document was last reviewed on ${(0, date_fns_1.format)(data.report.issuedAt || new Date(), 'dd MMMM yyyy')}. This document remains valid and binding until superseded by a subsequent version approved through the Galaxy Backbone Limited internal approval matrix.`,
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
    _getHeaderConfig(config) {
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
    _getFooterNotice(config) {
        const footer = isPlainRecord(config.template.footerConfig) ? config.template.footerConfig : {};
        return readString(footer, 'confidentialityNotice', config.footerNotice);
    }
    _getSignatureLabels(config) {
        const signature = isPlainRecord(config.template.signatureConfig) ? config.template.signatureConfig : {};
        return {
            preparedBy: readNestedLabel(signature, 'preparedBy', 'Prepared by'),
            reviewedBy: readNestedLabel(signature, 'reviewedBy', 'Reviewed by'),
            approvedBy: readNestedLabel(signature, 'approvedBy', 'Approved by'),
        };
    }
    _escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    // ─────────── Export ───────────
    async exportReport(reportId, format) {
        const data = await this.fetchReportData(reportId);
        const today = (0, date_fns_1.format)(new Date(), 'yyyy-MM-dd');
        const filename = `GBB-IAR-${data.engagement.referenceNumber}-${today}.${format}`;
        const mimeType = format === 'docx'
            ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            : 'application/pdf';
        const buffer = format === 'docx' ? await this.generateDocx(reportId) : await this.generatePdf(reportId);
        return { buffer, filename, mimeType };
    }
}
exports.ReportGenerationService = ReportGenerationService;
//# sourceMappingURL=report-generation.service.js.map