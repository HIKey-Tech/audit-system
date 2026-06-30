"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapUniverseToResponse = void 0;
const audit_utility_1 = require("../../../utility/audit.utility");
const mapUniverseToResponse = (entity) => ({
    id: entity.id,
    name: entity.name,
    description: entity.description,
    category: entity.category,
    ownerId: entity.owner_id,
    ownerName: entity.owner
        ? entity.owner.display_name ?? `${entity.owner.first_name} ${entity.owner.last_name}`.trim()
        : null,
    riskScore: (0, audit_utility_1.decimalToNumber)(entity.risk_score),
    lastAuditedAt: (0, audit_utility_1.toIso)(entity.last_audited_at),
    auditFrequency: entity.audit_frequency,
    status: entity.status,
    createdById: entity.created_by_id,
    createdAt: entity.created_at.toISOString(),
    updatedAt: entity.updated_at.toISOString(),
});
exports.mapUniverseToResponse = mapUniverseToResponse;
//# sourceMappingURL=universe.response.dto.js.map