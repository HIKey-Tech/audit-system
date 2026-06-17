"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkingPaperService = void 0;
const prisma_client_1 = require("../../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../../shared/errors/app.error");
const logger_util_1 = require("../../../../../shared/utils/logger.util");
const audit_log_service_1 = require("../../../../logging/service/implementation/audit-log.service");
const working_paper_template_service_1 = require("../../../../settings/service/implementation/working-paper-template.service");
const approval_service_1 = require("../../../../workflow/approval/service/implementation/approval.service");
const workflow_enum_1 = require("../../../../workflow/domain/enum/workflow.enum");
const audit_enum_1 = require("../../../domain/enum/audit.enum");
const audit_utility_1 = require("../../../utility/audit.utility");
const working_paper_response_dto_1 = require("../../dto/response/working-paper.response.dto");
const working_paper_import_utility_1 = require("../../utility/working-paper-import.utility");
const working_paper_utility_1 = require("../../utility/working-paper.utility");
const puppeteer_1 = __importDefault(require("puppeteer"));
class WorkingPaperService {
    documentService;
    templateService;
    approvalService;
    constructor(documentService, templateService = working_paper_template_service_1.workingPaperTemplateService, approvalService = approval_service_1.workflowApprovalService) {
        this.documentService = documentService;
        this.templateService = templateService;
        this.approvalService = approvalService;
    }
    async createWorkingPaper(engagementId, dto, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'working_paper:create');
        await this._assertEngagementInProgress(engagementId);
        await this._assertOptionalImportReferences(dto.templateId, dto.sourceDocumentId);
        const paper = await prisma_client_1.prisma.audit_Working_Paper.create({
            data: {
                engagement_id: engagementId,
                template_id: dto.templateId ?? null,
                source_document_id: dto.sourceDocumentId ?? null,
                working_paper_type: dto.workingPaperType ?? 'general',
                title: dto.title,
                content: dto.content,
                import_metadata: dto.importMetadata ? JSON.stringify(dto.importMetadata) : null,
                created_by_id: actor.id,
            },
        });
        logger_util_1.logger.info('Audit working paper created', { workingPaperId: paper.id, engagementId, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.working_paper.create', module: 'audit', entityType: 'audit_working_paper', entityId: paper.id });
        return (0, working_paper_response_dto_1.mapWorkingPaperToResponse)(paper);
    }
    async previewWorkingPaperImport(engagementId, file, dto, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'working_paper:create');
        const engagement = await this._getEngagementForWorkingPaperImport(engagementId);
        const extracted = await (0, working_paper_import_utility_1.extractWorkingPaperText)(file.buffer, file.mimeType, file.originalName);
        const template = await this._resolveImportTemplate(dto.templateId, engagement.audit_type);
        const mappedSections = template
            ? (0, working_paper_import_utility_1.mapTextToWorkingPaperSections)(extracted.text, template.sections)
            : [];
        const content = mappedSections.length > 0
            ? (0, working_paper_import_utility_1.buildWorkingPaperContentFromSections)(mappedSections)
            : extracted.text;
        const confidence = mappedSections.length > 0 ? (0, working_paper_import_utility_1.averageSectionConfidence)(mappedSections) : 0.35;
        const matchedSectionCount = mappedSections.filter((section) => section.content.trim().length > 0).length;
        const document = await this.documentService.upload({
            uploadedById: actor.id,
            originalName: file.originalName,
            mimeType: file.mimeType,
            fileSize: file.fileSize,
            buffer: file.buffer,
            module: 'audit',
            entityType: 'audit_working_paper_source',
            entityId: engagementId,
        });
        const suggestedTitle = this._suggestTitle(file.originalName, template?.name);
        const warnings = [...extracted.warnings];
        if (!template) {
            warnings.push('No working paper template matched this engagement. The extracted text was returned as free-form content.');
        }
        if (!extracted.text.trim()) {
            warnings.push('The file was read, but no usable text was extracted. Scanned PDFs or image-only documents may require OCR before import.');
        }
        if (template && matchedSectionCount === 0) {
            warnings.push('No template section headings were detected in the uploaded file. Use headings like Objective, Test Steps, Evidence, Results, and Conclusion, or copy the extracted text into the expected sections below.');
        }
        if (confidence < 0.5) {
            warnings.push('Low section-mapping confidence. Review and edit the preview before saving.');
        }
        logger_util_1.logger.info('Audit working paper import preview generated', {
            engagementId,
            documentId: document.id,
            templateId: template?.id ?? null,
            actorId: actor.id,
        });
        return {
            documentId: document.id,
            fileName: file.originalName,
            fileType: file.mimeType,
            templateId: template?.id ?? null,
            templateName: template?.name ?? null,
            workingPaperType: dto.workingPaperType ?? 'imported',
            suggestedTitle,
            extractedText: (0, working_paper_import_utility_1.truncateExtractedText)(extracted.text),
            mappedSections,
            content,
            confidence,
            warnings,
        };
    }
    async updateWorkingPaper(id, dto, actor) {
        const paper = await this._getPaper(id);
        if (paper.created_by_id !== actor.id)
            throw app_error_1.AppError.forbidden('Only the creator can update this working paper');
        if (!audit_utility_1.WP_REVIEWABLE_STATUSES.includes(paper.status)) {
            throw app_error_1.AppError.badRequest('Only draft or rejected working papers can be updated');
        }
        await this.documentService.upload({
            uploadedById: actor.id,
            originalName: `${paper.title}-v${paper.version_number}.txt`,
            mimeType: 'text/plain',
            fileSize: Buffer.byteLength(paper.content),
            buffer: Buffer.from(paper.content),
            module: 'audit',
            entityType: 'audit_working_paper_snapshot',
            entityId: paper.id,
        });
        const updated = await prisma_client_1.prisma.audit_Working_Paper.update({
            where: { id },
            data: {
                ...(dto.title !== undefined && { title: dto.title }),
                ...(dto.content !== undefined && { content: dto.content }),
                version_number: { increment: 1 },
                status: audit_enum_1.WorkingPaperStatus.Draft,
                rejection_reason: null,
            },
        });
        logger_util_1.logger.info('Audit working paper updated', { workingPaperId: id, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.working_paper.update', module: 'audit', entityType: 'audit_working_paper', entityId: id });
        return (0, working_paper_response_dto_1.mapWorkingPaperToResponse)(updated);
    }
    async submitWorkingPaper(id, actor) {
        const paper = await this._getPaperWithEngagement(id);
        if (paper.created_by_id !== actor.id)
            throw app_error_1.AppError.forbidden('Only the creator can submit this working paper');
        if (!audit_utility_1.WP_REVIEWABLE_STATUSES.includes(paper.status)) {
            throw app_error_1.AppError.badRequest('Only draft or rejected working papers can be submitted');
        }
        const { updated, approval } = await prisma_client_1.prisma.$transaction(async (tx) => {
            const updated = await tx.audit_Working_Paper.update({
                where: { id },
                data: { status: audit_enum_1.WorkingPaperStatus.Submitted, rejection_reason: null },
            });
            const approval = await this.approvalService.createApproval({
                entityType: workflow_enum_1.WorkflowEntityType.AuditWorkingPaper,
                entityId: id,
            }, actor, tx);
            return { updated, approval };
        }, { timeout: 15000 });
        this.approvalService.queueApprovalRequiredNotification(approval);
        logger_util_1.logger.info('Audit working paper submitted', { workingPaperId: id, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.working_paper.submit', module: 'audit', entityType: 'audit_working_paper', entityId: id });
        return (0, working_paper_response_dto_1.mapWorkingPaperToResponse)(updated);
    }
    async approveWorkingPaper(id, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'working_paper:approve');
        const paper = await this._getPaper(id);
        if (paper.status !== audit_enum_1.WorkingPaperStatus.Submitted)
            throw app_error_1.AppError.badRequest('Only submitted working papers can be approved');
        const approval = await this.approvalService.getApprovalByEntity(workflow_enum_1.WorkflowEntityType.AuditWorkingPaper, id);
        await this.approvalService.approve(approval.id, actor);
        const updated = await this._getPaper(id);
        logger_util_1.logger.info('Audit working paper approved', { workingPaperId: id, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.working_paper.approve', module: 'audit', entityType: 'audit_working_paper', entityId: id });
        return (0, working_paper_response_dto_1.mapWorkingPaperToResponse)(updated);
    }
    async rejectWorkingPaper(id, reason, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'working_paper:reject');
        const paper = await this._getPaper(id);
        if (paper.status !== audit_enum_1.WorkingPaperStatus.Submitted)
            throw app_error_1.AppError.badRequest('Only submitted working papers can be rejected');
        const approval = await this.approvalService.getApprovalByEntity(workflow_enum_1.WorkflowEntityType.AuditWorkingPaper, id);
        await this.approvalService.reject(approval.id, actor, reason);
        const updated = await this._getPaper(id);
        logger_util_1.logger.info('Audit working paper rejected', { workingPaperId: id, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.working_paper.reject', module: 'audit', entityType: 'audit_working_paper', entityId: id, newValues: { reason } });
        return (0, working_paper_response_dto_1.mapWorkingPaperToResponse)(updated);
    }
    async getWorkingPaperById(id) {
        const paper = await prisma_client_1.prisma.audit_Working_Paper.findFirst({
            where: { id, deleted_at: null },
            include: { evidence: true },
        });
        if (!paper)
            throw app_error_1.AppError.notFound('Audit working paper');
        return (0, working_paper_response_dto_1.mapWorkingPaperToResponse)(paper);
    }
    async listWorkingPapers(engagementId) {
        const papers = await prisma_client_1.prisma.audit_Working_Paper.findMany({
            where: { engagement_id: engagementId, deleted_at: null },
            orderBy: { updated_at: 'desc' },
        });
        return papers.map(working_paper_response_dto_1.mapWorkingPaperToResponse);
    }
    async exportWorkingPaper(id, format) {
        const paper = await prisma_client_1.prisma.audit_Working_Paper.findFirst({
            where: { id, deleted_at: null },
            include: {
                engagement: { select: { reference_number: true, title: true } },
                created_by: { select: { display_name: true, email: true } },
            },
        });
        if (!paper)
            throw app_error_1.AppError.notFound('Audit working paper');
        if (paper.status !== audit_enum_1.WorkingPaperStatus.Approved) {
            throw app_error_1.AppError.badRequest('Only approved working papers can be exported');
        }
        const auditorName = paper.created_by.display_name || paper.created_by.email;
        const exportDate = new Date().toISOString().slice(0, 10);
        const slug = paper.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
        const buffer = format === 'pdf'
            ? await this._renderWorkingPaperPdf({
                title: paper.title,
                engagementReference: paper.engagement.reference_number,
                engagementTitle: paper.engagement.title,
                workingPaperType: paper.working_paper_type,
                auditorName,
                status: paper.status,
                version: String(paper.version_number),
                date: exportDate,
                sections: (0, working_paper_utility_1.parseWorkingPaperSections)(paper.content),
            })
            : await this.documentService.renderDocxTemplate('working_paper', {
                title: paper.title,
                engagementReference: paper.engagement.reference_number,
                engagementTitle: paper.engagement.title,
                auditorName,
                date: exportDate,
                status: paper.status,
                version: String(paper.version_number),
                content: paper.content,
            });
        logger_util_1.logger.info('Working paper exported', { workingPaperId: id, format });
        return {
            fileName: `${slug}-working-paper.${format}`,
            mimeType: format === 'pdf'
                ? 'application/pdf'
                : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            buffer,
        };
    }
    async _renderWorkingPaperPdf(data) {
        const html = (0, working_paper_utility_1.buildWorkingPaperHtml)(data);
        const browser = await puppeteer_1.default.launch({ headless: true });
        try {
            const page = await browser.newPage();
            await page.setContent(html, { waitUntil: 'networkidle0' });
            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: { top: '20mm', bottom: '20mm', left: '18mm', right: '18mm' },
                displayHeaderFooter: true,
                headerTemplate: '<div></div>',
                footerTemplate: '<div style="font-size:9px;width:100%;text-align:center;color:#64748B;padding:0 18mm;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
            });
            return Buffer.from(pdfBuffer);
        }
        finally {
            await browser.close();
        }
    }
    async _assertEngagementInProgress(engagementId) {
        const engagement = await prisma_client_1.prisma.audit_Engagement.findFirst({
            where: { id: engagementId, deleted_at: null },
            select: { status: true },
        });
        if (!engagement)
            throw app_error_1.AppError.notFound('Audit engagement');
        if (engagement.status !== audit_enum_1.EngagementStatus.InProgress)
            throw app_error_1.AppError.badRequest('Engagement must be in progress');
    }
    async _getEngagementForWorkingPaperImport(engagementId) {
        const engagement = await prisma_client_1.prisma.audit_Engagement.findFirst({
            where: { id: engagementId, deleted_at: null },
            select: { status: true, audit_type: true },
        });
        if (!engagement)
            throw app_error_1.AppError.notFound('Audit engagement');
        if (engagement.status !== audit_enum_1.EngagementStatus.InProgress)
            throw app_error_1.AppError.badRequest('Engagement must be in progress');
        return { audit_type: engagement.audit_type };
    }
    async _resolveImportTemplate(templateId, auditType) {
        if (templateId)
            return this.templateService.getTemplateById(templateId);
        try {
            return await this.templateService.getDefaultTemplate(auditType);
        }
        catch {
            try {
                return await this.templateService.getDefaultTemplate('all');
            }
            catch {
                return null;
            }
        }
    }
    async _assertOptionalImportReferences(templateId, sourceDocumentId) {
        if (templateId) {
            const template = await prisma_client_1.prisma.working_Paper_Template.findFirst({
                where: { id: templateId, deleted_at: null, is_active: true },
                select: { id: true },
            });
            if (!template)
                throw app_error_1.AppError.notFound('Working paper template');
        }
        if (sourceDocumentId) {
            const document = await prisma_client_1.prisma.document.findFirst({
                where: { id: sourceDocumentId, deleted_at: null },
                select: { id: true },
            });
            if (!document)
                throw app_error_1.AppError.notFound('Source document');
        }
    }
    _suggestTitle(originalName, templateName) {
        const baseName = originalName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
        if (baseName)
            return baseName.slice(0, 200);
        return (templateName ? `${templateName} Import` : 'Imported working paper').slice(0, 200);
    }
    async _getPaper(id) {
        const paper = await prisma_client_1.prisma.audit_Working_Paper.findFirst({ where: { id, deleted_at: null } });
        if (!paper)
            throw app_error_1.AppError.notFound('Audit working paper');
        return paper;
    }
    async _getPaperWithEngagement(id) {
        const paper = await prisma_client_1.prisma.audit_Working_Paper.findFirst({
            where: { id, deleted_at: null },
            include: { engagement: true },
        });
        if (!paper)
            throw app_error_1.AppError.notFound('Audit working paper');
        return paper;
    }
}
exports.WorkingPaperService = WorkingPaperService;
//# sourceMappingURL=working-paper.service.js.map