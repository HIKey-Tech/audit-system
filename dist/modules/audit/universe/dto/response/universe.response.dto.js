"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapUniverseToResponse = void 0;
const audit_utility_1 = require("../../../utility/audit.utility");
const formatOwnerName = (user) => user ? (user.display_name ?? `${user.first_name} ${user.last_name}`.trim()) || null : null;
const mapUniverseToResponse = (entity) => {
    const seen = new Set([entity.owner_id]);
    const owners = [
        {
            id: entity.owner_id,
            name: formatOwnerName(entity.owner),
            isPrimary: true,
        },
    ];
    for (const extra of entity.additional_owners ?? []) {
        if (!extra.user_id || seen.has(extra.user_id))
            continue;
        seen.add(extra.user_id);
        owners.push({
            id: extra.user_id,
            name: formatOwnerName(extra.user),
            isPrimary: false,
        });
    }
    return {
        id: entity.id,
        name: entity.name,
        description: entity.description,
        category: entity.category,
        ownerId: entity.owner_id,
        ownerName: formatOwnerName(entity.owner),
        ownerIds: owners.map((o) => o.id),
        owners,
        riskScore: (0, audit_utility_1.decimalToNumber)(entity.risk_score),
        lastAuditedAt: (0, audit_utility_1.toIso)(entity.last_audited_at),
        auditFrequency: entity.audit_frequency,
        status: entity.status,
        createdById: entity.created_by_id,
        createdAt: entity.created_at.toISOString(),
        updatedAt: entity.updated_at.toISOString(),
    };
};
exports.mapUniverseToResponse = mapUniverseToResponse;
//# sourceMappingURL=universe.response.dto.js.map