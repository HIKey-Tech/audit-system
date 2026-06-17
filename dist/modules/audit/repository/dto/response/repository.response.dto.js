"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoryForEntityType = exports.ALL_REPOSITORY_ENTITY_TYPES = exports.REPOSITORY_CATEGORY_ENTITY_TYPES = void 0;
/**
 * Maps each repository category to the underlying Document.entity_type values.
 * This is the single place that encodes "what counts as a record / supporting
 * document / evidence" — keep it in sync with the audit upload call-sites.
 */
exports.REPOSITORY_CATEGORY_ENTITY_TYPES = {
    audit_record: ['audit_report', 'audit_working_paper_snapshot'],
    supporting_document: ['audit_working_paper_source'],
    evidence: ['audit_engagement', 'audit_follow_up_evidence'],
};
exports.ALL_REPOSITORY_ENTITY_TYPES = Object.values(exports.REPOSITORY_CATEGORY_ENTITY_TYPES).flat();
const ENTITY_TYPE_TO_CATEGORY = Object.entries(exports.REPOSITORY_CATEGORY_ENTITY_TYPES).reduce((acc, [category, types]) => {
    for (const type of types)
        acc[type] = category;
    return acc;
}, {});
const categoryForEntityType = (entityType) => (entityType && ENTITY_TYPE_TO_CATEGORY[entityType]) || 'other';
exports.categoryForEntityType = categoryForEntityType;
//# sourceMappingURL=repository.response.dto.js.map