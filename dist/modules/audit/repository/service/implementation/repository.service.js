"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepositoryService = void 0;
const prisma_client_1 = require("../../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../../shared/errors/app.error");
const api_response_type_1 = require("../../../../../shared/types/api-response.type");
const audit_log_service_1 = require("../../../../logging/service/implementation/audit-log.service");
const audit_utility_1 = require("../../../utility/audit.utility");
const repository_response_dto_1 = require("../../dto/response/repository.response.dto");
class RepositoryService {
    documentService;
    constructor(documentService) {
        this.documentService = documentService;
    }
    async list(query, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'engagement:read');
        const { skip, take, page, pageSize } = (0, api_response_type_1.parsePagination)(query);
        const entityTypes = query.category && query.category !== 'all'
            ? repository_response_dto_1.REPOSITORY_CATEGORY_ENTITY_TYPES[query.category]
            : repository_response_dto_1.ALL_REPOSITORY_ENTITY_TYPES;
        const where = {
            deleted_at: null,
            module: 'audit',
            entity_type: { in: entityTypes },
            ...(query.search && { original_name: { contains: query.search } }),
        };
        const [total, docs] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.document.count({ where }),
            prisma_client_1.prisma.document.findMany({
                where,
                orderBy: { created_at: 'desc' },
                skip,
                take,
                select: {
                    id: true,
                    original_name: true,
                    mime_type: true,
                    file_size: true,
                    entity_type: true,
                    entity_id: true,
                    created_at: true,
                    uploaded_by: { select: { id: true, first_name: true, last_name: true, display_name: true } },
                },
            }),
        ]);
        const engagementByDoc = await this._resolveEngagements(docs);
        const items = docs.map((doc) => ({
            id: doc.id,
            fileName: doc.original_name,
            mimeType: doc.mime_type,
            fileSize: doc.file_size,
            category: (0, repository_response_dto_1.categoryForEntityType)(doc.entity_type),
            entityType: doc.entity_type,
            uploadedAt: doc.created_at.toISOString(),
            uploadedBy: doc.uploaded_by
                ? {
                    id: doc.uploaded_by.id,
                    name: doc.uploaded_by.display_name ?? `${doc.uploaded_by.first_name} ${doc.uploaded_by.last_name}`,
                }
                : null,
            engagement: engagementByDoc.get(doc.id) ?? null,
        }));
        return { items, meta: (0, api_response_type_1.buildPaginationMeta)(total, page, pageSize) };
    }
    async getFile(documentId, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'engagement:read');
        // Scope to audit-module documents so engagement:read cannot pull arbitrary files.
        const doc = await prisma_client_1.prisma.document.findFirst({
            where: { id: documentId, module: 'audit', deleted_at: null },
            select: { id: true },
        });
        if (!doc)
            throw app_error_1.AppError.notFound('Document');
        const file = await this.documentService.getFileById(documentId);
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.repository.download', module: 'audit', entityType: 'document', entityId: documentId });
        return file;
    }
    /**
     * Resolve the owning engagement for a page of documents. Evidence and
     * working-paper-source docs store the engagement id directly; reports,
     * snapshots and follow-up evidence store a child entity id that we batch
     * back to its engagement. Bounded by page size — a handful of indexed
     * lookups, never N+1.
     */
    async _resolveEngagements(docs) {
        const engIdByDoc = new Map();
        const reportRefs = [];
        const paperRefs = [];
        const findingRefs = [];
        for (const doc of docs) {
            if (!doc.entity_id)
                continue;
            if (doc.entity_type === 'audit_engagement' || doc.entity_type === 'audit_working_paper_source') {
                engIdByDoc.set(doc.id, doc.entity_id);
            }
            else if (doc.entity_type === 'audit_report') {
                reportRefs.push({ doc: doc.id, ent: doc.entity_id });
            }
            else if (doc.entity_type === 'audit_working_paper_snapshot') {
                paperRefs.push({ doc: doc.id, ent: doc.entity_id });
            }
            else if (doc.entity_type === 'audit_follow_up_evidence') {
                findingRefs.push({ doc: doc.id, ent: doc.entity_id });
            }
        }
        const [reports, papers, findings] = await Promise.all([
            reportRefs.length
                ? prisma_client_1.prisma.audit_Report.findMany({ where: { id: { in: reportRefs.map((r) => r.ent) } }, select: { id: true, engagement_id: true } })
                : Promise.resolve([]),
            paperRefs.length
                ? prisma_client_1.prisma.audit_Working_Paper.findMany({ where: { id: { in: paperRefs.map((r) => r.ent) } }, select: { id: true, engagement_id: true } })
                : Promise.resolve([]),
            findingRefs.length
                ? prisma_client_1.prisma.audit_Finding.findMany({ where: { id: { in: findingRefs.map((r) => r.ent) } }, select: { id: true, engagement_id: true } })
                : Promise.resolve([]),
        ]);
        const link = (rows, refs) => {
            const byId = new Map(rows.map((r) => [r.id, r.engagement_id]));
            for (const ref of refs) {
                const engId = byId.get(ref.ent);
                if (engId)
                    engIdByDoc.set(ref.doc, engId);
            }
        };
        link(reports, reportRefs);
        link(papers, paperRefs);
        link(findings, findingRefs);
        const engIds = [...new Set(engIdByDoc.values())];
        const engagements = engIds.length
            ? await prisma_client_1.prisma.audit_Engagement.findMany({
                where: { id: { in: engIds } },
                select: { id: true, reference_number: true, title: true },
            })
            : [];
        const engMap = new Map(engagements.map((e) => [e.id, { id: e.id, referenceNumber: e.reference_number, title: e.title }]));
        const result = new Map();
        for (const [docId, engId] of engIdByDoc) {
            const ref = engMap.get(engId);
            if (ref)
                result.set(docId, ref);
        }
        return result;
    }
}
exports.RepositoryService = RepositoryService;
//# sourceMappingURL=repository.service.js.map