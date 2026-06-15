import { EvidenceResponseDto, mapEvidenceToResponse } from '../../../evidence/dto/response/evidence.response.dto';
import { FollowUpResponseDto, mapFollowUpToResponse } from '../../../follow-up/dto/response/follow-up.response.dto';
export interface FindingResponseDto {
    id: string;
    engagementId: string;
    engagementReference?: string;
    workingPaperId: string | null;
    checklistId: string | null;
    controlReference?: string;
    controlDescription?: string;
    riskId: string | null;
    riskTitle?: string;
    title: string;
    description: string;
    category: string;
    severity: string;
    rootCause: string;
    riskImplication: string;
    recommendation: string;
    auditeeId: string;
    auditeeName?: string;
    status: string;
    dueDate: string;
    createdById: string;
    createdByName?: string;
    closedById: string | null;
    closedAt: string | null;
    createdAt: string;
    updatedAt: string;
    evidence?: EvidenceResponseDto[];
    followUp?: FollowUpResponseDto | null;
}
declare const formatUserName: (user?: {
    display_name: string | null;
    first_name: string;
    last_name: string;
    email: string;
}) => string | undefined;
export declare const mapFindingToResponse: (finding: {
    id: string;
    engagement_id: string;
    engagement?: {
        reference_number: string;
    };
    working_paper_id: string | null;
    checklist_id: string | null;
    checklist?: {
        control_reference: string;
        control_description: string;
    } | null;
    risk_id: string | null;
    risk?: {
        title: string;
    } | null;
    title: string;
    description: string;
    category: string;
    severity: string;
    root_cause: string;
    risk_implication: string;
    recommendation: string;
    auditee_id: string;
    auditee?: Parameters<typeof formatUserName>[0];
    status: string;
    due_date: Date;
    created_by_id: string;
    created_by?: Parameters<typeof formatUserName>[0];
    closed_by_id: string | null;
    closed_at: Date | null;
    created_at: Date;
    updated_at: Date;
    evidence?: Array<Parameters<typeof mapEvidenceToResponse>[0]>;
    follow_up?: Parameters<typeof mapFollowUpToResponse>[0] | null;
}) => FindingResponseDto;
export {};
//# sourceMappingURL=finding.response.dto.d.ts.map