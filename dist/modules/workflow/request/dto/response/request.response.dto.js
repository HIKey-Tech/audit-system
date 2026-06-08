"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapRequestToResponse = exports.mapRequestActionToResponse = exports.mapRequestStepToResponse = void 0;
const approval_response_dto_1 = require("../../../approval/dto/response/approval.response.dto");
const mapRequestStepToResponse = (step) => ({
    id: step.id,
    requestId: step.request_id,
    level: step.level,
    recipientId: step.recipient_id,
    status: step.status,
    actedAt: step.acted_at?.toISOString() ?? null,
    createdAt: step.created_at.toISOString(),
    recipient: step.recipient ? (0, approval_response_dto_1.mapWorkflowUserBrief)(step.recipient) : undefined,
});
exports.mapRequestStepToResponse = mapRequestStepToResponse;
const mapRequestActionToResponse = (action) => ({
    id: action.id,
    requestId: action.request_id,
    stepId: action.step_id,
    actorId: action.actor_id,
    actionType: action.action_type,
    comment: action.comment,
    signatureHash: action.signature_hash,
    createdAt: action.created_at.toISOString(),
    actor: action.actor ? (0, approval_response_dto_1.mapWorkflowUserBrief)(action.actor) : undefined,
});
exports.mapRequestActionToResponse = mapRequestActionToResponse;
const mapRequestToResponse = (request, attachments) => ({
    id: request.id,
    referenceNumber: request.reference_number,
    title: request.title,
    description: request.description,
    initiatorId: request.initiator_id,
    currentLevel: request.current_level,
    status: request.status,
    lockedAt: request.locked_at?.toISOString() ?? null,
    createdAt: request.created_at.toISOString(),
    updatedAt: request.updated_at.toISOString(),
    initiator: request.initiator ? (0, approval_response_dto_1.mapWorkflowUserBrief)(request.initiator) : undefined,
    steps: request.steps?.map(exports.mapRequestStepToResponse),
    actions: request.actions?.map(exports.mapRequestActionToResponse),
    attachments,
});
exports.mapRequestToResponse = mapRequestToResponse;
//# sourceMappingURL=request.response.dto.js.map