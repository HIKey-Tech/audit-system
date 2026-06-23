"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapMappingToResponse = void 0;
const mapMappingToResponse = (m) => ({
    id: m.id,
    adGroupId: m.adGroupId,
    adGroupName: m.adGroupName,
    roleId: m.roleId,
    roleName: m.roleName,
    isActive: m.isActive,
    createdAt: m.createdAt.toISOString(),
});
exports.mapMappingToResponse = mapMappingToResponse;
//# sourceMappingURL=directory.response.dto.js.map