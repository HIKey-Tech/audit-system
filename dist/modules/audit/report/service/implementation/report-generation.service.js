"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportGenerationService = void 0;
const docx_1 = require("docx");
const date_fns_1 = require("date-fns");
const pdf_util_1 = require("../../../../../shared/utils/pdf.util");
const prisma_client_1 = require("../../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../../shared/errors/app.error");
const workflow_enum_1 = require("../../../../workflow/domain/enum/workflow.enum");
const document_1 = require("../../../../document");
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
                    },
                },
            },
        });
        if (!report)
            throw app_error_1.AppError.notFound('Audit report');
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
        // Header
        children.push(...this._buildDocxHeader(header));
        // Metadata table
        children.push(this._buildDocxMetadataTable(data, header.classification));
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
        // Signature block
        children.push(this._buildDocxSignatureBlock(data, approval, config, sigMap));
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
    _buildDocxSectionContent(key, data) {
        switch (key) {
            case 'executive_summary':
                return [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: data.report.executiveSummary })] })];
            case 'background':
                return [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: 'Refer to engagement details above.' })] })];
            case 'objectives':
                return [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: data.report.scope })] })];
            case 'methodology':
                return [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: data.report.methodology })] })];
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
            // Management Response
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
                            text: `Submitted by: ${responderName} on ${responseDate}`,
                            italics: true,
                            size: 20,
                        }),
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
        return new docx_1.Table({
            rows: [
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
                new docx_1.TableRow({
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
                }),
                new docx_1.TableRow({
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
                }),
                new docx_1.TableRow({
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
                }),
            ],
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
        let caeApproverName = 'N/A';
        if (approval?.steps) {
            const approvedSteps = approval.steps.filter((s) => s.status === 'approved');
            const highest = approvedSteps.length > 0
                ? approvedSteps.reduce((max, s) => (s.level > max.level ? s : max))
                : undefined;
            caeApproverName = highest?.approver?.displayName ?? 'N/A';
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
        let caeApproverName = 'N/A';
        if (approval?.steps) {
            const approvedSteps = approval.steps.filter((s) => s.status === 'approved');
            const highest = approvedSteps.length > 0
                ? approvedSteps.reduce((max, s) => (s.level > max.level ? s : max))
                : undefined;
            caeApproverName = highest?.approver?.displayName ?? 'N/A';
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
            detailedFindingsContent.push({ text: `Finding ${idx + 1}: ${f.title}`, bold: true, fontSize: 12, margin: [0, 14, 0, 6] }, {
                table: {
                    widths: [110, '*'],
                    body: [
                        [labelCell('Severity'), (0, pdf_util_1.severityBadge)(f.severity)],
                        [labelCell('Category'), { text: FINDING_CATEGORY_LABEL[f.category] ?? f.category }],
                        [labelCell('Status'), { text: FINDING_STATUS_LABEL[f.status] ?? f.status }],
                        [labelCell('Due Date'), { text: (0, date_fns_1.format)(f.dueDate, 'dd MMM yyyy') }],
                        [labelCell('Auditee'), { text: auditeeName }],
                    ],
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
                detailedFindingsContent.push(labeled('Management Response', f.followUp.managementResponse), { text: `Submitted by: ${responderName} on ${responseDate}`, italics: true, fontSize: 10, color: '#64748B', margin: [0, 0, 0, 3] });
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
                    sectionsContent.push({ text: data.report.executiveSummary });
                    break;
                case 'background':
                    sectionsContent.push({ text: 'Refer to engagement details above.' });
                    break;
                case 'objectives':
                    sectionsContent.push({ text: data.report.scope });
                    break;
                case 'methodology':
                    sectionsContent.push({ text: data.report.methodology });
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
        const reviewedSig = sigImg(reviewedStepId);
        const approvedSig = sigImg(approvedStepId);
        const signatureColumns = {
            columns: [
                {
                    width: '*',
                    stack: [
                        { text: `${labels.preparedBy}:`, bold: true, color: primary, margin: [0, 0, 0, 4] },
                        { text: leadAuditorName },
                        { text: leadAuditorTitle },
                        { text: preparedDate },
                    ],
                },
                {
                    width: '*',
                    stack: [
                        { text: `${labels.reviewedBy}:`, bold: true, color: primary, margin: [0, 0, 0, 4] },
                        ...(reviewedSig ? [reviewedSig] : []),
                        { text: auditManagerName },
                        { text: auditManagerTitle },
                    ],
                },
                {
                    width: '*',
                    stack: [
                        { text: `${labels.approvedBy}:`, bold: true, color: primary, margin: [0, 0, 0, 4] },
                        ...(approvedSig ? [approvedSig] : []),
                        { text: caeApproverName },
                    ],
                },
            ],
            columnGap: 10,
            margin: [0, 30, 0, 0],
        };
        return {
            pageSize: 'A4',
            pageMargins: [(0, pdf_util_1.mm)(20), (0, pdf_util_1.mm)(20), (0, pdf_util_1.mm)(20), (0, pdf_util_1.mm)(25)],
            footer: (currentPage, pageCount) => ({
                text: `${footerNotice} - Page ${currentPage} of ${pageCount}`,
                alignment: 'center',
                fontSize: 9,
                color: '#64748B',
                margin: [(0, pdf_util_1.mm)(20), 8, (0, pdf_util_1.mm)(20), 0],
            }),
            content: [
                { text: header.orgName, style: 'orgName', alignment: 'center' },
                { text: header.reportTitle.toUpperCase(), style: 'reportTitle', alignment: 'center', margin: [0, 6, 0, 4] },
                { text: header.orgAddress, alignment: 'center', fontSize: 10, color: '#64748B' },
                {
                    canvas: [{ type: 'line', x1: 0, y1: 0, x2: 482, y2: 0, lineWidth: 2, lineColor: accent }],
                    margin: [0, 8, 0, 14],
                },
                {
                    table: {
                        widths: [140, '*'],
                        body: [
                            [labelCell('Report Reference'), { text: data.engagement.referenceNumber }],
                            [labelCell('Audit Type'), { text: AUDIT_TYPE_LABEL[data.engagement.auditType] ?? data.engagement.auditType }],
                            [labelCell('Audited Entity'), { text: data.engagement.universe.name }],
                            [
                                labelCell('Audit Period'),
                                { text: `${(0, date_fns_1.format)(data.engagement.plannedStartDate, 'dd MMM yyyy')} to ${(0, date_fns_1.format)(data.engagement.plannedEndDate, 'dd MMM yyyy')}` },
                            ],
                            [
                                labelCell('Report Date'),
                                { text: data.report.issuedAt ? (0, date_fns_1.format)(data.report.issuedAt, 'dd MMMM yyyy') : 'Not yet issued' },
                            ],
                            [labelCell('Classification'), { text: header.classification, bold: true }],
                        ],
                    },
                    layout: pdf_util_1.borderedTableLayout,
                },
                ...sectionsContent,
                signatureColumns,
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