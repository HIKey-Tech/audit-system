"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportGenerationService = void 0;
const docx_1 = require("docx");
const puppeteer_1 = __importDefault(require("puppeteer"));
const date_fns_1 = require("date-fns");
const prisma_client_1 = require("../../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../../shared/errors/app.error");
const workflow_enum_1 = require("../../../../workflow/domain/enum/workflow.enum");
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
    operational: 'Operational',
};
const FINDING_STATUS_LABEL = {
    open: 'Open',
    management_response_received: 'Management Response Received',
    in_remediation: 'In Remediation',
    verified: 'Verified',
    closed: 'Closed',
};
// ────────────────────────────────────────────────────────────
// Service
// ────────────────────────────────────────────────────────────
class ReportGenerationService {
    reportTemplateService;
    systemConfigService;
    approvalService;
    constructor(reportTemplateService, systemConfigService, approvalService) {
        this.reportTemplateService = reportTemplateService;
        this.systemConfigService = systemConfigService;
        this.approvalService = approvalService;
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
    async fetchTemplateAndConfig() {
        const template = await this.reportTemplateService.getDefaultTemplate();
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
        const config = await this.fetchTemplateAndConfig();
        let approval = null;
        try {
            approval = await this.approvalService.getApprovalByEntity(workflow_enum_1.WorkflowEntityType.AuditReport, reportId);
        }
        catch {
            approval = null;
        }
        const doc = this._buildDocxDocument(data, config, approval);
        const uint8Array = await docx_1.Packer.toBuffer(doc);
        return Buffer.from(uint8Array);
    }
    _buildDocxDocument(data, config, approval) {
        const children = [];
        // Header
        children.push(...this._buildDocxHeader(config.orgName, config.orgAddress));
        // Metadata table
        children.push(this._buildDocxMetadataTable(data));
        // Sections
        config.template.sections.forEach((section, idx) => {
            children.push(new docx_1.Paragraph({
                spacing: { before: 240, after: 120 },
                children: [
                    new docx_1.TextRun({
                        text: `${idx + 1}. ${section.title}`,
                        bold: true,
                        size: 24,
                        color: '003087',
                    }),
                ],
            }));
            children.push(...this._buildDocxSectionContent(section.key, data));
        });
        // Signature block
        children.push(this._buildDocxSignatureBlock(data, approval));
        // Footer notice
        children.push(new docx_1.Paragraph({
            spacing: { before: 240 },
            children: [
                new docx_1.TextRun({
                    text: config.footerNotice,
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
                                            text: `${config.footerNotice} — Page `,
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
    _buildDocxHeader(orgName, orgAddress) {
        return [
            new docx_1.Paragraph({
                alignment: docx_1.AlignmentType.CENTER,
                children: [new docx_1.TextRun({ text: orgName, size: 20, color: '003087' })],
            }),
            new docx_1.Paragraph({
                alignment: docx_1.AlignmentType.CENTER,
                spacing: { before: 120, after: 120 },
                children: [
                    new docx_1.TextRun({
                        text: 'INTERNAL AUDIT REPORT',
                        bold: true,
                        size: 28,
                        color: '003087',
                        allCaps: true,
                    }),
                ],
            }),
            new docx_1.Paragraph({
                alignment: docx_1.AlignmentType.CENTER,
                children: [new docx_1.TextRun({ text: orgAddress, size: 18, color: '64748B' })],
            }),
            new docx_1.Paragraph({
                spacing: { before: 120, after: 240 },
                border: {
                    bottom: { color: '003087', space: 1, style: docx_1.BorderStyle.SINGLE, size: 12 },
                },
                children: [],
            }),
        ];
    }
    _buildDocxMetadataTable(data) {
        const rows = [
            this._docxMetadataRow('Report Reference', data.engagement.referenceNumber),
            this._docxMetadataRow('Audit Type', AUDIT_TYPE_LABEL[data.engagement.auditType] ?? data.engagement.auditType),
            this._docxMetadataRow('Audited Entity', data.engagement.universe.name),
            this._docxMetadataRow('Audit Period', `${(0, date_fns_1.format)(data.engagement.plannedStartDate, 'dd MMM yyyy')} to ${(0, date_fns_1.format)(data.engagement.plannedEndDate, 'dd MMM yyyy')}`),
            this._docxMetadataRow('Report Date', data.report.issuedAt ? (0, date_fns_1.format)(data.report.issuedAt, 'dd MMMM yyyy') : 'Not yet issued'),
            this._docxMetadataRow('Classification', 'CONFIDENTIAL'),
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
    _buildDocxSignatureBlock(data, approval) {
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
                                        new docx_1.TextRun({ text: 'Prepared by:', bold: true, color: '003087' }),
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
                                        new docx_1.TextRun({ text: 'Reviewed by:', bold: true, color: '003087' }),
                                    ],
                                }),
                                new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: auditManagerName })] }),
                                new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: auditManagerTitle })] }),
                            ],
                            width: { size: 33, type: docx_1.WidthType.PERCENTAGE },
                        }),
                        new docx_1.TableCell({
                            children: [
                                new docx_1.Paragraph({
                                    children: [
                                        new docx_1.TextRun({ text: 'Approved by:', bold: true, color: '003087' }),
                                    ],
                                }),
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
        const config = await this.fetchTemplateAndConfig();
        let approval = null;
        try {
            approval = await this.approvalService.getApprovalByEntity(workflow_enum_1.WorkflowEntityType.AuditReport, reportId);
        }
        catch {
            approval = null;
        }
        const html = this._buildPdfHtml(data, config, approval);
        const browser = await puppeteer_1.default.launch({ headless: true });
        try {
            const page = await browser.newPage();
            await page.setContent(html, { waitUntil: 'networkidle0' });
            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: { top: '20mm', bottom: '25mm', left: '20mm', right: '20mm' },
                displayHeaderFooter: true,
                headerTemplate: '<div></div>',
                footerTemplate: `<div style="font-size:9px;width:100%;text-align:center;color:#64748B;padding:0 20mm;">${this._escapeHtml(config.footerNotice)} — Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`,
            });
            return Buffer.from(pdfBuffer);
        }
        finally {
            await browser.close();
        }
    }
    _buildPdfHtml(data, config, approval) {
        const leadAuditorName = this._escapeHtml(data.engagement.leadAuditor.displayName ??
            `${data.engagement.leadAuditor.firstName} ${data.engagement.leadAuditor.lastName}`.trim() ??
            'N/A');
        const leadAuditorTitle = this._escapeHtml(data.engagement.leadAuditor.jobTitle ?? '');
        const preparedDate = data.engagement.actualStartDate
            ? (0, date_fns_1.format)(data.engagement.actualStartDate, 'dd MMM yyyy')
            : '';
        const auditManagerName = this._escapeHtml(data.engagement.auditManager.displayName ??
            `${data.engagement.auditManager.firstName} ${data.engagement.auditManager.lastName}`.trim() ??
            'N/A');
        const auditManagerTitle = this._escapeHtml(data.engagement.auditManager.jobTitle ?? '');
        let caeApproverName = 'N/A';
        if (approval?.steps) {
            const approvedSteps = approval.steps.filter((s) => s.status === 'approved');
            const highest = approvedSteps.length > 0
                ? approvedSteps.reduce((max, s) => (s.level > max.level ? s : max))
                : undefined;
            caeApproverName = this._escapeHtml(highest?.approver?.displayName ?? 'N/A');
        }
        const severityBadge = (severity) => {
            const classes = {
                critical: 'severity-critical',
                high: 'severity-high',
                medium: 'severity-medium',
                low: 'severity-low',
                informational: 'severity-informational',
            };
            return `<span class="${classes[severity.toLowerCase()] ?? 'severity-informational'}">${this._escapeHtml(severity.toUpperCase())}</span>`;
        };
        const findingsSummaryRows = data.findings
            .map((f, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${this._escapeHtml(f.title)}</td>
        <td>${this._escapeHtml(FINDING_CATEGORY_LABEL[f.category] ?? f.category)}</td>
        <td>${severityBadge(f.severity)}</td>
        <td>${this._escapeHtml(FINDING_STATUS_LABEL[f.status] ?? f.status)}</td>
        <td>${(0, date_fns_1.format)(f.dueDate, 'dd MMM yyyy')}</td>
      </tr>
    `)
            .join('');
        const detailedFindingsHtml = data.findings
            .map((f, idx) => {
            const auditeeName = this._escapeHtml(f.auditee.displayName ??
                `${f.auditee.firstName} ${f.auditee.lastName}`.trim() ??
                'N/A');
            let managementResponseHtml = '';
            if (f.followUp?.managementResponse) {
                const responder = f.followUp.managementResponseBy;
                const responderName = this._escapeHtml(responder?.displayName ??
                    `${responder?.firstName ?? ''} ${responder?.lastName ?? ''}`.trim() ??
                    'N/A');
                const responseDate = f.followUp.managementResponseAt
                    ? (0, date_fns_1.format)(f.followUp.managementResponseAt, 'dd MMM yyyy')
                    : '';
                managementResponseHtml = `
            <p><span class="label">Management Response:</span> ${this._escapeHtml(f.followUp.managementResponse)}</p>
            <p class="meta">Submitted by: ${responderName} on ${responseDate}</p>
          `;
            }
            let verificationHtml = '';
            if (f.followUp?.verifiedAt) {
                const verifier = f.followUp.verifiedBy;
                const verifierName = this._escapeHtml(verifier?.displayName ??
                    `${verifier?.firstName ?? ''} ${verifier?.lastName ?? ''}`.trim() ??
                    'N/A');
                const verifyDate = f.followUp.verifiedAt
                    ? (0, date_fns_1.format)(f.followUp.verifiedAt, 'dd MMM yyyy')
                    : '';
                verificationHtml = `
            <p><span class="label">Verification Status:</span> ${this._escapeHtml(f.followUp.verificationStatus)}</p>
            <p class="meta">Verified by: ${verifierName} on ${verifyDate}</p>
            <p><span class="label">Verification Notes:</span> ${this._escapeHtml(f.followUp.verificationNotes ?? 'N/A')}</p>
          `;
            }
            return `
          <div class="finding">
            <div class="finding-heading">Finding ${idx + 1}: ${this._escapeHtml(f.title)}</div>
            <table class="details-table">
              <tr><td class="label">Severity</td><td>${severityBadge(f.severity)}</td></tr>
              <tr><td class="label">Category</td><td>${this._escapeHtml(FINDING_CATEGORY_LABEL[f.category] ?? f.category)}</td></tr>
              <tr><td class="label">Status</td><td>${this._escapeHtml(FINDING_STATUS_LABEL[f.status] ?? f.status)}</td></tr>
              <tr><td class="label">Due Date</td><td>${(0, date_fns_1.format)(f.dueDate, 'dd MMM yyyy')}</td></tr>
              <tr><td class="label">Auditee</td><td>${auditeeName}</td></tr>
            </table>
            <p><span class="label">Description:</span> ${this._escapeHtml(f.description)}</p>
            <p><span class="label">Root Cause:</span> ${this._escapeHtml(f.rootCause)}</p>
            <p><span class="label">Risk Implication:</span> ${this._escapeHtml(f.riskImplication)}</p>
            <p><span class="label">Recommendation:</span> ${this._escapeHtml(f.recommendation)}</p>
            ${managementResponseHtml}
            ${verificationHtml}
          </div>
          ${idx < data.findings.length - 1 ? '<div class="separator"></div>' : ''}
        `;
        })
            .join('');
        const sectionsHtml = config.template.sections
            .map((section, idx) => {
            const sectionNumber = idx + 1;
            let content = '';
            switch (section.key) {
                case 'executive_summary':
                    content = `<p>${this._escapeHtml(data.report.executiveSummary)}</p>`;
                    break;
                case 'background':
                    content = `<p>Refer to engagement details above.</p>`;
                    break;
                case 'objectives':
                    content = `<p>${this._escapeHtml(data.report.scope)}</p>`;
                    break;
                case 'methodology':
                    content = `<p>${this._escapeHtml(data.report.methodology)}</p>`;
                    break;
                case 'findings_summary':
                    content = `
              <table class="data-table">
                <thead>
                  <tr><th>No.</th><th>Finding Title</th><th>Category</th><th>Severity</th><th>Status</th><th>Due Date</th></tr>
                </thead>
                <tbody>${findingsSummaryRows}</tbody>
              </table>
            `;
                    break;
                case 'detailed_findings':
                    content = detailedFindingsHtml;
                    break;
                case 'conclusion':
                    content = `<p>See findings and recommendations above.</p>`;
                    break;
                default:
                    content = `<p></p>`;
            }
            return `
          <div class="section">
            <div class="section-title">${sectionNumber}. ${this._escapeHtml(section.title)}</div>
            ${content}
          </div>
        `;
        })
            .join('');
        return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { margin: 20mm; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #1a1a1a; margin: 0; padding: 0; }
    .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #003087; padding-bottom: 10px; }
    .org-name { font-size: 14pt; color: #003087; font-weight: bold; }
    .report-title { font-size: 18pt; font-weight: bold; text-transform: uppercase; margin: 10px 0; color: #003087; }
    .org-address { font-size: 10pt; color: #64748B; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { border: 1px solid #ccc; padding: 8px 10px; text-align: left; }
    th { background-color: #003087; color: white; font-weight: 600; }
    .section-title { font-size: 14pt; font-weight: bold; color: #003087; margin-top: 25px; margin-bottom: 10px; }
    .finding-heading { font-size: 12pt; font-weight: bold; margin-top: 20px; color: #1a1a1a; }
    .label { font-weight: bold; color: #003087; }
    .severity-critical { background-color: #DC2626; color: white; padding: 2px 8px; border-radius: 3px; font-weight: bold; display: inline-block; }
    .severity-high { background-color: #EA580C; color: white; padding: 2px 8px; border-radius: 3px; font-weight: bold; display: inline-block; }
    .severity-medium { background-color: #CA8A04; color: black; padding: 2px 8px; border-radius: 3px; font-weight: bold; display: inline-block; }
    .severity-low { background-color: #16A34A; color: white; padding: 2px 8px; border-radius: 3px; font-weight: bold; display: inline-block; }
    .severity-informational { background-color: #64748B; color: white; padding: 2px 8px; border-radius: 3px; font-weight: bold; display: inline-block; }
    .signature-table td { border: none; vertical-align: top; width: 33%; padding: 10px; }
    .signature-table .sig-label { font-weight: bold; color: #003087; margin-bottom: 5px; display: block; }
    .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #ccc; font-size: 9pt; color: #64748B; text-align: center; }
    .separator { border-top: 1px solid #ccc; margin: 15px 0; }
    .meta { font-style: italic; font-size: 10pt; color: #64748B; }
    .finding { margin-bottom: 10px; }
    .details-table { margin: 10px 0; }
    .details-table td { border: 1px solid #ccc; padding: 6px 10px; }
    .details-table td:first-child { width: 20%; font-weight: bold; color: #003087; background-color: #f8f9fa; }
  </style>
</head>
<body>
  <div class="header">
    <div class="org-name">${this._escapeHtml(config.orgName)}</div>
    <div class="report-title">INTERNAL AUDIT REPORT</div>
    <div class="org-address">${this._escapeHtml(config.orgAddress)}</div>
  </div>

  <table class="data-table">
    <tr><td class="label">Report Reference</td><td>${this._escapeHtml(data.engagement.referenceNumber)}</td></tr>
    <tr><td class="label">Audit Type</td><td>${this._escapeHtml(AUDIT_TYPE_LABEL[data.engagement.auditType] ?? data.engagement.auditType)}</td></tr>
    <tr><td class="label">Audited Entity</td><td>${this._escapeHtml(data.engagement.universe.name)}</td></tr>
    <tr><td class="label">Audit Period</td><td>${(0, date_fns_1.format)(data.engagement.plannedStartDate, 'dd MMM yyyy')} to ${(0, date_fns_1.format)(data.engagement.plannedEndDate, 'dd MMM yyyy')}</td></tr>
    <tr><td class="label">Report Date</td><td>${data.report.issuedAt ? (0, date_fns_1.format)(data.report.issuedAt, 'dd MMMM yyyy') : 'Not yet issued'}</td></tr>
    <tr><td class="label">Classification</td><td><strong>CONFIDENTIAL</strong></td></tr>
  </table>

  ${sectionsHtml}

  <div style="margin-top: 30px;">
    <table class="signature-table">
      <tr>
        <td>
          <span class="sig-label">Prepared by:</span>
          ${leadAuditorName}<br>
          ${leadAuditorTitle}<br>
          ${preparedDate}
        </td>
        <td>
          <span class="sig-label">Reviewed by:</span>
          ${auditManagerName}<br>
          ${auditManagerTitle}
        </td>
        <td>
          <span class="sig-label">Approved by:</span>
          ${caeApproverName}
        </td>
      </tr>
    </table>
  </div>

  <div class="footer">
    ${this._escapeHtml(config.footerNotice)}
  </div>
</body>
</html>`;
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