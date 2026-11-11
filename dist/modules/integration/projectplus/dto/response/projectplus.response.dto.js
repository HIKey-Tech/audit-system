"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapProjectPlusLinkToResponse = void 0;
const mapProjectPlusLinkToResponse = (l) => ({
    id: l.id,
    engagementId: l.engagement_id,
    customerType: l.customer_type,
    referenceCode: l.reference_code,
    fullName: l.full_name,
    entityType: l.entity_type,
    entitySubType: l.entity_sub_type,
    rcNumber: l.rc_number,
    tin: l.tin,
    lastStatus: l.last_status,
    lastSyncedAt: l.last_synced_at ? l.last_synced_at.toISOString() : null,
    isActive: l.is_active,
    createdAt: l.created_at.toISOString(),
    updatedAt: l.updated_at.toISOString(),
});
exports.mapProjectPlusLinkToResponse = mapProjectPlusLinkToResponse;
//# sourceMappingURL=projectplus.response.dto.js.map