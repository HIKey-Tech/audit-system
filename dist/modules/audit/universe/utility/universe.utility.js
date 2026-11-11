"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listUniverseReferenceBlockers = exports.resolveUniverseOwners = void 0;
const dedupePreserveOrder = (ids) => {
    const seen = new Set();
    const out = [];
    for (const id of ids) {
        if (id && !seen.has(id)) {
            seen.add(id);
            out.push(id);
        }
    }
    return out;
};
/**
 * Resolves either unified `ownerIds` (`[primary, ...coOwners]`) or explicit
 * `ownerId` + `additionalOwnerIds` into a deduplicated primary + co-owner list.
 */
const resolveUniverseOwners = (input, existing) => {
    if (input.ownerIds !== undefined) {
        const unique = dedupePreserveOrder(input.ownerIds);
        if (unique.length === 0)
            return null;
        return {
            primaryOwnerId: unique[0],
            additionalOwnerIds: unique.slice(1),
        };
    }
    if (input.ownerId === undefined && input.additionalOwnerIds === undefined) {
        return null;
    }
    const primaryOwnerId = input.ownerId ?? existing?.primaryOwnerId;
    if (!primaryOwnerId)
        return null;
    const baseAdditional = input.additionalOwnerIds ?? existing?.additionalOwnerIds ?? [];
    const additionalOwnerIds = dedupePreserveOrder(baseAdditional).filter((id) => id !== primaryOwnerId);
    return { primaryOwnerId, additionalOwnerIds };
};
exports.resolveUniverseOwners = resolveUniverseOwners;
/** Formats non-zero downstream link counts into human-readable blocker clauses. */
const listUniverseReferenceBlockers = (counts) => {
    const parts = [];
    if (counts.planItems > 0) {
        parts.push(`${counts.planItems} audit plan item${counts.planItems === 1 ? '' : 's'}`);
    }
    if (counts.engagements > 0) {
        parts.push(`${counts.engagements} engagement${counts.engagements === 1 ? '' : 's'}`);
    }
    if (counts.risks > 0) {
        parts.push(`${counts.risks} linked risk${counts.risks === 1 ? '' : 's'}`);
    }
    if (counts.assets > 0) {
        parts.push(`${counts.assets} linked asset${counts.assets === 1 ? '' : 's'}`);
    }
    if (counts.systemDocs > 0) {
        parts.push(`${counts.systemDocs} system document${counts.systemDocs === 1 ? '' : 's'}`);
    }
    return parts;
};
exports.listUniverseReferenceBlockers = listUniverseReferenceBlockers;
//# sourceMappingURL=universe.utility.js.map