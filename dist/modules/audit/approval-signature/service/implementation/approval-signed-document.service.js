"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.approvalSignedDocumentService = exports.ApprovalSignedDocumentService = void 0;
// src/modules/audit/approval-signature/service/implementation/approval-signed-document.service.ts
const prisma_client_1 = require("../../../../../shared/prisma/prisma.client");
const logger_util_1 = require("../../../../../shared/utils/logger.util");
const document_1 = require("../../../../document");
const report_template_service_1 = require("../../../../settings/service/implementation/report-template.service");
const system_config_service_1 = require("../../../../settings/service/implementation/system-config.service");
const working_paper_template_service_1 = require("../../../../settings/service/implementation/working-paper-template.service");
const approval_service_1 = require("../../../../workflow/approval/service/implementation/approval.service");
const signed_document_utility_1 = require("../../../../workflow/request/utility/signed-document.utility");
const report_generation_service_1 = require("../../../report/service/implementation/report-generation.service");
const working_paper_service_1 = require("../../../working-papers/service/implementation/working-paper.service");
const SIGNED_ENTITY_TYPE = 'workflow_approval_signed';
class ApprovalSignedDocumentService {
    documents;
    reportGen;
    workingPapers;
    constructor(documents = new document_1.DocumentService(), reportGen = new report_generation_service_1.ReportGenerationService(report_template_service_1.reportTemplateService, system_config_service_1.systemConfigService, approval_service_1.workflowApprovalService), workingPapers = new working_paper_service_1.WorkingPaperService(new document_1.DocumentService(), working_paper_template_service_1.workingPaperTemplateService)) {
        this.documents = documents;
        this.reportGen = reportGen;
        this.workingPapers = workingPapers;
    }
    async generateForCompletedApproval(approvalId) {
        try {
            const approval = await prisma_client_1.prisma.workflow_Approval.findUnique({ where: { id: approvalId } });
            if (!approval || approval.status !== 'approved')
                return;
            const rendered = await this._renderForEntity(approval.entity_type, approval.entity_id);
            if (!rendered.bytes)
                return;
            const doc = await this.documents.upload({
                uploadedById: approval.submitted_by_id,
                originalName: rendered.baseName.replace(/\.pdf$/i, '') + ' (signed).pdf',
                mimeType: 'application/pdf',
                fileSize: rendered.bytes.length,
                buffer: rendered.bytes,
                module: 'workflow',
                entityType: SIGNED_ENTITY_TYPE,
                entityId: approvalId,
            });
            await prisma_client_1.prisma.workflow_Approval_Signed_Document.create({
                data: { approval_id: approvalId, signed_document_id: doc.id },
            });
            logger_util_1.logger.info('Approval signed document generated', {
                approvalId,
                entityType: approval.entity_type,
                signedDocumentId: doc.id,
            });
        }
        catch (err) {
            logger_util_1.logger.warn('Approval signed-document generation failed', { approvalId, err });
        }
    }
    async _renderForEntity(entityType, entityId) {
        if (entityType === 'audit_report') {
            return { bytes: await this.reportGen.generatePdf(entityId), baseName: 'audit-report' };
        }
        if (entityType === 'audit_working_paper') {
            const out = await this.workingPapers.exportWorkingPaper(entityId, 'pdf');
            return { bytes: out.buffer, baseName: out.fileName };
        }
        // audit_plan | audit_finding_closure → standalone certificate (no source document)
        const { reference, title, entries } = await this._certificateData(entityType, entityId);
        return {
            bytes: await (0, signed_document_utility_1.buildCertificatePdf)({ reference, title, manifestHash: '—', entries }),
            baseName: title,
        };
    }
    async _certificateData(entityType, entityId) {
        const approval = await prisma_client_1.prisma.workflow_Approval.findFirst({
            where: { entity_type: entityType, entity_id: entityId },
            orderBy: { created_at: 'desc' },
            select: { id: true },
        });
        const entries = approval ? await this._approverEntries(approval.id) : [];
        if (entityType === 'audit_plan') {
            const plan = await prisma_client_1.prisma.audit_Plan.findUnique({ where: { id: entityId }, select: { title: true } });
            return { reference: entityId.slice(0, 8), title: plan?.title ?? 'Audit Plan', entries };
        }
        const finding = await prisma_client_1.prisma.audit_Finding.findUnique({
            where: { id: entityId },
            select: { title: true, engagement: { select: { reference_number: true } } },
        });
        return {
            reference: finding?.engagement.reference_number ?? entityId.slice(0, 8),
            title: finding?.title ?? 'Finding Closure',
            entries,
        };
    }
    /** Signature-panel entries from approved steps, embedding each approver's recorded signature image. */
    async _approverEntries(approvalId) {
        const steps = await prisma_client_1.prisma.workflow_Approval_Step.findMany({
            where: { approval_id: approvalId, status: 'approved' },
            include: { approver: true },
            orderBy: { level: 'asc' },
        });
        const entries = [];
        for (const s of steps) {
            if (!s.approver)
                continue;
            const name = s.approver.display_name?.trim() || `${s.approver.first_name} ${s.approver.last_name}`.trim();
            const role = s.approver.job_title ?? '';
            const actedAt = s.acted_at ?? new Date();
            let signatureImage;
            if (s.signature_id) {
                const sig = await prisma_client_1.prisma.user_Signature.findUnique({ where: { id: s.signature_id } });
                if (sig) {
                    const file = await this.documents.getFileById(sig.document_id);
                    signatureImage = {
                        bytes: file.buffer,
                        format: file.mimeType === 'image/jpeg' ? 'jpg' : 'png',
                    };
                }
            }
            entries.push({ name, role, actedAt, action: 'signed', signatureImage });
        }
        return entries;
    }
}
exports.ApprovalSignedDocumentService = ApprovalSignedDocumentService;
exports.approvalSignedDocumentService = new ApprovalSignedDocumentService();
//# sourceMappingURL=approval-signed-document.service.js.map