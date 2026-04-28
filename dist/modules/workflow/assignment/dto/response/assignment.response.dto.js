"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapAssignmentToResponse = void 0;
const engagement_response_dto_1 = require("../../../../audit/engagement/dto/response/engagement.response.dto");
const approval_response_dto_1 = require("../../../approval/dto/response/approval.response.dto");
const mapAssignmentToResponse = (assignment) => ({
    id: assignment.id,
    engagementId: assignment.engagement_id,
    userId: assignment.user_id,
    role: assignment.role,
    assignedById: assignment.assigned_by_id,
    assignedAt: assignment.assigned_at.toISOString(),
    createdAt: assignment.created_at.toISOString(),
    user: assignment.user ? (0, approval_response_dto_1.mapWorkflowUserBrief)(assignment.user) : undefined,
    assignedBy: assignment.assigned_by ? (0, approval_response_dto_1.mapWorkflowUserBrief)(assignment.assigned_by) : undefined,
    engagement: assignment.engagement ? (0, engagement_response_dto_1.mapEngagementToResponse)(assignment.engagement) : undefined,
});
exports.mapAssignmentToResponse = mapAssignmentToResponse;
//# sourceMappingURL=assignment.response.dto.js.map