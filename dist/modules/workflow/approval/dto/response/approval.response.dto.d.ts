import { WorkflowUserBrief } from '../../../domain/entity/workflow.entity';
interface WorkflowUserLike {
    id: string;
    email: string;
    display_name: string | null;
    first_name: string;
    last_name: string;
    department: string | null;
    job_title: string | null;
}
export interface ApprovalStepResponseDto {
    id: string;
    approvalId: string;
    level: number;
    approverId: string | null;
    requiredPermission: string | null;
    status: string;
    comment: string | null;
    actedAt: string | null;
    signatureId: string | null;
    createdAt: string;
    approver?: WorkflowUserBrief;
}
export interface SignedApprovalDocumentDto {
    id: string;
    signedDocumentId: string;
    downloadUrl: string;
    generatedAt: string;
}
export interface ApprovalResponseDto {
    id: string;
    entityType: string;
    entityId: string;
    submittedById: string;
    currentLevel: number;
    status: string;
    rejectionReason: string | null;
    completedAt: string | null;
    createdAt: string;
    updatedAt: string;
    submittedBy?: WorkflowUserBrief;
    steps?: ApprovalStepResponseDto[];
}
export declare const mapWorkflowUserBrief: (user: WorkflowUserLike) => WorkflowUserBrief;
export declare const mapApprovalStepToResponse: (step: {
    id: string;
    approval_id: string;
    level: number;
    approver_id: string | null;
    required_permission: string | null;
    status: string;
    comment: string | null;
    acted_at: Date | null;
    signature_id?: string | null;
    created_at: Date;
    approver?: WorkflowUserLike | null;
}) => ApprovalStepResponseDto;
export declare const mapApprovalToResponse: (approval: {
    id: string;
    entity_type: string;
    entity_id: string;
    submitted_by_id: string;
    current_level: number;
    status: string;
    rejection_reason: string | null;
    completed_at: Date | null;
    created_at: Date;
    updated_at: Date;
    submitted_by?: WorkflowUserLike;
    steps?: Array<Parameters<typeof mapApprovalStepToResponse>[0]>;
}) => ApprovalResponseDto;
export {};
//# sourceMappingURL=approval.response.dto.d.ts.map